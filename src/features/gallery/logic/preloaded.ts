import type { SavedKnot } from '../../editor/hooks/useEditorState';

export const PRELOADED_KNOTS: SavedKnot[] = [
    {
        id: 'pre-unknot',
        name: 'Unknot',
        diskSequence: ['d0', 'd1', 'd2', 'd3', 'd0'],
        chiralities: ['L', 'L', 'L', 'L', 'L'],
        color: '#FF4500',
        createdAt: 1735700000000,
        spritePos: '0% 0%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 0, y: -130 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: 130, y: 0 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: 0, y: 130 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: -130, y: 0 }, radius: 1, visualRadius: 50, label: 'D3' }
        ]
    },
    {
        id: 'pre-3_1',
        name: '3_1',
        diskSequence: ['d0', 'd3', 'd1', 'd4', 'd2', 'd5', 'd0'],
        chiralities: ['L', 'L', 'L', 'L', 'L', 'L', 'L'],
        color: '#FF4500',
        createdAt: 1735700001000,
        spritePos: '25% 0%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 0, y: -130 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: 112.6, y: -65 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: 112.6, y: 65 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: 0, y: 130 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: -112.6, y: 65 }, radius: 1, visualRadius: 50, label: 'D4' },
            { id: 'd5', kind: 'disk', center: { x: -112.6, y: -65 }, radius: 1, visualRadius: 50, label: 'D5' }
        ]
    },
    {
        id: 'pre-4_1',
        name: '4_1',
        diskSequence: ['d0', 'd4', 'd1', 'd5', 'd2', 'd6', 'd3', 'd7', 'd0'],
        chiralities: ['L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L'],
        color: '#FF4500',
        createdAt: 1735700002000,
        spritePos: '50% 0%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 0, y: -156.8 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: 110.9, y: -110.9 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: 156.8, y: 0 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: 110.9, y: 110.9 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: 0, y: 156.8 }, radius: 1, visualRadius: 50, label: 'D4' },
            { id: 'd5', kind: 'disk', center: { x: -110.9, y: 110.9 }, radius: 1, visualRadius: 50, label: 'D5' },
            { id: 'd6', kind: 'disk', center: { x: -156.8, y: 0 }, radius: 1, visualRadius: 50, label: 'D6' },
            { id: 'd7', kind: 'disk', center: { x: -110.9, y: -110.9 }, radius: 1, visualRadius: 50, label: 'D7' }
        ]
    },
    {
        id: 'pre-5_1',
        name: '5_1',
        diskSequence: ['d0', 'd2', 'd4', 'd1', 'd3', 'd0'],
        chiralities: ['L', 'L', 'L', 'L', 'L', 'L'],
        color: '#FF4500',
        createdAt: 1735700003000,
        spritePos: '75% 0%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 0, y: -130 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: 123.6, y: -40.2 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: 76.4, y: 105.2 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: -76.4, y: 105.2 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: -123.6, y: -40.2 }, radius: 1, visualRadius: 50, label: 'D4' }
        ]
    },
    {
        id: 'pre-5_2',
        name: '5_2',
        diskSequence: ['d0', 'd3', 'd6', 'd2', 'd5', 'd1', 'd4', 'd0'],
        chiralities: ['L', 'L', 'L', 'L', 'L', 'L', 'L', 'L'],
        color: '#FF4500',
        createdAt: 1735700004000,
        spritePos: '100% 0%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 0, y: -138.3 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: 108.1, y: -86.2 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: 134.8, y: 30.8 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: 60, y: 124.6 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: -60, y: 124.6 }, radius: 1, visualRadius: 50, label: 'D4' },
            { id: 'd5', kind: 'disk', center: { x: -134.8, y: 30.8 }, radius: 1, visualRadius: 50, label: 'D5' },
            { id: 'd6', kind: 'disk', center: { x: -108.1, y: -86.2 }, radius: 1, visualRadius: 50, label: 'D6' }
        ]
    },
    {
        id: 'pre-6_1',
        name: '6_1',
        diskSequence: ['d0', 'd2', 'd4', 'd6', 'd8', 'd1', 'd3', 'd5', 'd7', 'd0'],
        chiralities: ['L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L'],
        color: '#FF4500',
        createdAt: 1735700005000,
        spritePos: '0% 50%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 0, y: -175.4 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: 112.8, y: -134.4 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: 172.8, y: -30.5 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: 151.9, y: 87.7 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: 60, y: 164.8 }, radius: 1, visualRadius: 50, label: 'D4' },
            { id: 'd5', kind: 'disk', center: { x: -60, y: 164.8 }, radius: 1, visualRadius: 50, label: 'D5' },
            { id: 'd6', kind: 'disk', center: { x: -151.9, y: 87.7 }, radius: 1, visualRadius: 50, label: 'D6' },
            { id: 'd7', kind: 'disk', center: { x: -172.8, y: -30.5 }, radius: 1, visualRadius: 50, label: 'D7' },
            { id: 'd8', kind: 'disk', center: { x: -112.8, y: -134.4 }, radius: 1, visualRadius: 50, label: 'D8' }
        ]
    },
    {
        id: 'pre-6_2',
        name: '6_2',
        diskSequence: ['d0', 'd3', 'd6', 'd1', 'd4', 'd7', 'd2', 'd5', 'd0'],
        chiralities: ['L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L'],
        color: '#FF4500',
        createdAt: 1735700006000,
        spritePos: '25% 50%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 0, y: -156.8 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: 110.9, y: -110.9 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: 156.8, y: 0 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: 110.9, y: 110.9 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: 0, y: 156.8 }, radius: 1, visualRadius: 50, label: 'D4' },
            { id: 'd5', kind: 'disk', center: { x: -110.9, y: 110.9 }, radius: 1, visualRadius: 50, label: 'D5' },
            { id: 'd6', kind: 'disk', center: { x: -156.8, y: 0 }, radius: 1, visualRadius: 50, label: 'D6' },
            { id: 'd7', kind: 'disk', center: { x: -110.9, y: -110.9 }, radius: 1, visualRadius: 50, label: 'D7' }
        ]
    },
    {
        id: 'pre-6_3',
        name: '6_3',
        diskSequence: ['d0', 'd3', 'd6', 'd9', 'd2', 'd5', 'd8', 'd1', 'd4', 'd7', 'd0'],
        chiralities: ['L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L'],
        color: '#FF4500',
        createdAt: 1735700007000,
        spritePos: '50% 50%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 0, y: -194.2 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: 114.1, y: -157.1 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: 184.7, y: -60 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: 184.7, y: 60 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: 114.1, y: 157.1 }, radius: 1, visualRadius: 50, label: 'D4' },
            { id: 'd5', kind: 'disk', center: { x: 0, y: 194.2 }, radius: 1, visualRadius: 50, label: 'D5' },
            { id: 'd6', kind: 'disk', center: { x: -114.1, y: 157.1 }, radius: 1, visualRadius: 50, label: 'D6' },
            { id: 'd7', kind: 'disk', center: { x: -184.7, y: 60 }, radius: 1, visualRadius: 50, label: 'D7' },
            { id: 'd8', kind: 'disk', center: { x: -184.7, y: -60 }, radius: 1, visualRadius: 50, label: 'D8' },
            { id: 'd9', kind: 'disk', center: { x: -114.1, y: -157.1 }, radius: 1, visualRadius: 50, label: 'D9' }
        ]
    },
    {
        id: 'pre-7_1',
        name: '7_1',
        diskSequence: ['d0', 'd2', 'd4', 'd6', 'd1', 'd3', 'd5', 'd0'],
        chiralities: ['L', 'L', 'L', 'L', 'L', 'L', 'L', 'L'],
        color: '#FF4500',
        createdAt: 1735700008000,
        spritePos: '75% 50%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 0, y: -138.3 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: 108.1, y: -86.2 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: 134.8, y: 30.8 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: 60, y: 124.6 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: -60, y: 124.6 }, radius: 1, visualRadius: 50, label: 'D4' },
            { id: 'd5', kind: 'disk', center: { x: -134.8, y: 30.8 }, radius: 1, visualRadius: 50, label: 'D5' },
            { id: 'd6', kind: 'disk', center: { x: -108.1, y: -86.2 }, radius: 1, visualRadius: 50, label: 'D6' }
        ]
    },
    {
        id: 'pre-7_2',
        name: '7_2',
        diskSequence: ['d0', 'd3', 'd6', 'd1', 'd4', 'd7', 'd2', 'd5', 'd8', 'd0'],
        chiralities: ['L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L'],
        color: '#FF4500',
        createdAt: 1735700009000,
        spritePos: '100% 50%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 0, y: -175.4 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: 112.8, y: -134.4 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: 172.8, y: -30.5 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: 151.9, y: 87.7 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: 60, y: 164.8 }, radius: 1, visualRadius: 50, label: 'D4' },
            { id: 'd5', kind: 'disk', center: { x: -60, y: 164.8 }, radius: 1, visualRadius: 50, label: 'D5' },
            { id: 'd6', kind: 'disk', center: { x: -151.9, y: 87.7 }, radius: 1, visualRadius: 50, label: 'D6' },
            { id: 'd7', kind: 'disk', center: { x: -172.8, y: -30.5 }, radius: 1, visualRadius: 50, label: 'D7' },
            { id: 'd8', kind: 'disk', center: { x: -112.8, y: -134.4 }, radius: 1, visualRadius: 50, label: 'D8' }
        ]
    },
    {
        id: 'pre-7_3',
        name: '7_3',
        diskSequence: ['d0', 'd3', 'd6', 'd9', 'd1', 'd4', 'd7', 'd10', 'd2', 'd5', 'd8', 'd0'],
        chiralities: ['L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L'],
        color: '#FF4500',
        createdAt: 1735700010000,
        spritePos: '0% 100%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 0, y: -213 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: 115.1, y: -179.2 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: 193.7, y: -88.5 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: 210.8, y: 30.3 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: 161, y: 139.5 }, radius: 1, visualRadius: 50, label: 'D4' },
            { id: 'd5', kind: 'disk', center: { x: 60, y: 204.3 }, radius: 1, visualRadius: 50, label: 'D5' },
            { id: 'd6', kind: 'disk', center: { x: -60, y: 204.3 }, radius: 1, visualRadius: 50, label: 'D6' },
            { id: 'd7', kind: 'disk', center: { x: -161, y: 139.5 }, radius: 1, visualRadius: 50, label: 'D7' },
            { id: 'd8', kind: 'disk', center: { x: -210.8, y: 30.3 }, radius: 1, visualRadius: 50, label: 'D8' },
            { id: 'd9', kind: 'disk', center: { x: -193.7, y: -88.5 }, radius: 1, visualRadius: 50, label: 'D9' },
            { id: 'd10', kind: 'disk', center: { x: -115.1, y: -179.2 }, radius: 1, visualRadius: 50, label: 'D10' }
        ]
    },
    {
        id: 'pre-7_4',
        name: '7_4',
        diskSequence: ['d0', 'd4', 'd8', 'd2', 'd6', 'd1', 'd5', 'd9', 'd3', 'd7', 'd0'],
        chiralities: ['L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L'],
        color: '#FF4500',
        createdAt: 1735700011000,
        spritePos: '25% 100%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 0, y: -194.2 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: 114.1, y: -157.1 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: 184.7, y: -60 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: 184.7, y: 60 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: 114.1, y: 157.1 }, radius: 1, visualRadius: 50, label: 'D4' },
            { id: 'd5', kind: 'disk', center: { x: 0, y: 194.2 }, radius: 1, visualRadius: 50, label: 'D5' },
            { id: 'd6', kind: 'disk', center: { x: -114.1, y: 157.1 }, radius: 1, visualRadius: 50, label: 'D6' },
            { id: 'd7', kind: 'disk', center: { x: -184.7, y: 60 }, radius: 1, visualRadius: 50, label: 'D7' },
            { id: 'd8', kind: 'disk', center: { x: -184.7, y: -60 }, radius: 1, visualRadius: 50, label: 'D8' },
            { id: 'd9', kind: 'disk', center: { x: -114.1, y: -157.1 }, radius: 1, visualRadius: 50, label: 'D9' }
        ]
    },
    {
        id: 'pre-7_5',
        name: '7_5',
        diskSequence: ['d0', 'd4', 'd8', 'd1', 'd5', 'd9', 'd2', 'd6', 'd10', 'd3', 'd7', 'd0'],
        chiralities: ['L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L'],
        color: '#FF4500',
        createdAt: 1735700012000,
        spritePos: '50% 100%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 0, y: -213 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: 115.1, y: -179.2 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: 193.7, y: -88.5 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: 210.8, y: 30.3 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: 161, y: 139.5 }, radius: 1, visualRadius: 50, label: 'D4' },
            { id: 'd5', kind: 'disk', center: { x: 60, y: 204.3 }, radius: 1, visualRadius: 50, label: 'D5' },
            { id: 'd6', kind: 'disk', center: { x: -60, y: 204.3 }, radius: 1, visualRadius: 50, label: 'D6' },
            { id: 'd7', kind: 'disk', center: { x: -161, y: 139.5 }, radius: 1, visualRadius: 50, label: 'D7' },
            { id: 'd8', kind: 'disk', center: { x: -210.8, y: 30.3 }, radius: 1, visualRadius: 50, label: 'D8' },
            { id: 'd9', kind: 'disk', center: { x: -193.7, y: -88.5 }, radius: 1, visualRadius: 50, label: 'D9' },
            { id: 'd10', kind: 'disk', center: { x: -115.1, y: -179.2 }, radius: 1, visualRadius: 50, label: 'D10' }
        ]
    },
    {
        id: 'pre-7_6',
        name: '7_6',
        diskSequence: ['d0', 'd5', 'd10', 'd3', 'd8', 'd1', 'd6', 'd11', 'd4', 'd9', 'd2', 'd7', 'd0'],
        chiralities: ['L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L'],
        color: '#FF4500',
        createdAt: 1735700013000,
        spritePos: '75% 100%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 0, y: -231.8 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: 115.9, y: -200.8 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: 200.8, y: -115.9 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: 231.8, y: 0 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: 200.8, y: 115.9 }, radius: 1, visualRadius: 50, label: 'D4' },
            { id: 'd5', kind: 'disk', center: { x: 115.9, y: 200.8 }, radius: 1, visualRadius: 50, label: 'D5' },
            { id: 'd6', kind: 'disk', center: { x: 0, y: 231.8 }, radius: 1, visualRadius: 50, label: 'D6' },
            { id: 'd7', kind: 'disk', center: { x: -115.9, y: 200.8 }, radius: 1, visualRadius: 50, label: 'D7' },
            { id: 'd8', kind: 'disk', center: { x: -200.8, y: 115.9 }, radius: 1, visualRadius: 50, label: 'D8' },
            { id: 'd9', kind: 'disk', center: { x: -231.8, y: 0 }, radius: 1, visualRadius: 50, label: 'D9' },
            { id: 'd10', kind: 'disk', center: { x: -200.8, y: -115.9 }, radius: 1, visualRadius: 50, label: 'D10' },
            { id: 'd11', kind: 'disk', center: { x: -115.9, y: -200.8 }, radius: 1, visualRadius: 50, label: 'D11' }
        ]
    },
    {
        id: 'pre-7_7',
        name: '7_7',
        diskSequence: ['d0', 'd5', 'd10', 'd2', 'd7', 'd12', 'd4', 'd9', 'd1', 'd6', 'd11', 'd3', 'd8', 'd0'],
        chiralities: ['L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L'],
        color: '#FF4500',
        createdAt: 1735700014000,
        spritePos: '100% 100%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 0, y: -250.7 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: 116.5, y: -222 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: 206.3, y: -142.4 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: 248.9, y: -30.2 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: 234.4, y: 88.9 }, radius: 1, visualRadius: 50, label: 'D4' },
            { id: 'd5', kind: 'disk', center: { x: 166.3, y: 187.7 }, radius: 1, visualRadius: 50, label: 'D5' },
            { id: 'd6', kind: 'disk', center: { x: 60, y: 243.4 }, radius: 1, visualRadius: 50, label: 'D6' },
            { id: 'd7', kind: 'disk', center: { x: -60, y: 243.4 }, radius: 1, visualRadius: 50, label: 'D7' },
            { id: 'd8', kind: 'disk', center: { x: -166.3, y: 187.7 }, radius: 1, visualRadius: 50, label: 'D8' },
            { id: 'd9', kind: 'disk', center: { x: -234.4, y: 88.9 }, radius: 1, visualRadius: 50, label: 'D9' },
            { id: 'd10', kind: 'disk', center: { x: -248.9, y: -30.2 }, radius: 1, visualRadius: 50, label: 'D10' },
            { id: 'd11', kind: 'disk', center: { x: -206.3, y: -142.4 }, radius: 1, visualRadius: 50, label: 'D11' },
            { id: 'd12', kind: 'disk', center: { x: -116.5, y: -222 }, radius: 1, visualRadius: 50, label: 'D12' }
        ]
    },
];
