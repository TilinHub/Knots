import React from 'react';
import type { CSBlock, CSDisk, Point2D } from '../../core/types/cs';
import { findAllCrossings } from '../../core/geometry/intersections';
import { detectRegionsWithDisks } from '../../core/algorithms/regionDetection';

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
  height = 600,
  rollingMode = false,
  pivotDiskId = null,
  rollingDiskId = null,
  theta = 0,
  showTrail = true,
  onDiskClick,
  showContactDisks = false,
}: CSCanvasProps) {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [dragState, setDragState] = React.useState<DragState | null>(null);
  const [trailPoints, setTrailPoints] = React.useState<Point2D[]>([]);
  
  const centerX = width / 2;
  const centerY = height / 2;

  // Separar discos de otros bloques
  const disks = blocks.filter((b): b is CSDisk => b.kind === 'disk');
  const nonDiskBlocks = blocks.filter((b) => b.kind !== 'disk');

  // Detectar cruces solo en bloques no-disco
  const crossings = React.useMemo(() => findAllCrossings(nonDiskBlocks), [nonDiskBlocks]);

  // Detectar regiones y discos de contacto
  const regions = React.useMemo(() => {
    if (showContactDisks && nonDiskBlocks.length >= 3 && disks.length === 0) {
      return detectRegionsWithDisks(nonDiskBlocks);
    }
    return [];
  }, [nonDiskBlocks, showContactDisks, disks.length]);

  // Calcular posición del disco rodante
  const rollingDiskPosition = React.useMemo(() => {
    if (!rollingMode || !pivotDiskId || !rollingDiskId) return null;
    
    const pivot = disks.find(d => d.id === pivotDiskId);
    const rolling = disks.find(d => d.id === rollingDiskId);
    
    if (!pivot || !rolling) return null;
    
    // Distancia entre centros: suma de radios VISUALES (rodado externo)
    const distance = pivot.visualRadius + rolling.visualRadius;
    
    // Nueva posición del centro del disco rodante
    const newCenter: Point2D = {
      x: pivot.center.x + distance * Math.cos(theta),
      y: pivot.center.y + distance * Math.sin(theta),
    };
    
    // Rotación propia del disco (sin deslizamiento)
    // Para rodado externo: spinAngle = -(distance / visualRadius) * theta
    const spinAngle = -(distance / rolling.visualRadius) * theta;
    
    return { center: newCenter, spinAngle };
  }, [rollingMode, pivotDiskId, rollingDiskId, theta, disks]);

  // Actualizar trail
  React.useEffect(() => {
    if (rollingDiskPosition && showTrail) {
      setTrailPoints(prev => {
        const newPoints = [...prev, rollingDiskPosition.center];
        // Limitar a 200 puntos
        return newPoints.length > 200 ? newPoints.slice(-200) : newPoints;
      });
    } else if (!rollingMode || !rollingDiskId) {
      setTrailPoints([]);
    }
  }, [rollingDiskPosition, showTrail, rollingMode, rollingDiskId]);

  // Validar overlap entre discos (usando RADIO VISUAL)
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
      
      // Permitir contacto tangente pero no overlap (distancia < suma de radios)
      if (distance < currentR + otherR - 1) {
        return true; // Hay overlap
      }
    }
    return false; // No hay overlap
  }, [disks]);

  // Convertir coordenadas cartesianas a SVG
  function toSVG(x: number, y: number): [number, number] {
    return [centerX + x, centerY - y];
  }

  // Convertir coordenadas SVG a cartesianas
  function fromSVG(svgX: number, svgY: number): Point2D {
    return {
      x: Math.round((svgX - centerX) / 5) * 5,
      y: Math.round((centerY - svgY) / 5) * 5,
    };
  }

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
    
    // En rolling mode, solo permitir selección de discos
    if (rollingMode && onDiskClick) {
      const block = blocks.find(b => b.id === blockId);
      if (block?.kind === 'disk') {
        onDiskClick(blockId);
      }
      return;
    }
    
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
    if (rollingMode) return; // No arrastrar en rolling mode
    
    const pos = getMousePosition(e);
    if (!pos) return;

    const block = blocks.find(b => b.id === dragState.blockId);
    if (!block) return;

    if (block.kind === 'segment') {
      if (dragState.pointType === 'p1') {
        onUpdateBlock(block.id, { p1: pos } as Partial<CSBlock>);
      } else if (dragState.pointType === 'p2') {
        onUpdateBlock(block.id, { p2: pos } as Partial<CSBlock>);
      }
    } else if (block.kind === 'arc') {
      if (dragState.pointType === 'center') {
        onUpdateBlock(block.id, { center: pos } as Partial<CSBlock>);
      } else if (dragState.pointType === 'start') {
        const dx = pos.x - block.center.x;
        const dy = pos.y - block.center.y;
        const angle = Math.atan2(dy, dx);
        onUpdateBlock(block.id, { startAngle: angle } as Partial<CSBlock>);
      } else if (dragState.pointType === 'end') {
        const dx = pos.x - block.center.x;
        const dy = pos.y - block.center.y;
        const angle = Math.atan2(dy, dx);
        onUpdateBlock(block.id, { endAngle: angle } as Partial<CSBlock>);
      }
    } else if (block.kind === 'disk' && dragState.pointType === 'disk') {
      const deltaX = pos.x - dragState.startX;
      const deltaY = pos.y - dragState.startY;
      
      const newCenter = {
        x: block.center.x + deltaX,
        y: block.center.y + deltaY
      };
      
      // Validar que no haya overlap (usando radio VISUAL)
      if (!checkDiskOverlap(block.id, newCenter)) {
        onUpdateBlock(block.id, { center: newCenter } as Partial<CSBlock>);
        
        setDragState({
          ...dragState,
          startX: pos.x,
          startY: pos.y,
        });
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
      <defs>
        {/* Grid patterns */}
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
        
        {/* Gradientes para discos de contacto */}
        {regions.map((region) =>
          region.disks.map((disk) => (
            <radialGradient key={`gradient-${disk.id}`} id={`gradient-${disk.id}`}>
              <stop offset="0%" stopColor="#6BB6FF" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#4A90E2" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#2E6BA8" stopOpacity="0.7" />
            </radialGradient>
          ))
        )}
        
        {/* Gradientes para discos manuales */}
        {disks.map((disk) => (
          <radialGradient key={`gradient-${disk.id}`} id={`gradient-${disk.id}`}>
            <stop offset="0%" stopColor={disk.color || "#6BB6FF"} stopOpacity="0.9" />
            <stop offset="50%" stopColor={disk.color || "#4A90E2"} stopOpacity="0.8" />
            <stop offset="100%" stopColor={disk.color || "#2E6BA8"} stopOpacity="0.7" />
          </radialGradient>
        ))}
      </defs>

      {/* Grid de fondo */}
      {showGrid && <rect width="100%" height="100%" fill="url(#largeGrid)" />}

      {/* Ejes cartesianos */}
      <line x1="0" y1={centerY} x2={width} y2={centerY} stroke="#999" strokeWidth="1.5" opacity="0.6" />
      <line x1={centerX} y1="0" x2={centerX} y2={height} stroke="#999" strokeWidth="1.5" opacity="0.6" />

      {/* Trail (trayectoria del disco rodante) */}
      {rollingMode && showTrail && trailPoints.length > 1 && (
        <polyline
          points={trailPoints.map(p => {
            const [x, y] = toSVG(p.x, p.y);
            return `${x},${y}`;
          }).join(' ')}
          fill="none"
          stroke="#FF6B6B"
          strokeWidth="2"
          strokeDasharray="4,4"
          opacity="0.6"
        />
      )}

      {/* Renderizar discos manuales */}
      {disks.map((disk) => {
        // Si este disco está rodando, usar la posición calculada
        const isRolling = rollingMode && disk.id === rollingDiskId && rollingDiskPosition;
        const center = isRolling ? rollingDiskPosition.center : disk.center;
        
        const [cx, cy] = toSVG(center.x, center.y);
        const isSelected = disk.id === selectedBlockId;
        const isPivot = rollingMode && disk.id === pivotDiskId;
        const isRollingDisk = rollingMode && disk.id === rollingDiskId;
        
        // Usar visualRadius para renderizado
        const renderRadius = disk.visualRadius;
        
        // Borde según estado
        let strokeColor = "#2E6BA8";
        let strokeWidth = 4;
        if (isPivot) {
          strokeColor = "#FFD700"; // Oro para pivote
          strokeWidth = 5;
        } else if (isRollingDisk) {
          strokeColor = "#FF6B6B"; // Rojo para rodante
          strokeWidth = 5;
        } else if (isSelected) {
          strokeColor = "#4ECDC4";
          strokeWidth = 5;
        }
        
        return (
          <g key={disk.id}>
            {/* Sombra */}
            <circle
              cx={cx + 3}
              cy={cy + 3}
              r={renderRadius}
              fill="rgba(0, 0, 0, 0.15)"
              pointerEvents="none"
            />
            {/* Disco */}
            <circle
              cx={cx}
              cy={cy}
              r={renderRadius}
              fill={`url(#gradient-${disk.id})`}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              opacity="0.85"
              style={{ cursor: rollingMode ? 'pointer' : 'grab' }}
              onMouseDown={(e) => handleMouseDown(disk.id, 'disk', e)}
              onClick={(e) => {
                e.stopPropagation();
                if (rollingMode && onDiskClick) {
                  onDiskClick(disk.id);
                } else {
                  onSelectBlock(disk.id);
                }
              }}
            />
            {/* Brillo */}
            <ellipse
              cx={cx - renderRadius * 0.25}
              cy={cy - renderRadius * 0.25}
              rx={renderRadius * 0.4}
              ry={renderRadius * 0.3}
              fill="rgba(255, 255, 255, 0.3)"
              pointerEvents="none"
            />
            {/* Marca de rotación (punto para ver el giro) */}
            {isRollingDisk && rollingDiskPosition && (
              <>
                <line
                  x1={cx}
                  y1={cy}
                  x2={cx + renderRadius * Math.cos(rollingDiskPosition.spinAngle)}
                  y2={cy - renderRadius * Math.sin(rollingDiskPosition.spinAngle)}
                  stroke="white"
                  strokeWidth="3"
                  opacity="0.8"
                  pointerEvents="none"
                />
                <circle
                  cx={cx + renderRadius * Math.cos(rollingDiskPosition.spinAngle)}
                  cy={cy - renderRadius * Math.sin(rollingDiskPosition.spinAngle)}
                  r="5"
                  fill="white"
                  pointerEvents="none"
                />
              </>
            )}
            {/* Línea pivote-rodante */}
            {rollingMode && isPivot && rollingDiskId && rollingDiskPosition && (
              <line
                x1={cx}
                y1={cy}
                x2={toSVG(rollingDiskPosition.center.x, rollingDiskPosition.center.y)[0]}
                y2={toSVG(rollingDiskPosition.center.x, rollingDiskPosition.center.y)[1]}
                stroke="#FFD700"
                strokeWidth="2"
                strokeDasharray="5,5"
                opacity="0.5"
                pointerEvents="none"
              />
            )}
            {/* Etiqueta */}
            <text
              x={cx}
              y={cy + 4}
              fontSize="13"
              fill="white"
              fontFamily="var(--ff-mono)"
              fontWeight="700"
              textAnchor="middle"
              dominantBaseline="middle"
              pointerEvents="none"
              style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}
            >
              {disk.label || disk.id.replace('disk-', 'D')}
            </text>
            {/* Indicador de pivote/rodante */}
            {isPivot && (
              <text
                x={cx}
                y={cy - renderRadius - 10}
                fontSize="10"
                fill="#FFD700"
                fontFamily="var(--ff-mono)"
                fontWeight="700"
                textAnchor="middle"
                pointerEvents="none"
              >
                PIVOTE
              </text>
            )}
            {isRollingDisk && (
              <text
                x={cx}
                y={cy - renderRadius - 10}
                fontSize="10"
                fill="#FF6B6B"
                fontFamily="var(--ff-mono)"
                fontWeight="700"
                textAnchor="middle"
                pointerEvents="none"
              >
                RODANTE
              </text>
            )}
          </g>
        );
      })}

      {/* Renderizar discos de contacto automáticos */}
      {showContactDisks && disks.length === 0 && regions.map((region) =>
        region.disks.map((disk) => {
          const [cx, cy] = toSVG(disk.center.x, disk.center.y);
          return (
            <g key={disk.id}>
              <circle cx={cx + 3} cy={cy + 3} r={disk.radius} fill="rgba(0, 0, 0, 0.15)" pointerEvents="none" />
              <circle cx={cx} cy={cy} r={disk.radius} fill={`url(#gradient-${disk.id})`} stroke="#2E6BA8" strokeWidth="4" opacity="0.85" pointerEvents="none" />
              <ellipse cx={cx - disk.radius * 0.25} cy={cy - disk.radius * 0.25} rx={disk.radius * 0.4} ry={disk.radius * 0.3} fill="rgba(255, 255, 255, 0.3)" pointerEvents="none" />
              <text x={cx} y={cy + 4} fontSize="13" fill="white" fontFamily="var(--ff-mono)" fontWeight="700" textAnchor="middle" dominantBaseline="middle" pointerEvents="none" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                {region.id.replace('region-', 'R')}
              </text>
            </g>
          );
        })
      )}

      {/* Renderizar bloques CS (segmentos y arcos) */}
      {nonDiskBlocks.map((block) => {
        const isSelected = block.id === selectedBlockId;
        const strokeWidth = isSelected ? 3 : 2;
        const blockOpacity = rollingMode ? 0.4 : (isSelected ? 1 : 0.8);

        if (block.kind === 'segment') {
          const [x1, y1] = toSVG(block.p1.x, block.p1.y);
          const [x2, y2] = toSVG(block.p2.x, block.p2.y);

          return (
            <g key={block.id}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth="12" style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onSelectBlock(block.id); }} />
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--canvas-segment)" strokeWidth={strokeWidth} strokeLinecap="round" opacity={blockOpacity} pointerEvents="none" />
              {isSelected && !rollingMode && (
                <>
                  <circle cx={x1} cy={y1} r="8" fill="var(--canvas-segment)" stroke="white" strokeWidth="2" style={{ cursor: 'grab' }} onMouseDown={(e) => handleMouseDown(block.id, 'p1', e)} />
                  <circle cx={x2} cy={y2} r="8" fill="var(--canvas-segment)" stroke="white" strokeWidth="2" style={{ cursor: 'grab' }} onMouseDown={(e) => handleMouseDown(block.id, 'p2', e)} />
                </>
              )}
              {!isSelected && !rollingMode && (
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
          // Usar visualRadius para renderizado SVG
          const renderRadius = block.visualRadius;
          const startX = cx + renderRadius * Math.cos(block.startAngle);
          const startY = cy - renderRadius * Math.sin(block.startAngle);
          const endX = cx + renderRadius * Math.cos(block.endAngle);
          const endY = cy - renderRadius * Math.sin(block.endAngle);
          let angleDiff = block.endAngle - block.startAngle;
          if (angleDiff < 0) angleDiff += 2 * Math.PI;
          const largeArc = angleDiff > Math.PI ? 1 : 0;
          const pathData = `M ${startX} ${startY} A ${renderRadius} ${renderRadius} 0 ${largeArc} 0 ${endX} ${endY}`;

          return (
            <g key={block.id}>
              <path d={pathData} fill="none" stroke="transparent" strokeWidth="12" style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onSelectBlock(block.id); }} />
              <path d={pathData} fill="none" stroke="var(--canvas-arc)" strokeWidth={strokeWidth} strokeLinecap="round" opacity={blockOpacity} pointerEvents="none" />
              {isSelected && !rollingMode && (
                <>
                  <circle cx={cx} cy={cy} r="7" fill="var(--canvas-arc)" stroke="white" strokeWidth="2" style={{ cursor: 'grab' }} onMouseDown={(e) => handleMouseDown(block.id, 'center', e)} />
                  <circle cx={startX} cy={startY} r="8" fill="var(--canvas-arc)" stroke="white" strokeWidth="2" style={{ cursor: 'grab' }} onMouseDown={(e) => handleMouseDown(block.id, 'start', e)} />
                  <circle cx={endX} cy={endY} r="8" fill="var(--canvas-arc)" stroke="white" strokeWidth="2" style={{ cursor: 'grab' }} onMouseDown={(e) => handleMouseDown(block.id, 'end', e)} />
                </>
              )}
              {!isSelected && !rollingMode && (
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
      {!rollingMode && !showContactDisks && crossings.map((cross) => {
        const [cx, cy] = toSVG(cross.position.x, cross.position.y);
        return (
          <g key={cross.id}>
            <circle cx={cx} cy={cy} r="7" fill="var(--canvas-cross)" stroke="white" strokeWidth="2" pointerEvents="none" />
            <title>Cruce: {cross.block1} ⨯ {cross.block2}\n({cross.position.x.toFixed(2)}, {cross.position.y.toFixed(2)})</title>
          </g>
        );
      })}

      {/* Etiqueta de origen */}
      <text x={centerX + 8} y={centerY - 8} fontSize="11" fill="var(--text-tertiary)" fontFamily="var(--ff-mono)" pointerEvents="none">(0,0)</text>

      {/* Contador de cruces */}
      {!rollingMode && !showContactDisks && crossings.length > 0 && (
        <text x="16" y="24" fontSize="12" fill="var(--canvas-cross)" fontFamily="var(--ff-mono)" fontWeight="600" pointerEvents="none">
          ⨯ {crossings.length} cruce{crossings.length !== 1 ? 's' : ''}
        </text>
      )}

      {/* Contador de discos */}
      {disks.length > 0 && (
        <text x="16" y="24" fontSize="12" fill="#4A90E2" fontFamily="var(--ff-mono)" fontWeight="600" pointerEvents="none">
          🔵 {disks.length} disco{disks.length !== 1 ? 's' : ''}
        </text>
      )}

      {/* Contador de discos de contacto */}
      {showContactDisks && regions.length > 0 && disks.length === 0 && (
        <text x="16" y="24" fontSize="12" fill="#4A90E2" fontFamily="var(--ff-mono)" fontWeight="600" pointerEvents="none">
          🔵 {regions.length} disco{regions.length !== 1 ? 's' : ''} de contacto
        </text>
      )}
    </svg>
  );
}
