import { useEffect, useState } from 'react';

import { graphToContactScene } from '../../../core/geometry/contactLayout';
import type { CSDisk } from '../../../core/types/cs';
import loadAllGraphs, { type GraphSet } from '../../../io/loadAllGraphs';
import { type Graph } from '../../../io/parseGraph6';
import { Button } from '../../../ui/Button';
import { GraphPreview } from './GraphPreview';

interface GraphsPanelProps {
  onLoadScene: (disks: CSDisk[]) => void;
}

export function GraphsPanel({ onLoadScene }: GraphsPanelProps) {
  const [graphSets, setGraphSets] = useState<GraphSet[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedSetLabel, setExpandedSetLabel] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 40;

  const handleSetExpand = (label: string) => {
    if (expandedSetLabel === label) {
      setExpandedSetLabel(null);
    } else {
      setExpandedSetLabel(label);
      setPage(1); // Reset page on expand
    }
  };

  useEffect(() => {
    setLoading(true);
    loadAllGraphs()
      .then((sets) => {
        console.log('GraphSets loaded:', sets);
        setGraphSets(sets);
        // Expand first set by default
        if (sets.length > 0) {
          setExpandedSetLabel(sets[0].label);
        }
      })
      .catch((err) => console.error('Failed to load graphs:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleApplyGraph = (graph: Graph) => {
    // Generar layout usando un radio fijo por ahora
    // (el usuario podría querer cambiar esto después, pero empezamos con algo razonable)
    const radius = 50;
    const scene = graphToContactScene(graph, radius);

    // Convertir Scene points a CSDisk[]
    // Scene points from graphToContactScene are just {x, y, ...}
    // We need to create CSDisk blocks
    const disks: CSDisk[] = scene.points.map((p, idx) => ({
      id: `disk-${idx + 1}`,
      kind: 'disk',
      center: { x: p.x, y: p.y },
      radius: 1, // Geometric radius (convention based on Contact Graph theory usually 1)
      visualRadius: radius, // Visual radius for rendering
      label: `D${idx + 1}`,
    }));

    console.log('Applying graph:', graph, 'Generated disks:', disks);
    onLoadScene(disks);
  };

  return (
    <div
      style={{
        padding: 'var(--space-md)',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-primary)',
        maxHeight: '400px',
        overflowY: 'auto',
      }}
    >
      <h2
        style={{
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 'var(--space-sm)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        📚 Graph Library
      </h2>

      {loading && (
        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Loading graphs...</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {graphSets.map((set) => (
          <div
            key={set.label}
            style={{ background: 'var(--bg-secondary)', borderRadius: '6px', overflow: 'hidden' }}
          >
            <div
              onClick={() => handleSetExpand(set.label)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 'var(--fs-body)',
                fontWeight: '500',
                userSelect: 'none',
                background: expandedSetLabel === set.label ? 'rgba(0,0,0,0.05)' : 'transparent',
              }}
            >
              <span>{set.label}</span>
              <span style={{ fontSize: '0.8em', opacity: 0.6 }}>{set.graphs.length}</span>
            </div>

            {expandedSetLabel === set.label && (
              <div style={{ padding: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                  {set.graphs.slice(0, page * PAGE_SIZE).map((graph, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleApplyGraph(graph)}
                      title={`Graph #${idx + 1}`}
                      style={{
                        aspectRatio: '1',
                        border: '1px solid var(--border)',
                        background: 'var(--bg-primary)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px',
                        color: 'var(--text-secondary)',
                        transition: 'all 0.2s',
                        padding: '2px',
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.borderColor = 'var(--accent-primary)')
                      }
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                    >
                      <GraphPreview graph={graph} size={40} showEdges={true} />
                    </button>
                  ))}
                </div>
                {set.graphs.length > page * PAGE_SIZE && (
                  <Button
                    onClick={() => setPage((p) => p + 1)}
                    variant="secondary"
                    style={{ width: '100%', marginTop: '8px', fontSize: '11px' }}
                  >
                    Load More ({set.graphs.length - page * PAGE_SIZE} remaining)
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
