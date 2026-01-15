// src/renderer/svg/SvgStage.tsx
import React from "react";
import type { Scene, Point } from "../../core/model/entities";

export type BBox = { x: number; y: number; width: number; height: number };

const COLORS = {
  bg: "#ffffff",
  gridMajor: "#9ca3af",
  gridMinor: "#e5e7eb",
  axis: "#6b7280",
  nodeStroke: "#111827",
  nodeFill: "#ffffff",
  nodeText: "#111827",
  selected: "#2563eb",
};

export function SvgStage(props: {
  scene: Scene;
  selectedPointId: string | null;
  measuredBBox: BBox | null;
  onSelectPoint: (id: string | null) => void;
  onMeasuredBBox: (bbox: BBox | null) => void;
}) {
  const { scene, selectedPointId, measuredBBox, onSelectPoint, onMeasuredBBox } = props;
  const selectedCircleRef = React.useRef<SVGCircleElement | null>(null);

  React.useLayoutEffect(() => {
    if (!selectedPointId || !selectedCircleRef.current) {
      onMeasuredBBox(null);
      return;
    }
    // getBBox() retorna x/y/width/height del bbox en espacio SVG. [web:20]
    const b = selectedCircleRef.current.getBBox();
    onMeasuredBBox({ x: b.x, y: b.y, width: b.width, height: b.height });
  }, [selectedPointId, scene, onMeasuredBBox]);

  const viewBox = "-250 -180 500 360";

  return (
    <svg
      style={{ width: "100%", height: "100%", background: COLORS.bg }}
      viewBox={viewBox}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onSelectPoint(null);
      }}
    >
      <Grid />

      <g>
        {scene.points.map((p: Point) => {
          const selected = p.id === selectedPointId;
          const stroke = selected ? COLORS.selected : COLORS.nodeStroke;

          return (
            <g
              key={p.id}
              style={{ cursor: "pointer" }}
              onPointerDown={(e) => {
                e.stopPropagation();
                onSelectPoint(p.id);
              }}
            >
              <circle
                ref={selected ? selectedCircleRef : undefined}
                cx={p.x}
                cy={p.y}
                r={10}
                fill={COLORS.nodeFill}
                stroke={stroke}
                strokeWidth={2.5}
              />
              <text
                x={p.x + 14}
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

      {measuredBBox && (
        <g pointerEvents="none">
          <rect
            x={measuredBBox.x}
            y={measuredBBox.y}
            width={measuredBBox.width}
            height={measuredBBox.height}
            fill="transparent"
            stroke={COLORS.selected}
            strokeWidth={2}
            strokeDasharray="6 4"
          />
        </g>
      )}
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
  for (let x = Math.ceil(minX / minor) * minor; x <= maxX; x += minor) {
    vLines.push({ x, major: x % major === 0 });
  }

  const hLines: Array<{ y: number; major: boolean }> = [];
  for (let y = Math.ceil(minY / minor) * minor; y <= maxY; y += minor) {
    hLines.push({ y, major: y % major === 0 });
  }

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
