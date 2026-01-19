import React from 'react';
import type { CSBlock, CSSegment, CSArc } from '../../core/types/cs';
import { CoordInput } from '../../ui/CoordInput';
import { Button } from '../../ui/Button';
import { CSCanvas } from './CSCanvas';
import { validateContinuity } from '../../core/validation/continuity';
import { getCurveLengthInfo, blockLength } from '../../core/geometry/arcLength';

interface EditorPageProps {
  onBackToGallery?: () => void;
}

/**
 * Página principal del editor de diagramas CS
 * Layout: Header + Canvas + Sidebar colapsable
 */
export function EditorPage({ onBackToGallery }: EditorPageProps) {
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
      blocks.map((b) => {
        if (b.id !== id) return b;
        // Merge updates with existing block
        return { ...b, ...updates } as CSBlock;
      })
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
            CS Diagram Builder
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          {/* Rolling Mode Toggle */}
          {validation.valid && blocks.length > 0 && (
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
            rollingMode={rollingMode}
            diskRadius={diskRadius}
            rollingSpeed={rollingSpeed}
            isRolling={isRolling}
            showTrail={showTrail}
          />
        </div>

        {/* SIDEBAR - resto del código sin cambios... */}
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
            {/* Contenido del sidebar (sin cambios) */}
          </aside>
        )}
      </div>
    </div>
  );
}
