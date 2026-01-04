
export interface SurveyRow {
  cycleNumber: number;
  startHour: string | number;
  startMin: string | number;
  startSec: string | number;
  Ni: number; // Queue at Start of RED / GAP WAIT
  Nr: number; // Queue at Start of GREEN / GAP ACCEPT
  Ng: number; // Back of Queue Count
  Nb: number; // Back of Queue (Calculated: Nr + Ng)
  No: number; // Overflow Queue
  avgGap?: string | number; // Average gap in seconds
}

export interface RealTimeStats {
    phase: 'RED' | 'GREEN';
    totalVisible: number;
    queueCount: number; // Vehicles currently in queue (stopped + slowing)
    freeFlowCount: number; // Moving fast
    wrongWayCount: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Vector {
  start: Point;
  end: Point;
}

export type ROI = Point[];

export enum ProcessingState {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  ANALYZING = 'ANALYZING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

export type SurveyStatus = 'RED' | 'GREEN' | 'IDLE';

export type IntersectionType = 'SIGNALISED' | 'UNSIGNALISED';

export interface SurveySettings {
    detectionConfidence: number; // 0.1 - 1.0 (default 0.3)
    iouThreshold: number; // 0.1 - 1.0 (default 0.5)
    stopSpeedThreshold: number; // pixels/frame (default 0.8)
    queueJoinThreshold: number; // pixels/frame (default 2.5)
    maxMissingFrames: number; // frames (default 15)
}
