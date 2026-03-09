import React, { useEffect, useRef, useState } from 'react';

interface Disk {
  id: string;
  center: { x: number; y: number };
  radius: number;
}

interface FlexibleEnvelopeProps {
  disks: Disk[];
  width: number;
  height: number;
  onDiskDrag?: (diskId: string, newPos: { x: number; y: number }) => void;
}

/**
 * Componente de Envolvente Flexible que envuelve dinamicamente a los discos
 * La envolvente es suave y se contrae/agranda cuando se mueven los discos
 */
export const FlexibleEnvelope: React.FC<FlexibleEnvelopeProps> = ({
  disks,
  width,
  height,
  onDiskDrag,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [draggingDisk, setDraggingDisk] = useState<string | null>(null);
  const [diskPositions, setDiskPositions] = useState<Map<string, { x: number; y: number }>>(
    new Map(),
  );

  // Inicializar posiciones de discos
  useEffect(() => {
    const positions = new Map();
    disks.forEach((disk) => {
      positions.set(disk.id, disk.center);
    });
    setDiskPositions(positions);
  }, [disks]);

  // Calcular convex hull de los discos (simplificado)
  const calculateEnvelope = (): Array<{ x: number; y: number }> => {
    if (diskPositions.size === 0) return [];

    const points: Array<{ x: number; y: number; diskId: string; radius: number }> = [];

    // Generar puntos alrededor de cada disco
    disks.forEach((disk) => {
      const pos = diskPositions.get(disk.id) || disk.center;
      const expandedRadius = disk.radius + 10; // Expandir un poco el radio

      // Generar 32 puntos alrededor del circulo
      for (let i = 0; i < 32; i++) {
        const angle = (i / 32) * Math.PI * 2;
        points.push({
          x: pos.x + expandedRadius * Math.cos(angle),
          y: pos.y + expandedRadius * Math.sin(angle),
          diskId: disk.id,
          radius: expandedRadius,
        });
      }
    });

    // Calcular convex hull simplificado
    const hull = grahamScan(points);
    return hull;
  };

  // Algoritmo Graham Scan para convex hull
  const grahamScan = (points: Array<any>): Array<{ x: number; y: number }> => {
    if (points.length < 3) return points;

    // Encontrar punto inferior izquierdo
    let minPoint = points[0];
    for (let i = 1; i < points.length; i++) {
      if (points[i].y > minPoint.y || (points[i].y === minPoint.y && points[i].x < minPoint.x)) {
        minPoint = points[i];
      }
    }

    // Ordenar por angulo polar
    const sortedPoints = points.sort((a, b) => {
      const angleA = Math.atan2(a.y - minPoint.y, a.x - minPoint.x);
      const angleB = Math.atan2(b.y - minPoint.y, b.x - minPoint.x);
      return angleA - angleB;
    });

    const hull: Array<any> = [];
    for (const point of sortedPoints) {
      while (hull.length > 1) {
        const top = hull[hull.length - 1];
        const prev = hull[hull.length - 2];
        const cross = (top.x - prev.x) * (point.y - prev.y) - (top.y - prev.y) * (point.x - prev.x);
        if (cross > 0) {
          hull.pop();
        } else {
          break;
        }
      }
      hull.push(point);
    }

    return hull;
  };

  // Dibujar en canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Limpiar canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Dibujar envolvente
    const envelope = calculateEnvelope();
    if (envelope.length > 0) {
      ctx.beginPath();
      ctx.moveTo(envelope[0].x, envelope[0].y);
      for (let i = 1; i < envelope.length; i++) {
        ctx.lineTo(envelope[i].x, envelope[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(100, 150, 255, 0.1)';
      ctx.fill();
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Suavizar la envolvente con curvas bezier
      ctx.beginPath();
      ctx.strokeStyle = '#1e40af';
      ctx.lineWidth = 3;
      for (let i = 0; i < envelope.length; i++) {
        const current = envelope[i];
        const next = envelope[(i + 1) % envelope.length];
        const midX = (current.x + next.x) / 2;
        const midY = (current.y + next.y) / 2;
        if (i === 0) {
          ctx.moveTo(current.x, current.y);
        }
        ctx.quadraticCurveTo(current.x, current.y, midX, midY);
      }
      ctx.stroke();
    }

    // Dibujar discos
    disks.forEach((disk) => {
      const pos = diskPositions.get(disk.id) || disk.center;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, disk.radius, 0, Math.PI * 2);
      ctx.fillStyle =
        draggingDisk === disk.id ? 'rgba(255, 100, 100, 0.7)' : 'rgba(100, 150, 255, 0.6)';
      ctx.fill();
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Etiqueta
      ctx.fillStyle = '#000000';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(disk.id, pos.x, pos.y);
    });

    // Dibujar info
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Envolvente Flexible - Arrastra los discos', 10, height - 10);
  }, [diskPositions, draggingDisk, width, height, disks]);

  // Manejadores de arrastre
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    for (const disk of disks) {
      const pos = diskPositions.get(disk.id) || disk.center;
      const distance = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
      if (distance <= disk.radius) {
        setDraggingDisk(disk.id);
        break;
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!draggingDisk) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newPositions = new Map(diskPositions);
    newPositions.set(draggingDisk, { x, y });
    setDiskPositions(newPositions);

    if (onDiskDrag) {
      onDiskDrag(draggingDisk, { x, y });
    }
  };

  const handleMouseUp = () => {
    setDraggingDisk(null);
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ border: '2px solid #1f2937', cursor: 'grab' }}
      />
    </div>
  );
};

export default FlexibleEnvelope;
