import React, { useRef, useEffect, useState } from 'react';
import { DubinsPathCalculator } from '../../core/math/DubinsPath';

export interface DubinsPathVisualizerProps {
  width?: number;
  height?: number;
  minRadius?: number;
  showPaths?: boolean;
}

const DubinsPathVisualizer: React.FC<DubinsPathVisualizerProps> = ({
  width = 800,
  height = 600,
  minRadius = 30,
  showPaths = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dubins] = useState(() => new DubinsPathCalculator(minRadius));

  // Draw Dubins paths on canvas
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
};

export default DubinsPathVisualizer;
