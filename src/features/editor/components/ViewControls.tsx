import type React from 'react';

interface ViewControlsProps {
  showGrid: boolean;
  onToggleGrid: (show: boolean) => void;
  gridSpacing: number;
  onGridSpacingChange: (spacing: number) => void;
  angleUnit: 'deg' | 'rad';
  onAngleUnitChange: (unit: 'deg' | 'rad') => void;
}

export const ViewControls = ({
  showGrid,
  onToggleGrid,
  gridSpacing,
  onGridSpacingChange,
  angleUnit,
  onAngleUnitChange,
}: ViewControlsProps) => {
  return (
    <div
      style={{
        padding: 'var(--space-md)',
        borderBottom: '1px solid var(--border)',
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
        }}
      >
        View
      </h2>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-sm)',
        }}
      >
        <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Grid</span>
        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showGrid}
            onChange={(e) => onToggleGrid(e.target.checked)}
            style={{ marginRight: '6px' }}
          />
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            {showGrid ? 'On' : 'Off'}
          </span>
        </label>
      </div>

      {showGrid && (
        <div style={{ marginBottom: 'var(--space-sm)' }}>
          <label
            style={{
              fontSize: '11px',
              color: 'var(--text-secondary)',
              display: 'block',
              marginBottom: '4px',
            }}
          >
            Spacing: {gridSpacing}px
          </label>
          <input
            type="range"
            min="10"
            max="50"
            step="5"
            value={gridSpacing}
            onChange={(e) => onGridSpacingChange(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Angles</span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => onAngleUnitChange('deg')}
            style={{
              padding: '2px 8px',
              fontSize: '11px',
              background: angleUnit === 'deg' ? '#F5F5F7' : 'transparent',
              border: `1px solid ${angleUnit === 'deg' ? '#D2D2D7' : 'transparent'}`,
              borderRadius: '4px',
              cursor: 'pointer',
              color: angleUnit === 'deg' ? '#1D1D1F' : 'var(--text-secondary)',
              fontWeight: angleUnit === 'deg' ? 600 : 400,
            }}
          >
            deg
          </button>
          <button
            onClick={() => onAngleUnitChange('rad')}
            style={{
              padding: '2px 8px',
              fontSize: '11px',
              background: angleUnit === 'rad' ? '#F5F5F7' : 'transparent',
              border: `1px solid ${angleUnit === 'rad' ? '#D2D2D7' : 'transparent'}`,
              borderRadius: '4px',
              cursor: 'pointer',
              color: angleUnit === 'rad' ? '#1D1D1F' : 'var(--text-secondary)',
              fontWeight: angleUnit === 'rad' ? 600 : 400,
            }}
          >
            rad
          </button>
        </div>
      </div>
    </div>
  );
};
