import React from "react";
import { createInitialScene } from "../../core/model/scene";
import type { Scene, Point, Primitive, Segment } from "../../core/model/entities";
import { SvgStage, type BBox, type ToolMode } from "../../renderer/svg/SvgStage";
import { resolveOverlapsSingleMove } from "../../core/geometry/resolveOverlaps";

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

function segmentKey(a: string, b: string) {
  return a < b ? `${a}__${b}` : `${b}__${a}`;
}

export function EditorPage() {
  // Undo/Redo history: past/present/future [web:293]
  const [past, setPast] = React.useState<Scene[]>([]);
  const [present, setPresent] = React.useState<Scene>(() => createInitialScene());
  const [future, setFuture] = React.useState<Scene[]>([]);
  const scene = present;

  const [mode, setMode] = React.useState<ToolMode>("move");
  const [selectedPointId, setSelectedPointId] = React.useState<string | null>("p1");
  const [bbox, setBbox] = React.useState<BBox | null>(null);

  const [linkA, setLinkA] = React.useState<string | null>(null);

  const [rulerA, setRulerA] = React.useState<string | null>(null);
  const [rulerB, setRulerB] = React.useState<string | null>(null);

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

  function commit(next: Scene) {
    setPast((p) => [...p, present]);
    setPresent(next);
    setFuture([]); // acción nueva => borra futuro [web:293]
  }

  function undo() {
    setPast((p) => {
      if (p.length === 0) return p;
      const prev = p[p.length - 1];
      setFuture((f) => [present, ...f]);
      setPresent(prev);
      return p.slice(0, -1);
    });
  }

  function redo() {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      setPast((p) => [...p, present]);
      setPresent(next);
      return f.slice(1);
    });
  }

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
        return;
      }
      if (ctrl && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && selectedPointId) {
        e.preventDefault();
        deletePoint(selectedPointId);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedPointId, present]);

  function handleSelectPoint(id: string | null) {
    setSelectedPointId(id);

    // Regla simple
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

  function addPoint(pt: { x: number; y: number }) {
    const id = nextPointId(scene);
    const p: Point = { id, kind: "point", x: pt.x, y: pt.y };
    commit({ ...scene, points: [...scene.points, p] });
    setSelectedPointId(id);
  }

  // ✅ Anti-overlap: el punto movido se “empuja” fuera de otros discos usando scene.radius como radio.
  function movePoint(id: string, pt: { x: number; y: number }) {
    const tentative = scene.points.map((p) => (p.id === id ? { ...p, x: pt.x, y: pt.y } : p));
    const fixed = resolveOverlapsSingleMove({
      movedId: id,
      points: tentative,
      radius: scene.radius,
    });

    commit({ ...scene, points: fixed });
  }

  function deletePoint(id: string) {
    const points = scene.points.filter((p) => p.id !== id);
    const primitives: Primitive[] = scene.primitives.filter((pr) => {
      if (pr.kind === "segment") return pr.a !== id && pr.b !== id;
      return true;
    });

    commit({ ...scene, points, primitives });

    setSelectedPointId((cur) => (cur === id ? null : cur));
    setLinkA((cur) => (cur === id ? null : cur));
    setRulerA((cur) => (cur === id ? null : cur));
    setRulerB((cur) => (cur === id ? null : cur));
  }

  function toggleSegment(a: string, b: string) {
    const key = segmentKey(a, b);

    const existing = scene.primitives.find(
      (pr) => pr.kind === "segment" && segmentKey(pr.a, pr.b) === key
    ) as Segment | undefined;

    if (existing) {
      commit({ ...scene, primitives: scene.primitives.filter((pr) => pr !== existing) });
      return;
    }

    const id = `s_${key}`;
    const seg: Segment = { id, kind: "segment", a, b };
    commit({ ...scene, primitives: [...scene.primitives, seg] });
  }

  return (
    <div
      style={{
        height: "100%",
        display: "grid",
        gridTemplateRows: "44px 1fr",
        gridTemplateColumns: "1fr 360px",
        gridTemplateAreas: `
          "toolbar toolbar"
          "stage   sidebar"
        `,
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          gridArea: "toolbar",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 10px",
          background: "rgba(255,255,255,0.96)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <ToolButton
          active={mode === "move"}
          onClick={() => {
            setMode("move");
            setLinkA(null);
          }}
        >
          Mover
        </ToolButton>
        <ToolButton
          active={mode === "add"}
          onClick={() => {
            setMode("add");
            setLinkA(null);
          }}
        >
          Agregar
        </ToolButton>
        <ToolButton
          active={mode === "link"}
          onClick={() => {
            setMode("link");
            setLinkA(null);
          }}
        >
          Enlazar
        </ToolButton>
        <ToolButton
          active={mode === "delete"}
          onClick={() => {
            setMode("delete");
            setLinkA(null);
          }}
        >
          Borrar
        </ToolButton>

        <div style={{ flex: 1 }} />

        <ToolButton disabled={past.length === 0} onClick={undo} title="Ctrl+Z">
          Undo
        </ToolButton>
        <ToolButton disabled={future.length === 0} onClick={redo} title="Ctrl+Y">
          Redo
        </ToolButton>
      </div>

      {/* Stage */}
      <div style={{ gridArea: "stage", minWidth: 0, minHeight: 0 }}>
        <SvgStage
          scene={scene}
          mode={mode}
          selectedPointId={selectedPointId}
          onSelectPoint={handleSelectPoint}
          onMeasuredBBox={setBbox}
          onAddPoint={addPoint}
          onMovePoint={movePoint}
          onDeletePoint={deletePoint}
          linkA={linkA}
          onPickLinkA={setLinkA}
          onToggleSegment={toggleSegment}
        />
      </div>

      {/* Sidebar */}
      <aside
        style={{
          gridArea: "sidebar",
          borderLeft: "1px solid var(--border)",
          background: "var(--panel)",
          padding: 14,
          overflow: "auto",
          minWidth: 0,
        }}
      >
        <h3 style={{ margin: "6px 0 12px", fontSize: 14 }}>Propiedades y medición</h3>

        <Card title="Herramienta">
          <Row label="Modo" value={mode} />
          <Row label="Link A" value={linkA ?? "—"} />
        </Card>

        <Spacer />

        <Card title="Punto seleccionado">
          <Row label="ID" value={selectedPointId ?? "—"} />
          <Row label="BBox W" value={bbox ? bbox.width.toFixed(2) : "—"} />
          <Row label="BBox H" value={bbox ? bbox.height.toFixed(2) : "—"} />
        </Card>

        <Spacer />

        <Card title="Regla (2 clicks)">
          <Row label="A" value={rulerA ?? "—"} />
          <Row label="B" value={rulerB ?? "—"} />
          <Row label="Dist." value={rulerDistance !== null ? rulerDistance.toFixed(2) : "—"} />
        </Card>
      </aside>
    </div>
  );
}

function Spacer() {
  return <div style={{ height: 12 }} />;
}

function ToolButton(props: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      title={props.title}
      disabled={props.disabled}
      onClick={props.onClick}
      style={{
        height: 32,
        padding: "0 10px",
        borderRadius: 10,
        border: "1px solid var(--border)",
        background: props.active ? "#111827" : "#ffffff",
        color: props.active ? "#ffffff" : "#111827",
        fontWeight: 700,
        cursor: props.disabled ? "not-allowed" : "pointer",
      }}
    >
      {props.children}
    </button>
  );
}

function Card(props: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 12,
      }}
    >
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>{props.title}</div>
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
