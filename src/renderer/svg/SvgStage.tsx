import React from "react";
import type { Scene, SceneEntity } from "../../core/model/entities";

type BBox = { x: number; y: number; width: number; height: number };

export function SvgStage(props: {
  scene: Scene;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMeasuredBBox: (bbox: BBox | null) => void;
}) {
  const { scene, selectedId, onSelect, onMeasuredBBox } = props;
  const selectedRef = React.useRef<SVGGElement | null>(null);

  // Medir después del render para que el elemento exista en el DOM.
  React.useLayoutEffect(() => {
    if (!selectedId || !selectedRef.current) {
      onMeasuredBBox(null);
      return;
    }
    const bbox = selectedRef.current.getBBox(); // x/y/width/height en espacio SVG [web:20]
    onMeasuredBBox({
      x: bbox.x,
      y: bbox.y,
      width: bbox.width,
      height: bbox.height,
    });
  }, [selectedId, scene, onMeasuredBBox]);

  const viewBox = "-250 -180 500 360";

  return (
    <svg
      style={{ width: "100%", height: "100%", background: "#0b1020" }}
      viewBox={viewBox}
      onPointerDown={(e) => {
        // Click en fondo => deseleccionar
        if (e.target === e.currentTarget) onSelect(null);
      }}
    >
      {/* Grilla simple */}
      <g opacity={0.25}>
        {Array.from({ length: 21 }).map((_, i) => {
          const x = -200 + i * 20;
          return (
            <line key={`vx${i}`} x1={x} y1={-200} x2={x} y2={200} stroke="#8aa4ff" />
          );
        })}
        {Array.from({ length: 21 }).map((_, i) => {
          const y = -200 + i * 20;
          return (
            <line key={`hy${i}`} x1={-220} y1={y} x2={220} y2={y} stroke="#8aa4ff" />
          );
        })}
      </g>

      {/* Contenido */}
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
    </svg>
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
    const stroke = selected ? "#ffdd57" : "#c7d2fe";
    const fill = selected ? "rgba(255,221,87,0.18)" : "rgba(199,210,254,0.12)";

    return (
      <g
        ref={selectedRef}
        style={{ cursor: "pointer" }}
        onPointerDown={(e) => {
          e.stopPropagation();
          onSelect(ent.id);
        }}
      >
        <circle cx={ent.x} cy={ent.y} r={ent.r} fill={fill} stroke={stroke} strokeWidth={2} />
        <text x={ent.x + ent.r + 6} y={ent.y + 4} fill="#e5e7eb" fontSize={12}>
          {ent.label ?? ent.id}
        </text>
      </g>
    );
  }

  return null;
}
