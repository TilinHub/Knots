import React from "react";

import { createInitialScene } from "../../core/model/scene";
import type { Scene, Point, Primitive, Segment } from "../../core/model/entities";

import { SvgStage, type BBox, type ToolMode } from "../../renderer/svg/SvgStage";
import { resolveOverlapsSingleMove } from "../../core/geometry/resolveOverlaps";
import { computeDiskHull } from "../../core/geometry/diskHull";

import loadAllGraphs, { type GraphSet } from "../../io/loadAllGraphs";
import type { Graph } from "../../io/parseGraph6";
import { graphToContactScene } from "../../core/geometry/contactLayout";

import { NavBar } from "../../ui/NavBar";
import { MetricsBar } from "../../ui/MetricsBar";

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

function countSegments(primitives: Primitive[]) {
  return primitives.filter((p) => p.kind === "segment").length;
}

export function EditorPage() {
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

  // --- Preload graphs UI state ---
  const [graphSets, setGraphSets] = React.useState<GraphSet[]>([]);
  const [graphSetIdx, setGraphSetIdx] = React.useState(0);
  const [graphIdx, setGraphIdx] = React.useState(0);
  const [graphLoading, setGraphLoading] = React.useState(false);
  const [graphError, setGraphError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    setGraphLoading(true);
    setGraphError(null);

    loadAllGraphs()
      .then((sets) => {
        if (!alive) return;
        setGraphSets(sets);
        setGraphSetIdx(0);
        setGraphIdx(0);
      })
      .catch((e) => {
        if (!alive) return;
        setGraphError(String(e?.message ?? e));
      })
      .finally(() => {
        if (!alive) return;
        setGraphLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

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

  // --- Hull + perimeter (como tu amigo) ---
  const disks = React.useMemo(
    () => scene.points.map((p) => ({ id: p.id, x: p.x, y: p.y, r: scene.radius })),
    [scene.points, scene.radius]
  );

  const hull = React.useMemo(() => computeDiskHull(disks), [disks]);

  const perimeter = React.useMemo(() => {
  let total = 0;

  for (const seg of hull.segments) {
    if (seg.type === "tangent") {
      total += Math.hypot(seg.to.x - seg.from.x, seg.to.y - seg.from.y);
    } else {
      let diff = seg.endAngle - seg.startAngle;
      if (diff < 0) diff += 2 * Math.PI;
      total += seg.disk.r * diff;
    }
  }

  // Perímetro REAL de la envolvente (sin normalizar)
  return total;
}, [hull.segments]);


  const metrics = React.useMemo(() => {
    return {
      perimeter,
      disks: scene.points.length,
      tangents: hull.stats.tangents,
      arcs: hull.stats.arcs,
      segments: countSegments(scene.primitives),
    };
  }, [perimeter, scene.points.length, scene.primitives, hull.stats.tangents, hull.stats.arcs]);

  function commit(next: Scene) {
    setPast((p) => [...p, present]);
    setPresent(next);
    setFuture([]);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPointId, present]);

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

  function addPoint(pt: { x: number; y: number }) {
    const id = nextPointId(scene);
    const p: Point = { id, kind: "point", x: pt.x, y: pt.y };
    commit({ ...scene, points: [...scene.points, p] });
    setSelectedPointId(id);
  }

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

  function loadSelectedGraph() {
    const set = graphSets[graphSetIdx];
    if (!set) return;

    const g: Graph | undefined = set.graphs[graphIdx];
    if (!g) return;

    const next = graphToContactScene(g, scene.radius, { iterations: 1500 });
    commit(next);

    setSelectedPointId("p1");
    setLinkA(null);
    setRulerA(null);
    setRulerB(null);
  }

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateRows: "56px 1fr auto" }}>
      <NavBar
        title="Contact Graph Visualizer"
        subtitle="Editor + Research UI"
        right={
          <div style={{ display: "flex", gap: 10 }}>
            <Pill
              active={mode === "move"}
              onClick={() => {
                setMode("move");
                setLinkA(null);
              }}
            >
              Move
            </Pill>
            <Pill
              active={mode === "add"}
              onClick={() => {
                setMode("add");
                setLinkA(null);
              }}
            >
              Add
            </Pill>
            <Pill
              active={mode === "link"}
              onClick={() => {
                setMode("link");
                setLinkA(null);
              }}
            >
              Link
            </Pill>
            <Pill
              active={mode === "delete"}
              onClick={() => {
                setMode("delete");
                setLinkA(null);
              }}
            >
              Delete
            </Pill>

            <div style={{ width: 1, background: "rgba(0,0,0,0.10)", margin: "0 4px" }} />

            <Pill disabled={past.length === 0} onClick={undo}>
              Undo
            </Pill>
            <Pill disabled={future.length === 0} onClick={redo}>
              Redo
            </Pill>
          </div>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", minHeight: 0 }}>
        <div style={{ minWidth: 0, minHeight: 0 }}>
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
            showHull={false}
            showGrid={false}
          />
        </div>

        <aside
          style={{
            borderLeft: "1px solid rgba(0,0,0,0.08)",
            background: "rgba(255,255,255,0.72)",
            backdropFilter: "saturate(180%) blur(18px)",
            padding: 16,
            overflow: "auto",
            minWidth: 0,
          }}
        >
          <SectionTitle>Properties / Measurement</SectionTitle>

          <Card title="Tool">
            <Row label="Mode" value={mode} />
            <Row label="Link A" value={linkA ?? "—"} />
            <Row label="Radius" value={scene.radius} />
          </Card>

          <Spacer />

          <Card title="Preload graph">
            <Row
              label="Status"
              value={graphLoading ? "Loading..." : graphError ? `Error: ${graphError}` : "Ready"}
            />
            <Row
              label="Set"
              value={
                <select
                  value={graphSetIdx}
                  onChange={(e) => {
                    setGraphSetIdx(Number(e.target.value));
                    setGraphIdx(0);
                  }}
                  disabled={!graphSets.length}
                >
                  {graphSets.map((s, i) => (
                    <option key={`${s.label}-${i}`} value={i}>
                      {s.label} ({s.graphs.length})
                    </option>
                  ))}
                </select>
              }
            />
            <Row
              label="Index"
              value={
                <input
                  type="number"
                  value={graphIdx}
                  min={0}
                  onChange={(e) => setGraphIdx(Number(e.target.value))}
                  style={{ width: 120 }}
                  disabled={!graphSets.length}
                />
              }
            />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <button
                onClick={loadSelectedGraph}
                disabled={!graphSets.length || graphLoading}
                style={{
                  height: 34,
                  padding: "0 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.10)",
                  background: "rgba(255,255,255,0.85)",
                  cursor: !graphSets.length || graphLoading ? "not-allowed" : "pointer",
                  fontWeight: 700,
                }}
              >
                Load
              </button>
            </div>
          </Card>

          <Spacer />

          <Card title="Selected">
            <Row label="ID" value={selectedPointId ?? "—"} />
            <Row label="BBox W" value={bbox ? bbox.width.toFixed(2) : "—"} />
            <Row label="BBox H" value={bbox ? bbox.height.toFixed(2) : "—"} />
          </Card>

          <Spacer />

          <Card title="Ruler (2 clicks)">
            <Row label="A" value={rulerA ?? "—"} />
            <Row label="B" value={rulerB ?? "—"} />
            <Row
              label="Center dist."
              value={rulerDistance !== null ? rulerDistance.toFixed(2) : "—"}
            />
          </Card>

          <Spacer />

          <Card title="Hull stats (hidden)">
            <Row label="Perimeter" value={metrics.perimeter.toFixed(8)} />
            <Row label="Disks" value={metrics.disks} />
            <Row label="Tangents" value={metrics.tangents} />
            <Row label="Arcs" value={metrics.arcs} />
            <Row label="Segments" value={metrics.segments} />
          </Card>
        </aside>
      </div>

      <MetricsBar
        perimeter={metrics.perimeter}
        disks={metrics.disks}
        tangents={metrics.tangents}
        arcs={metrics.arcs}
        segments={metrics.segments}
      />
    </div>
  );
}

function Pill(props: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      disabled={props.disabled}
      onClick={props.onClick}
      style={{
        height: 34,
        padding: "0 12px",
        borderRadius: 999,
        border: "1px solid rgba(0,0,0,0.10)",
        background: props.active ? "#111827" : "rgba(255,255,255,0.85)",
        color: props.active ? "#ffffff" : "#111827",
        fontWeight: 700,
        fontSize: 13,
        cursor: props.disabled ? "not-allowed" : "pointer",
        opacity: props.disabled ? 0.5 : 1,
      }}
    >
      {props.children}
    </button>
  );
}

function SectionTitle(props: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 12,
        letterSpacing: "0.02em",
        color: "rgba(17,24,39,0.55)",
        marginBottom: 10,
      }}
    >
      {props.children}
    </div>
  );
}

function Spacer() {
  return <div style={{ height: 12 }} />;
}

function Card(props: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.9)",
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: 16,
        padding: 14,
      }}
    >
      <div style={{ fontSize: 12, color: "rgba(17,24,39,0.55)", marginBottom: 10 }}>
        {props.title}
      </div>
      {props.children}
    </div>
  );
}

function Row(props: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "120px 1fr",
        padding: "7px 0",
        borderTop: "1px solid rgba(0,0,0,0.06)",
        alignItems: "center",
        fontSize: 13,
      }}
    >
      <div style={{ color: "rgba(17,24,39,0.70)" }}>{props.label}</div>
      <div style={{ fontWeight: 700, textAlign: "right", color: "#111827" }}>{props.value}</div>
    </div>
  );
}
