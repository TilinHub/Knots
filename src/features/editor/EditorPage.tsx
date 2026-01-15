// src/features/editor/EditorPage.tsx
import React from "react";
import { createInitialScene } from "../../core/model/scene";
import { SvgStage } from "../../renderer/svg/SvgStage";

type BBox = { x: number; y: number; width: number; height: number };

export function EditorPage() {
  const [scene] = React.useState(() => createInitialScene());
  const [selectedId, setSelectedId] = React.useState<string | null>("n1");
  const [bbox, setBbox] = React.useState<BBox | null>(null);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 320px",
        height: "100vh",
        background: "#ffffff",
      }}
    >
      <div style={{ position: "relative" }}>
        <SvgStage
          scene={scene}
          selectedId={selectedId}
          measuredBBox={bbox}
          onSelect={setSelectedId}
          onMeasuredBBox={setBbox}
        />


        {/* HUD */}
        <div
          style={{
            position: "absolute",
            left: 12,
            top: 12,
            padding: "10px 12px",
            background: "rgba(255,255,255,0.92)",
            border: "1px solid #e5e7eb",
            color: "#111827",
            fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
            fontSize: 12,
            borderRadius: 10,
            boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
            minWidth: 220,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Selección</div>
          <div style={{ display: "grid", gridTemplateColumns: "70px 1fr", rowGap: 4 }}>
            <div style={{ color: "#374151" }}>ID</div>
            <div style={{ fontWeight: 600 }}>{selectedId ?? "—"}</div>

            <div style={{ color: "#374151" }}>BBox</div>
            <div>
              {bbox
                ? `x=${bbox.x.toFixed(2)} y=${bbox.y.toFixed(2)} w=${bbox.width.toFixed(
                    2
                  )} h=${bbox.height.toFixed(2)}`
                : "—"}
            </div>
          </div>
        </div>
      </div>

      {/* Panel lateral */}
      <aside
        style={{
          borderLeft: "1px solid #e5e7eb",
          background: "#fafafa",
          padding: 14,
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
          color: "#111827",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 800, margin: "6px 0 12px" }}>
          Propiedades
        </div>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 12,
          }}
        >
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
            Medidas (bbox del elemento SVG)
          </div>

          <Row label="ID" value={selectedId ?? "—"} />
          <Row label="X" value={bbox ? bbox.x.toFixed(2) : "—"} />
          <Row label="Y" value={bbox ? bbox.y.toFixed(2) : "—"} />
          <Row label="Ancho" value={bbox ? bbox.width.toFixed(2) : "—"} />
          <Row label="Alto" value={bbox ? bbox.height.toFixed(2) : "—"} />
        </div>

        <div style={{ marginTop: 12, fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
          Tip: estas medidas vienen de <code>getBBox()</code>, que devuelve el rectángulo mínimo
          del elemento en el espacio SVG. [web:20]
        </div>
      </aside>
    </div>
  );
}

function Row(props: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "80px 1fr",
        padding: "6px 0",
        borderTop: "1px solid #f3f4f6",
        alignItems: "center",
        fontSize: 13,
      }}
    >
      <div style={{ color: "#374151" }}>{props.label}</div>
      <div style={{ fontWeight: 600, color: "#111827", textAlign: "right" }}>
        {props.value}
      </div>
    </div>
  );
}
