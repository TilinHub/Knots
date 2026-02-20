import React from 'react';

interface BlockProps {
  title: string;
  children: React.ReactNode;
  active?: boolean;
  onDelete?: () => void;
}

/**
 * Contenedor tipo card para definición de bloques CS
 */
export function Block({ title, children, active = false, onDelete }: BlockProps) {
  return (
    <div
      style={{
        padding: 'var(--space-sm)',
        border: `1px solid ${active ? 'var(--canvas-arc)' : 'var(--border)'}`,
        borderRadius: '8px',
        background: 'white',
        transition: 'border-color 0.15s ease',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--space-sm)',
        }}
      >
        <div
          style={{
            fontSize: 'var(--fs-caption)',
            fontWeight: 'var(--fw-semibold)',
            color: active ? 'var(--canvas-arc)' : 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {title}
        </div>
        {onDelete && (
          <button
            onClick={onDelete}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              padding: '4px',
              fontSize: '14px',
              lineHeight: 1,
            }}
            title="Eliminar bloque"
          >
            ×
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
        {children}
      </div>
    </div>
  );
}
