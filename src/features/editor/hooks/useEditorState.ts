import { useEffect,useMemo, useState } from 'react';

import { blockLength,getCurveLengthInfo } from '../../../core/geometry/arcLength';
import type { CSArc, CSBlock, CSDisk, CSSegment } from '../../../core/types/cs';
import { validateContinuity } from '../../../core/validation/continuity';
import type { DynamicAnchor } from '../../knot/logic/useKnotState';

interface InitialKnot {
    id: number;
    name: string;
    nodes: number[];
    edges: [number, number][];
}

export interface SavedKnot {
    id: string;
    name: string;
    diskSequence: string[];
    anchorSequence?: DynamicAnchor[]; // [NEW] Store exact anchor points
    chiralities?: ('L' | 'R')[];
    frozenPath?: any[]; // [NEW] Frozen path segments at save time (immutable)
    color: string;
}

export function useEditorState(initialKnot?: InitialKnot) {
    // Data State
    const [blocks, setBlocks] = useState<CSBlock[]>([]);
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

    // [FIX] Initialize from localStorage if available
    const [savedKnots, setSavedKnots] = useState<SavedKnot[]>(() => {
        try {
            const stored = localStorage.getItem('knots_saved_envelopes');
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error("Failed to load saved knots:", e);
            return [];
        }
    });

    // [FIX] Persist changes to localStorage
    useEffect(() => {
        try {
            localStorage.setItem('knots_saved_envelopes', JSON.stringify(savedKnots));
        } catch (e) {
            console.error("Failed to save knots:", e);
        }
    }, [savedKnots]);

    // UI State
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [showGrid, setShowGrid] = useState(true);
    const [gridSpacing, setGridSpacing] = useState(50);
    const [angleUnit, setAngleUnit] = useState<'deg' | 'rad'>('deg');
    const [showContactDisks, setShowContactDisks] = useState(false);
    const [showEnvelope, setShowEnvelope] = useState(true);
    const [showValidation, setShowValidation] = useState(false);

    // Appearance State
    const [diskColor, setDiskColor] = useState('#89CFF0'); // Default Baby Blue
    const [envelopeColor, setEnvelopeColor] = useState('#5CA0D3'); // Default Blue

    // Initialize blocks from knot
    useEffect(() => {
        if (!initialKnot || initialKnot.id === 0) return;

        const initialBlocks: CSBlock[] = initialKnot.edges.map((edge, idx) => {
            const [nodeA, nodeB] = edge;
            const angleA = (nodeA / initialKnot.nodes.length) * 2 * Math.PI;
            const angleB = (nodeB / initialKnot.nodes.length) * 2 * Math.PI;
            const radius = 100;

            return {
                id: `s${idx + 1}`,
                kind: 'segment',
                p1: {
                    x: Math.round(Math.cos(angleA) * radius),
                    y: Math.round(Math.sin(angleA) * radius)
                },
                p2: {
                    x: Math.round(Math.cos(angleB) * radius),
                    y: Math.round(Math.sin(angleB) * radius)
                },
            } as CSSegment;
        });

        setBlocks(initialBlocks);
    }, [initialKnot]);

    // Computed
    const nonDiskBlocks = useMemo(() => blocks.filter(b => b.kind !== 'disk'), [blocks]);
    const diskBlocks = useMemo(() => blocks.filter(b => b.kind === 'disk') as CSDisk[], [blocks]);
    const validation = useMemo(() => validateContinuity(nonDiskBlocks), [nonDiskBlocks]);
    const lengthInfo = useMemo(() => getCurveLengthInfo(nonDiskBlocks), [nonDiskBlocks]);
    const diskCount = diskBlocks.length;

    const selectedBlock = blocks.find(b => b.id === selectedBlockId);

    // Actions
    function addSavedKnot(diskSequence: string[], chiralities?: ('L' | 'R')[], anchorSequence?: DynamicAnchor[], frozenPath?: any[]) {
        if (diskSequence.length < 2) return;
        const id = `knot-${Date.now()}`;

        // Enrich path with relative angles for elastic reconstruction
        let enrichedPath: any[] | undefined;
        if (frozenPath) {
            // Build disk position lookup from current blocks
            const diskLookup = new Map<string, { center: { x: number, y: number }, radius: number }>();
            blocks.forEach(b => {
                if (b.kind === 'disk') {
                    diskLookup.set(b.id, { center: (b as any).center, radius: (b as any).visualRadius });
                }
            });

            // Helper: find which disk a point is on (by proximity)
            const findDiskForPoint = (pt: { x: number, y: number }): { diskId: string, disk: { center: { x: number, y: number }, radius: number } } | null => {
                for (const [id, d] of diskLookup) {
                    const dist = Math.sqrt(Math.pow(pt.x - d.center.x, 2) + Math.pow(pt.y - d.center.y, 2));
                    if (Math.abs(dist - d.radius) < d.radius * 0.15) { // 15% tolerance
                        return { diskId: id, disk: d };
                    }
                }
                return null;
            };

            enrichedPath = frozenPath.map((seg: any) => {
                if (seg.type === 'ARC') {
                    // ARCs already have startAngle/endAngle/diskId — keep as-is
                    return { ...seg };
                } else {
                    // TANGENT: compute _startAngle and _endAngle relative to their disks
                    const enriched = { ...seg };

                    // Try direct lookup first, then proximity search
                    let sDisk = diskLookup.get(seg.startDiskId);
                    let sId = seg.startDiskId;
                    if (!sDisk && seg.start) {
                        const found = findDiskForPoint(seg.start);
                        if (found) { sDisk = found.disk; sId = found.diskId; }
                    }

                    let eDisk = diskLookup.get(seg.endDiskId);
                    let eId = seg.endDiskId;
                    if (!eDisk && seg.end) {
                        const found = findDiskForPoint(seg.end);
                        if (found) { eDisk = found.disk; eId = found.diskId; }
                    }

                    if (sDisk) {
                        enriched._startAngle = Math.atan2(seg.start.y - sDisk.center.y, seg.start.x - sDisk.center.x);
                        enriched._startDiskId = sId; // Resolved disk ID
                    }
                    if (eDisk) {
                        enriched._endAngle = Math.atan2(seg.end.y - eDisk.center.y, seg.end.x - eDisk.center.x);
                        enriched._endDiskId = eId; // Resolved disk ID
                    }
                    return enriched;
                }
            });
        }

        const newKnot: SavedKnot = {
            id,
            name: `Knot ${savedKnots.length + 1} (${diskSequence.length} disks)`,
            diskSequence: [...diskSequence],
            chiralities: chiralities ? [...chiralities] : undefined,
            anchorSequence: anchorSequence ? [...anchorSequence] : undefined,
            frozenPath: enrichedPath ? JSON.parse(JSON.stringify(enrichedPath)) : undefined,
            color: '#FF4500'
        };
        setSavedKnots(prev => [...prev, newKnot]);
    }

    function deleteSavedKnot(id: string) {
        setSavedKnots(prev => prev.filter(k => k.id !== id));
    }

    function addSegment() {
        const id = `s${Date.now()}`;
        const newSegment: CSSegment = {
            id,
            kind: 'segment',
            p1: { x: 0, y: 0 },
            p2: { x: 100, y: 50 },
        };
        setBlocks(prev => [...prev, newSegment]);
        setSelectedBlockId(id);
    }

    function addArc() {
        const id = `a${Date.now()}`;
        const newArc: CSArc = {
            id,
            kind: 'arc',
            center: { x: 50, y: 50 },
            radius: 1,
            visualRadius: 40,
            startAngle: 0,
            endAngle: Math.PI / 2,
        };
        setBlocks(prev => [...prev, newArc]);
        setSelectedBlockId(id);
    }

    function addDisk() {
        const padding = 0; // Sin espacio, tangentes
        let newCenter = { x: 0, y: 0 };
        let visualRadius = 50;

        if (diskBlocks.length > 0) {
            // Heredar radio visual del primer disco (asumiendo consistencia)
            visualRadius = diskBlocks[0].visualRadius;

            // Encontrar el disco más a la derecha
            const rightMostDisk = diskBlocks.reduce((prev, current) => {
                return (prev.center.x + prev.visualRadius) > (current.center.x + current.visualRadius) ? prev : current;
            });

            newCenter = {
                x: rightMostDisk.center.x + rightMostDisk.visualRadius + visualRadius + padding,
                y: 0
            };
        }

        const id = `disk-${Date.now()}`;
        const newDisk: CSDisk = {
            id,
            kind: 'disk',
            center: newCenter,
            radius: 1,
            visualRadius: visualRadius,
            label: `D${diskBlocks.length + 1}`,
            color: '#4A90E2',
        };
        setBlocks(prev => [...prev, newDisk]);
        setSelectedBlockId(id);
    }

    function deleteBlock(id: string) {
        setBlocks(prev => prev.filter((b) => b.id !== id));
        if (selectedBlockId === id) setSelectedBlockId(null);
    }

    function updateBlock(id: string, updates: Partial<CSBlock>) {
        setBlocks(prev =>
            prev.map((b) => {
                if (b.id !== id) return b;
                return { ...b, ...updates } as CSBlock;
            })
        );
    }

    return {
        state: {
            blocks,
            selectedBlockId,
            selectedBlock,
            savedKnots,
            sidebarOpen,
            showGrid,
            gridSpacing,
            angleUnit,
            showContactDisks,
            showEnvelope,
            showValidation,
            nonDiskBlocks,
            diskBlocks,
            validation,
            lengthInfo,
            diskColor,
            envelopeColor,
        },
        actions: {
            setBlocks,
            setSelectedBlockId,
            setSavedKnots,
            addSavedKnot,
            deleteSavedKnot,
            setSidebarOpen,
            setShowGrid,
            setGridSpacing,
            setAngleUnit,
            setShowContactDisks,
            setShowEnvelope,
            setShowValidation,
            addSegment,
            addArc,
            addDisk,
            deleteBlock,
            updateBlock,
            setDiskColor,
            setEnvelopeColor,
        }
    };
}
