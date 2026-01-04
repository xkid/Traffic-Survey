import React, { useState, useRef, useEffect } from 'react';
import { ROI, Point, Vector } from '../types';

interface VideoPlayerROIProps {
  videoUrl: string;
  onRoiChange: (roi: ROI, width: number, height: number) => void;
  onDirectionChange: (vector: Vector | null) => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
}

export const VideoPlayerROI: React.FC<VideoPlayerROIProps> = ({ 
  videoUrl, 
  onRoiChange, 
  onDirectionChange,
  videoRef, 
  canvasRef 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // ROI State
  const [points, setPoints] = useState<Point[]>([]);
  const [isClosed, setIsClosed] = useState(false);
  
  // Direction State
  const [flowStart, setFlowStart] = useState<Point | null>(null);
  const [flowEnd, setFlowEnd] = useState<Point | null>(null);
  const [isDirectionSet, setIsDirectionSet] = useState(false);

  const [mousePos, setMousePos] = useState<Point | null>(null);

  const getCoordinates = (e: React.MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleClick = (e: React.MouseEvent) => {
    const coords = getCoordinates(e);

    // Phase 1: Draw Polygon
    if (!isClosed) {
        if (points.length >= 2) {
            const startPoint = points[0];
            const dist = Math.sqrt(
                Math.pow(coords.x - startPoint.x, 2) + Math.pow(coords.y - startPoint.y, 2)
            );

            // Close loop
            if (dist < 20) {
                setIsClosed(true);
                setMousePos(null);
                if (videoRef.current) {
                    onRoiChange(points, videoRef.current.offsetWidth, videoRef.current.offsetHeight);
                }
                return;
            }
        }
        setPoints([...points, coords]);
        return;
    }

    // Phase 2: Draw Direction
    if (!isDirectionSet) {
        if (!flowStart) {
            setFlowStart(coords);
        } else {
            setFlowEnd(coords);
            setIsDirectionSet(true);
            setMousePos(null);
            onDirectionChange({ start: flowStart, end: coords });
        }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isClosed && isDirectionSet) return;
    setMousePos(getCoordinates(e));
  };

  const handleReset = () => {
    setPoints([]);
    setIsClosed(false);
    setFlowStart(null);
    setFlowEnd(null);
    setIsDirectionSet(false);
    setMousePos(null);
    if (videoRef.current) {
      onRoiChange([], videoRef.current.offsetWidth, videoRef.current.offsetHeight);
      onDirectionChange(null);
    }
  };

  // Generate SVG path string for the polygon
  const getPolygonPath = () => {
    if (points.length === 0) return '';
    return points.map(p => `${p.x},${p.y}`).join(' ');
  };

  const getLinePath = () => {
    if (points.length === 0) return '';
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }
    return path;
  };

  // Sync canvas size
  useEffect(() => {
    if (containerRef.current && canvasRef?.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        canvasRef.current.width = clientWidth;
        canvasRef.current.height = clientHeight;
    }
  }, [videoUrl, canvasRef]);

  return (
    <div className="relative w-full max-w-3xl mx-auto shadow-lg rounded-lg overflow-hidden bg-black select-none" ref={containerRef}>
      <video
        ref={videoRef}
        src={videoUrl}
        playsInline
        muted
        controls={isClosed && isDirectionSet} 
        className="w-full block" 
        crossOrigin="anonymous"
      />
      
      {/* Visualization Canvas */}
      <canvas 
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* SVG Overlay */}
      <svg 
        className={`absolute inset-0 w-full h-full z-10 ${isClosed && isDirectionSet ? 'pointer-events-none' : 'cursor-crosshair'}`}
        onMouseDown={!(isClosed && isDirectionSet) ? handleClick : undefined}
        onMouseMove={!(isClosed && isDirectionSet) ? handleMouseMove : undefined}
      >
        <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#00FF00" />
            </marker>
        </defs>

        {/* Polygon */}
        {isClosed && (
          <polygon 
            points={getPolygonPath()} 
            fill="rgba(255, 0, 0, 0.1)" 
            stroke="red" 
            strokeWidth="2" 
          />
        )}
        {!isClosed && points.length > 0 && (
          <>
            <path d={getLinePath()} fill="none" stroke="red" strokeWidth="2" />
            {mousePos && (
              <line 
                x1={points[points.length - 1].x} 
                y1={points[points.length - 1].y} 
                x2={mousePos.x} 
                y2={mousePos.y} 
                stroke="rgba(255, 0, 0, 0.5)" 
                strokeWidth="2" 
                strokeDasharray="4"
              />
            )}
          </>
        )}
        {points.map((p, i) => (
          <circle 
            key={i} 
            cx={p.x} 
            cy={p.y} 
            r={i === 0 && !isClosed ? 6 : 4} 
            fill={i === 0 && !isClosed ? "yellow" : "white"} 
            stroke="red" 
            strokeWidth="1" 
          />
        ))}

        {/* Direction Arrow */}
        {isClosed && !isDirectionSet && flowStart && mousePos && (
             <line 
                x1={flowStart.x} y1={flowStart.y}
                x2={mousePos.x} y2={mousePos.y}
                stroke="#00FF00" strokeWidth="4"
                markerEnd="url(#arrowhead)"
             />
        )}
        {isClosed && isDirectionSet && flowStart && flowEnd && (
             <line 
                x1={flowStart.x} y1={flowStart.y}
                x2={flowEnd.x} y2={flowEnd.y}
                stroke="#00FF00" strokeWidth="4"
                markerEnd="url(#arrowhead)"
                opacity="0.6"
             />
        )}
      </svg>

      {/* Info Overlay */}
      <div className="absolute top-2 right-2 flex flex-col gap-2 z-20">
        <button 
          onClick={handleReset}
          className="bg-white text-gray-800 text-xs px-3 py-1 rounded shadow hover:bg-gray-100 font-semibold pointer-events-auto"
        >
          Reset All
        </button>
      </div>

      <div className="absolute top-2 left-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded pointer-events-none z-20">
        {!isClosed 
          ? (points.length === 0 ? "1. Click to define detection zone." : "1. Click points. Click yellow start to close.") 
          : !isDirectionSet 
             ? (!flowStart ? "2. Click START point of traffic flow." : "2. Click END point of traffic flow.")
             : "Setup Complete. Ready to Survey."}
      </div>
    </div>
  );
};