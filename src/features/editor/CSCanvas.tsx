import React from 'react';
import type { CSBlock } from '../../core/types/cs';
import { findAllCrossings } from '../../core/geometry/intersections';

interface CSCanvasProps {
  blocks: CSBlock[];
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  showGrid?: boolean;
  gridSpacing?: number;
  width?: number;
  height?: number;
}

/**
 * Canvas SVG para renderizar diagramas CS
 * Sistema de coordenadas cartesiano con origen en el centro
 */
export function CSCanvas({ 
  blocks, 
  selectedBlockId,
  onSelectBlock,
  showGrid = true,
  gridSpacing = 20,
  width = 800, 
  height = 600 
}: CSCanvasProps) {
  const centerX = width / 2;
  const centerY = height / 2;

  // Detectar cruces
  const crossings = React.useMemo(() => findAllCrossings(blocks), [blocks]);

  // Convertir coordenadas cartesianas a SVG (invertir Y)
  function toSVG(x: number, y: number): [number, number] {
    return [centerX + x, centerY - y];
  }

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${width} ${height}`}
      style={{ background: 'var(--canvas-bg)', cursor: 'default' }}
      onClick={(e) => {
        // Click en fondo deselecciona
        if (e.target === e.currentTarget) {
          onSelectBlock(null);
        }
      }}
    >
      {/* Grid de fondo */}
      <defs>
        <pattern id="grid" width={gridSpacing} height={gridSpacing} patternUnits="userSpaceOnUse">
          <path
            d={`M ${gridSpacing} 0 L 0 0 0 ${gridSpacing}`}
            fill="none"
            stroke="var(--canvas-grid)"
            strokeWidth="0.5"
          />
        </pattern>
      </defs>
      {showGrid && <rect width="100%" height="100%" fill="url(#grid)" opacity="0.3" />}

      {/* Ejes cartesianos */}
      <line
        x1="0"
        y1={centerY}
        x2={width}
        y2={centerY}
        stroke="var(--border)"
        strokeWidth="1"
        opacity="0.5"
      />
      <line
        x1={centerX}
        y1="0"
        x2={centerX}
        y2={height}
        stroke="var(--border)"
        strokeWidth="1"
        opacity="0.5"
      />

      {/* Renderizar bloques CS */}
      {blocks.map((block) => {
        const isSelected = block.id === selectedBlockId;
        const strokeWidth = isSelected ? 3 : 2;

        if (block.kind === 'segment') {
          const [x1, y1] = toSVG(block.p1.x, block.p1.y);
          const [x2, y2] = toSVG(block.p2.x, block.p2.y);

          return (
            <g 
              key={block.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelectBlock(block.id);
              }}
              style={{ cursor: 'pointer' }}
            >
              {/* Área clickeable invisible más grande */}
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="transparent"
                strokeWidth="12"
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
              />
              {/* Puntos extremos */}
              <circle cx={x1} cy={y1} r={isSelected ? 5 : 4} fill="var(--canvas-segment)" />
              <circle cx={x2} cy={y2} r={isSelected ? 5 : 4} fill="var(--canvas-segment)" />
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
            <g 
              key={block.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelectBlock(block.id);
              }}
              style={{ cursor: 'pointer' }}
            >
              {/* Área clickeable invisible */}
              <path
                d={pathData}
                fill="none"
                stroke="transparent"
                strokeWidth="12"
              />
              {/* Arco visible */}
              <path
                d={pathData}
                fill="none"
                stroke="var(--canvas-arc)"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                opacity={isSelected ? 1 : 0.8}
              />
              {/* Centro del arco */}
              <circle 
                cx={cx} 
                cy={cy} 
                r={isSelected ? 4 : 3} 
                fill="var(--canvas-arc)" 
                opacity="0.5" 
              />
              {/* Puntos extremos */}
              <circle cx={startX} cy={startY} r={isSelected ? 5 : 4} fill="var(--canvas-arc)" />
              <circle cx={endX} cy={endY} r={isSelected ? 5 : 4} fill="var(--canvas-arc)" />
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
        >
          ⨯ {crossings.length} cruce{crossings.length !== 1 ? 's' : ''}
        </text>
      )}
    </svg>
  );
}
