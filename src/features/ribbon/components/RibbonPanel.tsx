import React from 'react';
import { Button } from '../../../ui/components/Button';

interface RibbonState {
    isActive: boolean;
    width: number;
    showCenterPath: boolean;
    opacity: number;
}

interface RibbonPanelProps {
    state: RibbonState;
    actions: {
        toggleMode: () => void;
        setWidth: (w: number) => void;
        setOpacity: (o: number) => void;
        toggleCenterPath: () => void;
    };
}

export const RibbonPanel: React.FC<RibbonPanelProps> = ({ state, actions }) => {
    return (
        <div
            style={{
                padding: 'var(--space-md)',
                borderBottom: '1px solid var(--border)',
                background: 'var(--bg-primary)',
            }}
        >
            <header
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 'var(--space-md)',
                }}
            >
                <h2
                    style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        margin: 0,
                    }}
                >
                    🎀 Ribbon Mode
                </h2>
                <button
                    onClick={actions.toggleMode}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-tertiary)',
                        cursor: 'pointer',
                        fontSize: '18px',
                    }}
                >
                    ×
                </button>
            </header>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>


                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Opacity</label>
                        <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>
                            {(state.opacity * 100).toFixed(0)}%
                        </span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={state.opacity}
                        onChange={(e) => actions.setOpacity(Number(e.target.value))}
                        style={{ width: '100%' }}
                    />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                        type="checkbox"
                        id="showCenterPath"
                        checked={state.showCenterPath}
                        onChange={actions.toggleCenterPath}
                        style={{ cursor: 'pointer' }}
                    />
                    <label
                        htmlFor="showCenterPath"
                        style={{ fontSize: '12px', color: 'var(--text-primary)', cursor: 'pointer' }}
                    >
                        Show Center Path
                    </label>
                </div>

                <div style={{ marginTop: 'var(--space-sm)' }}>
                    <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                        Visualizes the knot as a thickened ribbon for clearance analysis.
                    </p>
                </div>
            </div>
        </div>
    );
};
