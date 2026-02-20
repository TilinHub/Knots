import React from 'react';

interface CoordInputProps {
  x: number;
  y: number;
  onChange: (x: number, y: number) => void;
  label?: string;
  disabled?: boolean;
}

/**
 * Input de coordenadas 2D (x, y)
 * Diseño minimalista con tipografía monoespaciada para precisión
 */
export function CoordInput({ x, y, onChange, label, disabled }: CoordInputProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
      {label && (
        <label
          style={{
            fontSize: 'var(--fs-caption)',
            color: 'var(--text-secondary)',
            fontWeight: 'var(--fw-medium)',
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
          }}
        >
          {label}
        </label>
      )}
      <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
        <input
          type="number"
          value={x}
          onChange={(e) => onChange(Number(e.target.value), y)}
          disabled={disabled}
          placeholder="x"
          step="0.1"
          style={{
            ...inputStyle,
            opacity: disabled ? 0.5 : 1,
            cursor: disabled ? 'not-allowed' : 'text',
          }}
        />
        <input
          type="number"
          value={y}
          onChange={(e) => onChange(x, Number(e.target.value))}
          disabled={disabled}
          placeholder="y"
          step="0.1"
          style={{
            ...inputStyle,
            opacity: disabled ? 0.5 : 1,
            cursor: disabled ? 'not-allowed' : 'text',
          }}
        />
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '80px',
  height: '32px',
  padding: '0 8px',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  fontFamily: 'var(--ff-mono)',
  fontSize: 'var(--fs-body)',
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  transition: 'border-color 0.15s ease',
};
