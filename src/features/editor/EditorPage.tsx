import React from 'react';
import type { CSBlock } from '../../core/types/cs';
import { CoordInput } from '../../ui/CoordInput';
import { Button } from '../../ui/Button';
import { CSCanvas } from './CSCanvas';
import { validateContinuity } from '../../core/validation/continuity';
import { getCurveLengthInfo, blockLength } from '../../core/geometry/arcLength';

/**
 * Página principal del editor de diagramas CS
 * Layout: Header + Canvas + Sidebar colapsable
 */
export function EditorPage() {
  const [blocks, setBlocks] = React.useState<CSBlock[]>([]);
  const [selectedBlockId, setSelectedBlockId] = React.useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [showValidation, setShowValidation] = React.useState(false);
  const [showGrid, setShowGrid] = React.useState(true);
  const [gridSpacing, setGridSpacing] = React.useState(20);
  const [angleUnit, setAngleUnit] = React.useState<'deg' | 'rad'>('deg');

  // Validación automática
  const validation = React.useMemo(() => validateContinuity(blocks), [blocks]);
  
  // Cálculo de longitud
  const lengthInfo = React.useMemo(() => getCurveLengthInfo(blocks), [blocks]);

  // Obtener bloque seleccionado
  const selectedBlock = blocks.find(b => b.id === selectedBlockId);
  const selectedBlockLength = selectedBlock ? blockLength(selectedBlock) : null;

  // Funciones de conversión
  const radToDeg = (rad: number) => (rad * 180 / Math.PI);
  const degToRad = (deg: number) => (deg * Math.PI / 180);

  function addSegment() {
    const id = `s${blocks.length + 1}`;
    const newSegment: CSBlock = {
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
    const newArc: CSBlock = {
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
          {/* Longitud total (solo si es válido) */}
          {validation.valid && blocks.length > 0 && (
            <div
              style={{
                fontSize: 'var(--fs-caption)',
                color: 'var(--text-secondary)',
                fontWeight: 'var(--fw-medium)',
                padding: '4px 12px',
                background: 'var(--bg-tertiary)',
                borderRadius: '6px',
                fontFamily: 'var(--ff-mono)',
              }}
            >
              L = {lengthInfo.totalLength.toFixed(2)} px
            </div>
          )}

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
          <CSCanvas 
            blocks={blocks} 
            selectedBlockId={selectedBlockId}
            onSelectBlock={setSelectedBlockId}
            onUpdateBlock={updateBlock}
            showGrid={showGrid}
            gridSpacing={gridSpacing}
          />
        </div>

        {/* SIDEBAR */}
        {sidebarOpen && (
          <aside
            style={{
              width: '320px',
              borderLeft: '1px solid var(--border)',
              background: 'var(--bg-secondary)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* CONTROLES DE VISTA */}
            <div
              style={{
                padding: 'var(--space-md)',
                borderBottom: '1px solid var(--border)',
              }}
            >
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
                Vista
              </h2>

              {/* Toggle grilla */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-sm)' }}>
                <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-primary)' }}>Grilla</span>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={showGrid}
                    onChange={(e) => setShowGrid(e.target.checked)}
                    style={{ marginRight: '6px' }}
                  />
                  <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)' }}>
                    {showGrid ? 'Visible' : 'Oculta'}
                  </span>
                </label>
              </div>

              {/* Espaciado de grilla */}
              {showGrid && (
                <div style={{ marginBottom: 'var(--space-sm)' }}>
                  <label
                    style={{
                      fontSize: 'var(--fs-caption)',
                      color: 'var(--text-secondary)',
                      display: 'block',
                      marginBottom: '4px',
                    }}
                  >
                    Espaciado: {gridSpacing}px
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="50"
                    step="5"
                    value={gridSpacing}
                    onChange={(e) => setGridSpacing(Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
              )}

              {/* Toggle unidades de ángulo */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-primary)' }}>Ángulos</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={() => setAngleUnit('deg')}
                    style={{
                      padding: '4px 8px',
                      fontSize: 'var(--fs-caption)',
                      background: angleUnit === 'deg' ? 'var(--bg-primary)' : 'transparent',
                      border: `1px solid ${angleUnit === 'deg' ? 'var(--border)' : 'transparent'}`,
                      borderRadius: '4px',
                      cursor: 'pointer',
                      color: angleUnit === 'deg' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    }}
                  >
                    grados
                  </button>
                  <button
                    onClick={() => setAngleUnit('rad')}
                    style={{
                      padding: '4px 8px',
                      fontSize: 'var(--fs-caption)',
                      background: angleUnit === 'rad' ? 'var(--bg-primary)' : 'transparent',
                      border: `1px solid ${angleUnit === 'rad' ? 'var(--border)' : 'transparent'}`,
                      borderRadius: '4px',
                      cursor: 'pointer',
                      color: angleUnit === 'rad' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    }}
                  >
                    radianes
                  </button>
                </div>
              </div>
            </div>

            {/* LISTA DE BLOQUES */}
            <div
              style={{
                padding: 'var(--space-md)',
                borderBottom: '1px solid var(--border)',
                flex: 1,
                overflowY: 'auto',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
                <h2
                  style={{
                    fontSize: 'var(--fs-caption)',
                    fontWeight: 'var(--fw-semibold)',
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Bloques ({blocks.length})
                </h2>
              </div>

              {blocks.length === 0 ? (
                <div
                  style={{
                    fontSize: 'var(--fs-caption)',
                    color: 'var(--text-tertiary)',
                    textAlign: 'center',
                    padding: 'var(--space-lg)',
                  }}
                >
                  Sin bloques aún
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {blocks.map((block) => {
                    const length = blockLength(block);
                    return (
                      <div
                        key={block.id}
                        onClick={() => setSelectedBlockId(block.id)}
                        style={{
                          padding: 'var(--space-sm)',
                          background: selectedBlockId === block.id ? 'var(--bg-primary)' : 'transparent',
                          border: `1px solid ${selectedBlockId === block.id ? 'var(--border)' : 'transparent'}`,
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          if (selectedBlockId !== block.id) {
                            e.currentTarget.style.background = 'var(--bg-tertiary)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (selectedBlockId !== block.id) {
                            e.currentTarget.style.background = 'transparent';
                          }
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-medium)', color: 'var(--text-primary)' }}>
                            {block.id}
                          </div>
                          <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)' }}>
                            {block.kind === 'segment' ? 'Segmento' : 'Arco'} · L = {length.toFixed(1)} px
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteBlock(block.id);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-tertiary)',
                            cursor: 'pointer',
                            padding: '4px',
                            fontSize: '14px',
                          }}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Botones añadir */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)', marginTop: 'var(--space-md)' }}>
                <Button onClick={addSegment}>+ Segmento</Button>
                <Button onClick={addArc} variant="secondary">
                  + Arco
                </Button>
              </div>
            </div>

            {/* PANEL DE PROPIEDADES DINÁMICO */}
            {selectedBlock && (
              <div
                style={{
                  padding: 'var(--space-md)',
                  background: 'var(--bg-primary)',
                }}
              >
                <div style={{ marginBottom: 'var(--space-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-primary)' }}>
                      {selectedBlock.id}
                    </h3>
                    <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)' }}>
                      {selectedBlock.kind === 'segment' ? 'Segmento' : 'Arco'}
                    </div>
                  </div>
                  {selectedBlockLength !== null && (
                    <div
                      style={{
                        fontSize: 'var(--fs-caption)',
                        fontFamily: 'var(--ff-mono)',
                        color: 'var(--text-secondary)',
                        padding: '4px 8px',
                        background: 'var(--bg-secondary)',
                        borderRadius: '4px',
                      }}
                    >
                      L = {selectedBlockLength.toFixed(2)}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                  {selectedBlock.kind === 'segment' ? (
                    <>
                      <CoordInput
                        label="P₁"
                        x={selectedBlock.p1.x}
                        y={selectedBlock.p1.y}
                        onChange={(x, y) =>
                          updateBlock(selectedBlock.id, { p1: { x, y } })
                        }
                      />
                      <CoordInput
                        label="P₂"
                        x={selectedBlock.p2.x}
                        y={selectedBlock.p2.y}
                        onChange={(x, y) =>
                          updateBlock(selectedBlock.id, { p2: { x, y } })
                        }
                      />
                    </>
                  ) : (
                    <>
                      <CoordInput
                        label="Centro"
                        x={selectedBlock.center.x}
                        y={selectedBlock.center.y}
                        onChange={(x, y) =>
                          updateBlock(selectedBlock.id, { center: { x, y } })
                        }
                      />
                      <div>
                        <label
                          style={{
                            fontSize: 'var(--fs-caption)',
                            color: 'var(--text-secondary)',
                            fontWeight: 'var(--fw-medium)',
                            textTransform: 'uppercase',
                            display: 'block',
                            marginBottom: '4px',
                          }}
                        >
                          Radio (r)
                        </label>
                        <input
                          type="number"
                          value={selectedBlock.radius}
                          onChange={(e) =>
                            updateBlock(selectedBlock.id, { radius: Number(e.target.value) })
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
                              display: 'block',
                              marginBottom: '4px',
                            }}
                          >
                            θ₁ {angleUnit === 'deg' ? '(°)' : '(rad)'}
                          </label>
                          <input
                            type="number"
                            value={
                              angleUnit === 'deg' 
                                ? radToDeg(selectedBlock.startAngle).toFixed(2)
                                : selectedBlock.startAngle.toFixed(4)
                            }
                            onChange={(e) => {
                              const value = Number(e.target.value);
                              const radValue = angleUnit === 'deg' ? degToRad(value) : value;
                              updateBlock(selectedBlock.id, { startAngle: radValue });
                            }}
                            step={angleUnit === 'deg' ? '1' : '0.01'}
                            style={{
                              width: '100%',
                              height: '32px',
                              padding: '0 8px',
                              border: '1px solid var(--border)',
                              borderRadius: '6px',
                              fontFamily: 'var(--ff-mono)',
                              fontSize: '13px',
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
                              display: 'block',
                              marginBottom: '4px',
                            }}
                          >
                            θ₂ {angleUnit === 'deg' ? '(°)' : '(rad)'}
                          </label>
                          <input
                            type="number"
                            value={
                              angleUnit === 'deg'
                                ? radToDeg(selectedBlock.endAngle).toFixed(2)
                                : selectedBlock.endAngle.toFixed(4)
                            }
                            onChange={(e) => {
                              const value = Number(e.target.value);
                              const radValue = angleUnit === 'deg' ? degToRad(value) : value;
                              updateBlock(selectedBlock.id, { endAngle: radValue });
                            }}
                            step={angleUnit === 'deg' ? '1' : '0.01'}
                            style={{
                              width: '100%',
                              height: '32px',
                              padding: '0 8px',
                              border: '1px solid var(--border)',
                              borderRadius: '6px',
                              fontFamily: 'var(--ff-mono)',
                              fontSize: '13px',
                            }}
                          />
                        </div>
                      </div>
                      {/* Mostrar longitud de arco con fórmula */}
                      <div
                        style={{
                          fontSize: 'var(--fs-caption)',
                          color: 'var(--text-secondary)',
                          padding: '8px',
                          background: 'var(--bg-secondary)',
                          borderRadius: '4px',
                          fontFamily: 'var(--ff-mono)',
                        }}
                      >
                        L = r × |Δθ| = {selectedBlock.radius.toFixed(1)} × {Math.abs(selectedBlock.endAngle - selectedBlock.startAngle).toFixed(3)}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {!selectedBlock && blocks.length > 0 && (
              <div
                style={{
                  padding: 'var(--space-lg)',
                  textAlign: 'center',
                  color: 'var(--text-tertiary)',
                  fontSize: 'var(--fs-caption)',
                }}
              >
                Selecciona un bloque para editar
              </div>
            )}
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

            {/* Información de longitud */}
            {validation.valid && (
              <div style={{ marginBottom: 'var(--space-md)' }}>
                <div
                  style={{
                    fontSize: 'var(--fs-body)',
                    color: 'var(--accent-valid)',
                    textAlign: 'center',
                    padding: 'var(--space-md)',
                    background: 'var(--bg-secondary)',
                    borderRadius: '8px',
                    marginBottom: 'var(--space-md)',
                  }}
                >
                  ✓ Diagrama CS válido
                </div>

                <div
                  style={{
                    fontSize: 'var(--fs-caption)',
                    fontWeight: 'var(--fw-semibold)',
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    marginBottom: 'var(--space-xs)',
                  }}
                >
                  Longitud de Curva
                </div>
                <div
                  style={{
                    padding: 'var(--space-md)',
                    background: 'var(--bg-secondary)',
                    borderRadius: '6px',
                  }}
                >
                  <div
                    style={{
                      fontSize: 'var(--fs-header)',
                      fontWeight: 'var(--fw-semibold)',
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--ff-mono)',
                      marginBottom: 'var(--space-sm)',
                    }}
                  >
                    L = {lengthInfo.totalLength.toFixed(2)} px
                  </div>
                  <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)' }}>
                    {lengthInfo.blockLengths.map((info, i) => (
                      <div key={info.id} style={{ marginBottom: '4px' }}>
                        {info.id}: {info.length.toFixed(2)} px
                        {i < lengthInfo.blockLengths.length - 1 && ' +'}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <Button onClick={() => setShowValidation(false)}>Cerrar</Button>
          </div>
        </div>
      )}
    </div>
  );
}
