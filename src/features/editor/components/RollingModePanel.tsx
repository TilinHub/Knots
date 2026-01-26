import { Button } from '../../../ui/Button';
import type { CSDisk } from '../../../core/types/cs';

interface RollingModePanelProps {
    pivotDiskId: string | null;
    rollingDiskId: string | null;
    theta: number;
    speed: number;
    isAnimating: boolean;
    showTrail: boolean;
    diskBlocks: CSDisk[];
    onToggleAnimation: () => void;
    onThetaChange: (theta: number) => void;
    onSpeedChange: (speed: number) => void;
    onShowTrailChange: (show: boolean) => void;
    onResetSelection: () => void;
}

export const RollingModePanel = ({
    pivotDiskId,
    rollingDiskId,
    theta,
    speed,
    isAnimating,
    showTrail,
    diskBlocks,
    onToggleAnimation,
    onThetaChange,
    onSpeedChange,
    onShowTrailChange,
    onResetSelection,
}: RollingModePanelProps) => {
    return (
        <div
            style={{
                padding: 'var(--space-md)',
                borderBottom: '1px solid var(--border)',
                background: 'var(--bg-primary)',
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
                🎡 Rolling Mode
            </h2>

            {/* Instructions */}
            <div
                style={{
                    padding: 'var(--space-sm)',
                    background: 'var(--bg-secondary)',
                    borderRadius: '6px',
                    fontSize: 'var(--fs-caption)',
                    color: 'var(--text-secondary)',
                    marginBottom: 'var(--space-md)',
                    lineHeight: '1.5',
                }}
            >
                {!pivotDiskId && '1️⃣ Click en disco pivote (fijo)'}
                {pivotDiskId && !rollingDiskId && '2️⃣ Click en disco rodante'}
                {pivotDiskId && rollingDiskId && '✅ Usa controles para rodar'}
            </div>

            {/* Current State */}
            {pivotDiskId && (
                <div style={{ marginBottom: 'var(--space-md)', fontSize: 'var(--fs-caption)' }}>
                    <div style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        <strong>Pivote:</strong> {diskBlocks.find(d => d.id === pivotDiskId)?.label || pivotDiskId}
                    </div>
                    {rollingDiskId && (
                        <div style={{ color: 'var(--text-secondary)' }}>
                            <strong>Rodante:</strong> {diskBlocks.find(d => d.id === rollingDiskId)?.label || rollingDiskId}
                        </div>
                    )}
                </div>
            )}

            {/* Controls */}
            {pivotDiskId && rollingDiskId && (
                <>
                    <div style={{ marginBottom: 'var(--space-md)' }}>
                        <Button
                            onClick={onToggleAnimation}
                            style={{ width: '100%', background: isAnimating ? 'var(--accent-error)' : 'var(--accent-primary)' }}
                        >
                            {isAnimating ? '⏸️ Pausar' : '▶️ Iniciar'}
                        </Button>
                    </div>

                    <div style={{ marginBottom: 'var(--space-sm)' }}>
                        <label
                            style={{
                                fontSize: 'var(--fs-caption)',
                                color: 'var(--text-secondary)',
                                display: 'block',
                                marginBottom: '4px',
                                fontWeight: 'var(--fw-medium)',
                            }}
                        >
                            Ángulo: {(theta % (2 * Math.PI)).toFixed(2)} rad
                        </label>
                        <input
                            type="range"
                            min="0"
                            max={2 * Math.PI}
                            step="0.05"
                            value={theta % (2 * Math.PI)}
                            onChange={(e) => onThetaChange(Number(e.target.value))}
                            style={{ width: '100%' }}
                        />
                    </div>

                    <div style={{ marginBottom: 'var(--space-sm)' }}>
                        <label
                            style={{
                                fontSize: 'var(--fs-caption)',
                                color: 'var(--text-secondary)',
                                display: 'block',
                                marginBottom: '4px',
                                fontWeight: 'var(--fw-medium)',
                            }}
                        >
                            Velocidad: {speed.toFixed(3)}x
                        </label>
                        <input
                            type="range"
                            min="0.005"
                            max="0.1"
                            step="0.005"
                            value={speed}
                            onChange={(e) => onSpeedChange(Number(e.target.value))}
                            style={{ width: '100%' }}
                        />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-primary)' }}>Trayectoria</span>
                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={showTrail}
                                onChange={(e) => onShowTrailChange(e.target.checked)}
                                style={{ marginRight: '6px' }}
                            />
                            <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)' }}>
                                {showTrail ? 'Sí' : 'No'}
                            </span>
                        </label>
                    </div>

                    <div style={{ marginTop: 'var(--space-md)' }}>
                        <Button
                            onClick={onResetSelection}
                            variant="secondary"
                            style={{ width: '100%' }}
                        >
                            🔄 Resetear selección
                        </Button>
                    </div>
                </>
            )}
        </div>
    );
};
