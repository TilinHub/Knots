import { useState, type FC } from 'react';

interface EditorHeaderProps {
    initialKnotName?: string;
    onBackToGallery?: () => void;
    rollingMode: boolean;
    onToggleRollingMode: () => void;
    showContactDisks: boolean;
    onToggleContactDisks: () => void;
    nonDiskBlocksCount: number;
    diskBlocksCount: number;
    validation: { valid: boolean; errors: any[] };
    lengthInfo: { totalLength: number; tangentLength?: number; arcLength?: number };
    sidebarOpen: boolean;
    onToggleSidebar: () => void;
    onShowValidationDetails: () => void;
    // Knot/Reidemeister Mode
    knotMode: boolean;
    onToggleKnotMode: () => void;
}

export const EditorHeader = ({
    initialKnotName,
    onBackToGallery,
    rollingMode,
    onToggleRollingMode,
    showContactDisks,
    onToggleContactDisks,
    nonDiskBlocksCount,
    diskBlocksCount,
    validation,
    lengthInfo,
    sidebarOpen,
    onToggleSidebar,
    onShowValidationDetails,
    knotMode,
    onToggleKnotMode,
}: EditorHeaderProps) => {
    const [showLengthDetails, setShowLengthDetails] = useState(false);

    const statusColor = nonDiskBlocksCount === 0
        ? 'var(--text-tertiary)'
        : validation.valid
            ? 'var(--accent-valid)'
            : 'var(--accent-error)';

    const statusText = nonDiskBlocksCount === 0
        ? 'sin bloques'
        : validation.valid
            ? 'cs válido'
            : `${validation.errors.length} error${validation.errors.length !== 1 ? 'es' : ''}`;

    return (
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
                    {initialKnotName || 'CS Diagram Builder'}
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                {nonDiskBlocksCount >= 3 && (
                    <button
                        onClick={onToggleContactDisks}
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


                {diskBlocksCount >= 2 && !showContactDisks && (
                    <button
                        onClick={onToggleKnotMode}
                        style={{
                            padding: '6px 12px',
                            fontSize: 'var(--fs-caption)',
                            fontWeight: 'var(--fw-medium)',
                            background: knotMode ? '#FF6B6B' : 'var(--bg-tertiary)',
                            color: knotMode ? 'white' : 'var(--text-primary)',
                            border: `1px solid ${knotMode ? '#FF6B6B' : 'var(--border)'}`,
                            borderRadius: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                        }}
                    >
                        🪢 Knot Mode
                    </button>
                )}

                {diskBlocksCount >= 2 && !showContactDisks && !knotMode && (
                    <button
                        onClick={onToggleRollingMode}
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

                {((validation.valid && nonDiskBlocksCount > 0) || (diskBlocksCount >= 2 && !showContactDisks)) && (
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setShowLengthDetails(!showLengthDetails)}
                            style={{
                                fontSize: 'var(--fs-caption)',
                                color: 'var(--text-secondary)',
                                fontWeight: 'var(--fw-medium)',
                                padding: '4px 12px',
                                background: 'var(--bg-tertiary)',
                                borderRadius: '6px',
                                fontFamily: 'var(--ff-mono)',
                                border: 'none',
                                cursor: 'help',
                            }}
                        >
                            L = {lengthInfo.totalLength.toFixed(2)} px
                        </button>
                        {showLengthDetails && lengthInfo.tangentLength !== undefined && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                marginTop: '8px',
                                background: 'white',
                                border: '1px solid var(--border)',
                                borderRadius: '6px',
                                padding: '8px 12px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                zIndex: 10,
                                minWidth: '160px',
                                fontSize: 'var(--fs-caption)',
                                color: 'var(--text-primary)',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <span>Rectas:</span>
                                    <span style={{ fontFamily: 'var(--ff-mono)' }}>{lengthInfo.tangentLength?.toFixed(2)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <span>Arcos:</span>
                                    <span style={{ fontFamily: 'var(--ff-mono)' }}>{lengthInfo.arcLength?.toFixed(2)}</span>
                                </div>
                                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '4px', marginTop: '4px', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                                    <span>Total:</span>
                                    <span style={{ fontFamily: 'var(--ff-mono)' }}>{lengthInfo.totalLength.toFixed(2)}</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <button
                    onClick={onShowValidationDetails}
                    disabled={nonDiskBlocksCount === 0}
                    style={{
                        fontSize: 'var(--fs-caption)',
                        color: statusColor,
                        fontWeight: 'var(--fw-medium)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'none',
                        border: 'none',
                        cursor: nonDiskBlocksCount > 0 ? 'pointer' : 'default',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        transition: 'background 0.15s',
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
                    onClick={onToggleSidebar}
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
    );
};
