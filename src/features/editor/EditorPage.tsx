import React from "react";
import { createInitialScene } from "../../core/model/scene";
import type { Scene, Primitive, Point } from "../../core/model/entities";
import { SvgStage, type BBox } from "../../renderer/svg/SvgStage";

type PointId = string;

function distanceBetween(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function nextPointId(scene: Scene) {
  const nums = scene.points
    .map((p) => Number(p.id.replace(/^p/, "")))
    .filter((n) => Number.isFinite(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return `p${max + 1}`;
}

export function EditorPage() {
  const [scene, setScene] = React.useState<Scene>(() => createInitialScene());

  const [selectedPointId, setSelectedPointId] = React.useState<PointId | null>("p1");
  const [bbox, setBbox] = React.useState<BBox | null>(null);

  // Regla
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

    // Regla: A, luego B, luego reinicia
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

  function handleCreatePoint(pt: { x: number; y: number }) {
    setScene((prev) => {
      const id = nextPointId(prev);
      const newPoint: Point = { id, kind: "point", x: pt.x, y: pt.y };
      return { ...prev, points: [...prev.points, newPoint] };
    });
    setSelectedPointId(null); // opcional
  }

  function handleMovePoint(id: string, pt: { x: number; y: number }) {
    setScene((prev) => ({
      ...prev,
      points: prev.points.map((p) => (p.id === id ? { ...p, x: pt.x, y: pt.y } : p)),
    }));
  }

  function deletePoint(id: string) {
    setScene((prev) => {
      const points = prev.points.filter((p) => p.id !== id);

      const primitives: Primitive[] = prev.primitives.filter((pr) => {
        if (pr.kind === "segment") return pr.a !== id && pr.b !== id;
        return true; // por ahora no borramos arcos (cuando existan, también habrá que filtrarlos)
      });

      return { ...prev, points, primitives };
    });

    setSelectedPointId((cur) => (cur === id ? null : cur));
    setRulerA((cur) => (cur === id ? null : cur));
    setRulerB((cur) => (cur === id ? null : cur));
  }

  // Delete/Backspace para eliminar seleccionado
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!selectedPointId) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deletePoint(selectedPointId);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedPointId]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", height: "100vh" }}>
      <div style={{ position: "relative" }}>
        <SvgStage
          scene={scene}
          selectedPointId={selectedPointId}
          onSelectPoint={handleSelectPoint}
          onMeasuredBBox={setBbox}
          onCreatePoint={handleCreatePoint}
          onMovePoint={handleMovePoint}
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
            minWidth: 280,
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Controles</div>
          <div style={{ color: "#374151", lineHeight: 1.5 }}>
            Doble click en el fondo: agrega punto.
            <br />
            Arrastra un punto: muévelo.
            <br />
            Delete/Backspace: elimina punto seleccionado.
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
          <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
            Borrar: tecla Delete/Backspace.
          </div>
        </Card>

        <div style={{ height: 12 }} />

        <Card title="Regla (2 clicks)">
          <Row label="A" value={rulerA ?? "—"} />
          <Row label="B" value={rulerB ?? "—"} />
          <Row label="Dist." value={rulerDistance !== null ? rulerDistance.toFixed(2) : "—"} />
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
