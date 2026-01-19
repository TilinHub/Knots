import React from 'react';
import type { CSBlock, CSArc, CSSegment, Point2D } from '../../core/types/cs';
import { findAllCrossings } from '../../core/geometry/intersections';

interface CSCanvasProps {
  blocks: CSBlock[];
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  onUpdateBlock: (id: string, updates: Partial<CSBlock>) => void;
  showGrid?: boolean;
  gridSpacing?: number;
  width?: number;
  height?: number;
}

type PointType = 'p1' | 'p2' | 'center' | 'start' | 'end';

interface DragState {
  blockId: string;
  pointType: PointType;
  startX: number;
  startY: number;
}

/**
 * Canvas SVG para renderizar diagramas CS
 * Sistema de coordenadas cartesiano con origen en el centro
 */
export function CSCanvas({ 
  blocks, 
  selectedBlockId,
  onSelectBlock,
  onUpdateBlock,
  showGrid = true,
  gridSpacing = 20,
  width = 800, 
  height = 600 
}: CSCanvasProps) {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [dragState, setDragState] = React.useState<DragState | null>(null);
  
  const centerX = width / 2;
  const centerY = height / 2;

  // Detectar cruces
  const crossings = React.useMemo(() => findAllCrossings(blocks), [blocks]);

  // Convertir coordenadas cartesianas a SVG (invertir Y)
  function toSVG(x: number, y: number): [number, number] {
    return [centerX + x, centerY - y];
  }

  // Convertir coordenadas SVG a cartesianas
  function fromSVG(svgX: number, svgY: number): Point2D {
    return {
      x: Math.round((svgX - centerX) / 5) * 5, // Snap a 5px
      y: Math.round((centerY - svgY) / 5) * 5,
    };
  }

  // Obtener coordenadas del mouse relativas al SVG
  function getMousePosition(e: React.MouseEvent<SVGSVGElement>): Point2D | null {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    const svgX = (e.clientX - rect.left) * scaleX;
    const svgY = (e.clientY - rect.top) * scaleY;
    return fromSVG(svgX, svgY);
  }

  function handleMouseDown(blockId: string, pointType: PointType, e: React.MouseEvent) {
    e.stopPropagation();
    const pos = getMousePosition(e as React.MouseEvent<SVGSVGElement>);
    if (!pos) return;
    
    setDragState({
      blockId,
      pointType,
      startX: pos.x,
      startY: pos.y,
    });
    onSelectBlock(blockId);
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!dragState) return;
    
    const pos = getMousePosition(e);
    if (!pos) return;

    const block = blocks.find(b => b.id === dragState.blockId);
    if (!block) return;

    if (block.kind === 'segment') {
      if (dragState.pointType === 'p1') {
        onUpdateBlock(block.id, { p1: pos });
      } else if (dragState.pointType === 'p2') {
        onUpdateBlock(block.id, { p2: pos });
      }
    } else if (block.kind === 'arc') {
      if (dragState.pointType === 'center') {
        onUpdateBlock(block.id, { center: pos });
      } else if (dragState.pointType === 'start') {
        const dx = pos.x - block.center.x;
        const dy = pos.y - block.center.y;
        const angle = Math.atan2(dy, dx);
        onUpdateBlock(block.id, { startAngle: angle });
      } else if (dragState.pointType === 'end') {
        const dx = pos.x - block.center.x;
        const dy = pos.y - block.center.y;
        const angle = Math.atan2(dy, dx);
        onUpdateBlock(block.id, { endAngle: angle });
      }
    }
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
      style={{ background: 'var(--canvas-bg)', cursor: dragState ? 'grabbing' : 'default' }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onSelectBlock(null);
        }
      }}
    >
      {/* Grid de fondo - MEJORADO */}
      {showGrid && (
        <>
          <defs>
            <pattern 
              id="smallGrid" 
              width={gridSpacing} 
              height={gridSpacing} 
              patternUnits="userSpaceOnUse"
            >
              <path
                d={`M ${gridSpacing} 0 L 0 0 0 ${gridSpacing}`}
                fill="none"
                stroke="#d0d0d0"
                strokeWidth="0.5"
              />
            </pattern>
            <pattern 
              id="largeGrid" 
              width={gridSpacing * 5} 
              height={gridSpacing * 5} 
              patternUnits="userSpaceOnUse"
            >
              <rect width={gridSpacing * 5} height={gridSpacing * 5} fill="url(#smallGrid)" />
              <path
                d={`M ${gridSpacing * 5} 0 L 0 0 0 ${gridSpacing * 5}`}
                fill="none"
                stroke="#b0b0b0"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#largeGrid)" />
        </>
      )}

      {/* Ejes cartesianos */}
      <line
        x1="0"
        y1={centerY}
        x2={width}
        y2={centerY}
        stroke="#999"
        strokeWidth="1.5"
        opacity="0.6"
      />
      <line
        x1={centerX}
        y1="0"
        x2={centerX}
        y2={height}
        stroke="#999"
        strokeWidth="1.5"
        opacity="0.6"
      />

      {/* Renderizar bloques CS */}
      {blocks.map((block) => {
        const isSelected = block.id === selectedBlockId;
        const strokeWidth = isSelected ? 3 : 2;

        if (block.kind === 'segment') {
          const [x1, y1] = toSVG(block.p1.x, block.p1.y);
          const [x2, y2] = toSVG(block.p2.x, block.p2.y);

          return (
            <g key={block.id}>
              {/* Área clickeable invisible */}
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="transparent"
                strokeWidth="12"
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectBlock(block.id);
                }}
              />
              {/* Segmento visible */}
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="var(--canvas-segment)"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                opacity={isSelected ? 1 : 0.8}
                pointerEvents="none"
              />
              {/* Handles arrastrables */}
              {isSelected && (
                <>
                  <circle 
                    cx={x1} 
                    cy={y1} 
                    r="8" 
                    fill="var(--canvas-segment)"
                    stroke="white"
                    strokeWidth="2"
                    style={{ cursor: 'grab' }}
                    onMouseDown={(e) => handleMouseDown(block.id, 'p1', e)}
                  />
                  <circle 
                    cx={x2} 
                    cy={y2} 
                    r="8" 
                    fill="var(--canvas-segment)"
                    stroke="white"
                    strokeWidth="2"
                    style={{ cursor: 'grab' }}
                    onMouseDown={(e) => handleMouseDown(block.id, 'p2', e)}
                  />
                </>
              )}
              {!isSelected && (
                <>
                  <circle cx={x1} cy={y1} r="4" fill="var(--canvas-segment)" pointerEvents="none" />
                  <circle cx={x2} cy={y2} r="4" fill="var(--canvas-segment)" pointerEvents="none" />
                </>
              )}
            </g>
          );
        }

        if (block.kind === 'arc') {
          const [cx, cy] = toSVG(block.center.x, block.center.y);

          const startX = cx + block.radius * Math.cos(block.startAngle);
          const startY = cy - block.radius * Math.sin(block.startAngle);
          const endX = cx + block.radius * Math.cos(block.endAngle);
          const endY = cy - block.radius * Math.sin(block.endAngle);

          let angleDiff = block.endAngle - block.startAngle;
          if (angleDiff < 0) angleDiff += 2 * Math.PI;
          const largeArc = angleDiff > Math.PI ? 1 : 0;

          const pathData = [
            `M ${startX} ${startY}`,
            `A ${block.radius} ${block.radius} 0 ${largeArc} 0 ${endX} ${endY}`,
          ].join(' ');

          return (
            <g key={block.id}>
              {/* Área clickeable */}
              <path
                d={pathData}
                fill="none"
                stroke="transparent"
                strokeWidth="12"
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectBlock(block.id);
                }}
              />
              {/* Arco visible */}
              <path
                d={pathData}
                fill="none"
                stroke="var(--canvas-arc)"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                opacity={isSelected ? 1 : 0.8}
                pointerEvents="none"
              />
              {/* Handles arrastrables */}
              {isSelected && (
                <>
                  {/* Centro */}
                  <circle 
                    cx={cx} 
                    cy={cy} 
                    r="7"
                    fill="var(--canvas-arc)" 
                    stroke="white"
                    strokeWidth="2"
                    style={{ cursor: 'grab' }}
                    onMouseDown={(e) => handleMouseDown(block.id, 'center', e)}
                  />
                  {/* Punto inicial */}
                  <circle 
                    cx={startX} 
                    cy={startY} 
                    r="8" 
                    fill="var(--canvas-arc)"
                    stroke="white"
                    strokeWidth="2"
                    style={{ cursor: 'grab' }}
                    onMouseDown={(e) => handleMouseDown(block.id, 'start', e)}
                  />
                  {/* Punto final */}
                  <circle 
                    cx={endX} 
                    cy={endY} 
                    r="8" 
                    fill="var(--canvas-arc)"
                    stroke="white"
                    strokeWidth="2"
                    style={{ cursor: 'grab' }}
                    onMouseDown={(e) => handleMouseDown(block.id, 'end', e)}
                  />
                </>
              )}
              {!isSelected && (
                <>
                  <circle cx={cx} cy={cy} r="3" fill="var(--canvas-arc)" opacity="0.5" pointerEvents="none" />
                  <circle cx={startX} cy={startY} r="4" fill="var(--canvas-arc)" pointerEvents="none" />
                  <circle cx={endX} cy={endY} r="4" fill="var(--canvas-arc)" pointerEvents="none" />
                </>
              )}
            </g>
          );
        }

        return null;
      })}

      {/* Renderizar puntos de cruce */}
      {crossings.map((cross) => {
        const [cx, cy] = toSVG(cross.position.x, cross.position.y);
        return (
          <g key={cross.id}>
            <circle
              cx={cx}
              cy={cy}
              r="7"
              fill="var(--canvas-cross)"
              stroke="white"
              strokeWidth="2"
              pointerEvents="none"
            />
            <title>
              Cruce: {cross.block1} ⨯ {cross.block2}
              {`\n(${cross.position.x.toFixed(2)}, ${cross.position.y.toFixed(2)})`}
            </title>
          </g>
        );
      })}

      {/* Etiqueta de origen */}
      <text
        x={centerX + 8}
        y={centerY - 8}
        fontSize="11"
        fill="var(--text-tertiary)"
        fontFamily="var(--ff-mono)"
        pointerEvents="none"
      >
        (0,0)
      </text>

      {/* Contador de cruces */}
      {crossings.length > 0 && (
        <text
          x="16"
          y="24"
          fontSize="12"
          fill="var(--canvas-cross)"
          fontFamily="var(--ff-mono)"
          fontWeight="600"
          pointerEvents="none"
        >
          ⨯ {crossings.length} cruce{crossings.length !== 1 ? 's' : ''}
        </text>
      )}
    </svg>
  );
}
