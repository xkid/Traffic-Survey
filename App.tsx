import React, { useState, useEffect, useRef } from 'react';
import { VideoUploader } from './components/VideoUploader';
import { VideoPlayerROI } from './components/VideoPlayerROI';
import { SurveyForm } from './components/SurveyForm';
import { TrafficSurveySession } from './services/geminiService';
import { ROI, ProcessingState, SurveyRow, SurveyStatus, Vector, RealTimeStats } from './types';

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [roi, setRoi] = useState<ROI | null>(null);
  const [direction, setDirection] = useState<Vector | null>(null);
  const [videoDims, setVideoDims] = useState({ width: 0, height: 0 });
  const [status, setStatus] = useState<ProcessingState>(ProcessingState.IDLE);
  
  // Real-time Stats State
  const [realTimeStats, setRealTimeStats] = useState<RealTimeStats>({
      phase: 'GREEN',
      totalVisible: 0,
      queueCount: 0,
      freeFlowCount: 0,
      wrongWayCount: 0
  });

  const [surveyData, setSurveyData] = useState<SurveyRow[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>("");
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<TrafficSurveySession | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      stopSurvey();
    };
  }, [videoUrl]);

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setVideoUrl(URL.createObjectURL(selectedFile));
    setStatus(ProcessingState.IDLE);
    setSurveyData([]);
    setRoi(null);
    setDirection(null);
    stopSurvey();
  };

  const handleRoiChange = (newRoi: ROI, width: number, height: number) => {
    if (newRoi.length >= 3) {
        setRoi(newRoi);
    } else {
        setRoi(null);
    }
    setVideoDims({ width, height });
  };

  const stopSurvey = () => {
      if (intervalRef.current) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
      }
      if (sessionRef.current) {
          sessionRef.current.disconnect();
          sessionRef.current = null;
      }
      if (videoRef.current) {
          videoRef.current.pause();
      }
      
      // Clear canvas
      if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
  };

  const handleStartSurvey = async () => {
    if (!file || !roi || !videoRef.current) return;
    
    setStatus(ProcessingState.ANALYZING);
    setErrorMsg("");
    setSurveyData([]);
    stopSurvey();

    try {
        sessionRef.current = new TrafficSurveySession("unused_key");
        
        await sessionRef.current.connect(
            roi, 
            direction,
            videoDims,
            (partialRow) => {
                const videoTime = videoRef.current ? videoRef.current.currentTime : 0;
                const minutes = Math.floor(videoTime / 60);
                const seconds = Math.floor(videoTime % 60);
                const nb = (partialRow.Nr || 0) + (partialRow.Ng || 0);

                setSurveyData(prev => {
                    const newRow: SurveyRow = {
                        cycleNumber: prev.length + 1,
                        startHour: 5, 
                        startMin: minutes.toString().padStart(2, '0'),
                        startSec: seconds.toString().padStart(2, '0'),
                        Ni: partialRow.Ni || 0,
                        Nr: partialRow.Nr || 0,
                        Ng: partialRow.Ng || 0,
                        Nb: nb,
                        No: partialRow.No || 0,
                        avgGap: partialRow.avgGap
                    };
                    return [...prev, newRow];
                });
            },
            (err) => {
                console.error("Model Error:", err);
                setErrorMsg("Failed to load detection model.");
                setStatus(ProcessingState.ERROR);
            },
            (stats) => {
                setRealTimeStats(stats);
            }
        );

        // Start Video
        try {
           await videoRef.current.play();
        } catch(e) {
           console.warn("Autoplay prevented", e);
        }

        // Processing Loop
        intervalRef.current = window.setInterval(async () => {
            if (videoRef.current && sessionRef.current && sessionRef.current.isConnected && !videoRef.current.paused && !videoRef.current.ended) {
                // Pass video and ROI canvas context for drawing
                const ctx = canvasRef.current?.getContext('2d');
                await sessionRef.current.detectFrame(videoRef.current, ctx || undefined);
            } else if (videoRef.current && videoRef.current.ended) {
                stopSurvey();
                setStatus(ProcessingState.COMPLETED);
            }
        }, 100); // 10 FPS

    } catch (err) {
        console.error(err);
        setStatus(ProcessingState.ERROR);
        setErrorMsg("System error.");
        stopSurvey();
    }
  };

  const reset = () => {
    stopSurvey();
    setFile(null);
    setVideoUrl(null);
    setSurveyData([]);
    setStatus(ProcessingState.IDLE);
    setRoi(null);
    setDirection(null);
    setRealTimeStats({
        phase: 'GREEN',
        totalVisible: 0,
        queueCount: 0,
        freeFlowCount: 0,
        wrongWayCount: 0
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 py-4 px-6 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-900 text-white p-2 rounded-lg">
            <i className="fas fa-traffic-light text-xl"></i>
          </div>
          <h1 className="text-xl font-bold text-gray-800">Sidra Queue Survey AI (Local)</h1>
        </div>
        {status === ProcessingState.COMPLETED && (
            <button 
                onClick={reset}
                className="text-sm text-gray-500 hover:text-blue-600 font-medium"
            >
                New Survey
            </button>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-8">
        
        {/* Step 1: Upload */}
        {!videoUrl && (
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
             <h2 className="text-lg font-semibold mb-4 text-gray-700">1. Upload Traffic Video</h2>
             <VideoUploader onFileSelect={handleFileSelect} />
          </div>
        )}

        {/* Step 2: Define ROI & Analyze */}
        {videoUrl && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="space-y-4 lg:col-span-2">
               <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                  <div className="flex justify-between items-center mb-2">
                    <h2 className="text-lg font-semibold text-gray-700">2. Define Detection Zone</h2>
                    {roi && <span className="text-xs text-green-600 font-bold bg-green-100 px-2 py-1 rounded">Zone Set</span>}
                    {direction && <span className="text-xs text-blue-600 font-bold bg-blue-100 px-2 py-1 rounded ml-2">Direction Set</span>}
                  </div>
                  <p className="text-sm text-gray-500 mb-4">
                    1. Define Lane Polygon (Red).<br/>
                    2. Define Traffic Flow Direction (Green Arrow).
                  </p>
                  
                  {/* Pass canvasRef to VideoPlayerROI */}
                  <VideoPlayerROI 
                    videoUrl={videoUrl} 
                    onRoiChange={handleRoiChange} 
                    onDirectionChange={setDirection}
                    videoRef={videoRef}
                    canvasRef={canvasRef}
                  />

                  <div className="mt-6 flex justify-end space-x-3">
                    {status === ProcessingState.ANALYZING && (
                        <button
                            onClick={() => {
                                stopSurvey();
                                setStatus(ProcessingState.COMPLETED);
                            }}
                            className="px-6 py-2 rounded-lg font-bold text-red-600 border border-red-200 hover:bg-red-50"
                        >
                            Stop Survey
                        </button>
                    )}
                    
                    {status !== ProcessingState.ANALYZING && (
                        <button
                            onClick={handleStartSurvey}
                            disabled={!roi || !direction}
                            title={!roi || !direction ? "Please set ROI and Direction first" : ""}
                            className={`
                                px-6 py-2 rounded-lg font-bold text-white shadow-md transition-all flex items-center
                                ${!roi || !direction
                                    ? 'bg-gray-400 cursor-not-allowed' 
                                    : 'bg-blue-700 hover:bg-blue-800 hover:shadow-lg'}
                            `}
                        >
                            <i className="fas fa-play mr-2"></i> Start Survey
                        </button>
                    )}
                  </div>
                  
                  {status === ProcessingState.ERROR && (
                      <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                          {errorMsg}
                      </div>
                  )}
               </div>
            </div>
            
            {/* Real-Time Stats & Glossary Side Panel */}
            <div className="space-y-4 lg:col-span-1">
                 {/* Monitor */}
                 <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="font-bold text-gray-800 mb-3 border-b pb-2"><i className="fas fa-desktop mr-2"></i>Live Monitor</h3>
                    
                    <div className={`p-4 rounded-lg text-center mb-4 transition-colors ${realTimeStats.phase === 'RED' ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                         <span className="text-xs uppercase font-bold text-gray-500 block mb-1">Current Phase</span>
                         <span className={`text-2xl font-black ${realTimeStats.phase === 'RED' ? 'text-red-600' : 'text-green-600'}`}>
                             {realTimeStats.phase}
                         </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-50 p-3 rounded border border-gray-100">
                            <span className="text-xs text-gray-500 block">Total Visible</span>
                            <span className="text-lg font-bold text-gray-800">{realTimeStats.totalVisible}</span>
                        </div>
                        <div className="bg-red-50 p-3 rounded border border-red-100">
                             <span className="text-xs text-red-600 block font-bold">In Queue (Stopped/Slow)</span>
                             <span className="text-lg font-bold text-red-700">{realTimeStats.queueCount}</span>
                        </div>
                        <div className="bg-green-50 p-3 rounded border border-green-100">
                             <span className="text-xs text-green-600 block font-bold">Free Flow (Active)</span>
                             <span className="text-lg font-bold text-green-700">{realTimeStats.freeFlowCount}</span>
                        </div>
                        <div className="bg-gray-100 p-3 rounded border border-gray-200">
                             <span className="text-xs text-gray-500 block">Wrong Way (Ignored)</span>
                             <span className="text-lg font-bold text-gray-600">{realTimeStats.wrongWayCount}</span>
                        </div>
                    </div>
                 </div>

                 {/* Glossary / Legend */}
                 <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                     <h3 className="font-bold text-gray-800 mb-3 border-b pb-2"><i className="fas fa-book mr-2"></i>Variable Glossary</h3>
                     <div className="space-y-3 text-sm">
                         <div>
                             <div className="flex items-center mb-1">
                                 <div className="w-3 h-3 bg-red-500 mr-2 rounded-sm"></div>
                                 <span className="font-bold font-mono text-blue-900">Ni (Queue Start Red)</span>
                             </div>
                             <p className="text-gray-500 text-xs pl-5">Initial Overflow Queue from previous cycle. Vehicles still queued when Red starts.</p>
                         </div>
                         <div>
                             <div className="flex items-center mb-1">
                                 <div className="w-3 h-3 bg-orange-500 mr-2 rounded-sm"></div>
                                 <span className="font-bold font-mono text-blue-900">Nr (Queue Start Green)</span>
                             </div>
                             <p className="text-gray-500 text-xs pl-5">Vehicles stopped in queue at the moment Green starts.</p>
                         </div>
                         <div>
                             <div className="flex items-center mb-1">
                                 <div className="w-3 h-3 bg-orange-400 mr-2 rounded-sm"></div>
                                 <span className="font-bold font-mono text-blue-900">Ng (Arrivals)</span>
                             </div>
                             <p className="text-gray-500 text-xs pl-5">Vehicles joining the back of the queue during the Green phase.</p>
                         </div>
                         <div>
                             <div className="flex items-center mb-1">
                                 <div className="w-3 h-3 border-2 border-red-500 mr-2 rounded-sm"></div>
                                 <span className="font-bold font-mono text-blue-900">Nb (Back of Queue)</span>
                             </div>
                             <p className="text-gray-500 text-xs pl-5">Max queue reach. Calculated as Nr + Ng.</p>
                         </div>
                         <div>
                             <div className="flex items-center mb-1">
                                 <div className="w-3 h-3 bg-green-500 mr-2 rounded-sm"></div>
                                 <span className="font-bold font-mono text-blue-900">Free Flow</span>
                             </div>
                             <p className="text-gray-500 text-xs pl-5">Vehicles passing through without stopping (Not counted in Ng).</p>
                         </div>
                     </div>
                 </div>
            </div>

            {/* Step 3: Results */}
            <div className="space-y-4 lg:col-span-3">
                 <div className="animate-fade-in-up">
                    <SurveyForm data={surveyData} />
                 </div>
                 {surveyData.length === 0 && status === ProcessingState.ANALYZING && (
                     <div className="text-center text-gray-500 italic text-sm mt-4 p-4 border border-dashed rounded-lg">
                         <i className="fas fa-car mr-2"></i>
                         Monitoring cycles... Data rows appear when Signal turns RED.
                     </div>
                 )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;