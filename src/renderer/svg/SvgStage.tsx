import React from "react";
import type { Scene, Point, Primitive } from "../../core/model/entities";

export type BBox = { x: number; y: number; width: number; height: number };
export type ToolMode = "move" | "add" | "delete" | "link";

const COLORS = {
  bg: "#ffffff",
  gridMajor: "#9ca3af",
  gridMinor: "#e5e7eb",
  axis: "#6b7280",

  edge: "#111827",
  edgePreview: "#2563eb",

  nodeStroke: "#111827",
  nodeFill: "#ffffff",
  nodeText: "#111827",
  selected: "#2563eb",
};

function parseViewBox(vb: string) {
  const [minX, minY, width, height] = vb.split(/\s+/).map(Number);
  return { minX, minY, width, height };
}

// DOM(px) -> SVG(user units) usando viewBox.
function clientToSvgPoint(
  e: { clientX: number; clientY: number },
  svg: SVGSVGElement,
  viewBox: string
) {
  const rect = svg.getBoundingClientRect();
  const vb = parseViewBox(viewBox);
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

  // Link tool
  linkA: string | null;
  onPickLinkA: (id: string | null) => void;
  onToggleSegment: (a: string, b: string) => void;
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
  } = props;

  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const selectedCircleRef = React.useRef<SVGCircleElement | null>(null);

  const viewBox = "-250 -180 500 360";

  React.useLayoutEffect(() => {
    if (!selectedPointId || !selectedCircleRef.current) {
      onMeasuredBBox(null);
      return;
    }
    // getBBox() devuelve el bbox mínimo (x/y/width/height) en espacio SVG. [web:20]
    const b = selectedCircleRef.current.getBBox();
    onMeasuredBBox({ x: b.x, y: b.y, width: b.width, height: b.height });
  }, [selectedPointId, scene, onMeasuredBBox]);

  const pointsById = React.useMemo(() => {
    const m = new Map<string, Point>();
    for (const p of scene.points) m.set(p.id, p);
    return m;
  }, [scene.points]);

  // Drag state
  const dragRef = React.useRef<{
    id: string;
    dx: number;
    dy: number;
    pointerId: number;
  } | null>(null);

  function beginDrag(e: React.PointerEvent<SVGGElement>, p: Point) {
    if (mode !== "move") return;

    e.stopPropagation();
    onSelectPoint(p.id);

    const svg = svgRef.current;
    if (!svg) return;

    const pos = clientToSvgPoint(e, svg, viewBox);
    dragRef.current = { id: p.id, dx: p.x - pos.x, dy: p.y - pos.y, pointerId: e.pointerId };

    // Captura para seguir recibiendo move/up aunque el puntero salga del elemento. [web:272]
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function moveDrag(e: React.PointerEvent<SVGGElement>) {
    const drag = dragRef.current;
    const svg = svgRef.current;
    if (!drag || !svg) return;

    const pos = clientToSvgPoint(e, svg, viewBox);
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
    if (e.target !== e.currentTarget) return;

    const svg = svgRef.current;
    if (!svg) return;

    if (mode === "add") {
      const pt = clientToSvgPoint(e, svg, viewBox);
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

    // mode move => drag se inicia en beginDrag (también selecciona)
  }

  // Preview Link A -> cursor
  const [cursor, setCursor] = React.useState<{ x: number; y: number } | null>(null);
  React.useEffect(() => {
    if (mode !== "link" || !linkA) {
      setCursor(null);
      return;
    }
    function onMove(ev: MouseEvent) {
      const svg = svgRef.current;
      if (!svg) return;
      setCursor(clientToSvgPoint(ev, svg, viewBox));
    }
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [mode, linkA]);

  const linkAPoint = linkA ? pointsById.get(linkA) ?? null : null;

  return (
    <svg
      ref={svgRef}
      style={{ width: "100%", height: "100%", background: COLORS.bg }}
      viewBox={viewBox}
      onPointerDown={onBackgroundPointerDown}
    >
      <Grid />

      {/* Segmentos */}
      <g stroke={COLORS.edge} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" opacity={0.9}>
        {scene.primitives.map((pr: Primitive) => {
          if (pr.kind !== "segment") return null;
          const a = pointsById.get(pr.a);
          const b = pointsById.get(pr.b);
          if (!a || !b) return null;
          return <line key={pr.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
        })}
      </g>

      {/* Preview enlace */}
      {mode === "link" && linkAPoint && cursor && (
        <line
          x1={linkAPoint.x}
          y1={linkAPoint.y}
          x2={cursor.x}
          y2={cursor.y}
          stroke={COLORS.edgePreview}
          strokeWidth={2}
          strokeDasharray="6 4"
          strokeLinecap="round"
          pointerEvents="none"
        />
      )}

      {/* Puntos */}
      <g>
        {scene.points.map((p: Point) => {
          const selected = p.id === selectedPointId;
          const isLinkA = mode === "link" && linkA === p.id;

          return (
            <g
              key={p.id}
              style={{ cursor: mode === "move" ? "grab" : "pointer" }}
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
                r={11}
                fill={COLORS.nodeFill}
                stroke={isLinkA ? COLORS.edgePreview : selected ? COLORS.selected : COLORS.nodeStroke}
                strokeWidth={3}
              />
              <text
                x={p.x + 16}
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

function Grid() {
  const minX = -250;
  const maxX = 250;
  const minY = -180;
  const maxY = 180;

  const minor = 10;
  const major = 50;

  const vLines: Array<{ x: number; major: boolean }> = [];
  for (let x = Math.ceil(minX / minor) * minor; x <= maxX; x += minor) vLines.push({ x, major: x % major === 0 });

  const hLines: Array<{ y: number; major: boolean }> = [];
  for (let y = Math.ceil(minY / minor) * minor; y <= maxY; y += minor) hLines.push({ y, major: y % major === 0 });

  return (
    <g shapeRendering="crispEdges">
      <g stroke={COLORS.gridMinor} strokeWidth={1}>
        {vLines.filter((l) => !l.major).map((l) => (
          <line key={`vmin${l.x}`} x1={l.x} y1={minY} x2={l.x} y2={maxY} />
        ))}
        {hLines.filter((l) => !l.major).map((l) => (
          <line key={`hmin${l.y}`} x1={minX} y1={l.y} x2={maxX} y2={l.y} />
        ))}
      </g>

      <g stroke={COLORS.gridMajor} strokeWidth={1}>
        {vLines.filter((l) => l.major).map((l) => (
          <line key={`vmaj${l.x}`} x1={l.x} y1={minY} x2={l.x} y2={maxY} />
        ))}
        {hLines.filter((l) => l.major).map((l) => (
          <line key={`hmaj${l.y}`} x1={minX} y1={l.y} x2={maxX} y2={l.y} />
        ))}
      </g>

      <g stroke={COLORS.axis} strokeWidth={1.5}>
        <line x1={minX} y1={0} x2={maxX} y2={0} />
        <line x1={0} y1={minY} x2={0} y2={maxY} />
      </g>
    </g>
  );
}
