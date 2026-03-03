import type { SavedKnot } from '../editor/hooks/useEditorState';

export const PRELOADED_KNOTS: SavedKnot[] = [
    {
        id: 'pre-trefoil',
        name: 'Trefoil (3 crossings)',
        diskSequence: ['d0', 'd1', 'd2'],
        chiralities: ['L', 'L', 'L'],
        color: '#FF4500',
        createdAt: 1735700000000,
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 43.3, y: -25 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: -43.3, y: -25 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: 0, y: 50 }, radius: 1, visualRadius: 50, label: 'D2' },
        ]
    },
    {
        id: 'pre-fig8',
        name: 'Figure-Eight (4 crossings)',
        diskSequence: ['d0', 'd1', 'd2', 'd3'],
        chiralities: ['L', 'R', 'L', 'R'],
        color: '#1E90FF',
        createdAt: 1735700000500,
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 50, y: 50 }, radius: 1, visualRadius: 40, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: -50, y: 50 }, radius: 1, visualRadius: 40, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: -50, y: -50 }, radius: 1, visualRadius: 40, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: 50, y: -50 }, radius: 1, visualRadius: 40, label: 'D3' },
        ]
    },
    {
        id: 'pre-clover',
        name: 'Geometric Clover',
        diskSequence: ['d0', 'd1', 'd2', 'd3'],
        chiralities: ['L', 'L', 'L', 'L'],
        color: '#32CD32',
        createdAt: 1735700001000,
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 80, y: 0 }, radius: 1, visualRadius: 40, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: 0, y: 80 }, radius: 1, visualRadius: 40, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: -80, y: 0 }, radius: 1, visualRadius: 40, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: 0, y: -80 }, radius: 1, visualRadius: 40, label: 'D3' },
        ]
    },
    {
        id: 'pre-cinquefoil',
        name: 'Cinquefoil Star (5 disks)',
        diskSequence: ['d0', 'd2', 'd4', 'd1', 'd3'],
        chiralities: ['L', 'L', 'L', 'L', 'L'],
        color: '#FFD700',
        createdAt: 1735700002000,
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 0, y: 100 }, radius: 1, visualRadius: 35, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: 95, y: 31 }, radius: 1, visualRadius: 35, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: 59, y: -81 }, radius: 1, visualRadius: 35, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: -59, y: -81 }, radius: 1, visualRadius: 35, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: -95, y: 31 }, radius: 1, visualRadius: 35, label: 'D4' },
        ]
    }
];
