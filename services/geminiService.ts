import "@tensorflow/tfjs";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import { ROI, SurveyRow, Point, SurveyStatus, Vector, RealTimeStats } from "../types";

// Ray-casting algorithm for point in polygon
function isPointInPolygon(point: Point, vs: Point[]) {
    const x = point.x, y = point.y;
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        const xi = vs[i].x, yi = vs[i].y;
        const xj = vs[j].x, yj = vs[j].y;
        const intersect = ((yi > y) !== (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

interface TrackedVehicle {
    id: number;
    lastX: number;
    lastY: number;
    width: number;  // Store exact dimensions
    height: number; // Store exact dimensions
    speed: number;
    framesSeen: number;
    isStopped: boolean;
    missingFrames: number;
    wrongWay: boolean; 
    hasJoinedQueue: boolean; // NEW: Track if this vehicle has been counted in queue
}

export class TrafficSurveySession {
  private model: cocoSsd.ObjectDetection | null = null;
  private onRowCallback: ((row: Partial<SurveyRow>) => void) | null = null;
  private onStatsCallback: ((stats: RealTimeStats) => void) | null = null;
  private onErrorCallback: ((err: Error) => void) | null = null;
  public isConnected: boolean = false;
  
  // Config
  private roi: ROI = [];
  private directionVector: Vector | null = null;
  private videoDims = { width: 0, height: 0 };

  // Tracking State
  private trackedVehicles: TrackedVehicle[] = [];
  private nextId = 1;
  
  // Cycle State Machine
  private phase: 'RED' | 'GREEN' = 'GREEN';
  private frameCount = 0;
  private cycleData = {
      Ni: 0,
      Nr: 0,
      Ng: 0,
      No: 0,
      arrivals: 0
  };
  private lastPhaseChangeFrame = 0;
  private lastGreenFrameStart = 0;
  
  // Gap Calculation
  private exitTimes: number[] = []; 

  constructor(apiKey: string) {}

  async connect(
      roi: ROI, 
      directionVector: Vector | null,
      videoDims: {width: number, height: number}, 
      onRow: (row: Partial<SurveyRow>) => void, 
      onError: (err: Error) => void,
      onStats: (stats: RealTimeStats) => void
  ) {
    this.roi = roi;
    this.directionVector = directionVector;
    this.videoDims = videoDims;
    this.onRowCallback = onRow;
    this.onErrorCallback = onError;
    this.onStatsCallback = onStats;
    
    try {
        console.log("Loading TensorFlow model...");
        this.model = await cocoSsd.load();
        this.isConnected = true;
        console.log("Model loaded.");
        if (this.onStatsCallback) {
             this.onStatsCallback({
                 phase: this.phase,
                 totalVisible: 0,
                 queueCount: 0,
                 freeFlowCount: 0,
                 wrongWayCount: 0
             });
        }
    } catch (e: any) {
        console.error("Failed to load model:", e);
        this.isConnected = false;
        if (this.onErrorCallback) this.onErrorCallback(e);
    }
  }

  async detectFrame(video: HTMLVideoElement, canvasCtx?: CanvasRenderingContext2D) {
      if (!this.model || !this.isConnected) return;

      this.frameCount++;

      const predictions = await this.model.detect(video);
      
      const scaleX = this.videoDims.width / video.videoWidth;
      const scaleY = this.videoDims.height / video.videoHeight;

      if (canvasCtx) {
          canvasCtx.clearRect(0, 0, this.videoDims.width, this.videoDims.height);
      }

      const vehicleTypes = ['car', 'truck', 'bus', 'motorcycle'];
      
      // 1. Map raw predictions to ROI-filtered candidates
      const currentCandidates: {x: number, y: number, w: number, h: number, class: string}[] = [];

      predictions.forEach(p => {
          if (!vehicleTypes.includes(p.class)) return;

          const boxX = p.bbox[0] * scaleX;
          const boxY = p.bbox[1] * scaleY;
          const boxW = p.bbox[2] * scaleX;
          const boxH = p.bbox[3] * scaleY;

          const centerX = boxX + boxW / 2;
          const centerY = boxY + boxH / 2;
          
          // STRICTER ROI CHECK: 
          // Check bottom center (wheels) to match ground plane
          const checkPoint = { x: centerX, y: boxY + boxH * 0.9 }; 

          if (isPointInPolygon(checkPoint, this.roi)) {
              currentCandidates.push({
                  x: centerX, y: centerY, w: boxW, h: boxH, class: p.class
              });
          }
      });

      // 2. Update Tracking
      const newTracked: TrackedVehicle[] = [];
      const STOP_THRESHOLD = 0.8; // Pixels/frame. < 0.8 is Stopped.
      const QUEUE_JOIN_THRESHOLD = 2.5; // Pixels/frame. < 2.5 implies joining queue (slow movement)
      const MAX_MISSING_FRAMES = 15; // Persist for ~1.5 seconds if detection lost

      const matchedIds = new Set<number>();

      currentCandidates.forEach(v => {
          let bestMatch: TrackedVehicle | null = null;
          let minDist = 60; 

          this.trackedVehicles.forEach(t => {
              if (matchedIds.has(t.id)) return;
              const dist = Math.sqrt(Math.pow(t.lastX - v.x, 2) + Math.pow(t.lastY - v.y, 2));
              if (dist < minDist) {
                  minDist = dist;
                  bestMatch = t;
              }
          });

          if (bestMatch) {
              matchedIds.add(bestMatch.id);
              
              const dx = v.x - bestMatch.lastX;
              const dy = v.y - bestMatch.lastY;
              const distMoved = Math.sqrt(dx*dx + dy*dy);
              
              // More responsive speed calc for stopping detection
              const speed = (bestMatch.speed * 0.5) + (distMoved * 0.5); 
              const isStopped = speed < STOP_THRESHOLD;

              let wrongWay = bestMatch.wrongWay;
              
              if (this.directionVector && speed > 1.5) {
                  const uDx = this.directionVector.end.x - this.directionVector.start.x;
                  const uDy = this.directionVector.end.y - this.directionVector.start.y;
                  const dot = dx * uDx + dy * uDy;
                  const magV = Math.sqrt(dx*dx + dy*dy);
                  const magU = Math.sqrt(uDx*uDx + uDy*uDy);
                  const cosSim = dot / (magV * magU);
                  
                  if (cosSim < 0.2) {
                      wrongWay = true;
                  } else {
                      wrongWay = false;
                  }
              }

              // --- QUEUE COUNTING LOGIC (Ng) ---
              // If we are in GREEN phase, check if this vehicle joins the queue.
              let joined = bestMatch.hasJoinedQueue;
              
              if (this.phase === 'GREEN' && !joined && !wrongWay) {
                  if (speed < QUEUE_JOIN_THRESHOLD) {
                      joined = true;
                      this.cycleData.arrivals++; // Ng increment
                  }
              }

              newTracked.push({
                  ...bestMatch,
                  lastX: v.x,
                  lastY: v.y,
                  width: v.w,
                  height: v.h,
                  speed: speed,
                  framesSeen: bestMatch.framesSeen + 1,
                  isStopped: isStopped,
                  missingFrames: 0, // Reset missing frames
                  wrongWay: wrongWay,
                  hasJoinedQueue: joined
              });
          } else {
              // New detection
              newTracked.push({
                  id: this.nextId++,
                  lastX: v.x,
                  lastY: v.y,
                  width: v.w,
                  height: v.h,
                  speed: 5, 
                  framesSeen: 1,
                  isStopped: false,
                  missingFrames: 0,
                  wrongWay: false,
                  hasJoinedQueue: false // Wait for speed drop to count
              });
          }
      });

      // Handle Unmatched Vehicles (Persistence & Exit Detection)
      this.trackedVehicles.forEach(t => {
          if (!matchedIds.has(t.id)) {
              if (t.missingFrames < MAX_MISSING_FRAMES) {
                  // Persist vehicle
                  newTracked.push({
                      ...t,
                      missingFrames: t.missingFrames + 1
                  });
              } else {
                  // Vehicle definitely exited or lost
                  if (this.phase === 'GREEN' && !t.wrongWay && !t.isStopped && t.framesSeen > 5) {
                      this.exitTimes.push(this.frameCount);
                  }
              }
          }
      });

      this.trackedVehicles = newTracked;

      // Filter Logic for Stats / Phase Detection
      const validVehicles = this.trackedVehicles.filter(v => !v.wrongWay);

      // Realtime Stats Calculation
      const currentQueueCount = validVehicles.filter(v => v.hasJoinedQueue || v.isStopped).length;
      const currentFreeFlow = validVehicles.filter(v => !v.hasJoinedQueue && !v.isStopped).length;
      const currentWrongWay = this.trackedVehicles.length - validVehicles.length;

      if (this.onStatsCallback) {
          this.onStatsCallback({
              phase: this.phase,
              totalVisible: this.trackedVehicles.length,
              queueCount: currentQueueCount,
              freeFlowCount: currentFreeFlow,
              wrongWayCount: currentWrongWay
          });
      }

      // Visualization
      if (canvasCtx) {
          this.trackedVehicles.forEach(v => {
             // Skip drawing if missing frames > 2 to avoid ghosting too much
             if (v.missingFrames > 2) return;

             // Color Code:
             let color = '#10B981'; // Default Green (Free flow)
             if (v.wrongWay) color = '#9CA3AF'; // Gray
             else if (v.isStopped) color = '#EF4444'; // Red
             else if (v.hasJoinedQueue) color = '#F59E0B'; // Orange (Moving but part of queue)
             
             // Draw Bounding Box (Use stored width/height centered on lastX/lastY)
             const x = v.lastX - v.width / 2;
             const y = v.lastY - v.height / 2;

             canvasCtx.strokeStyle = color;
             canvasCtx.lineWidth = 2;
             canvasCtx.strokeRect(x, y, v.width, v.height);
             
             // Draw Text Background for visibility
             const text = `ID:${v.id} ${v.speed.toFixed(1)}`;
             canvasCtx.font = "bold 12px sans-serif";
             const textMetrics = canvasCtx.measureText(text);
             
             canvasCtx.fillStyle = 'rgba(0, 0, 0, 0.7)'; // Semi-transparent black
             canvasCtx.fillRect(x, y - 18, textMetrics.width + 8, 18);

             // Draw Text
             canvasCtx.fillStyle = color;
             canvasCtx.fillText(text, x + 4, y - 4);
          });
      }

      // --- PHASE DETECTION LOGIC ---
      const stoppedCount = validVehicles.filter(v => v.isStopped && v.framesSeen > 3).length;
      const movingCount = validVehicles.length - stoppedCount;
      const total = validVehicles.length;

      const MIN_PHASE_DURATION = 30; 
      const framesSinceChange = this.frameCount - this.lastPhaseChangeFrame;

      if (framesSinceChange > MIN_PHASE_DURATION) {
          if (this.phase === 'GREEN') {
             // Switch to RED if significant stopping
             if (stoppedCount > movingCount && stoppedCount >= 1) {
                 this.triggerPhaseChange('RED');
             }
             else if (stoppedCount >= 2) {
                 this.triggerPhaseChange('RED');
             }
          }
          else if (this.phase === 'RED') {
              // Switch to GREEN if movement resumes
              if (movingCount > stoppedCount) {
                  this.triggerPhaseChange('GREEN');
              }
              else if (total === 0) {
                  this.triggerPhaseChange('GREEN');
              }
          }
      }
  }

  private triggerPhaseChange(newPhase: 'RED' | 'GREEN') {
      console.log(`Phase Switch: ${this.phase} -> ${newPhase}`);
      
      if (newPhase === 'RED') {
          // --- END OF GREEN / START OF RED ---
          // Cycle Completed.
          
          // Calculate Avg Gap
          let avgGapVal = 0;
          if (this.exitTimes.length > 1) {
             this.exitTimes.sort((a,b) => a - b);
             let totalGapFrames = 0;
             let gapsCount = 0;
             for(let i=1; i < this.exitTimes.length; i++) {
                 const gap = this.exitTimes[i] - this.exitTimes[i-1];
                 totalGapFrames += gap;
                 gapsCount++;
             }
             if (gapsCount > 0) {
                 avgGapVal = (totalGapFrames / gapsCount) / 10.0;
             }
          }
          
          // No (Overflow Queue): Vehicles still stopped/queued at end of Green (Start of Red)
          const validVehicles = this.trackedVehicles.filter(v => !v.wrongWay);
          // Strictly, overflow is what is left over.
          // Using 'hasJoinedQueue' ensures we count those who tried to pass but got stuck, 
          // plus those who were stopped.
          const overflow = validVehicles.filter(v => v.hasJoinedQueue && v.isStopped).length;
          
          this.cycleData.No = overflow;

          if (this.onRowCallback) {
              this.onRowCallback({
                  Ni: this.cycleData.Ni,
                  Nr: this.cycleData.Nr,
                  Ng: this.cycleData.arrivals,
                  No: this.cycleData.No,
                  avgGap: avgGapVal > 0 ? avgGapVal.toFixed(1) : '-'
              });
          }

          // Ni for NEXT cycle = No from THIS cycle
          this.cycleData = {
              Ni: overflow,
              Nr: 0, // Will be set at Start of Green
              Ng: 0,
              No: 0,
              arrivals: 0
          };
          this.exitTimes = [];

      } else {
          // --- START OF GREEN ---
          // Snapshot Nr (Queue at Start of Green)
          // Nr = All currently stopped/queued vehicles
          const validVehicles = this.trackedVehicles.filter(v => !v.wrongWay);
          
          // Mark all currently present vehicles as "In Queue" for the new cycle
          // because they are waiting at the red light.
          // This includes stopped vehicles AND those slowly rolling up.
          let queueCount = 0;
          
          validVehicles.forEach(v => {
              if (v.isStopped || v.speed < 2.0) {
                  v.hasJoinedQueue = true;
                  queueCount++;
              } else {
                  v.hasJoinedQueue = false; // Reset for free-flow passers
              }
          });

          this.cycleData.Nr = queueCount;
          this.cycleData.arrivals = 0; // Reset Ng counter
          this.lastGreenFrameStart = this.frameCount;
          this.exitTimes = [];
      }

      this.phase = newPhase;
      this.lastPhaseChangeFrame = this.frameCount;
  }

  disconnect() {
      this.isConnected = false;
      this.model = null; 
      this.trackedVehicles = [];
  }
}