import React from 'react';
import type { CSBlock, CSSegment, CSArc, CSDisk } from '../../core/types/cs';
import { CoordInput } from '../../ui/CoordInput';
import { Button } from '../../ui/Button';
import { CSCanvas } from './CSCanvas';
import { validateContinuity } from '../../core/validation/continuity';
import { getCurveLengthInfo, blockLength } from '../../core/geometry/arcLength';

interface EditorPageProps {
  onBackToGallery?: () => void;
  initialKnot?: {
    id: number;
    name: string;
    nodes: number[];
    edges: [number, number][];
  };
}

/**
 * Página principal del editor de diagramas CS
 * Layout: Header + Canvas + Sidebar colapsable
 */
export function EditorPage({ onBackToGallery, initialKnot }: EditorPageProps) {
  const [blocks, setBlocks] = React.useState<CSBlock[]>([]);
  const [selectedBlockId, setSelectedBlockId] = React.useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [showValidation, setShowValidation] = React.useState(false);
  const [showGrid, setShowGrid] = React.useState(true);
  const [gridSpacing, setGridSpacing] = React.useState(20);
  const [angleUnit, setAngleUnit] = React.useState<'deg' | 'rad'>('deg');

  // Rolling mode states
  const [rollingMode, setRollingMode] = React.useState(false);
  const [diskRadius, setDiskRadius] = React.useState(30);
  const [rollingSpeed, setRollingSpeed] = React.useState(0.1);
  const [isRolling, setIsRolling] = React.useState(false);
  const [showTrail, setShowTrail] = React.useState(true);

  // Contact graph state
  const [showContactDisks, setShowContactDisks] = React.useState(false);

  // Convertir nudo inicial a bloques CS
  React.useEffect(() => {
    if (!initialKnot || initialKnot.id === 0) return; // 0 = nuevo nudo vacío
    
    // Convertir edges del nudo a segmentos CS
    const initialBlocks: CSBlock[] = initialKnot.edges.map((edge, idx) => {
      const [nodeA, nodeB] = edge;
      
      // Posicionar nodos en círculo para visualización inicial
      const angleA = (nodeA / initialKnot.nodes.length) * 2 * Math.PI;
      const angleB = (nodeB / initialKnot.nodes.length) * 2 * Math.PI;
      const radius = 100;
      
      return {
        id: `s${idx + 1}`,
        kind: 'segment',
        p1: { 
          x: Math.round(Math.cos(angleA) * radius), 
          y: Math.round(Math.sin(angleA) * radius)
        },
        p2: { 
          x: Math.round(Math.cos(angleB) * radius), 
          y: Math.round(Math.sin(angleB) * radius)
        },
      } as CSSegment;
    });
    
    setBlocks(initialBlocks);
  }, [initialKnot]);

  // Validación automática
  const validation = React.useMemo(() => validateContinuity(blocks.filter(b => b.kind !== 'disk')), [blocks]);
  
  // Cálculo de longitud (solo bloques no-disco)
  const lengthInfo = React.useMemo(() => getCurveLengthInfo(blocks.filter(b => b.kind !== 'disk')), [blocks]);

  // Obtener bloque seleccionado
  const selectedBlock = blocks.find(b => b.id === selectedBlockId);
  const selectedBlockLength = selectedBlock && selectedBlock.kind !== 'disk' ? blockLength(selectedBlock) : null;

  // Funciones de conversión
  const radToDeg = (rad: number) => (rad * 180 / Math.PI);
  const degToRad = (deg: number) => (deg * Math.PI / 180);

  // Contador de discos para IDs únicos
  const diskCount = blocks.filter(b => b.kind === 'disk').length;

  function addSegment() {
    const id = `s${Date.now()}`;
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
    const id = `a${Date.now()}`;
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

  function addDisk() {
    const id = `disk-${diskCount + 1}`;
    const newDisk: CSDisk = {
      id,
      kind: 'disk',
      center: { x: diskCount * 80, y: 0 },
      radius: 40,
      label: `D${diskCount + 1}`,
      color: '#4A90E2',
    };
    setBlocks([...blocks, newDisk]);
    setSelectedBlockId(id);
  }

  function deleteBlock(id: string) {
    setBlocks(blocks.filter((b) => b.id !== id));
    if (selectedBlockId === id) setSelectedBlockId(null);
  }

  function updateBlock(id: string, updates: Partial<CSBlock>) {
    setBlocks(
      blocks.map((b) => {
        if (b.id !== id) return b;
        // Merge updates with existing block
        return { ...b, ...updates } as CSBlock;
      })
    );
  }

  // Determinar color y texto del estado
  const nonDiskBlocks = blocks.filter(b => b.kind !== 'disk');
  const statusColor = nonDiskBlocks.length === 0 
    ? 'var(--text-tertiary)'
    : validation.valid 
      ? 'var(--accent-valid)'
      : 'var(--accent-error)';

  const statusText = nonDiskBlocks.length === 0
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
          {onBackToGallery && (
            <button
              onClick={onBackToGallery}
              style={{
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: 'var(--fs-caption)',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-tertiary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'none';
              }}
            >
              ← Galería
            </button>
          )}
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
            {initialKnot && initialKnot.id !== 0 ? initialKnot.name : 'CS Diagram Builder'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          {/* Contact Graph Toggle */}
          {nonDiskBlocks.length >= 3 && (
            <button
              onClick={() => {
                setShowContactDisks(!showContactDisks);
                if (!showContactDisks) {
                  setRollingMode(false);
                }
              }}
              style={{
                padding: '6px 12px',
                fontSize: 'var(--fs-caption)',
                fontWeight: 'var(--fw-medium)',
                background: showContactDisks ? '#4A90E2' : 'var(--bg-tertiary)',
                color: showContactDisks ? 'white' : 'var(--text-primary)',
                border: `1px solid ${showContactDisks ? '#4A90E2' : 'var(--border)'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              🔵 Grafos de Contacto
            </button>
          )}

          {/* Rolling Mode Toggle */}
          {validation.valid && nonDiskBlocks.length > 0 && !showContactDisks && (
            <button
              onClick={() => {
                setRollingMode(!rollingMode);
                if (!rollingMode) {
                  setIsRolling(false);
                }
              }}
              style={{
                padding: '6px 12px',
                fontSize: 'var(--fs-caption)',
                fontWeight: 'var(--fw-medium)',
                background: rollingMode ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                color: rollingMode ? 'white' : 'var(--text-primary)',
                border: `1px solid ${rollingMode ? 'var(--accent-primary)' : 'var(--border)'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              🎡 Rolling Mode
            </button>
          )}

          {/* Longitud total (solo si es válido) */}
          {validation.valid && nonDiskBlocks.length > 0 && !showContactDisks && (
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
            onClick={() => nonDiskBlocks.length > 0 && setShowValidation(true)}
            disabled={nonDiskBlocks.length === 0}
            style={{
              fontSize: 'var(--fs-caption)',
              color: statusColor,
              fontWeight: 'var(--fw-medium)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'none',
              border: 'none',
              cursor: nonDiskBlocks.length > 0 ? 'pointer' : 'default',
              padding: '4px 8px',
              borderRadius: '4px',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              if (nonDiskBlocks.length > 0) e.currentTarget.style.background = 'var(--bg-tertiary)';
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
            rollingMode={rollingMode}
            diskRadius={diskRadius}
            rollingSpeed={rollingSpeed}
            isRolling={isRolling}
            showTrail={showTrail}
            showContactDisks={showContactDisks}
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
            {/* Rolling mode / Contact graph panels remain the same... */}
            
            {/* LISTA DE BLOQUES */}
            {!rollingMode && !showContactDisks && (
              <div
                style={{
                  padding: 'var(--space-md)',
                  borderBottom: '1px solid var(--border)',
                  flex: 1,
                  overflowY: 'auto',
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
                  Elementos ({blocks.length})
                </h2>

                {blocks.length === 0 ? (
                  <div
                    style={{
                      fontSize: 'var(--fs-caption)',
                      color: 'var(--text-tertiary)',
                      textAlign: 'center',
                      padding: 'var(--space-lg)',
                    }}
                  >
                    Sin elementos aún
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {blocks.map((block) => {
                      const length = block.kind !== 'disk' ? blockLength(block) : null;
                      const displayName = block.kind === 'segment' ? 'Segmento' : 
                                         block.kind === 'arc' ? 'Arco' : 
                                         block.kind === 'disk' ? 'Disco' : 'Elemento';
                      
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
                              {block.kind === 'disk' && 'label' in block ? block.label : block.id}
                            </div>
                            <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)' }}>
                              {displayName}
                              {length !== null && ` · L = ${length.toFixed(1)} px`}
                              {block.kind === 'disk' && ` · r = ${block.radius.toFixed(0)} px`}
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

                {/* Botones añadir - CON DISCO */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)', marginTop: 'var(--space-md)' }}>
                  <Button onClick={addDisk} style={{ background: '#4A90E2' }}>🔵 + Disco</Button>
                  <Button onClick={addSegment}>+ Segmento</Button>
                  <Button onClick={addArc} variant="secondary">+ Arco</Button>
                </div>
              </div>
            )}

            {/* PANEL DE PROPIEDADES - CON SOPORTE PARA DISCOS */}
            {!rollingMode && !showContactDisks && selectedBlock && (
              <div
                style={{
                  padding: 'var(--space-md)',
                  background: 'var(--bg-primary)',
                }}
              >
                <div style={{ marginBottom: 'var(--space-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-primary)' }}>
                      {selectedBlock.kind === 'disk' && 'label' in selectedBlock ? selectedBlock.label : selectedBlock.id}
                    </h3>
                    <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)' }}>
                      {selectedBlock.kind === 'segment' ? 'Segmento' : selectedBlock.kind === 'arc' ? 'Arco' : 'Disco'}
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
                  {selectedBlock.kind === 'disk' ? (
                    // PROPIEDADES DEL DISCO
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
                          min="10"
                          max="100"
                          step="5"
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
                          Etiqueta
                        </label>
                        <input
                          type="text"
                          value={selectedBlock.label || ''}
                          onChange={(e) =>
                            updateBlock(selectedBlock.id, { label: e.target.value })
                          }
                          placeholder="D1, D2, etc."
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
                    </>
                  ) : selectedBlock.kind === 'segment' ? (
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
                  ) : selectedBlock.kind === 'arc' ? (
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
                    </>
                  ) : null}
                </div>
              </div>
            )}

            {!rollingMode && !showContactDisks && !selectedBlock && blocks.length > 0 && (
              <div
                style={{
                  padding: 'var(--space-lg)',
                  textAlign: 'center',
                  color: 'var(--text-tertiary)',
                  fontSize: 'var(--fs-caption)',
                }}
              >
                Selecciona un elemento para editar
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
