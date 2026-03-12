import React, { useState, useMemo } from 'react';
import { Button } from '../../../ui/components/Button';
import type { SavedKnot } from '../../editor/hooks/useEditorState';
import { KnotThumbnail } from '../../catalog/components/KnotThumbnail';
import { PRELOADED_KNOTS } from '../logic/preloaded';
import knotTableImg from '../../../assets/knot_table.png';

interface KnotGalleryProps {
    knots: SavedKnot[];
    onLoadKnot: (knot: SavedKnot) => void;
    onDeleteKnot: (id: string) => void;
    isSidebar?: boolean;
}

export const KnotGallery: React.FC<KnotGalleryProps> = ({
    knots,
    onLoadKnot,
    onDeleteKnot,
    isSidebar = false,
}) => {
    // Accordion state - default open '3 crossings'
    const [expandedSection, setExpandedSection] = useState<string | null>('3 crossings');
    
    const toggleSection = (section: string) => {
        setExpandedSection(prev => prev === section ? null : section);
    };

    // Grouping logic
    const sections = useMemo(() => {
        // Combine preloaded and user knots
        const allKnots = [...PRELOADED_KNOTS];
        
        // Add user knots that aren't already in PRELOADED
        knots.forEach(k => {
            if (!allKnots.some(p => p.id === k.id)) {
                allKnots.push(k);
            }
        });

        // Initialize bins
        const bins: Record<string, SavedKnot[]> = {
            '3 crossings': [],
            '4 crossings': [],
            '5 crossings': [],
            '6 crossings': [],
            '7 crossings': [],
            'Special Knots': [],
        };

        allKnots.forEach(knot => {
            const count = knot.diskSequence.length;
            if (count === 3) bins['3 crossings'].push(knot);
            else if (count === 4) bins['4 crossings'].push(knot);
            else if (count === 5) bins['5 crossings'].push(knot);
            else if (count === 6) bins['6 crossings'].push(knot);
            else if (count === 7) bins['7 crossings'].push(knot);
            else {
                // Not in 3-7 bins, place them in Special Knots
                bins['Special Knots'].push(knot);
            }
        });

        // Always return these ordered keys
        return [
            { label: '3 crossings', knots: bins['3 crossings'] },
            { label: '4 crossings', knots: bins['4 crossings'] },
            { label: '5 crossings', knots: bins['5 crossings'] },
            { label: '6 crossings', knots: bins['6 crossings'] },
            { label: '7 crossings', knots: bins['7 crossings'] },
            { label: 'Special Knots', knots: bins['Special Knots'] },
        ];
    }, [knots]);

    return (
        <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)'
        }}>
            {/* Header omitted when in sidebar */}
            {!isSidebar && (
                <div style={{
                    padding: '24px 32px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div>
                        <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>Gallery</h1>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            Browse knots categorized by crossing count
                        </p>
                    </div>
                </div>
            )}

            {/* Content Sidebar-like Layout */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: isSidebar ? '16px' : '32px',
                width: '100%',
                maxWidth: isSidebar ? '100%' : '1200px', // constrain width for better UX
                margin: '0 auto'
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {sections.map(section => (
                        <div
                            key={section.label}
                            style={{ background: 'var(--bg-secondary)', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}
                        >
                            <div
                                onClick={() => toggleSection(section.label)}
                                style={{
                                    padding: '16px 20px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    fontSize: '16px',
                                    fontWeight: '600',
                                    userSelect: 'none',
                                    background: expandedSection === section.label ? 'rgba(0,0,0,0.02)' : 'transparent',
                                }}
                            >
                                <span>{section.label}</span>
                                <span style={{ fontSize: '14px', opacity: 0.6, background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '12px' }}>
                                    {section.knots.length}
                                </span>
                            </div>

                            {expandedSection === section.label && (
                                <div style={{ padding: '16px', borderTop: '1px solid var(--border)' }}>
                                    {section.knots.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-tertiary)', fontSize: '13px' }}>
                                            No knots yet for this category.
                                        </div>
                                    ) : (
                                        <div style={{ 
                                            display: 'grid', 
                                            // Make grid more compact like Contact Graphs
                                            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', 
                                            gap: '12px' 
                                        }}>
                                            {section.knots.map((knot, idx) => (
                                                <GalleryItem
                                                    key={knot.id || idx}
                                                    knot={knot}
                                                    isUserKnot={!PRELOADED_KNOTS.some(p => p.id === knot.id)}
                                                    onLoad={() => onLoadKnot(knot)}
                                                    onDelete={() => onDeleteKnot(knot.id)}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const GalleryItem: React.FC<{ knot: SavedKnot; isUserKnot: boolean; onLoad: () => void; onDelete: () => void }> = ({ knot, isUserKnot, onLoad, onDelete }) => {
    return (
        <div 
            style={{
                border: '1px solid var(--border)',
                background: 'var(--bg-primary)',
                borderRadius: '8px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.2s ease',
                position: 'relative',
                cursor: 'pointer'
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            onClick={onLoad}
            title={knot.name}
        >
            {/* Thumbnail Area - Square aspect ratio */}
            <div style={{
                position: 'relative',
                aspectRatio: '1',
                width: '100%',
                background: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderBottom: '1px solid var(--border)' 
            }}>
                {knot.spritePos ? (
                    <div style={{
                        width: '100%',
                        height: '100%',
                        backgroundImage: `url(${knotTableImg})`,
                        backgroundSize: '500% 300%',
                        backgroundPosition: knot.spritePos,
                        backgroundRepeat: 'no-repeat',
                    }} />
                ) : (
                    <KnotThumbnail
                        disks={(knot.blocks || []).filter(b => b.kind === 'disk') as any}
                        size={120}
                        showEnvelope={true}
                        diskSequence={knot.diskSequence}
                        chiralities={knot.chiralities}
                    />
                )}
            </div>

            {/* Info Area */}
            <div style={{ padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '12px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {knot.name}
                </div>
                {isUserKnot && (
                    <div 
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        style={{ 
                            fontSize: '11px', 
                            color: 'var(--accent-error)',
                            padding: '2px 4px',
                            cursor: 'pointer',
                            borderRadius: '4px'
                        }}
                        title="Delete User Knot"
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,0,0,0.1)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                        🗑️
                    </div>
                )}
            </div>
        </div>
    );
};
