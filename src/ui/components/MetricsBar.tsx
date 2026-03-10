import React from 'react';

function Metric(props: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, color: 'rgba(17,24,39,0.60)' }}>{props.label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>
        {props.value}
      </div>
      {props.hint ? (
        <div style={{ fontSize: 11, color: 'rgba(17,24,39,0.45)' }}>{props.hint}</div>
      ) : null}
    </div>
  );
}

export function MetricsBar(props: {
  perimeter: number | null;
  disks: number;
  tangents: number | null;
  arcs: number | null;
  segments: number;
}) {
  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        zIndex: 10,
        backdropFilter: 'saturate(180%) blur(18px)',
        background: 'rgba(255,255,255,0.78)',
        borderTop: '1px solid rgba(0,0,0,0.08)',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 18,
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          maxWidth: 1400,
          margin: '0 auto',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, minmax(120px, 1fr))',
            gap: 16,
            width: '100%',
          }}
        >
          <Metric
            label="Perímetro"
            value={props.perimeter === null ? '—' : props.perimeter.toFixed(8)}
            hint={props.perimeter === null ? 'Pendiente de cálculo' : undefined}
          />
          <Metric label="Discos" value={props.disks} />
          <Metric
            label="Tangentes"
            value={props.tangents === null ? '—' : props.tangents}
            hint={props.tangents === null ? 'Pendiente de cálculo' : undefined}
          />
          <Metric
            label="Arcos"
            value={props.arcs === null ? '—' : props.arcs}
            hint={props.arcs === null ? 'Pendiente de cálculo' : undefined}
          />
          <Metric label="Segmentos" value={props.segments} />
        </div>
      </div>
    </div>
  );
}
