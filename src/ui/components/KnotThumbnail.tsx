import { useEffect, useRef, useState } from 'react';
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
    if (!divRef.current || nodes.length === 0) return;

    let network: Network | null = null;

    try {
      network = new Network(
        divRef.current,
        {
          nodes: nodes.map((id) => ({ id })),
          edges: edges.map(([from, to]) => ({ from, to })),
        },
        {
          physics: {
            enabled: true,
            stabilization: {
              iterations: 100,
              updateInterval: 25,
            },
          },
          height: `${size}px`,
          width: `${size}px`,
          nodes: {
            shape: 'dot',
            size: 8,
            color: '#8fbfff',
            borderWidth: 0,
          },
          edges: {
            color: '#8fbfff',
            width: 2,
            smooth: false,
          },
          layout: {
            improvedLayout: true,
          },
          interaction: {
            dragNodes: false,
            dragView: false,
            selectable: false,
            zoomView: false,
          },
        },
      );

      const captureCanvas = () => {
        const canvas = divRef.current?.querySelector('canvas');
        if (canvas && network) {
          setImageUrl(canvas.toDataURL('image/png'));
          network.destroy();
          network = null;
        }
      };

      // Esperar a que la física se estabilice
      network.on('stabilizationIterationsDone', () => {
        setTimeout(captureCanvas, 100);
      });

      // Fallback en caso de que no se estabilice
      const fallbackTimer = setTimeout(captureCanvas, 800);

      return () => {
        clearTimeout(fallbackTimer);
        if (network) {
          network.destroy();
        }
      };
    } catch (error) {
      console.error('Error creating network:', error);
    }
  }, [nodes, edges, size]);

  return (
    <>
      <div
        ref={divRef}
        style={{
          position: 'absolute',
          left: '-9999px',
          top: 0,
          visibility: 'hidden',
        }}
      />
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="Knot preview"
          width={size}
          height={size}
          style={{
            display: 'block',
            borderRadius: 4,
            backgroundColor: '#fff',
          }}
        />
      ) : (
        <div
          style={{
            width: size,
            height: size,
            background: '#f0f0f0',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#999',
            fontSize: '12px',
          }}
        >
          Loading...
        </div>
      )}
    </>
  );
}
