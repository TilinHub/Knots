import React from 'react';
import type { CSBlock, CSSegment, CSArc } from '../../core/types/cs';
import { CoordInput } from '../../ui/CoordInput';
import { Button } from '../../ui/Button';
import { Block } from '../../ui/Block';
import { CSCanvas } from './CSCanvas';
import { validateContinuity } from '../../core/validation/continuity';

/**
 * Página principal del editor de diagramas CS
 * Layout: Header + Canvas + Sidebar colapsable
 */
export function EditorPage() {
  const [blocks, setBlocks] = React.useState<CSBlock[]>([]);
  const [selectedBlockId, setSelectedBlockId] = React.useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [showValidation, setShowValidation] = React.useState(false);

  // Validación automática
  const validation = React.useMemo(() => validateContinuity(blocks), [blocks]);

  function addSegment() {
    const id = `s${blocks.length + 1}`;
    const newSegment: CSSegment = {
      id,
      kind: 'segment',
      p1: { x: 0, y: 0 },
      p2: { x: 100, y: 50 },
    };
    setBlocks([...blocks, newSegment]);
    setSelectedBlockId(id);
  }

  function addArc() {
    const id = `a${blocks.length + 1}`;
    const newArc: CSArc = {
      id,
      kind: 'arc',
      center: { x: 50, y: 50 },
      radius: 25,
      startAngle: 0,
      endAngle: Math.PI / 2,
    };
    setBlocks([...blocks, newArc]);
    setSelectedBlockId(id);
  }

  function deleteBlock(id: string) {
    setBlocks(blocks.filter((b) => b.id !== id));
    if (selectedBlockId === id) setSelectedBlockId(null);
  }

  function updateBlock(id: string, updates: Partial<CSBlock>) {
    setBlocks(
      blocks.map((b) => (b.id === id ? { ...b, ...updates } : b))
    );
  }

  // Determinar color y texto del estado
  const statusColor = blocks.length === 0 
    ? 'var(--text-tertiary)'
    : validation.valid 
      ? 'var(--accent-valid)'
      : 'var(--accent-error)';

  const statusText = blocks.length === 0
    ? 'sin bloques'
    : validation.valid
      ? 'cs válido'
      : `${validation.errors.length} error${validation.errors.length !== 1 ? 'es' : ''}`;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* HEADER */}
      <header
        style={{
          height: '60px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 var(--space-lg)',
          background: 'var(--bg-primary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
          <h1
            style={{
              fontSize: 'var(--fs-header)',
              fontWeight: 'var(--fw-semibold)',
              color: 'var(--text-primary)',
            }}
          >
            Knots
          </h1>
          <div
            style={{
              fontSize: 'var(--fs-caption)',
              color: 'var(--text-secondary)',
            }}
          >
            CS Diagram Builder
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <button
            onClick={() => blocks.length > 0 && setShowValidation(true)}
            disabled={blocks.length === 0}
            style={{
              fontSize: 'var(--fs-caption)',
              color: statusColor,
              fontWeight: 'var(--fw-medium)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'none',
              border: 'none',
              cursor: blocks.length > 0 ? 'pointer' : 'default',
              padding: '4px 8px',
              borderRadius: '4px',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              if (blocks.length > 0) e.currentTarget.style.background = 'var(--bg-tertiary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: statusColor,
              }}
            />
            {statusText}
          </button>

          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '6px 10px',
              cursor: 'pointer',
              fontSize: 'var(--fs-caption)',
              color: 'var(--text-secondary)',
            }}
          >
            {sidebarOpen ? '▶️' : '◀️'}
          </button>
        </div>
      </header>

      {/* MAIN: Canvas + Sidebar */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* CANVAS */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            minWidth: 0,
          }}
        >
          <CSCanvas blocks={blocks} />
        </div>

        {/* SIDEBAR */}
        {sidebarOpen && (
          <aside
            style={{
              width: '280px',
              borderLeft: '1px solid var(--border)',
              background: 'var(--bg-secondary)',
              padding: 'var(--space-md)',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-md)',
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: 'var(--fs-caption)',
                  fontWeight: 'var(--fw-semibold)',
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: 'var(--space-sm)',
                }}
              >
                Bloques CS
              </h2>

              {/* Lista de bloques */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {blocks.length === 0 && (
                  <div
                    style={{
                      fontSize: 'var(--fs-caption)',
                      color: 'var(--text-tertiary)',
                      textAlign: 'center',
                      padding: 'var(--space-md)',
                    }}
                  >
                    Sin bloques. Crea un segmento o arco.
                  </div>
                )}

                {blocks.map((block) => (
                  <Block
                    key={block.id}
                    title={`${block.id} · ${block.kind === 'segment' ? 'Segmento' : 'Arco'}`}
                    active={selectedBlockId === block.id}
                    onDelete={() => deleteBlock(block.id)}
                  >
                    {block.kind === 'segment' ? (
                      <>
                        <CoordInput
                          label="P₁"
                          x={block.p1.x}
                          y={block.p1.y}
                          onChange={(x, y) =>
                            updateBlock(block.id, { p1: { x, y } } as Partial<CSSegment>)
                          }
                        />
                        <CoordInput
                          label="P₂"
                          x={block.p2.x}
                          y={block.p2.y}
                          onChange={(x, y) =>
                            updateBlock(block.id, { p2: { x, y } } as Partial<CSSegment>)
                          }
                        />
                      </>
                    ) : (
                      <>
                        <CoordInput
                          label="Centro"
                          x={block.center.x}
                          y={block.center.y}
                          onChange={(x, y) =>
                            updateBlock(block.id, { center: { x, y } } as Partial<CSArc>)
                          }
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                          <label
                            style={{
                              fontSize: 'var(--fs-caption)',
                              color: 'var(--text-secondary)',
                              fontWeight: 'var(--fw-medium)',
                              textTransform: 'uppercase',
                            }}
                          >
                            Radio
                          </label>
                          <input
                            type="number"
                            value={block.radius}
                            onChange={(e) =>
                              updateBlock(block.id, { radius: Number(e.target.value) } as Partial<CSArc>)
                            }
                            step="0.1"
                            style={{
                              width: '100%',
                              height: '32px',
                              padding: '0 8px',
                              border: '1px solid var(--border)',
                              borderRadius: '6px',
                              fontFamily: 'var(--ff-mono)',
                            }}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                          <div style={{ flex: 1 }}>
                            <label
                              style={{
                                fontSize: 'var(--fs-caption)',
                                color: 'var(--text-secondary)',
                                fontWeight: 'var(--fw-medium)',
                                textTransform: 'uppercase',
                              }}
                            >
                              θ₁
                            </label>
                            <input
                              type="number"
                              value={block.startAngle}
                              onChange={(e) =>
                                updateBlock(block.id, {
                                  startAngle: Number(e.target.value),
                                } as Partial<CSArc>)
                              }
                              step="0.1"
                              style={{
                                width: '100%',
                                height: '32px',
                                padding: '0 8px',
                                border: '1px solid var(--border)',
                                borderRadius: '6px',
                                fontFamily: 'var(--ff-mono)',
                              }}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label
                              style={{
                                fontSize: 'var(--fs-caption)',
                                color: 'var(--text-secondary)',
                                fontWeight: 'var(--fw-medium)',
                                textTransform: 'uppercase',
                              }}
                            >
                              θ₂
                            </label>
                            <input
                              type="number"
                              value={block.endAngle}
                              onChange={(e) =>
                                updateBlock(block.id, {
                                  endAngle: Number(e.target.value),
                                } as Partial<CSArc>)
                              }
                              step="0.1"
                              style={{
                                width: '100%',
                                height: '32px',
                                padding: '0 8px',
                                border: '1px solid var(--border)',
                                borderRadius: '6px',
                                fontFamily: 'var(--ff-mono)',
                              }}
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </Block>
                ))}
              </div>
            </div>

            {/* Botones añadir */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              <Button onClick={addSegment}>+ Añadir Segmento</Button>
              <Button onClick={addArc} variant="secondary">
                + Añadir Arco
              </Button>
            </div>
          </aside>
        )}
      </div>

      {/* MODAL DE VALIDACIÓN */}
      {showValidation && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowValidation(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: 'var(--space-lg)',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                fontSize: 'var(--fs-header)',
                fontWeight: 'var(--fw-semibold)',
                marginBottom: 'var(--space-md)',
              }}
            >
              Validación de Continuidad
            </h3>

            {validation.errors.length > 0 && (
              <div style={{ marginBottom: 'var(--space-md)' }}>
                <div
                  style={{
                    fontSize: 'var(--fs-caption)',
                    fontWeight: 'var(--fw-semibold)',
                    color: 'var(--accent-error)',
                    textTransform: 'uppercase',
                    marginBottom: 'var(--space-xs)',
                  }}
                >
                  Errores
                </div>
                {validation.errors.map((err, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: 'var(--fs-body)',
                      color: 'var(--text-primary)',
                      padding: 'var(--space-sm)',
                      background: 'var(--bg-secondary)',
                      borderRadius: '6px',
                      marginBottom: 'var(--space-xs)',
                      fontFamily: 'var(--ff-mono)',
                    }}
                  >
                    {err}
                  </div>
                ))}
              </div>
            )}

            {validation.warnings.length > 0 && (
              <div style={{ marginBottom: 'var(--space-md)' }}>
                <div
                  style={{
                    fontSize: 'var(--fs-caption)',
                    fontWeight: 'var(--fw-semibold)',
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    marginBottom: 'var(--space-xs)',
                  }}
                >
                  Advertencias
                </div>
                {validation.warnings.map((warn, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: 'var(--fs-body)',
                      color: 'var(--text-secondary)',
                      padding: 'var(--space-sm)',
                      background: 'var(--bg-secondary)',
                      borderRadius: '6px',
                      marginBottom: 'var(--space-xs)',
                      fontFamily: 'var(--ff-mono)',
                    }}
                  >
                    {warn}
                  </div>
                ))}
              </div>
            )}

            {validation.valid && validation.errors.length === 0 && (
              <div
                style={{
                  fontSize: 'var(--fs-body)',
                  color: 'var(--accent-valid)',
                  textAlign: 'center',
                  padding: 'var(--space-lg)',
                }}
              >
                ✓ Diagrama CS válido
              </div>
            )}

            <Button onClick={() => setShowValidation(false)}>Cerrar</Button>
          </div>
        </div>
      )}
    </div>
  );
}
