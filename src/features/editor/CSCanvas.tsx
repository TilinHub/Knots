import React from 'react';
import type { CSBlock, CSDisk, Point2D, CSArc } from '@/core/types/cs';
import { findAllCrossings, findDiskContacts, type DiskContact } from '@/core/geometry/intersections';
import { detectRegionsWithDisks } from '@/core/algorithms/regionDetection';
import { type Disk } from '@/core/geometry/diskHull';
import { useDiskHull } from '@/features/editor/hooks/useDiskHull';
import { KnotRenderer } from './components/KnotRenderer';
import type { KnotDiagram } from '@/core/types/knot';
import { DubinsRenderer } from './components/DubinsRenderer';
import type { DubinsPath, Config } from '@/core/geometry/dubins';
import { useContactGraph } from './hooks/useContactGraph';
import { useContactPath } from './hooks/useContactPath';
import { ContactGraphRenderer } from './components/ContactGraphRenderer';
import { ContactPathRenderer } from './components/ContactPathRenderer';


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
  showEnvelope?: boolean; // [NEW]
  // Dubins props
  dubinsMode?: boolean;
  dubinsPaths?: DubinsPath[];
  dubinsStart?: Config | null;
  dubinsEnd?: Config | null;
  dubinsVisibleTypes?: Set<string>;
  startDiskId?: string | null;
  endDiskId?: string | null;
  onSetDubinsStart?: (c: Config | null) => void;
  onSetDubinsEnd?: (c: Config | null) => void;
  // Persistent Dubins
  persistentDubinsState?: any; // Avoiding circular dependency hell by using any or creating shared type. 
  // Ideally "PersistentDubinsState" but it is exported from a hook. 
  // Let's use any for speed or duplicate interface. Using 'any' for now to avoid circular import of hook file.
  persistentDubinsActions?: any;
}

type PointType = 'p1' | 'p2' | 'center' | 'start' | 'end' | 'disk';

interface DragState {
  blockId: string;
  pointType: PointType;
  dragSubtype?: 'move' | 'rotate'; // NEW
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
  gridSpacing = 50,
  width = 800,
  height = 600,
  rollingMode = false,
  pivotDiskId = null,
  rollingDiskId = null,
  theta = 0,
  showTrail = true,
  onDiskClick,
  showContactDisks = false,
  showEnvelope = true, // [NEW] Default true
  knotMode = false,
  knot = null,
  onKnotSegmentClick,
  dubinsMode = false,
  dubinsPaths = [],
  dubinsStart = null,
  dubinsEnd = null,
  dubinsVisibleTypes = new Set(),
  startDiskId,
  endDiskId,
  onSetDubinsStart,
  onSetDubinsEnd,
  persistentDubinsState,
  persistentDubinsActions
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

  // Detectar contactos entre discos (Dubins constraint)
  const contacts = React.useMemo(() => findDiskContacts(disks), [disks]);

  // NEW: Contact Graph Integration
  // Map CSDisk to ContactDisk
  const contactDisks = React.useMemo(() => disks.map(d => ({
    id: d.id,
    center: d.center,
    radius: d.visualRadius,
    regionId: 'default'
  })), [disks]);

  const contactGraph = useContactGraph(contactDisks);

  // NEW: Active Path Selection Hook
  const { diskSequence, activePath, toggleDisk, clearSequence } = useContactPath(contactGraph);

  // Import ContactPathRenderer locally or at top
  const interactMode = dubinsMode ? 'dubins' : 'standard'; // Just using flag for now

  // Update handleMouseDown to toggle disks if in correct mode
  // But dubinsMode is currently used for "Dubins". Let's repurpose it or add 'contactMode'.
  // User wants "Todo el Implementation Plan", which replaced Dubins.
  // So 'dubinsMode' effectively becomes 'ContactGraphMode'.


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

      const minDistance = currentR + otherR;

      // Strict overlap check (no -1 tolerance)
      if (distance < minDistance) {
        // Unsticking logic: Allow moving away if already overlapping
        const oldDx = current.center.x - other.center.x;
        const oldDy = current.center.y - other.center.y;
        const oldDistance = Math.sqrt(oldDx * oldDx + oldDy * oldDy);

        // If we were strictly inside (bad state) and we are improving (moving out), allow it.
        if (oldDistance < minDistance && distance > oldDistance) {
          continue;
        }
        return true;
      }
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

    // DUBINS INTERACTION
    if (dubinsMode) {
      const pos = getMousePositionExact(e as any);
      if (!pos) return;

      // Transform SVG Y (Down) to Cartesian Y (Up)
      const cartX = pos.x;
      const cartY = pos.y; // Correct? fromSVGExact returns: { x: svgX - centerX, y: centerY - svgY }
      // Ah, fromSVGExact ALREADY converts to Cartesian (Y Up relative to center).
      // Standard Math atan2(y, x) works directly on these coords.

      // Logic:
      // 1. If Start is not set, we place Start.
      // 2. If Start is set but End is not, we place End.
      // 3. If both set, simple click clears? Or dragging modifies closest?
      // Let's go simple: Click clears if both exist.

      // Hit Testing
      const hitRadius = 30; // Increased from 20 for better usability

      const checkHit = (c: Config | null, id: string): 'move' | 'rotate' | null => {
        if (!c) return null;
        const distBase = Math.sqrt(Math.pow(cartX - c.x, 2) + Math.pow(cartY - c.y, 2));
        if (distBase < hitRadius) return 'move';

        const tipX = c.x + 40 * Math.cos(c.theta);
        const tipY = c.y + 40 * Math.sin(c.theta);
        const distTip = Math.sqrt(Math.pow(cartX - tipX, 2) + Math.pow(cartY - tipY, 2));
        if (distTip < hitRadius) return 'rotate';

        return null;
      };

      // Check hits (Allow dragging even if disk is selected)
      const hitStart = checkHit(dubinsStart, 'dubins-start');
      const hitEnd = checkHit(dubinsEnd, 'dubins-end');

      if (hitStart) {
        setDragState({
          blockId: 'dubins-start',
          pointType: 'start',
          dragSubtype: hitStart,
          startX: cartX,
          startY: cartY
        });
        return;
      }

      if (hitEnd) {
        setDragState({
          blockId: 'dubins-end',
          pointType: 'end',
          dragSubtype: hitEnd,
          startX: cartX,
          startY: cartY
        });
        return;
      }

      // PLACEMENT LOGIC

      // If we clicked a Disk (based on blockId and pointType passed to handleMouseDown)
      // We should trigger the Selection Logic.
      if (blockId && pointType === 'disk') {
        // Verify it's a disk 
        // (handleMouseDown is called with 'disk' only from the disk render loop)

        // FIX: If rolling mode is active, let the specific rolling handler below take care of it
        // to avoid double-toggling selection.
        if (!rollingMode) {
          onDiskClick?.(blockId);
        }
        // Do NOT return here. We want to allow standard drag logic (setDragState below) to execute.
      }
    }

    if (rollingMode && onDiskClick) {
      const block = blocks.find(b => b.id === blockId);
      if (block?.kind === 'disk') onDiskClick(blockId);
      return;
    }
    const pos = getMousePositionExact(e as any); // Simplificado para usar coordenadas base
    if (!pos) return;

    // ... Standard (rest of legacy logic remains) ...
    // Necesitamos posición 'SVG' cruda para delta tracking preciso visualmente si queremos
    // pero fromSVGExact ya nos da el punto en el espacio lógico. Usaremos ese.
    // Para consistencia con lógica anterior:
    const rect = svgRef.current!.getBoundingClientRect();
    const rawX = (e.clientX - rect.left) * (width / rect.width);
    const rawY = (e.clientY - rect.top) * (height / rect.height);

    // Helper for snapping (Using component-level findClosestDisk)

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

    if (dubinsMode && dragState.pointType !== 'disk') {
      // Manual Dubins Logic (Config Arrow Dragging)
      const pos = getMousePositionExact(e);
      if (!pos) return;
      // ... (rest of logic) ...

      if (!pos) return;

      const currentX = pos.x;
      const currentY = pos.y;

      const isStart = dragState.blockId === 'dubins-start';
      const currentConfig = isStart ? dubinsStart : dubinsEnd;
      const setConfig = isStart ? onSetDubinsStart : onSetDubinsEnd;

      if (!currentConfig) return;

      if (dragState.dragSubtype === 'move') {
        let targetX = currentX;
        let targetY = currentY;

        // Check if constrained to a disk
        const constrainedDiskId = isStart ? startDiskId : endDiskId;

        if (constrainedDiskId) {
          const disk = disks.find(d => d.id === constrainedDiskId);
          if (disk) {
            // Snap strictly to disk boundary
            const dx = currentX - disk.center.x;
            const dy = currentY - disk.center.y;
            const angle = Math.atan2(dy, dx);

            targetX = disk.center.x + disk.visualRadius * Math.cos(angle);
            targetY = disk.center.y + disk.visualRadius * Math.sin(angle);

            // Auto-set theta to Tangent
            // Default to CCW tangent: Angle + PI/2
            const targetTheta = angle + Math.PI / 2;

            setConfig?.({
              x: targetX,
              y: targetY,
              theta: targetTheta
            });
            return; // Skip other logic
          }
        }

        // Standard Snap to Contact Point if hovering one (Manual Mode)
        let closestContact: DiskContact | null = null;
        let minDist = 30; // Snap radius

        for (const c of contacts) {
          const dist = Math.sqrt(Math.pow(currentX - c.point.x, 2) + Math.pow(currentY - c.point.y, 2));
          if (dist < minDist) {
            minDist = dist;
            closestContact = c;
          }
        }

        if (closestContact) {
          targetX = closestContact.point.x;
          targetY = closestContact.point.y;
          // Also force orientation? User might want to adjust orientation manually, 
          // but user request implies strict strictness.
          // Let's snap position but let orientation be free IF dragging rotation?
          // Wait, this is 'move' subtype. 
          // Should we also snap theta if we snap POS?
          // Usually yes, the contact implies a specific tangent.
          // Let's snap theta too for convenience.
          setConfig?.({
            x: targetX,
            y: targetY,
            theta: closestContact.tangentAngle
          });
        } else {
          // If not snapping to contact, allow free move OR block it?
          // User said "no hacer dubins en el aire". 
          // Maybe we only update if snapped?
          // Or we allow free move but rely on visual feedback.
          // Let's allow free move for now but heavy snap availability.
          setConfig?.({ ...currentConfig, x: targetX, y: targetY });
        }
      } else {
        const dx = currentX - currentConfig.x;
        const dy = currentY - currentConfig.y;
        const theta = Math.atan2(dy, dx);
        setConfig?.({ ...currentConfig, theta });
      }
      return;
    }


    if (rollingMode) return;
    // ... rest of standard logic ...

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
        if (e.target === e.currentTarget) {
          onSelectBlock(null);
          // Ensure Dubins gets triggered if we click background
          if (dubinsMode) {
            persistentDubinsActions?.setHoverDiskId(null);
            // Optional: Clear active disk? 
            // persistentDubinsActions?.setActiveDiskId(null);
          } else if (e.currentTarget) {
            handleMouseDown('background', 'p1', e);
          }
        }
      }}
    >
      <defs>
        {/* Sub-grid (e.g., 20px) */}
        <pattern id="smallGrid" width={gridSpacing / 5} height={gridSpacing / 5} patternUnits="userSpaceOnUse">
          <path d={`M ${gridSpacing / 5} 0 L 0 0 0 ${gridSpacing / 5}`} fill="none" stroke="#F5F5F5" strokeWidth="1" />
        </pattern>
        {/* Main Grid (e.g., 100px) */}
        <pattern id="largeGrid" width={gridSpacing} height={gridSpacing} patternUnits="userSpaceOnUse">
          <rect width={gridSpacing} height={gridSpacing} fill="url(#smallGrid)" />
          <path d={`M ${gridSpacing} 0 L 0 0 0 ${gridSpacing}`} fill="none" stroke="#E0E0E0" strokeWidth="1" />
        </pattern>
      </defs>

      {/* Grid Background */}
      {showGrid && <rect width="100%" height="100%" fill="url(#largeGrid)" />}

      {/* Ejes */}
      <line x1="0" y1={centerY} x2={width} y2={centerY} stroke="#ddd" strokeWidth="1" />
      <line x1={centerX} y1="0" x2={centerX} y2={height} stroke="#ddd" strokeWidth="1" />

      {/* BELT (Convex Hull) OR KNOT */}
      {!knotMode && hullData && showEnvelope && (
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

      {/* Contact Graph Overlay (Global Tangent Network) - HIDDEN BY DEFAULT (Too messy) */}
      <g transform={`translate(${centerX}, ${centerY}) scale(1, -1)`}>
        {/* Only show if explicitly enabled for debugging or specific mode */}
        {/* <ContactGraphRenderer graph={contactGraph} visible={!dubinsMode} /> */}
        {/* Active Path Highlight */}
        <ContactPathRenderer path={activePath} visible={true} />
      </g>

      {/* DISK CONTACT LINES (Penny Graph Edges) */}
      {disks.map((d1, i) =>
        disks.slice(i + 1).map((d2) => {
          const dist = Math.sqrt(Math.pow(d1.center.x - d2.center.x, 2) + Math.pow(d1.center.y - d2.center.y, 2));
          const threshold = d1.visualRadius + d2.visualRadius + 0.5; // Tolerance
          if (dist <= threshold) {
            const [x1, y1] = toSVG(d1.center.x, d1.center.y);
            const [x2, y2] = toSVG(d2.center.x, d2.center.y);
            return (
              <line
                key={`contact-${d1.id}-${d2.id}`}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="#5CA0D3"
                strokeWidth="2"
              />
            );
          }
          return null;
        })
      )}

      {dubinsMode && (
        <g transform={`translate(${centerX}, ${centerY}) scale(1, -1)`}>
          {/* 1. Selected Paths (Behind) */}
          <DubinsRenderer
            selectedPaths={persistentDubinsState?.visibleSelectedPaths}
          // Pass empty candidates here to avoid duplication
          />
          {/* Legacy Support if needed */}
          <DubinsRenderer
            paths={dubinsPaths || []}
            startConfig={dubinsStart || null}
            endConfig={dubinsEnd || null}
            visibleTypes={dubinsVisibleTypes || new Set()}
          />

          {/* Render Contacts */}
          {contacts.map((c, i) => (
            <g key={`contact-${i}`}
              transform={`translate(${c.point.x}, ${c.point.y})`}
              style={{ cursor: 'pointer' }}
              onMouseDown={(e) => {
                e.stopPropagation();
                // We disable manual contact point selection in favor of Disk-to-Disk selection.
                // Keep the visual contact point for reference but no interaction for now.
              }}
            >
              <circle r="6" fill="#FF8C00" stroke="white" strokeWidth="2" />
              {/* Tangent Guide */}
              <line x1="-10" y1="0" x2="10" y2="0" stroke="#FF8C00" strokeWidth="1" transform={`rotate(${c.tangentAngle * 180 / Math.PI})`} opacity="0.5" />
            </g>
          ))}
        </g>
      )}

      {/* Discos */}
      {disks.map((disk, index) => {
        // Default position
        let [cx, cy] = toSVG(disk.center.x, disk.center.y);

        // Override position if this is the rolling disk
        if (rollingMode && disk.id === rollingDiskId && rollingDiskPosition) {
          [cx, cy] = toSVG(rollingDiskPosition.center.x, rollingDiskPosition.center.y);
        }

        const isSelected = disk.id === selectedBlockId;
        const isStart = startDiskId === disk.id;
        const isEnd = endDiskId === disk.id;
        const radius = disk.visualRadius;

        let fill = "#89CFF0"; // Baby Blue
        let stroke = isSelected ? "#2E6BA8" : "#5CA0D3";
        let strokeWidth = 2; // User requested no thickening on selection

        if (rollingMode) {
          if (disk.id === pivotDiskId) {
            fill = "rgba(100, 200, 100, 0.5)"; // Greenish for Pivot
            stroke = "#2E8B57";
            strokeWidth = 3;
          } else if (disk.id === rollingDiskId) {
            fill = "rgba(255, 165, 0, 0.6)"; // Orange for Rolling
            stroke = "#FF8C00";
            strokeWidth = 3;
          }
        } else if (dubinsMode) {
          if (isStart) {
            fill = "rgba(100, 255, 100, 0.6)";
            stroke = "rgba(50, 200, 50, 0.9)";
            strokeWidth = 4;
          } else if (isEnd) {
            fill = "rgba(255, 100, 100, 0.6)";
            stroke = "rgba(200, 50, 50, 0.9)";
            strokeWidth = 4;
          }
        }

        return (
          <g key={disk.id}
            onMouseDown={(e) => {
              // Always use handleMouseDown to allow dragging + clicking
              handleMouseDown(disk.id, 'disk', e);
            }}
            onMouseEnter={() => {
              if (dubinsMode) {
                persistentDubinsActions?.setHoverDiskId(disk.id);
              }
            }}
            // REMOVED onMouseLeave to keep candidates visible for selection
            style={{ cursor: interactMode === 'dubins' ? 'crosshair' : 'grab' }}
          >
            {/* Relleno Azul Penny Graph style */}
            <circle
              cx={cx}
              cy={cy}
              // Compensate for stroke difference so visual boundary stays constant
              // Unselected: Stroke 2 (Offset 1). Selected: Stroke 2 (Offset 1).
              // We want R_visual = r + 1.
              // So r = radius.
              r={diskSequence.includes(disk.id) ? radius - 1 : radius}
              fill={diskSequence.includes(disk.id) ? "#FF4500" : fill} // Highlight selection
              fillOpacity={diskSequence.includes(disk.id) ? 0.4 : 1}
              stroke={diskSequence.includes(disk.id) ? "#FF4500" : stroke}
              strokeWidth={diskSequence.includes(disk.id) ? 4 : 2}
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
              style={{ userSelect: 'none' }}
            >
              {index}
            </text>

            {/* Centro y Coordenadas (NUEVO) */}
            <circle cx={cx} cy={cy} r={2} fill="black" pointerEvents="none" />
            <text
              x={cx}
              y={cy + 12}
              textAnchor="middle"
              fontFamily="monospace"
              fontSize="10"
              fill="rgba(0,0,0,0.8)"
              pointerEvents="none"
              style={{ userSelect: 'none', textShadow: '0px 0px 2px white' }}
            >
              {`(${(disk.center.x / 50).toFixed(2)}, ${(disk.center.y / 50).toFixed(2)})`}
            </text>
          </g>
        );
      })}

      {/* DUBINS CANDIDATES (FRONT OF DISKS) */}
      {dubinsMode && (
        <g transform={`translate(${centerX}, ${centerY}) scale(1, -1)`}>
          <DubinsRenderer
            candidates={persistentDubinsState?.candidates}
            onPathClick={persistentDubinsActions?.handlePathClick}
            hoverPathType={persistentDubinsState?.hoverPathType}
            onPathHover={persistentDubinsActions?.setHoverPathType}
          />
        </g>
      )}

      {/* Resto de bloques (Segmentos/Arcos) si existen */}
      {nonDiskBlocks.map((block) => (
        // ... (Renderizado mínimo para no romper app si hay otros bloques)
        null
      ))}

    </svg>
  );
}
