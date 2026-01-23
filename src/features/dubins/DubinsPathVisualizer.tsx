import { useEffect, useRef, useState } from 'react';
import { DubinsPathCalculator } from '@/core/math';

export interface DubinsPathVisualizerProps {
  width?: number;
  height?: number;
  minRadius?: number;
  showPaths?: boolean;
}

export default function DubinsPathVisualizer({
  width = 800,
  height = 600,
  minRadius = 30,
  showPaths = true,
}: DubinsPathVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dubins] = useState(() => new DubinsPathCalculator(minRadius));

  useEffect(() => {
    void dubins;
    void canvasRef;
    // TODO: implement drawing logic.
  }, [dubins, showPaths, width, height]);

  return (
    <div style={{ width, height, border: '1px solid #ccc' }}>
      <canvas ref={canvasRef} width={width} height={height} />
    </div>
  );
}
