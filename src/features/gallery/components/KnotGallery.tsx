import React, { useState, useMemo } from 'react';
import { Button } from '@/ui/Button';
import type { SavedKnot } from '../../editor/hooks/useEditorState';
import { KnotThumbnail } from '../../catalog/components/KnotThumbnail';
import { PRELOADED_KNOTS } from '../logic/preloaded';

interface KnotGalleryProps {
    knots: SavedKnot[];
    onLoadKnot: (knot: SavedKnot) => void;
    onDeleteKnot: (id: string) => void;
    onBack: () => void;
}

export const KnotGallery: React.FC<KnotGalleryProps> = ({
    knots,
    onLoadKnot,
    onDeleteKnot,
    onBack,
}) => {
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState<'date' | 'name'>('date');

    const { standardKnots, userKnots } = useMemo(() => {
        const searchLower = search.toLowerCase();

        const filterFn = (k: SavedKnot) => k.name.toLowerCase().includes(searchLower);
        const sortFn = (a: SavedKnot, b: SavedKnot) => {
            if (sortBy === 'date') return (b.createdAt || 0) - (a.createdAt || 0);
            return a.name.localeCompare(b.name);
        };

        return {
            standardKnots: PRELOADED_KNOTS.filter(filterFn).sort(sortFn),
            userKnots: knots.filter(k =>
                !PRELOADED_KNOTS.some(p => p.id === k.id) && filterFn(k)
            ).sort(sortFn),
        };
    }, [knots, search, sortBy]);

    return (
        <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)'
        }}>
            {/* Header */}
            <div style={{
                padding: '24px 32px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>Pro Knot Gallery</h1>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        {knots.length} knots saved in your collection
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ position: 'relative' }}>
                        <input
                            type="text"
                            placeholder="Search knots..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{
                                padding: '8px 12px 8px 32px',
                                borderRadius: '8px',
                                border: '1px solid var(--border)',
                                background: 'var(--bg-secondary)',
                                fontSize: '14px',
                                width: '240px'
                            }}
                        />
                        <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>🔍</span>
                    </div>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            background: 'var(--bg-secondary)',
                            fontSize: '14px'
                        }}
                    >
                        <option value="date">Newest First</option>
                        <option value="name">Alphabetical</option>
                    </select>
                    <Button onClick={onBack} variant="secondary">Back to Editor</Button>
                </div>
            </div>

            {/* Grid Content */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '32px',
            }}>
                {/* STANDARD LIBRARY */}
                <SectionHeader title="📚 Standard Library" count={standardKnots.length} />
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '24px',
                    marginBottom: '48px'
                }}>
                    {standardKnots.map(knot => (
                        <KnotCard
                            key={knot.id}
                            knot={knot}
                            isSystem={true}
                            onLoad={() => onLoadKnot(knot)}
                            onDelete={() => onDeleteKnot(knot.id)}
                        />
                    ))}
                </div>

                {/* USER COLLECTION */}
                <SectionHeader title="👤 My Collection" count={userKnots.length} />
                {userKnots.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-tertiary)', border: '1px dashed var(--border)', borderRadius: '12px' }}>
                        <p>No user knots saved yet. Use "Save Envelope" in the editor.</p>
                    </div>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                        gap: '24px'
                    }}>
                        {userKnots.map(knot => (
                            <KnotCard
                                key={knot.id}
                                knot={knot}
                                isSystem={false}
                                onLoad={() => onLoadKnot(knot)}
                                onDelete={() => onDeleteKnot(knot.id)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const SectionHeader: React.FC<{ title: string; count: number }> = ({ title, count }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>{title}</h2>
        <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '10px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
            {count}
        </span>
    </div>
);

const KnotCard: React.FC<{ knot: SavedKnot; isSystem?: boolean; onLoad: () => void; onDelete: () => void }> = ({ knot, isSystem, onLoad, onDelete }) => {
    const dateStr = knot.createdAt ? new Date(knot.createdAt).toLocaleDateString() : 'Unknown date';

    return (
        <div className="knot-card" style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            overflow: 'hidden',
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* Thumbnail Area */}
            <div style={{
                height: '200px',
                background: '#f8f9fa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderBottom: '1px solid var(--border)',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <KnotThumbnail
                    disks={knot.blocks.filter(b => b.kind === 'disk') as any}
                    size={200}
                    showEnvelope={true}
                    diskSequence={knot.diskSequence}
                    chiralities={knot.chiralities}
                />
                <div style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    background: knot.color || 'var(--accent-primary)',
                    color: 'white',
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase'
                }}>
                    {knot.diskSequence.length} Disks
                </div>
            </div>

            {/* Info Area */}
            <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600 }}>{knot.name}</h3>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-tertiary)' }}>{dateStr}</p>

                <div style={{ marginTop: 'auto', paddingTop: '16px', display: 'flex', gap: '8px' }}>
                    <Button onClick={onLoad} variant="primary" style={{ flex: 1, fontSize: '13px' }}>Load Nudo</Button>
                    {!isSystem && (
                        <Button
                            onClick={onDelete}
                            variant="secondary"
                            style={{
                                width: '40px',
                                padding: 0,
                                borderColor: 'var(--accent-error)',
                                color: 'var(--accent-error)'
                            }}
                        >
                            🗑️
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};
