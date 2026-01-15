import React from "react";
import { createInitialScene } from "../../core/model/scene";
import type { Scene } from "../../core/model/entities";
import { SvgStage, type BBox } from "../../renderer/svg/SvgStage";

type PointId = string;

function distanceBetween(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function EditorPage() {
  const [scene] = React.useState<Scene>(() => createInitialScene());

  const [selectedPointId, setSelectedPointId] = React.useState<PointId | null>("p1");
  const [bbox, setBbox] = React.useState<BBox | null>(null);

  const [rulerA, setRulerA] = React.useState<PointId | null>(null);
  const [rulerB, setRulerB] = React.useState<PointId | null>(null);

  const pointsById = React.useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    for (const p of scene.points) m.set(p.id, { x: p.x, y: p.y });
    return m;
  }, [scene.points]);

  const rulerDistance = React.useMemo(() => {
    if (!rulerA || !rulerB) return null;
    const a = pointsById.get(rulerA);
    const b = pointsById.get(rulerB);
    if (!a || !b) return null;
    return distanceBetween(a, b);
  }, [rulerA, rulerB, pointsById]);

  function handleSelectPoint(id: string | null) {
    setSelectedPointId(id);
    if (!id) return;

    if (!rulerA) {
      setRulerA(id);
      setRulerB(null);
      return;
    }
    if (rulerA && !rulerB) {
      if (id === rulerA) return;
      setRulerB(id);
      return;
    }
    setRulerA(id);
    setRulerB(null);
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", height: "100vh" }}>
      <div style={{ position: "relative" }}>
        <SvgStage
          scene={scene}
          selectedPointId={selectedPointId}
          measuredBBox={bbox}
          onSelectPoint={handleSelectPoint}
          onMeasuredBBox={setBbox}
        />

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
            minWidth: 260,
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Selección</div>
          <div style={{ display: "grid", gridTemplateColumns: "70px 1fr", rowGap: 4 }}>
            <div style={{ color: "#374151" }}>Punto</div>
            <div style={{ fontWeight: 700 }}>{selectedPointId ?? "—"}</div>
            <div style={{ color: "#374151" }}>BBox</div>
            <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
              {bbox
                ? `x=${bbox.x.toFixed(2)} y=${bbox.y.toFixed(2)} w=${bbox.width.toFixed(
                    2
                  )} h=${bbox.height.toFixed(2)}`
                : "—"}
            </div>
          </div>
        </div>
      </div>

      <aside
        style={{
          borderLeft: "1px solid #e5e7eb",
          background: "#fafafa",
          padding: 14,
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
          color: "#111827",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 900, margin: "6px 0 12px" }}>
          Propiedades y medición
        </div>

        <Card title="Punto seleccionado">
          <Row label="ID" value={selectedPointId ?? "—"} />
          <Row label="BBox W" value={bbox ? bbox.width.toFixed(2) : "—"} />
          <Row label="BBox H" value={bbox ? bbox.height.toFixed(2) : "—"} />
        </Card>

        <div style={{ height: 12 }} />

        <Card title="Regla (2 clicks)">
          <Row label="A" value={rulerA ?? "—"} />
          <Row label="B" value={rulerB ?? "—"} />
          <Row label="Dist." value={rulerDistance !== null ? rulerDistance.toFixed(2) : "—"} />
          <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
            Click 1 = A, Click 2 = B, Click 3 reinicia.
          </div>
        </Card>
      </aside>
    </div>
  );
}

function Card(props: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 12,
      }}
    >
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>{props.title}</div>
      {props.children}
    </div>
  );
}

function Row(props: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "90px 1fr",
        padding: "6px 0",
        borderTop: "1px solid #f3f4f6",
        alignItems: "center",
        fontSize: 13,
      }}
    >
      <div style={{ color: "#374151" }}>{props.label}</div>
      <div style={{ fontWeight: 700, textAlign: "right" }}>{props.value}</div>
    </div>
  );
}
