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
import { ContactPathRenderer } from './components/ContactPathRenderer'; // Still used for activePath
import { KnotLayer } from '@/renderer/layers/KnotLayer';
import { DubinsLayer } from '@/renderer/layers/DubinsLayer';
import { StandardLayer } from '@/renderer/layers/StandardLayer';
import type { EnvelopeSegment } from '@/core/geometry/contactGraph';
import { computeOuterContour } from '@/core/geometry/outerFace';
import { computeRobustConvexHull } from '@/core/geometry/robustHull';
import { findEnvelopePathFromPoints, findEnvelopePath, buildBoundedCurvatureGraph } from '@/core/geometry/contactGraph';

// ── FLAG: Outer Contour for Envelope Display ────────────────────
// Set to `false` to revert to the old convex-hull-only envelope.
// This flag ONLY affects envelope display (!knotMode && showEnvelope).
// It does NOT affect: knot-mode paths, saved knot paths, Dubins, load/save.
const USE_OUTER_CONTOUR_ENVELOPE = true;

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
  theta?: number; // [RESTORED]
  showTrail?: boolean;
  onDiskClick?: (diskId: string) => void;
  // Knot props
  knotMode?: boolean; // [RESTORED] Fallback
  knotPath?: EnvelopeSegment[]; // [RESTORED] Fallback
  knotSequence?: string[]; // [RESTORED] Fallback
  anchorSequence?: { x: number, y: number }[] | any[]; // [RESTORED] Fallback + DynamicAnchor support

  knotState?: any; // [NEW] Pass full state
  savedKnotPaths?: { id: string, color: string, path: EnvelopeSegment[] }[]; // [NEW]
  onKnotSegmentClick?: (index: number) => void;
  onKnotPointClick?: (diskId: string, point: Point2D) => void; // [NEW]
  // Appearance
  diskColor?: string;
  envelopeColor?: string;
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
  offsetX?: number; // [NEW]
  offsetY?: number; // [NEW]
  hasMoved?: boolean; // [NEW] to distinguish click vs drag
  lastAdded?: string; // [NEW] Track last added/visited disk in this gesture
  pendingUndo?: boolean; // [NEW] If true, we only toggle (undo) on MouseUp if didn't move
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
  knotState,
  savedKnotPaths = [], // [NEW]
  onKnotSegmentClick,
  onKnotPointClick, // [NEW]
  diskColor = '#89CFF0',
  envelopeColor = '#5CA0D3',
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
  persistentDubinsActions,
  ...props // Capture other props for fallback
}: CSCanvasProps) {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [dragState, setDragState] = React.useState<DragState | null>(null);
  const [trailPoints, setTrailPoints] = React.useState<Point2D[]>([]);

  // [FIX] Derive knot variables from knotState object, OR fallback to props
  const {
    mode: knotModeStringArg,
    diskSequence: knotSequenceArg,
    knotPath: knotPathArg,
    anchorPoints: anchorPointsArg,
    anchorSequence: rawAnchorSequence, // [NEW] Get raw anchors (diskId, angle)
    chiralities: knotChiralities, // [NEW] Get chiralities for topology
    actions: knotActions
  } = knotState || {};

  const knotMode = knotState ? (knotModeStringArg === 'knot') : (props.knotMode ?? false);
  const staticKnotPath = knotState ? knotPathArg : (props.knotPath || []);
  const knotSequence = knotState ? knotSequenceArg : (props.knotSequence || []);
  const anchorPoints = knotState ? anchorPointsArg : (props.anchorSequence || []);

  const centerX = width / 2;
  const centerY = height / 2;

  // Separar discos de otros bloques
  const disks = blocks.filter((b): b is CSDisk => b.kind === 'disk');
  const nonDiskBlocks = blocks.filter((b) => b.kind !== 'disk');

  // Calculate Rolling Position first
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

  // Create list of disks with overrides applied (for Hull and Contacts)
  const displayedDisks = React.useMemo(() => {
    if (!rollingDiskPosition || !rollingDiskId) return disks;
    return disks.map(d => {
      if (d.id === rollingDiskId) {
        return { ...d, center: rollingDiskPosition.center };
      }
      return d;
    });
  }, [disks, rollingDiskPosition, rollingDiskId]);

  // Mapear CSDisk a la estructura Disk que espera diskHull
  const simpleDisks = React.useMemo(() => displayedDisks.map(d => ({
    id: d.id,
    x: d.center.x,
    y: d.center.y,
    r: d.visualRadius
  })), [displayedDisks]);

  const hullData = useDiskHull(simpleDisks);


  // Detectar cruces solo en bloques no-disco
  const crossings = React.useMemo(() => findAllCrossings(nonDiskBlocks), [nonDiskBlocks]);

  // Detectar contactos entre discos (Dubins constraint)
  const contacts = React.useMemo(() => findDiskContacts(displayedDisks), [displayedDisks]);

  // NEW: Contact Graph Integration
  // Map CSDisk to ContactDisk
  const contactDisks = React.useMemo(() => displayedDisks.map(d => ({
    id: d.id,
    center: d.center,
    radius: d.visualRadius,
    regionId: 'default'
  })), [displayedDisks]);

  const contactGraph = useContactGraph(contactDisks);

  // DYNAMIC KNOT PATH for Rolling Mode
  // If we are rolling, the parent's knotPath is stale (based on static blocks).
  // We must recompute it using the *displayed* disks (which have the rolling position).
  const knotPath = React.useMemo(() => {
    if (rollingMode && knotMode) {

      // 1. Priority: True Elastic Envelope (Sequence + Chirality)
      // This respects the topology (L/R sequence) but re-solves the geometry continuously.
      // This is the "Rubber Band" behavior described in contact compass theory.
      if (knotSequence && knotSequence.length >= 2 && knotChiralities && knotChiralities.length > 0) {
        try {
          // Build a fresh graph from the CURRENT (rolling) disk positions
          const graph = buildBoundedCurvatureGraph(contactDisks, true, [], false);

          // Solve for the path using the saved sequence and chiralities
          const result = findEnvelopePath(graph, knotSequence, knotChiralities);

          if (result.path && result.path.length > 0) {
            return result.path;
          }
        } catch (e) {
          console.warn("Elastic Envelope calculation failed", e);
          // Fallback to point-based if topological solver fails
        }
      }

      // 2. Fallback: Use Raw Anchors (DiskID + Angle) to handle Rolling Rotation (Material Point)
      if (rawAnchorSequence && Array.isArray(rawAnchorSequence) && rawAnchorSequence.length > 0) {
        try {
          const dynamicPoints = rawAnchorSequence.map((anchor: any) => {
            const disk = displayedDisks.find(d => d.id === anchor.diskId);
            if (!disk) return { x: 0, y: 0 };

            let effectiveAngle = anchor.angle;
            // If this is the rolling disk, add spin
            if (anchor.diskId === rollingDiskId && rollingDiskPosition) {
              effectiveAngle += rollingDiskPosition.spinAngle;
            }

            return {
              x: disk.center.x + disk.visualRadius * Math.cos(effectiveAngle),
              y: disk.center.y + disk.visualRadius * Math.sin(effectiveAngle)
            };
          });

          const result = findEnvelopePathFromPoints(dynamicPoints, contactDisks);
          return result.path;
        } catch (e) {
          console.warn("Failed to recompute dynamic knot path from raw anchors", e);
        }
      }

      // 3. Fallback: Use static anchor points (only handles translation if anchors were updated, which they aren't)
      if (anchorPoints && anchorPoints.length > 0) {
        try {
          const result = findEnvelopePathFromPoints(anchorPoints, contactDisks);
          return result.path;
        } catch (e) {
          console.warn("Failed to recompute dynamic knot path from static points", e);
          return staticKnotPath;
        }
      }
    }
    return staticKnotPath;
  }, [rollingMode, knotMode, knotSequence, knotChiralities, rawAnchorSequence, anchorPoints, contactDisks, staticKnotPath, displayedDisks, rollingDiskId, rollingDiskPosition]);

  // ── LAYERS LOGIC ────────────────────────────────────────────────
  // Replaced manual computation with Layers (render-time or internal).
  // Standard Envelope -> StandardLayer (uses EditorEnvelopeComputer)
  // Knot Envelope -> KnotLayer (uses KnotEnvelopeComputer)


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
      // If we clicked a Disk ...
      // Logic moved to handleMouseUp to allow Click vs Drag differentiation.
    }

    // KNOT MODE INTERACTION
    // KNOT MODE INTERACTION
    // Removed blocking code to allow dragging.
    // Click logic moved to handleMouseUp (click vs drag detection).

    if (rollingMode && onDiskClick) {
      const block = blocks.find(b => b.id === blockId);
      if (block?.kind === 'disk') onDiskClick(block.id);
      return;
    }

    // KNOT MODE INTERACTION (Drag-to-Connect) - DISABLED
    // We only want points to construct the knot, not the disk body.
    /*
    if (knotMode && onDiskClick && !e.shiftKey) {
      const block = blocks.find(b => b.id === blockId);
      if (block?.kind === 'disk') {
        const isLastInfo = knotSequence.length > 0 && knotSequence[knotSequence.length - 1] === block.id;

        if (isLastInfo) {
          // Pending Undo: Wait to see if drag or click
          setDragState({
            blockId: block.id,
            pointType: 'disk',
            startX: 0,
            startY: 0,
            hasMoved: false,
            lastAdded: block.id,
            pendingUndo: true,
          });
        } else {
          // Add immediately
          onDiskClick(block.id);
          setDragState({
            blockId: block.id,
            pointType: 'disk',
            startX: 0,
            startY: 0,
            hasMoved: false,
            lastAdded: block.id,
            pendingUndo: false,
          });
        }
        return;
      }
    }
    */
    const pos = getMousePositionExact(e as any); // Simplificado para usar coordenadas base
    if (!pos) return;

    const block = blocks.find(b => b.id === blockId);

    // Calculate offset for absolute dragging
    let offsetX = 0;
    let offsetY = 0;
    if (block && block.kind === 'disk' && pointType === 'disk') {
      offsetX = pos.x - block.center.x;
      offsetY = pos.y - block.center.y;
    }

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
      offsetX,
      offsetY,
      hasMoved: false, // [NEW]
    });
    onSelectBlock(blockId);
  }

  // Helper to check trajectory collision against obstacles
  function checkTrajectoryIntersections(p1: Point2D, p2: Point2D): Point2D | null {
    if (!savedKnotPaths) return null;

    const obstacles: { p1: Point2D, p2: Point2D }[] = [];
    savedKnotPaths.forEach(k => {
      k.path.forEach(seg => {
        if ('start' in seg) {
          obstacles.push({ p1: seg.start, p2: seg.end });
        }
      });
    });

    let firstHit: Point2D | null = null;
    let minT = 1.0;

    for (const obs of obstacles) {
      const x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y;
      const x3 = obs.p1.x, y3 = obs.p1.y, x4 = obs.p2.x, y4 = obs.p2.y;

      const den = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
      if (Math.abs(den) < 1e-9) continue;

      const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / den;
      const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / den;

      if (ua > 0.001 && ua < 0.999 && ub > 0.001 && ub < 0.999) {
        if (ua < minT) {
          minT = ua;
          firstHit = {
            x: x1 + ua * (x2 - x1),
            y: y1 + ua * (y2 - y1)
          };
        }
      }
    }

    return firstHit;
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!dragState) return;

    const pos = getMousePositionExact(e);
    if (!pos) return;

    // 1. Knot Mode Dragging (Drawing) - UNLESS SHIFT IS PRESSED (Shift = Move Disk)
    if (knotMode && !e.shiftKey && dragState.pointType === 'disk' && dragState.offsetX === undefined) {
      // Find hovered disk
      const currentId = disks.find(d => {
        const dist = Math.sqrt(Math.pow(pos.x - d.center.x, 2) + Math.pow(pos.y - d.center.y, 2));
        return dist < d.visualRadius;
      })?.id;

      if (currentId && currentId !== dragState.lastAdded) {
        onDiskClick?.(currentId);
        setDragState(prev => prev ? ({ ...prev, lastAdded: currentId, pendingUndo: false }) : null);
      }
      return;
    }

    // 2. Dubins Mode Logic (Restored)
    if (dubinsMode && dragState.pointType !== 'disk') {
      // Manual Dubins Logic (Config Arrow Dragging)
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
          setConfig?.({
            x: targetX,
            y: targetY,
            theta: closestContact.tangentAngle
          });
        } else {
          setConfig?.({ ...currentConfig, x: targetX, y: targetY });
        }
      } else {
        // Rotate
        const dx = currentX - currentConfig.x;
        const dy = currentY - currentConfig.y;
        const theta = Math.atan2(dy, dx);
        setConfig?.({ ...currentConfig, theta });
      }
      return;
    }


    if (rollingMode) return;

    const { blockId, pointType, offsetX, offsetY } = dragState;
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;

    // 3. Absolute Dragging Logic using Offset (Disk)
    if (block.kind === 'disk' && pointType === 'disk' && offsetX !== undefined && offsetY !== undefined) {

      // [FIX] Prevent dragging in Knot Mode (unless Shift is held)
      if (knotMode && !e.shiftKey) return;

      const targetX = pos.x - offsetX;
      const targetY = pos.y - offsetY;

      let newCenter = { x: targetX, y: targetY };
      const oldCenter = block.center;

      // TRAJECTORY CHECK (Drag Constraint)
      const collision = checkTrajectoryIntersections(oldCenter, newCenter);
      if (collision) {
        // Clamp
        newCenter = collision;
      }

      if (!checkDiskOverlap(block.id, newCenter)) {
        onUpdateBlock(block.id, { center: newCenter } as Partial<CSBlock>);

        const rect = svgRef.current!.getBoundingClientRect();
        const svgX = (e.clientX - rect.left) * (width / rect.width);
        const svgY = (e.clientY - rect.top) * (height / rect.height);
        const moveDist = Math.sqrt(Math.pow(svgX - dragState.startX, 2) + Math.pow(svgY - dragState.startY, 2));

        if (!dragState.hasMoved && moveDist > 2) {
          setDragState(prev => prev ? ({ ...prev, hasMoved: true }) : null);
        }
      }
    }
  }

  function handleMouseUp() {
    if (dragState && !dragState.hasMoved && dragState.pointType === 'disk') {

      // KNOT MODE UNDO
      if (knotMode && dragState.pendingUndo) {
        onDiskClick?.(dragState.blockId);
      }

      const block = blocks.find(b => b.id === dragState.blockId);
      // Only trigger click if block exists and is disk
      // Handles Knot Mode (Legacy/Fallback), and potentially Dubins/Rolling if they use onDiskClick
      if (block?.kind === 'disk' && !knotMode) { // Prevent double trigger in Knot Mode
        onDiskClick?.(block.id);
      }
    }
    setDragState(null);
  }

  // Helper inside component to access toSVG
  function describeArc(disk: CSDisk, arc: any): string {
    const [startX, startY] = toSVG(arc.start.x, arc.start.y);
    const [endX, endY] = toSVG(arc.end.x, arc.end.y);
    // Fallback to straight line for now to ensure build passes and "Save" visualization works at least as lines
    return `M ${startX} ${startY} L ${endX} ${endY}`;
  }

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox={`0 0 ${width} ${height}`}
      style={{ background: 'var(--canvas-bg)', cursor: dragState ? 'grabbing' : 'default' }} // Fondo adaptable
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
          <path d={`M ${gridSpacing / 5} 0 L 0 0 0 ${gridSpacing / 5}`} fill="none" stroke="var(--canvas-grid)" strokeWidth="1" strokeOpacity="0.5" />
        </pattern>
        {/* Main Grid (e.g., 100px) */}
        <pattern id="largeGrid" width={gridSpacing} height={gridSpacing} patternUnits="userSpaceOnUse">
          <rect width={gridSpacing} height={gridSpacing} fill="url(#smallGrid)" />
          <path d={`M ${gridSpacing} 0 L 0 0 0 ${gridSpacing}`} fill="none" stroke="var(--canvas-grid)" strokeWidth="1" />
        </pattern>
      </defs>

      {/* Grid Background */}
      {showGrid && <rect width="100%" height="100%" fill="url(#largeGrid)" />}

      {/* Ejes - Only show if Grid is on */}
      {showGrid && (
        <>
          <line x1="0" y1={centerY} x2={width} y2={centerY} stroke="var(--border)" strokeWidth="1" />
          <line x1={centerX} y1="0" x2={centerX} y2={height} stroke="var(--border)" strokeWidth="1" />
        </>
      )}


      {/* BELT (Outer Contour or Convex Hull) — ENVELOPE DISPLAY */}

      {/* LAYERS */}

      {/* 1. Standard Envelope (Editor Mode) */}
      <StandardLayer
        visible={true}
        blocks={blocks}
        showEnvelope={showEnvelope}
        envelopeColor={envelopeColor}
        knotMode={knotMode}
        context={{ width, height }}
      />

      {/* 2. Knot Layer (Envelope + Path) */}
      <KnotLayer
        visible={true}
        blocks={blocks}
        knotPath={knotPath}
        anchorPoints={anchorPoints}
        showEnvelope={showEnvelope}
        envelopeColor={envelopeColor}
        knotMode={knotMode}
        onKnotPointClick={onKnotPointClick}
        savedKnotPaths={savedKnotPaths}
        context={{ width, height }} // If needed
      />


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
                stroke={envelopeColor}
                strokeWidth="2"
              />
            );
          }
          return null;
        })
      )}

      {/* 3. Dubins Layer (Background) */}
      <DubinsLayer
        visible={true}
        plane="background"
        dubinsMode={dubinsMode}
        persistentDubinsState={persistentDubinsState}
        persistentDubinsActions={persistentDubinsActions}
        dubinsPaths={dubinsPaths}
        dubinsStart={dubinsStart}
        dubinsEnd={dubinsEnd}
        dubinsVisibleTypes={dubinsVisibleTypes}
        blocks={blocks}
      />

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
        const isKnotSelected = knotMode && knotSequence.includes(disk.id);
        const radius = disk.visualRadius;

        let fill = diskColor;
        let stroke = isSelected ? "#2E6BA8" : envelopeColor;
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
        } else if (knotMode && knotSequence.length > 0 && knotSequence[0] === disk.id) {
          // Highlight Start Disk in Knot Mode to help closing the loop
          fill = "rgba(50, 205, 50, 0.2)"; // Subtle Green
          stroke = "#32CD32"; // Lime Green
          strokeWidth = 3;
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

        if (isKnotSelected) {
          // User requested same color as normal modes. 
          // We keep fill as diskColor.
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
              r={radius} // Don't shrink
              fill={fill}
              fillOpacity={isKnotSelected ? 0.6 : 1}
              stroke={stroke}
              strokeWidth={strokeWidth}
            />
            {/* Etiqueta (Índice) - Original */}
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

            {/* Sequence Order Badge (Knot Mode) */}
            {isKnotSelected && (
              <text
                x={cx}
                y={cy}
                dy=".3em"
                textAnchor="middle"
                fontFamily="Arial"
                fontSize="16"
                fill="white"
                fontWeight="bold"
                pointerEvents="none"
                style={{
                  userSelect: 'none',
                  textShadow: '0px 0px 3px rgba(0,0,0,0.5)'
                }}
              >
                {knotSequence
                  .map((id: string, idx: number) => id === disk.id ? idx + 1 : -1)
                  .filter((i: number) => i !== -1)
                  .join(', ')}
              </text>
            )}

            {/* Centro y Coordenadas (NUEVO) - Hide center info if knot selected to clearer view? Or keep small? */}
            {!isKnotSelected && (
              <>
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
              </>
            )}
          </g>
        );
      })}

      {/* [NEW] Knot Mode Anchors (Rendered on top of everything) */}
      {knotMode && disks.map(disk => {
        const r = disk.visualRadius;
        const { x, y } = disk.center;
        // 4 Anchors: N, S, E, W
        const anchors = [
          { x: x, y: y + r }, // N
          { x: x, y: y - r }, // S
          { x: x + r, y: y }, // E
          { x: x - r, y: y }, // W
        ];
        return anchors.map((p, i) => {
          const [sx, sy] = toSVG(p.x, p.y);
          return (
            <circle
              key={`${disk.id}-anchor-${i}`}
              cx={sx} cy={sy}
              r={5}
              fill="#FF4500" // Red-Orange
              stroke="white"
              strokeWidth={1.5}
              cursor="pointer"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onKnotPointClick?.(disk.id, { x: p.x, y: p.y });
              }}
            />
          );
        });
      })}


      {/* Current Active Knot Construction */}
      {knotMode && (
        <g transform={`translate(${centerX}, ${centerY}) scale(1, -1)`}>
          <ContactPathRenderer path={knotPath} visible={true} color="#FF0000" width={4} />
        </g>
      )}

      {/* 4. Dubins Layer (Foreground Candidates) */}
      <DubinsLayer
        visible={true}
        plane="foreground"
        dubinsMode={dubinsMode}
        persistentDubinsState={persistentDubinsState}
        persistentDubinsActions={persistentDubinsActions}
        dubinsPaths={dubinsPaths}
        dubinsStart={dubinsStart}
        dubinsEnd={dubinsEnd}
        dubinsVisibleTypes={dubinsVisibleTypes}
        blocks={blocks}
      />

      {/* [NEW] DEBUG: Render Selected Anchor Points (Purple) */}
      {knotMode && anchorPoints?.map((p: any, i: number) => {
        const [cx, cy] = toSVG(p.x, p.y);
        return (
          <circle
            key={`debug-anchor-${i}`}
            cx={cx} cy={cy}
            r={6}
            fill="#8A2BE2" // BlueViolet / Purple
            stroke="white"
            strokeWidth={2}
            pointerEvents="none"
          />
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
