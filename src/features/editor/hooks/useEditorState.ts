import { useState, useMemo, useEffect } from 'react';
import type { CSBlock, CSDisk, CSArc, CSSegment } from '../../../core/types/cs';
import { validateContinuity } from '../../../core/validation/continuity';
import { getCurveLengthInfo, blockLength } from '../../../core/geometry/arcLength';

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
    color: string;
}

export function useEditorState(initialKnot?: InitialKnot) {
    // Data State
    const [blocks, setBlocks] = useState<CSBlock[]>([]);
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
    const [savedKnots, setSavedKnots] = useState<SavedKnot[]>([]); // [NEW]

    // UI State
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [showGrid, setShowGrid] = useState(true);
    const [gridSpacing, setGridSpacing] = useState(50);
    const [angleUnit, setAngleUnit] = useState<'deg' | 'rad'>('deg');
    const [showContactDisks, setShowContactDisks] = useState(false);
    const [showEnvelope, setShowEnvelope] = useState(true);
    const [showValidation, setShowValidation] = useState(false);

    // Appearance State // [NEW]
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
    function addSavedKnot(diskSequence: string[]) {
        if (diskSequence.length < 2) return;
        const id = `knot-${Date.now()}`;
        const newKnot: SavedKnot = {
            id,
            name: `Knot ${savedKnots.length + 1}`,
            diskSequence: [...diskSequence], // storage copy
            color: '#FF4500' // Default orange/red
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
