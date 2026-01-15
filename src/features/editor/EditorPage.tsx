import React from "react";
import { createInitialScene } from "../../core/model/scene";
import { SvgStage } from "../../renderer/svg/SvgStage";

type BBox = { x: number; y: number; width: number; height: number };

export function EditorPage() {
  const [scene] = React.useState(() => createInitialScene());
  const [selectedId, setSelectedId] = React.useState<string | null>("n1");
  const [bbox, setBbox] = React.useState<BBox | null>(null);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", height: "100vh" }}>
      <div style={{ position: "relative" }}>
        <SvgStage
          scene={scene}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onMeasuredBBox={setBbox}
        />

        {/* HUD simple */}
        <div
          style={{
            position: "absolute",
            left: 12,
            top: 12,
            padding: "8px 10px",
            background: "rgba(0,0,0,0.45)",
            color: "white",
            fontFamily: "system-ui, sans-serif",
            fontSize: 12,
            borderRadius: 8,
          }}
        >
          <div>Selected: {selectedId ?? "none"}</div>
          <div>
            BBox:{" "}
            {bbox
              ? `x=${bbox.x.toFixed(2)} y=${bbox.y.toFixed(2)} w=${bbox.width.toFixed(
                  2
                )} h=${bbox.height.toFixed(2)}`
              : "—"}
          </div>
        </div>
      </div>

      <aside
        style={{
          borderLeft: "1px solid #1f2937",
          padding: 12,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <h3 style={{ margin: "6px 0 10px" }}>Propiedades</h3>
        <div style={{ fontSize: 13, color: "#111827" }}>
          <div>ID: {selectedId ?? "—"}</div>
          <div>Ancho: {bbox ? bbox.width.toFixed(2) : "—"}</div>
          <div>Alto: {bbox ? bbox.height.toFixed(2) : "—"}</div>
        </div>
      </aside>
    </div>
  );
}
