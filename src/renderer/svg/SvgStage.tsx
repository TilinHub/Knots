// src/renderer/svg/SvgStage.tsx
import React from "react";
import type { Scene, SceneEntity } from "../../core/model/entities";

export type BBox = { x: number; y: number; width: number; height: number };

const COLORS = {
  bg: "#ffffff",
  gridMajor: "#9ca3af", // gris oscuro (major)
  gridMinor: "#e5e7eb", // gris claro (minor)
  axis: "#6b7280",
  nodeStroke: "#111827", // casi negro
  nodeFill: "#ffffff",
  nodeText: "#111827",
  selected: "#2563eb", // azul
};

export function SvgStage(props: {
  scene: Scene;
  selectedId: string | null;
  measuredBBox: BBox | null;
  onSelect: (id: string | null) => void;
  onMeasuredBBox: (bbox: BBox | null) => void;
}) {
  const { scene, selectedId, measuredBBox, onSelect, onMeasuredBBox } = props;
  const selectedRef = React.useRef<SVGGElement | null>(null);

  React.useLayoutEffect(() => {
    if (!selectedId || !selectedRef.current) {
      onMeasuredBBox(null);
      return;
    }

    // getBBox() devuelve el rectángulo mínimo del elemento en el espacio SVG. [web:20]
    const bbox = selectedRef.current.getBBox();
    onMeasuredBBox({ x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height });
  }, [selectedId, scene, onMeasuredBBox]);

  const viewBox = "-250 -180 500 360";

  return (
    <svg
      style={{ width: "100%", height: "100%", background: COLORS.bg }}
      viewBox={viewBox}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onSelect(null);
      }}
    >
      <Grid />

      <g>
        {scene.entities.map((ent) => (
          <Entity
            key={ent.id}
            ent={ent}
            selected={ent.id === selectedId}
            selectedRef={ent.id === selectedId ? selectedRef : undefined}
            onSelect={onSelect}
          />
        ))}
      </g>

      {/* Overlay bbox sin setState (evita loops) */}
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
      {/* Minor */}
      <g stroke={COLORS.gridMinor} strokeWidth={1}>
        {vLines
          .filter((l) => !l.major)
          .map((l) => (
            <line key={`vmin${l.x}`} x1={l.x} y1={minY} x2={l.x} y2={maxY} />
          ))}
        {hLines
          .filter((l) => !l.major)
          .map((l) => (
            <line key={`hmin${l.y}`} x1={minX} y1={l.y} x2={maxX} y2={l.y} />
          ))}
      </g>

      {/* Major */}
      <g stroke={COLORS.gridMajor} strokeWidth={1}>
        {vLines
          .filter((l) => l.major)
          .map((l) => (
            <line key={`vmaj${l.x}`} x1={l.x} y1={minY} x2={l.x} y2={maxY} />
          ))}
        {hLines
          .filter((l) => l.major)
          .map((l) => (
            <line key={`hmaj${l.y}`} x1={minX} y1={l.y} x2={maxX} y2={l.y} />
          ))}
      </g>

      {/* Ejes */}
      <g stroke={COLORS.axis} strokeWidth={1.5}>
        <line x1={minX} y1={0} x2={maxX} y2={0} />
        <line x1={0} y1={minY} x2={0} y2={maxY} />
      </g>
    </g>
  );
}

function Entity(props: {
  ent: SceneEntity;
  selected: boolean;
  selectedRef?: React.RefObject<SVGGElement | null>;
  onSelect: (id: string) => void;
}) {
  const { ent, selected, selectedRef, onSelect } = props;

  if (ent.kind === "node") {
    const stroke = selected ? COLORS.selected : COLORS.nodeStroke;

    return (
      <g
        ref={selectedRef}
        style={{ cursor: "pointer" }}
        onPointerDown={(e) => {
          e.stopPropagation();
          onSelect(ent.id);
        }}
      >
        <circle
          cx={ent.x}
          cy={ent.y}
          r={ent.r}
          fill={COLORS.nodeFill}
          stroke={stroke}
          strokeWidth={2.5}
        />
        <text
          x={ent.x + ent.r + 8}
          y={ent.y + 5}
          fill={COLORS.nodeText}
          fontSize={13}
          fontFamily="system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif"
        >
          {ent.label ?? ent.id}
        </text>
      </g>
    );
  }

  return null;
}
