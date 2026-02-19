
import { useEffect,useMemo, useRef, useState } from 'react';

import { Button } from '@/ui/Button';

import type { CatalogEntry } from './catalogTypes';
import { CatalogGenerator } from './generator';
import { KnotThumbnail } from './KnotThumbnail';

interface CatalogPanelProps {
    onLoadEntry?: (entry: CatalogEntry) => void;
}

export function CatalogPanel({ onLoadEntry }: CatalogPanelProps) {
    const [entries, setEntries] = useState<CatalogEntry[]>([]);
    const [generating, setGenerating] = useState(false);
    const [generationStatus, setGenerationStatus] = useState<'idle' | 'generating' | 'completed' | 'error'>('idle');
    const [progress, setProgress] = useState(0);
    const [expandedGroup, setExpandedGroup] = useState<number | null>(3); // Default open 3 crossings
    const generatorRef = useRef<CatalogGenerator | null>(null);

    // Group entries by crossing number
    const groupedEntries = useMemo(() => {
        const groups: Record<number, CatalogEntry[]> = {};
        entries.forEach(e => {
            const n = e.numCrossings;
            if (!groups[n]) groups[n] = [];
            groups[n].push(e);
        });
        return groups;
    }, [entries]);

    // Load from localStorage on mount or PRELOAD
    useEffect(() => {
        try {
            const saved = localStorage.getItem('knotCatalog_v2'); // New key to force refresh
            if (saved) {
                const parsed = JSON.parse(saved);
                setEntries(parsed);
                setGenerationStatus('idle');
            } else {
                // If nothing saved, load PRELOADED and save
                import('./preloaded').then(mod => {
                    const params = mod.PRELOADED_CATALOG;
                    if (params.length > 0) {
                        setEntries(params);
                        setExpandedGroup(3); // Auto open
                    }
                });
            }
        } catch (e) {
            console.error("Failed to load catalog", e);
            // Fallback clear
            localStorage.removeItem('knotCatalog_v2');
        }
    }, []);

    // Save to localStorage whenever entries change (debounced or on completion)
    useEffect(() => {
        if (entries.length > 0) {
            localStorage.setItem('knotCatalog_v2', JSON.stringify(entries));
        }
    }, [entries, generationStatus]);

    const handleStartGeneration = async () => {
        setGenerating(true);
        setGenerationStatus('generating');
        setEntries([]); // Clear previous? Or append? Let's clear for "Regenerate".
        setProgress(0); // Reset progress

        generatorRef.current = new CatalogGenerator();
        const gen = generatorRef.current.generate(); // Store the generator for iteration

        try {
            let count = 0;
            for await (const entry of gen) {
                count++;
                setProgress(count); // Update progress
                if (entry) {
                    setEntries(prev => {
                        const next = [...prev, entry];
                        return next;
                    });
                }
            }
            setGenerationStatus('completed');
        } catch (e) {
            console.error("Generation error", e);
            setGenerationStatus('error');
        } finally {
            setGenerating(false);
        }
    };

    const handleStop = () => {
        if (generatorRef.current) {
            generatorRef.current.stop();
        }
        setGenerating(false);
    };

    return (
        <div style={{ padding: '0', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
            {/* Header / Controls */}
            <div style={{
                padding: '12px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        🗂️ Knot Catalog
                    </h2>
                    <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                        {entries.length} Knots Found
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                    {!generating ? (
                        <Button onClick={handleStartGeneration} variant="primary" style={{ flex: 1, fontSize: '12px' }}>
                            ▶ Generate All
                        </Button>
                    ) : (
                        <Button onClick={handleStop} variant="secondary" style={{ flex: 1, fontSize: '12px', borderColor: 'var(--accent-error)', color: 'var(--accent-error)' }}>
                            ⏹ Stop ({progress})
                        </Button>
                    )}
                </div>
            </div>

            {/* Gallery Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                {Object.keys(groupedEntries).length === 0 && !generating && (
                    <div style={{
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-tertiary)',
                        fontSize: '12px',
                        gap: '8px'
                    }}>
                        <div style={{ fontSize: '24px', opacity: 0.3 }}>📚</div>
                        <div>Catalog is empty.</div>
                        <div>Click <strong>Generate All</strong> to start exploration.</div>
                    </div>
                )}

                {[3, 4, 5, 6, 7].map(num => {
                    const group = groupedEntries[num] || [];
                    if (group.length === 0 && !generating) return null; // Hide empty groups if not generating

                    const isExpanded = expandedGroup === num;

                    return (
                        <div key={num} style={{ marginBottom: '12px', background: 'var(--bg-secondary)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                            <div
                                onClick={() => setExpandedGroup(isExpanded ? null : num)}
                                style={{
                                    padding: '8px 12px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    background: isExpanded ? 'rgba(0,0,0,0.03)' : 'transparent',
                                    userSelect: 'none'
                                }}
                            >
                                <span style={{ fontWeight: 600, fontSize: '12px' }}>{num} Crossings</span>
                                <span style={{
                                    padding: '2px 6px',
                                    borderRadius: '10px',
                                    background: 'var(--bg-tertiary)',
                                    fontSize: '10px',
                                    color: 'var(--text-secondary)'
                                }}>
                                    {group.length}
                                </span>
                            </div>

                            {isExpanded && (
                                <div style={{ padding: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    {group.map((entry, i) => (
                                        <div
                                            key={i}
                                            onClick={() => onLoadEntry?.(entry)}
                                            style={{
                                                background: 'var(--bg-primary)',
                                                border: '1px solid var(--border)',
                                                borderRadius: '4px',
                                                padding: '4px',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                position: 'relative'
                                            }}
                                            title={`Knot ${entry.knotId}\n${entry.results.length} stable states`}
                                        >
                                            {/* Thumbnail of FIRST stable result or Initial */}
                                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px', background: '#f5f5f5', borderRadius: '2px', overflow: 'hidden' }}>
                                                {entry.results.length > 0 ? (
                                                    <KnotThumbnail
                                                        disks={entry.results[0].finalConfig.blocks.filter(b => b.kind === 'disk') as any}
                                                        size={120}
                                                        showEnvelope={true}
                                                        // We need the sequence!
                                                        // CatalogEntry should probably store the sequence too?
                                                        // For now, we reuse the initial config blocks if we can't easily reconstruct sequence?
                                                        // Wait, results[0].finalConfig is just CSBlock[].
                                                        // We assume standard sequence for simple rendering (0-1-2...) or we need to store it.
                                                        // We assume standard sequence for simple rendering (0-1-2...) or we need to store it.
                                                        // Let's pass undefined seq for now (just disks) or try to find cycle.
                                                        diskSequence={entry.diskSequence}
                                                        chiralities={entry.results[0].chiralities}
                                                    />
                                                ) : (
                                                    <div style={{ width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#ccc' }}>
                                                        No Stable Reults
                                                    </div>
                                                )}
                                            </div>

                                            <div style={{ fontSize: '10px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {entry.knotId}
                                            </div>
                                            <div style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>
                                                L: {entry.results[0]?.pathLength.toFixed(3) ?? '?'}
                                            </div>
                                            <div style={{
                                                position: 'absolute',
                                                top: '4px',
                                                right: '4px',
                                                fontSize: '8px',
                                                background: 'var(--accent-primary)',
                                                color: 'white',
                                                padding: '1px 4px',
                                                borderRadius: '2px'
                                            }}>
                                                {entry.results.length}
                                            </div>
                                        </div>
                                    ))}
                                    {group.length === 0 && generating && (
                                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '10px', fontSize: '10px', color: 'var(--text-tertiary)' }}>
                                            Searching...
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
