import { useState, useEffect, type FC } from 'react';
import Logo from '../../../assets/LOGO.png';

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
    // Dubins
    dubinsMode: boolean;
    onToggleDubinsMode: () => void;
    // Envelope
    showEnvelope?: boolean; // [NEW]
    onToggleEnvelope?: () => void; // [NEW]
    // View Controls
    showGrid: boolean;
    onToggleGrid: (show: boolean) => void;
    gridSpacing: number;
    onGridSpacingChange: (val: number) => void;
    angleUnit: 'deg' | 'rad';
    onAngleUnitChange: (unit: 'deg' | 'rad') => void;
    // Appearance
    diskColor?: string;
    onDiskColorChange?: (color: string) => void;
    envelopeColor?: string;
    onEnvelopeColorChange?: (color: string) => void;
    // Catalog
    catalogMode?: boolean;
    onToggleCatalogMode?: () => void;
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
    dubinsMode,
    onToggleDubinsMode,
    showEnvelope = true,
    onToggleEnvelope,
    showGrid,
    onToggleGrid,
    gridSpacing,
    onGridSpacingChange,
    angleUnit,
    onAngleUnitChange,
    diskColor,
    onDiskColorChange,
    envelopeColor,
    onEnvelopeColorChange,
    catalogMode,
    onToggleCatalogMode,
}: EditorHeaderProps) => {
    const [showLengthDetails, setShowLengthDetails] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [darkMode, setDarkMode] = useState(false);

    useEffect(() => {
        if (darkMode) {
            document.documentElement.classList.add('dark-mode');
            document.documentElement.style.colorScheme = 'dark';
        } else {
            document.documentElement.classList.remove('dark-mode');
            document.documentElement.style.colorScheme = 'light';
        }
    }, [darkMode]);

    const statusColor = validation.valid
        ? 'var(--accent-valid)'
        : 'var(--accent-error)';

    const statusText = validation.valid
        ? 'Valid CS'
        : `${validation.errors.length} error${validation.errors.length !== 1 ? 's' : ''}`;

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
                // overflow: 'hidden', // REMOVED to allow dropdown
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
                            justifyContent: 'center',
                            gap: '6px',
                            transition: 'all 0.15s',
                        }}
                    >
                        ← Gallery
                    </button>
                )}
                {/* Logo Wrapper for cropping */}
                <div style={{ height: '60px', overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
                    <img
                        src={Logo}
                        alt="Knots Logo"
                        style={{ height: '68px', width: 'auto', display: 'block' }}
                    />
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* ENVELOPE TOGGLE - NEW */}
                {diskBlocksCount >= 2 && (
                    <button
                        onClick={onToggleEnvelope}
                        style={{
                            padding: '6px 12px',
                            fontSize: '13px',
                            fontWeight: 500,
                            background: showEnvelope ? '#6B46C1' : 'transparent',
                            color: showEnvelope ? 'white' : 'var(--text-primary)',
                            border: `1px solid ${showEnvelope ? '#6B46C1' : 'var(--border)'}`,
                            borderRadius: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                        }}
                        title={showEnvelope ? "Hide Envelope" : "Show Envelope"}
                    >
                        🟣 Envelope
                    </button>
                )}

                {true && (
                    <button
                        onClick={onToggleContactDisks}
                        style={{
                            padding: '6px 12px',
                            fontSize: '13px',
                            fontWeight: 500,
                            background: showContactDisks ? '#0071E3' : 'transparent',
                            color: showContactDisks ? 'white' : 'var(--text-primary)',
                            border: `1px solid ${showContactDisks ? '#0071E3' : 'var(--border)'}`,
                            borderRadius: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                        }}
                    >
                        🔵 Contact Graphs
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

                {!showContactDisks && !knotMode && !rollingMode && (
                    <button
                        onClick={onToggleDubinsMode}
                        style={{
                            padding: '6px 12px',
                            fontSize: 'var(--fs-caption)',
                            fontWeight: 'var(--fw-medium)',
                            background: dubinsMode ? '#4ECDC4' : 'var(--bg-tertiary)',
                            color: dubinsMode ? 'white' : 'var(--text-primary)',
                            border: `1px solid ${dubinsMode ? '#4ECDC4' : 'var(--border)'}`,
                            borderRadius: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                        }}
                    >
                        🚗 Dubins
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

                {/* CATALOG MODE BUTTON */}
                <button
                    onClick={onToggleCatalogMode}
                    style={{
                        padding: '6px 12px',
                        fontSize: 'var(--fs-caption)',
                        fontWeight: 'var(--fw-medium)',
                        background: catalogMode ? 'var(--accent-secondary)' : 'var(--bg-tertiary)',
                        color: catalogMode ? 'white' : 'var(--text-primary)',
                        border: `1px solid ${catalogMode ? 'var(--accent-secondary)' : 'var(--border)'}`,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                    }}
                    title="Knot Catalog"
                >
                    📚 Catalog
                </button>

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
                            L = {(lengthInfo.totalLength / 50).toFixed(2)} u
                        </button>
                        {showLengthDetails && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                marginTop: '8px',
                                background: 'var(--bg-primary)',
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
                                    <span style={{ fontFamily: 'var(--ff-mono)' }}>{((lengthInfo.tangentLength ?? 0) / 50).toFixed(2)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <span>Arcos:</span>
                                    <span style={{ fontFamily: 'var(--ff-mono)' }}>{((lengthInfo.arcLength ?? 0) / 50).toFixed(2)}</span>
                                </div>
                                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '4px', marginTop: '4px', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                                    <span>Total:</span>
                                    <span style={{ fontFamily: 'var(--ff-mono)' }}>{(lengthInfo.totalLength / 50).toFixed(2)}</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Settings Gear */}
                <div style={{ position: 'relative' }}>
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        style={{
                            background: showSettings ? 'var(--bg-tertiary)' : 'none',
                            border: '1px solid var(--border)',
                            borderRadius: '6px',
                            padding: '0',
                            cursor: 'pointer',
                            fontSize: '16px',
                            color: 'var(--text-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '32px',
                            height: '32px',
                            transition: 'all 0.15s',
                        }}
                        title="Settings"
                    >
                        ⚙️
                    </button>
                    {showSettings && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            right: 0,
                            marginTop: '8px',
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            padding: '16px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            zIndex: 100,
                            minWidth: '220px',
                        }}>
                            {/* Appearance Controls */}
                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Appearance</span>
                                    <button
                                        onClick={() => setDarkMode(!darkMode)}
                                        style={{
                                            width: '50px',
                                            height: '28px',
                                            background: darkMode ? '#32D74B' : '#E5E5EA',
                                            borderRadius: '99px',
                                            border: 'none',
                                            cursor: 'pointer',
                                            position: 'relative',
                                            transition: 'background 0.3s ease',
                                            padding: '2px',
                                            display: 'flex',
                                            alignItems: 'center',
                                        }}
                                        title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                                    >
                                        <div style={{
                                            width: '24px',
                                            height: '24px',
                                            background: 'white',
                                            borderRadius: '50%',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                            transform: darkMode ? 'translateX(22px)' : 'translateX(0)',
                                            transition: 'transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '14px',
                                        }}>
                                            {darkMode ? '🌙' : '☀️'}
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {/* Color Controls */}
                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Colors</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
                                        Disks
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-tertiary)', padding: '4px', borderRadius: '4px' }}>
                                            <div style={{
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '4px',
                                                background: diskColor || '#89CFF0',
                                                border: '1px solid var(--border)',
                                                position: 'relative',
                                                overflow: 'hidden'
                                            }}>
                                                <input
                                                    type="color"
                                                    value={diskColor || '#89CFF0'}
                                                    onChange={(e) => onDiskColorChange?.(e.target.value)}
                                                    style={{ position: 'absolute', top: '-50%', left: '-50%', width: '200%', height: '200%', cursor: 'pointer', opacity: 0 }}
                                                />
                                            </div>
                                            <span style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--text-primary)' }}>{diskColor || '#89CFF0'}</span>
                                        </div>
                                    </label>
                                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
                                        Envelope
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-tertiary)', padding: '4px', borderRadius: '4px' }}>
                                            <div style={{
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '4px',
                                                background: envelopeColor || '#5CA0D3',
                                                border: '1px solid var(--border)',
                                                position: 'relative',
                                                overflow: 'hidden'
                                            }}>
                                                <input
                                                    type="color"
                                                    value={envelopeColor || '#5CA0D3'}
                                                    onChange={(e) => onEnvelopeColorChange?.(e.target.value)}
                                                    style={{ position: 'absolute', top: '-50%', left: '-50%', width: '200%', height: '200%', cursor: 'pointer', opacity: 0 }}
                                                />
                                            </div>
                                            <span style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--text-primary)' }}>{envelopeColor || '#5CA0D3'}</span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Grid Controls */}
                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Grid</span>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={showGrid}
                                            onChange={(e) => onToggleGrid(e.target.checked)}
                                        />
                                        {showGrid ? 'On' : 'Off'}
                                    </label>
                                </div>
                                {showGrid && (
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                                            <span>Spacing</span>
                                            <span>{gridSpacing}px</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="20"
                                            max="100"
                                            step="10"
                                            value={gridSpacing}
                                            onChange={(e) => onGridSpacingChange(parseInt(e.target.value))}
                                            style={{ width: '100%' }}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Angle Controls */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Angles</span>
                                    <div style={{ display: 'flex', background: 'var(--bg-tertiary)', borderRadius: '4px', padding: '2px' }}>
                                        <button
                                            onClick={() => onAngleUnitChange('deg')}
                                            style={{
                                                border: 'none',
                                                background: angleUnit === 'deg' ? 'white' : 'transparent',
                                                boxShadow: angleUnit === 'deg' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                                                borderRadius: '3px',
                                                padding: '2px 8px',
                                                fontSize: '11px',
                                                cursor: 'pointer',
                                                fontWeight: angleUnit === 'deg' ? 600 : 400,
                                            }}
                                        >
                                            deg
                                        </button>
                                        <button
                                            onClick={() => onAngleUnitChange('rad')}
                                            style={{
                                                border: 'none',
                                                background: angleUnit === 'rad' ? 'white' : 'transparent',
                                                boxShadow: angleUnit === 'rad' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                                                borderRadius: '3px',
                                                padding: '2px 8px',
                                                fontSize: '11px',
                                                cursor: 'pointer',
                                                fontWeight: angleUnit === 'rad' ? 600 : 400,
                                            }}
                                        >
                                            rad
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {nonDiskBlocksCount > 0 && (
                    <button
                        onClick={onShowValidationDetails}
                        style={{
                            fontSize: 'var(--fs-caption)',
                            color: statusColor,
                            fontWeight: 'var(--fw-medium)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
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
                )}

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
