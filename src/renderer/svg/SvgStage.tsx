import React from "react";
import type { Scene, Point, Primitive } from "../../core/model/entities";
import { computeDiskHull } from "../../core/geometry/diskHull";

export type BBox = { x: number; y: number; width: number; height: number };
export type ToolMode = "move" | "add" | "delete" | "link";

const COLORS = {
  bg: "#ffffff",

  // dashed graph edges (thin)
  edge: "rgba(91, 143, 189, 0.75)",
  edgePreview: "rgba(91, 143, 189, 1)",

  // hull (unchanged)
  hull: "#a855f7",
  hullStrokeWidth: 10,

  // nodes: solid purple (no transparency) + darker purple thin stroke
  nodeFill: "#A78BFA",          // solid purple
  nodeStroke: "#4C1D95",        // dark purple
  selectedNodeStroke: "#2E1065", // even darker purple

  nodeText: "#111827",
};

type ViewBox = { minX: number; minY: number; width: number; height: number };

function clamp(x: number, a: number, b: number) {
  return Math.max(a, Math.min(b, x));
}

function viewBoxToString(vb: ViewBox) {
  return `${vb.minX} ${vb.minY} ${vb.width} ${vb.height}`;
}

function clientToSvgPoint(
  e: { clientX: number; clientY: number },
  svg: SVGSVGElement,
  vb: ViewBox
) {
  const rect = svg.getBoundingClientRect();
  const px = (e.clientX - rect.left) / rect.width;
  const py = (e.clientY - rect.top) / rect.height;
  return { x: vb.minX + px * vb.width, y: vb.minY + py * vb.height };
}

export function SvgStage(props: {
  scene: Scene;

  mode: ToolMode;

  selectedPointId: string | null;
  onSelectPoint: (id: string | null) => void;

  onMeasuredBBox: (bbox: BBox | null) => void;

  onAddPoint: (pt: { x: number; y: number }) => void;
  onMovePoint: (id: string, pt: { x: number; y: number }) => void;
  onDeletePoint: (id: string) => void;

  linkA: string | null;
  onPickLinkA: (id: string | null) => void;
  onToggleSegment: (a: string, b: string) => void;

  showHull?: boolean;
  showGrid?: boolean;
}) {
  const {
    scene,
    mode,
    selectedPointId,
    onSelectPoint,
    onMeasuredBBox,
    onAddPoint,
    onMovePoint,
    onDeletePoint,
    linkA,
    onPickLinkA,
    onToggleSegment,
    showHull = true,
    showGrid = false,
  } = props;

  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const selectedCircleRef = React.useRef<SVGCircleElement | null>(null);

  const [vb, setVb] = React.useState<ViewBox>({ minX: -250, minY: -180, width: 500, height: 360 });

  React.useLayoutEffect(() => {
    if (!selectedPointId || !selectedCircleRef.current) {
      onMeasuredBBox(null);
      return;
    }
    const b = selectedCircleRef.current.getBBox();
    onMeasuredBBox({ x: b.x, y: b.y, width: b.width, height: b.height });
  }, [selectedPointId, scene, onMeasuredBBox]);

  const pointsById = React.useMemo(() => {
    const m = new Map<string, Point>();
    for (const p of scene.points) m.set(p.id, p);
    return m;
  }, [scene.points]);

  // Usar radio geométrico (radius) para cálculos del hull
  const disks = React.useMemo(
    () => scene.points.map((p) => ({ id: p.id, x: p.x, y: p.y, r: scene.radius })),
    [scene.points, scene.radius]
  );
  const hull = React.useMemo(() => computeDiskHull(disks), [disks]);

  // Zoom (wheel) centered at cursor
  function onWheel(e: React.WheelEvent<SVGSVGElement>) {
    e.preventDefault();

    const svg = svgRef.current;
    if (!svg) return;

    const zoomFactor = Math.exp(e.deltaY * 0.0015);
    const nextW = clamp(vb.width * zoomFactor, 80, 6000);
    const nextH = clamp(vb.height * zoomFactor, 80, 6000);

    const p = clientToSvgPoint(e, svg, vb);
    const rx = (p.x - vb.minX) / vb.width;
    const ry = (p.y - vb.minY) / vb.height;

    const nextMinX = p.x - rx * nextW;
    const nextMinY = p.y - ry * nextH;

    setVb({ minX: nextMinX, minY: nextMinY, width: nextW, height: nextH });
  }

  // Pan (Space + drag)
  const [spaceDown, setSpaceDown] = React.useState(false);
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === "Space") setSpaceDown(true);
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === "Space") setSpaceDown(false);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const panRef = React.useRef<{ pointerId: number; start: { x: number; y: number }; vb0: ViewBox } | null>(null);

  function beginPan(e: React.PointerEvent<SVGSVGElement>) {
    if (!spaceDown) return;
    const svg = svgRef.current;
    if (!svg) return;

    const start = { x: e.clientX, y: e.clientY };
    panRef.current = { pointerId: e.pointerId, start, vb0: vb };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function movePan(e: React.PointerEvent<SVGSVGElement>) {
    const pan = panRef.current;
    const svg = svgRef.current;
    if (!pan || !svg) return;

    const rect = svg.getBoundingClientRect();
    const dxPx = e.clientX - pan.start.x;
    const dyPx = e.clientY - pan.start.y;

    const dx = (dxPx / rect.width) * pan.vb0.width;
    const dy = (dyPx / rect.height) * pan.vb0.height;

    setVb({ ...pan.vb0, minX: pan.vb0.minX - dx, minY: pan.vb0.minY - dy });
  }

  function endPan(e: React.PointerEvent<SVGSVGElement>) {
    const pan = panRef.current;
    if (!pan) return;
    panRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }

  // Node drag (mode move)
  const dragRef = React.useRef<{ id: string; dx: number; dy: number; pointerId: number } | null>(null);

  function beginDrag(e: React.PointerEvent<SVGGElement>, p: Point) {
    if (mode !== "move") return;
    if (spaceDown) return;

    e.stopPropagation();
    onSelectPoint(p.id);

    const svg = svgRef.current;
    if (!svg) return;

    const pos = clientToSvgPoint(e, svg, vb);
    dragRef.current = { id: p.id, dx: p.x - pos.x, dy: p.y - pos.y, pointerId: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function moveDrag(e: React.PointerEvent<SVGGElement>) {
    const drag = dragRef.current;
    const svg = svgRef.current;
    if (!drag || !svg) return;

    const pos = clientToSvgPoint(e, svg, vb);
    onMovePoint(drag.id, { x: pos.x + drag.dx, y: pos.y + drag.dy });
  }

  function endDrag(e: React.PointerEvent<SVGGElement>) {
    if (!dragRef.current) return;
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }

  function onBackgroundPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (spaceDown) {
      beginPan(e);
      return;
    }

    if (e.target !== e.currentTarget) return;

    const svg = svgRef.current;
    if (!svg) return;

    if (mode === "add") {
      const pt = clientToSvgPoint(e, svg, vb);
      onAddPoint(pt);
      return;
    }

    onSelectPoint(null);
    onPickLinkA(null);
  }

  function onPointPointerDown(e: React.PointerEvent<SVGGElement>, p: Point) {
    e.stopPropagation();

    if (mode === "delete") {
      onDeletePoint(p.id);
      return;
    }

    if (mode === "link") {
      if (!linkA) {
        onPickLinkA(p.id);
        onSelectPoint(p.id);
        return;
      }
      if (linkA === p.id) return;

      onToggleSegment(linkA, p.id);
      onPickLinkA(null);
      onSelectPoint(p.id);
      return;
    }
  }

  // Preview link
  const [cursor, setCursor] = React.useState<{ x: number; y: number } | null>(null);
  React.useEffect(() => {
    if (mode !== "link" || !linkA) {
      setCursor(null);
      return;
    }
    function onMove(ev: MouseEvent) {
      const svg = svgRef.current;
      if (!svg) return;
      setCursor(clientToSvgPoint(ev, svg, vb));
    }
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [mode, linkA, vb]);

  const linkAPoint = linkA ? pointsById.get(linkA) ?? null : null;

  return (
    <svg
      ref={svgRef}
      style={{ width: "100%", height: "100%", background: COLORS.bg, touchAction: "none" }}
      viewBox={viewBoxToString(vb)}
      onWheel={onWheel}
      onPointerDown={onBackgroundPointerDown}
      onPointerMove={(e) => {
        if (panRef.current) movePan(e);
      }}
      onPointerUp={(e) => {
        if (panRef.current) endPan(e);
      }}
      onPointerCancel={(e) => {
        if (panRef.current) endPan(e);
      }}
    >
      {showGrid ? null : null}

      {/* Hull */}
      {showHull && hull.svgPathD && (
        <path
          d={hull.svgPathD}
          fill="none"
          stroke={COLORS.hull}
          strokeWidth={COLORS.hullStrokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.9}
          pointerEvents="none"
        />
      )}

      {/* Graph segments (thin + dashed) */}
      <g
        stroke={COLORS.edge}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="6 7"
        opacity={0.95}
      >
        {scene.primitives.map((pr: Primitive) => {
          if (pr.kind !== "segment") return null;
          const a = pointsById.get(pr.a);
          const b = pointsById.get(pr.b);
          if (!a || !b) return null;
          return <line key={pr.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
        })}
      </g>

      {/* Link preview (thin + dashed) */}
      {mode === "link" && linkAPoint && cursor && (
        <line
          x1={linkAPoint.x}
          y1={linkAPoint.y}
          x2={cursor.x}
          y2={cursor.y}
          stroke={COLORS.edgePreview}
          strokeWidth={1.2}
          strokeDasharray="5 7"
          strokeLinecap="round"
          pointerEvents="none"
        />
      )}

      {/* Nodes - usar visualRadius para renderizado */}
      <g>
        {scene.points.map((p: Point) => {
          const selected = p.id === selectedPointId;
          const isLinkA = mode === "link" && linkA === p.id;

          const stroke = isLinkA
            ? COLORS.edgePreview
            : selected
              ? COLORS.selectedNodeStroke
              : COLORS.nodeStroke;

          return (
            <g
              key={p.id}
              style={{ cursor: spaceDown ? "grab" : mode === "move" ? "grab" : "pointer" }}
              onPointerDown={(e) => {
                onPointPointerDown(e, p);
                beginDrag(e, p);
              }}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              <circle
                ref={selected ? selectedCircleRef : undefined}
                cx={p.x}
                cy={p.y}
                r={scene.visualRadius}
                fill={COLORS.nodeFill}
                stroke={stroke}
                strokeWidth={1}
              />
              <text
                x={p.x + scene.visualRadius + 6}
                y={p.y + 5}
                fill={COLORS.nodeText}
                fontSize={13}
                fontFamily="system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif"
              >
                {p.id}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
