import React from 'react';

export function NavBar(props: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        backdropFilter: 'saturate(180%) blur(18px)',
        background: 'rgba(255,255,255,0.78)',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
      }}
    >
      <div
        style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 18px',
          maxWidth: 1400,
          margin: '0 auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
          <div
            style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', color: '#111827' }}
          >
            {props.title}
          </div>
          {props.subtitle ? (
            <div
              style={{
                fontSize: 12,
                color: 'rgba(17,24,39,0.65)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {props.subtitle}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{props.right}</div>
      </div>
    </div>
  );
}
