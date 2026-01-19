import React, { useEffect, useRef, useState } from 'react';
import { Network } from 'vis-network';

interface KnotThumbnailProps {
  nodes: number[];
  edges: [number, number][];
  size?: number;
}

export default function KnotThumbnail({ nodes, edges, size = 70 }: KnotThumbnailProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!divRef.current) return;

    const network = new Network(
      divRef.current,
      {
        nodes: nodes.map(id => ({ id })),
        edges: edges.map(([from, to]) => ({ from, to }))
      },
      {
        physics: false,
        height: `${size}px`,
        width: `${size}px`,
        nodes: { 
          shape: 'dot', 
          size: 8, 
          color: '#8fbfff', 
          borderWidth: 0 
        },
        edges: { 
          color: '#8fbfff', 
          width: 1 
        },
        layout: { improvedLayout: true }
      }
    );

    const captureCanvas = () => {
      const canvas = divRef.current?.querySelector('canvas');
      if (canvas) {
        setImageUrl(canvas.toDataURL('image/png'));
        network.destroy();
      }
    };

    network.once('afterDrawing', captureCanvas);
    const fallbackTimer = setTimeout(captureCanvas, 300);

    return () => {
      clearTimeout(fallbackTimer);
      network.destroy();
    };
  }, [nodes, edges, size]);

  return (
    <>
      <div
        ref={divRef}
        style={{ position: 'absolute', inset: 0, visibility: 'hidden' }}
      />
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="Knot preview"
          width={size}
          height={size}
          style={{ display: 'block', borderRadius: 4 }}
        />
      ) : (
        <div
          style={{
            width: size,
            height: size,
            background: '#f0f0f0',
            borderRadius: 4
          }}
        />
      )}
    </>
  );
}
