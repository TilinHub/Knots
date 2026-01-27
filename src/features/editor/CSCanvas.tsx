import React from 'react';
import type { CSBlock, CSDisk, Point2D, CSArc } from '@/core/types/cs';
import { findAllCrossings } from '@/core/geometry/intersections';
import { detectRegionsWithDisks } from '@/core/algorithms/regionDetection';
import { type Disk } from '@/core/geometry/diskHull';
import { useDiskHull } from '@/features/editor/hooks/useDiskHull';
import { KnotRenderer } from './components/KnotRenderer';
import type { KnotDiagram } from '@/core/types/knot';


interface CSCanvasProps {
  blocks: CSBlock[];
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  onUpdateBlock: (id: string, updates: Partial<CSBlock>) => void;
  showGrid?: boolean;
  gridSpacing?: number;
  width?: number;
  height?: number;
  // Rolling mode props - NEW
  rollingMode?: boolean;
  pivotDiskId?: string | null;
  rollingDiskId?: string | null;
  theta?: number;
  showTrail?: boolean;
  onDiskClick?: (diskId: string) => void;
  // Knot props
  knotMode?: boolean;
  knot?: KnotDiagram | null;
  onKnotSegmentClick?: (index: number) => void;
  // Contact graph props
  showContactDisks?: boolean;
}

type PointType = 'p1' | 'p2' | 'center' | 'start' | 'end' | 'disk';

interface DragState {
  blockId: string;
  pointType: PointType;
  startX: number;
  startY: number;
}

/**
 * Canvas SVG para renderizar diagramas CS
 * Estilo "Penny Graph Viewer": Discos azules, "cinturón" (Hull) y grilla limpia.
 */
export function CSCanvas({
  blocks,
  selectedBlockId,
  onSelectBlock,
  onUpdateBlock,
  showGrid = true,
  gridSpacing = 20,
  width = 800,
  height = 600,
  rollingMode = false,
  pivotDiskId = null,
  rollingDiskId = null,
  theta = 0,
  showTrail = true,
  onDiskClick,
  showContactDisks = false,
  knotMode = false,
  knot = null,
  onKnotSegmentClick,
}: CSCanvasProps) {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [dragState, setDragState] = React.useState<DragState | null>(null);
  const [trailPoints, setTrailPoints] = React.useState<Point2D[]>([]);

  const centerX = width / 2;
  const centerY = height / 2;

  // Separar discos de otros bloques
  const disks = blocks.filter((b): b is CSDisk => b.kind === 'disk');
  const nonDiskBlocks = blocks.filter((b) => b.kind !== 'disk');

  // Mapear CSDisk a la estructura Disk que espera diskHull
  const simpleDisks = React.useMemo(() => disks.map(d => ({
    id: d.id,
    x: d.center.x,
    y: d.center.y,
    r: d.visualRadius
  })), [disks]);

  const hullData = useDiskHull(simpleDisks);


  // Detectar cruces solo en bloques no-disco
  const crossings = React.useMemo(() => findAllCrossings(nonDiskBlocks), [nonDiskBlocks]);

  // Detectar regiones y discos de contacto (Legacy/Optional)
  const regions = React.useMemo(() => {
    if (showContactDisks && nonDiskBlocks.length >= 3 && disks.length === 0) {
      return detectRegionsWithDisks(nonDiskBlocks);
    }
    return [];
  }, [nonDiskBlocks, showContactDisks, disks.length]);

  // ... (Rolling logic kept for compatibility, though simplified visual focus)
  const rollingDiskPosition = React.useMemo(() => {
    if (!rollingMode || !pivotDiskId || !rollingDiskId) return null;
    const pivot = disks.find(d => d.id === pivotDiskId);
    const rolling = disks.find(d => d.id === rollingDiskId);
    if (!pivot || !rolling) return null;
    const distance = pivot.visualRadius + rolling.visualRadius;
    const newCenter: Point2D = {
      x: pivot.center.x + distance * Math.cos(theta),
      y: pivot.center.y + distance * Math.sin(theta),
    };
    const spinAngle = -(distance / rolling.visualRadius) * theta;
    return { center: newCenter, spinAngle };
  }, [rollingMode, pivotDiskId, rollingDiskId, theta, disks]);

  React.useEffect(() => {
    if (rollingDiskPosition && showTrail) {
      setTrailPoints(prev => {
        const newPoints = [...prev, rollingDiskPosition.center];
        return newPoints.length > 200 ? newPoints.slice(-200) : newPoints;
      });
    } else if (!rollingMode || !rollingDiskId) {
      setTrailPoints([]);
    }
  }, [rollingDiskPosition, showTrail, rollingMode, rollingDiskId]);

  const checkDiskOverlap = React.useCallback((diskId: string, newCenter: Point2D): boolean => {
    const current = disks.find(d => d.id === diskId);
    if (!current) return false;
    const currentR = current.visualRadius;
    for (const other of disks) {
      if (other.id === diskId) continue;
      const dx = newCenter.x - other.center.x;
      const dy = newCenter.y - other.center.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const otherR = other.visualRadius;
      if (distance < currentR + otherR - 1) return true;
    }
    return false;
  }, [disks]);

  // Convertir coordenadas cartesianas a SVG
  function toSVG(x: number, y: number): [number, number] {
    return [centerX + x, centerY - y];
  }

  // Helper para convertir path del hull (que está en coords cartesianas) a SVG coords
  // diskHull devuelve 'M x y L x y ...', necesitamos transformar esos x,y
  function transformPathToSVG(d: string): string {
    return d.replace(/([ML])\s*(-?\d+\.?\d*)\s+(-?\d+\.?\d*)/g, (_, cmd, x, y) => {
      const [sx, sy] = toSVG(parseFloat(x), parseFloat(y));
      return `${cmd} ${sx} ${sy}`;
    }).replace(/A\s*(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)/g,
      (_, rx, ry, rot, large, sweep, ex, ey) => {
        // Arcos son más complejos de transformar si hay rotación/escala asimétrica
        // Pero aquí escala es 1:1, solo translación y flip Y.
        // Flip Y cambia el sweep flag.
        const [sx, sy] = toSVG(parseFloat(ex), parseFloat(ey));
        // Invertir sweep flag debido al flip Y del eje SVG vs Cartesiano
        const newSweep = sweep === '0' ? '1' : '0';
        return `A ${rx} ${ry} ${rot} ${large} ${newSweep} ${sx} ${sy}`;
      });
  }


  function fromSVGExact(svgX: number, svgY: number): Point2D {
    return { x: svgX - centerX, y: centerY - svgY };
  }

  function getMousePositionExact(e: React.MouseEvent<SVGSVGElement>): Point2D | null {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    const svgX = (e.clientX - rect.left) * scaleX;
    const svgY = (e.clientY - rect.top) * scaleY;
    return fromSVGExact(svgX, svgY);
  }

  function handleMouseDown(blockId: string, pointType: PointType, e: React.MouseEvent) {
    e.stopPropagation();
    if (rollingMode && onDiskClick) {
      const block = blocks.find(b => b.id === blockId);
      if (block?.kind === 'disk') onDiskClick(blockId);
      return;
    }
    const pos = getMousePositionExact(e as any); // Simplificado para usar coordenadas base
    if (!pos) return;

    // Necesitamos posición 'SVG' cruda para delta tracking preciso visualmente si queremos
    // pero fromSVGExact ya nos da el punto en el espacio lógico. Usaremos ese.
    // Para consistencia con lógica anterior:
    const rect = svgRef.current!.getBoundingClientRect();
    const rawX = (e.clientX - rect.left) * (width / rect.width);
    const rawY = (e.clientY - rect.top) * (height / rect.height);

    setDragState({
      blockId,
      pointType,
      startX: rawX, // Tracking en espacio SVG para delta directo si se prefiere, o convertir
      startY: rawY,
    });
    onSelectBlock(blockId);
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!dragState) return;
    if (rollingMode) return;

    // Convertir a SVG coords para calcular delta en píxeles de pantalla/svg
    const rect = svgRef.current!.getBoundingClientRect();
    const svgX = (e.clientX - rect.left) * (width / rect.width);
    const svgY = (e.clientY - rect.top) * (height / rect.height);

    const block = blocks.find(b => b.id === dragState.blockId);
    if (!block) return;

    // Diferencia en coordenadas SVG (Y hacia abajo)
    const deltaSvgX = svgX - dragState.startX;
    // Invertir delta Y para coordenadas cartesianas (Y hacia arriba)
    const deltaSvgY = svgY - dragState.startY;

    // Aquí hay un truco: si movemos el mouse 10px abajo en pantalla:
    // SVG Y aumenta 10.
    // Cartesiano Y debe disminuir 10.
    // toSVG(y) = cy - y.
    // Si y decrece, toSVG(y) crece. Correcto.
    // Entonces deltaCartesianoY = -deltaSvgY.
    const deltaCartX = deltaSvgX;
    const deltaCartY = -deltaSvgY;

    if (block.kind === 'disk' && dragState.pointType === 'disk') {
      const newCenter = {
        x: block.center.x + deltaCartX,
        y: block.center.y + deltaCartY
      };

      if (!checkDiskOverlap(block.id, newCenter)) {
        onUpdateBlock(block.id, { center: newCenter } as Partial<CSBlock>);
        setDragState({
          ...dragState,
          startX: svgX,
          startY: svgY
        });
      }
    }
    // ... (Logica para segmentos/arcos omitida/simplificada o mantenida si es necesario)
    // Por ahora nos enfocamos en Penny Graphs (Discos)
  }

  function handleMouseUp() {
    setDragState(null);
  }

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox={`0 0 ${width} ${height}`}
      style={{ background: 'white', cursor: dragState ? 'grabbing' : 'default' }} // Fondo blanco limpio
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={(e) => {
        if (e.target === e.currentTarget) onSelectBlock(null);
      }}
    >
      <defs>
        <pattern id="smallGrid" width={gridSpacing} height={gridSpacing} patternUnits="userSpaceOnUse">
          <path d={`M ${gridSpacing} 0 L 0 0 0 ${gridSpacing}`} fill="none" stroke="#f0f0f0" strokeWidth="1" />
        </pattern>
        <pattern id="largeGrid" width={gridSpacing * 5} height={gridSpacing * 5} patternUnits="userSpaceOnUse">
          <rect width={gridSpacing * 5} height={gridSpacing * 5} fill="url(#smallGrid)" />
          <path d={`M ${gridSpacing * 5} 0 L 0 0 0 ${gridSpacing * 5}`} fill="none" stroke="#e0e0e0" strokeWidth="1" />
        </pattern>
      </defs>

      {/* Grid */}
      {showGrid && <rect width="100%" height="100%" fill="url(#largeGrid)" />}

      {/* Ejes */}
      <line x1="0" y1={centerY} x2={width} y2={centerY} stroke="#ddd" strokeWidth="1" />
      <line x1={centerX} y1="0" x2={centerX} y2={height} stroke="#ddd" strokeWidth="1" />

      {/* BELT (Convex Hull) OR KNOT */}
      {!knotMode && hullData && (
        <path
          d={transformPathToSVG(hullData.svgPathD)}
          fill="rgba(137, 207, 240, 0.2)"
          stroke="#5CA0D3"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      )}

      {knotMode && knot && (
        <g transform={`translate(${centerX}, ${centerY}) scale(1, -1)`}>
          <KnotRenderer
            knot={knot}
            onSegmentClick={(idx) => onKnotSegmentClick?.(idx)}
          />
        </g>
      )}

      {/* Discos */}
      {disks.map((disk, index) => {
        const [cx, cy] = toSVG(disk.center.x, disk.center.y);
        const isSelected = disk.id === selectedBlockId;
        const radius = disk.visualRadius;

        return (
          <g key={disk.id}
            onMouseDown={(e) => handleMouseDown(disk.id, 'disk', e)}
            style={{ cursor: 'grab' }}
          >
            {/* Relleno Azul Penny Graph style */}
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="#89CFF0" /* Baby Blue */
              stroke={isSelected ? "#2E6BA8" : "#5CA0D3"}
              strokeWidth={isSelected ? 4 : 2}
            />
            {/* Etiqueta (Índice) */}
            <text
              x={cx}
              y={cy + radius + 20} /* Debajo del disco */
              textAnchor="middle"
              fontFamily="monospace"
              fontSize="14"
              fill="#555"
              fontWeight="bold"
              pointerEvents="none"
            >
              {index}
            </text>

            {/* ID Label opcional dentro si se desea, pero la imagen muestra indices fuera a veces. 
                Dejamos indice fuera. */}
          </g>
        );
      })}

      {/* Resto de bloques (Segmentos/Arcos) si existen */}
      {nonDiskBlocks.map((block) => (
        // ... (Renderizado mínimo para no romper app si hay otros bloques)
        null
      ))}

    </svg>
  );
}
