import type { SavedKnot } from '../../editor/hooks/useEditorState';

export const PRELOADED_KNOTS: SavedKnot[] = [
    {
        id: 'pre-unknot',
        name: 'Unknot',
        diskSequence: ['d0', 'd1', 'd2'],
        chiralities: ['L', 'L', 'L'],
        color: '#FF4500',
        createdAt: 1735700000000,
        spritePos: '0% 0%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 133.3, y: 0 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: -66.6, y: 115.4 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: -66.7, y: -115.4 }, radius: 1, visualRadius: 50, label: 'D2' }
        ]
    },
    {
        id: 'pre-3_1',
        name: '3_1',
        diskSequence: ['d0', 'd1', 'd2'],
        chiralities: ['L', 'L', 'L'],
        color: '#FF4500',
        createdAt: 1735700001000,
        spritePos: '25% 0%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 133.3, y: 0 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: -66.6, y: 115.4 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: -66.7, y: -115.4 }, radius: 1, visualRadius: 50, label: 'D2' }
        ]
    },
    {
        id: 'pre-4_1',
        name: '4_1',
        diskSequence: ['d0', 'd1', 'd2', 'd3'],
        chiralities: ['L', 'L', 'L', 'L'],
        color: '#FF4500',
        createdAt: 1735700002000,
        spritePos: '50% 0%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 133.3, y: 0 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: 0, y: 133.3 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: -133.3, y: 0 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: 0, y: -133.3 }, radius: 1, visualRadius: 50, label: 'D3' }
        ]
    },
    {
        id: 'pre-5_1',
        name: '5_1',
        diskSequence: ['d0', 'd1', 'd2', 'd3', 'd4'],
        chiralities: ['L', 'L', 'L', 'L', 'L'],
        color: '#FF4500',
        createdAt: 1735700003000,
        spritePos: '75% 0%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 133.3, y: 0 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: 41.2, y: 126.8 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: -107.8, y: 78.4 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: -107.8, y: -78.4 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: 41.2, y: -126.8 }, radius: 1, visualRadius: 50, label: 'D4' }
        ]
    },
    {
        id: 'pre-5_2',
        name: '5_2',
        diskSequence: ['d0', 'd1', 'd2', 'd3', 'd4'],
        chiralities: ['L', 'L', 'L', 'L', 'L'],
        color: '#FF4500',
        createdAt: 1735700004000,
        spritePos: '100% 0%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 133.3, y: 0 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: 41.2, y: 126.8 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: -107.8, y: 78.4 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: -107.8, y: -78.4 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: 41.2, y: -126.8 }, radius: 1, visualRadius: 50, label: 'D4' }
        ]
    },
    {
        id: 'pre-6_1',
        name: '6_1',
        diskSequence: ['d0', 'd1', 'd2', 'd3', 'd4', 'd5'],
        chiralities: ['L', 'L', 'L', 'L', 'L', 'L'],
        color: '#FF4500',
        createdAt: 1735700005000,
        spritePos: '0% 50%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 133.3, y: 0 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: 66.7, y: 115.4 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: -66.6, y: 115.4 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: -133.3, y: 0 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: -66.7, y: -115.4 }, radius: 1, visualRadius: 50, label: 'D4' },
            { id: 'd5', kind: 'disk', center: { x: 66.7, y: -115.4 }, radius: 1, visualRadius: 50, label: 'D5' }
        ]
    },
    {
        id: 'pre-6_2',
        name: '6_2',
        diskSequence: ['d0', 'd1', 'd2', 'd3', 'd4', 'd5'],
        chiralities: ['L', 'L', 'L', 'L', 'L', 'L'],
        color: '#FF4500',
        createdAt: 1735700006000,
        spritePos: '25% 50%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 133.3, y: 0 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: 66.7, y: 115.4 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: -66.6, y: 115.4 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: -133.3, y: 0 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: -66.7, y: -115.4 }, radius: 1, visualRadius: 50, label: 'D4' },
            { id: 'd5', kind: 'disk', center: { x: 66.7, y: -115.4 }, radius: 1, visualRadius: 50, label: 'D5' }
        ]
    },
    {
        id: 'pre-6_3',
        name: '6_3',
        diskSequence: ['d0', 'd1', 'd2', 'd3', 'd4', 'd5'],
        chiralities: ['L', 'L', 'L', 'L', 'L', 'L'],
        color: '#FF4500',
        createdAt: 1735700007000,
        spritePos: '50% 50%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 133.3, y: 0 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: 66.7, y: 115.4 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: -66.6, y: 115.4 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: -133.3, y: 0 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: -66.7, y: -115.4 }, radius: 1, visualRadius: 50, label: 'D4' },
            { id: 'd5', kind: 'disk', center: { x: 66.7, y: -115.4 }, radius: 1, visualRadius: 50, label: 'D5' }
        ]
    },
    {
        id: 'pre-7_1',
        name: '7_1',
        diskSequence: ['d0', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6'],
        chiralities: ['L', 'L', 'L', 'L', 'L', 'L', 'L'],
        color: '#FF4500',
        createdAt: 1735700008000,
        spritePos: '75% 50%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 133.3, y: 0 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: 83.1, y: 104.2 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: -29.7, y: 130 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: -120.1, y: 57.8 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: -120.1, y: -57.8 }, radius: 1, visualRadius: 50, label: 'D4' },
            { id: 'd5', kind: 'disk', center: { x: -29.7, y: -130 }, radius: 1, visualRadius: 50, label: 'D5' },
            { id: 'd6', kind: 'disk', center: { x: 83.1, y: -104.2 }, radius: 1, visualRadius: 50, label: 'D6' }
        ]
    },
    {
        id: 'pre-7_2',
        name: '7_2',
        diskSequence: ['d0', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6'],
        chiralities: ['L', 'L', 'L', 'L', 'L', 'L', 'L'],
        color: '#FF4500',
        createdAt: 1735700009000,
        spritePos: '100% 50%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 133.3, y: 0 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: 83.1, y: 104.2 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: -29.7, y: 130 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: -120.1, y: 57.8 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: -120.1, y: -57.8 }, radius: 1, visualRadius: 50, label: 'D4' },
            { id: 'd5', kind: 'disk', center: { x: -29.7, y: -130 }, radius: 1, visualRadius: 50, label: 'D5' },
            { id: 'd6', kind: 'disk', center: { x: 83.1, y: -104.2 }, radius: 1, visualRadius: 50, label: 'D6' }
        ]
    },
    {
        id: 'pre-7_3',
        name: '7_3',
        diskSequence: ['d0', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6'],
        chiralities: ['L', 'L', 'L', 'L', 'L', 'L', 'L'],
        color: '#FF4500',
        createdAt: 1735700010000,
        spritePos: '0% 100%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 133.3, y: 0 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: 83.1, y: 104.2 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: -29.7, y: 130 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: -120.1, y: 57.8 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: -120.1, y: -57.8 }, radius: 1, visualRadius: 50, label: 'D4' },
            { id: 'd5', kind: 'disk', center: { x: -29.7, y: -130 }, radius: 1, visualRadius: 50, label: 'D5' },
            { id: 'd6', kind: 'disk', center: { x: 83.1, y: -104.2 }, radius: 1, visualRadius: 50, label: 'D6' }
        ]
    },
    {
        id: 'pre-7_4',
        name: '7_4',
        diskSequence: ['d0', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6'],
        chiralities: ['L', 'L', 'L', 'L', 'L', 'L', 'L'],
        color: '#FF4500',
        createdAt: 1735700011000,
        spritePos: '25% 100%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 133.3, y: 0 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: 83.1, y: 104.2 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: -29.7, y: 130 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: -120.1, y: 57.8 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: -120.1, y: -57.8 }, radius: 1, visualRadius: 50, label: 'D4' },
            { id: 'd5', kind: 'disk', center: { x: -29.7, y: -130 }, radius: 1, visualRadius: 50, label: 'D5' },
            { id: 'd6', kind: 'disk', center: { x: 83.1, y: -104.2 }, radius: 1, visualRadius: 50, label: 'D6' }
        ]
    },
    {
        id: 'pre-7_5',
        name: '7_5',
        diskSequence: ['d0', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6'],
        chiralities: ['L', 'L', 'L', 'L', 'L', 'L', 'L'],
        color: '#FF4500',
        createdAt: 1735700012000,
        spritePos: '50% 100%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 133.3, y: 0 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: 83.1, y: 104.2 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: -29.7, y: 130 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: -120.1, y: 57.8 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: -120.1, y: -57.8 }, radius: 1, visualRadius: 50, label: 'D4' },
            { id: 'd5', kind: 'disk', center: { x: -29.7, y: -130 }, radius: 1, visualRadius: 50, label: 'D5' },
            { id: 'd6', kind: 'disk', center: { x: 83.1, y: -104.2 }, radius: 1, visualRadius: 50, label: 'D6' }
        ]
    },
    {
        id: 'pre-7_6',
        name: '7_6',
        diskSequence: ['d0', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6'],
        chiralities: ['L', 'L', 'L', 'L', 'L', 'L', 'L'],
        color: '#FF4500',
        createdAt: 1735700013000,
        spritePos: '75% 100%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 133.3, y: 0 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: 83.1, y: 104.2 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: -29.7, y: 130 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: -120.1, y: 57.8 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: -120.1, y: -57.8 }, radius: 1, visualRadius: 50, label: 'D4' },
            { id: 'd5', kind: 'disk', center: { x: -29.7, y: -130 }, radius: 1, visualRadius: 50, label: 'D5' },
            { id: 'd6', kind: 'disk', center: { x: 83.1, y: -104.2 }, radius: 1, visualRadius: 50, label: 'D6' }
        ]
    },
    {
        id: 'pre-7_7',
        name: '7_7',
        diskSequence: ['d0', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6'],
        chiralities: ['L', 'L', 'L', 'L', 'L', 'L', 'L'],
        color: '#FF4500',
        createdAt: 1735700014000,
        spritePos: '100% 100%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 133.3, y: 0 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: 83.1, y: 104.2 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: -29.7, y: 130 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: -120.1, y: 57.8 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: -120.1, y: -57.8 }, radius: 1, visualRadius: 50, label: 'D4' },
            { id: 'd5', kind: 'disk', center: { x: -29.7, y: -130 }, radius: 1, visualRadius: 50, label: 'D5' },
            { id: 'd6', kind: 'disk', center: { x: 83.1, y: -104.2 }, radius: 1, visualRadius: 50, label: 'D6' }
        ]
    },
];
