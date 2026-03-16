import type { SavedKnot } from '../../editor/hooks/useEditorState';

/**
 * Preloaded knot gallery — mathematically exact configurations
 *
 * Model: Ayala, Kirszenblat & Rubinstein — "Immersed Flat Ribbon Knots" (arXiv:2005.13168)
 *
 * Central-satellite model:
 *   - D_0 at origin (central disk)
 *   - n satellite disks tangent to D_0, centres at distance 2r = 100 (visualRadius = 50)
 *   - For torus knots T(p,2): p satellites equally spaced, step-by-2 visiting, all-L chiralities
 *   - For figure-8 (4_1): paper's conjectured configuration (Fig.15, §6.4)
 */

export const PRELOADED_KNOTS: SavedKnot[] = [
    // ── Unknot ─────────────────────────────────────────────────────────
    // 0 crossings, 1 bounded region → 1 disk.
    // We use 2 tangent disks (twisted unknot) so the engine can render a path.
    // Rib = 2π (§6.1)
    {
        id: 'pre-unknot',
        name: 'Unknot',
        diskSequence: ['d0', 'd1', 'd0'],
        chiralities: ['L', 'L', 'L'],
        color: '#FF4500',
        createdAt: 1735700000000,
        spritePos: '0% 0%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 0, y: 0 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: 0, y: 100 }, radius: 1, visualRadius: 50, label: 'D1' },
        ],
    },

    // ── 3_1 Trefoil = T(3,2) ───────────────────────────────────────────
    // 3 crossings → 4 disks (D_0 + 3 satellites at 120° apart)
    // Satellites at angles 90°, 210°, 330° from D_0
    // Step-by-2 visiting: 1 → 3 → 2
    // Rib = 6 + 2π (§6.2)
    {
        id: 'pre-3_1',
        name: '3_1',
        diskSequence: ['d0', 'd1', 'd3', 'd2', 'd0'],
        chiralities: ['L', 'L', 'L', 'L', 'L'],
        color: '#FF4500',
        createdAt: 1735700001000,
        spritePos: '25% 0%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 0, y: 0 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: 0, y: 100 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: -86.6, y: -50 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: 86.6, y: -50 }, radius: 1, visualRadius: 50, label: 'D3' },
        ],
    },

    // ── 4_1 Figure-eight knot ──────────────────────────────────────────
    // 4 crossings → 5 disks. Paper's conjectured minimiser (Fig.15, §6.4)
    // D_0 central, D_1 & D_3 tangent to D_0 at ±45° below,
    // D_2 tangent to D_1 & D_3 at bottom, D_4 tangent to D_0 above.
    // Centres from paper: D_0=(0,0), D_1=(-√2,-√2), D_2=(0,-2√2),
    //   D_3=(√2,-√2), D_4=(0,2), scaled by visualRadius=50.
    // Core length: open problem
    {
        id: 'pre-4_1',
        name: '4_1',
        diskSequence: ['d0', 'd4', 'd0', 'd1', 'd2', 'd3', 'd0'],
        chiralities: ['L', 'R', 'L', 'R', 'L', 'R', 'L'],
        color: '#FF4500',
        createdAt: 1735700002000,
        spritePos: '50% 0%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 0, y: 0 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: -70.71, y: -70.71 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: 0, y: -141.42 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: 70.71, y: -70.71 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: 0, y: 100 }, radius: 1, visualRadius: 50, label: 'D4' },
        ],
    },

    // ── 5_1 Cinquefoil = T(5,2) ────────────────────────────────────────
    // 5 crossings → 6 disks (D_0 + 5 satellites at 72° apart)
    // Starting angle 90°, step 72°
    // Step-by-2 visiting: 1 → 3 → 5 → 2 → 4
    // Rib = 10 + 2π (§6.7, T(p,2) family: Rib = 2p + 2π)
    {
        id: 'pre-5_1',
        name: '5_1',
        diskSequence: ['d0', 'd1', 'd3', 'd5', 'd2', 'd4', 'd0'],
        chiralities: ['L', 'L', 'L', 'L', 'L', 'L', 'L'],
        color: '#FF4500',
        createdAt: 1735700003000,
        spritePos: '75% 0%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 0, y: 0 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: 0, y: 100 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: -95.11, y: 30.9 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: -58.78, y: -80.9 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: 58.78, y: -80.9 }, radius: 1, visualRadius: 50, label: 'D4' },
            { id: 'd5', kind: 'disk', center: { x: 95.11, y: 30.9 }, radius: 1, visualRadius: 50, label: 'D5' },
        ],
    },

    // ── 5_2 (twist knot, 5 crossings) ──────────────────────────────────
    // 5 crossings → 6 disks (D_0 + 5 satellites)
    // Same satellite positions as 5_1; different visiting order + chiralities
    // distinguish it from T(5,2).
    {
        id: 'pre-5_2',
        name: '5_2',
        diskSequence: ['d0', 'd1', 'd4', 'd2', 'd5', 'd3', 'd0'],
        chiralities: ['L', 'L', 'R', 'L', 'R', 'L', 'L'],
        color: '#FF4500',
        createdAt: 1735700004000,
        spritePos: '100% 0%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 0, y: 0 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: 0, y: 100 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: -95.11, y: 30.9 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: -58.78, y: -80.9 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: 58.78, y: -80.9 }, radius: 1, visualRadius: 50, label: 'D4' },
            { id: 'd5', kind: 'disk', center: { x: 95.11, y: 30.9 }, radius: 1, visualRadius: 50, label: 'D5' },
        ],
    },

    // ── 6_1 Stevedore knot (6 crossings) ───────────────────────────────
    // 6 crossings → 7 disks (D_0 + 6 satellites at 60° apart)
    {
        id: 'pre-6_1',
        name: '6_1',
        diskSequence: ['d0', 'd1', 'd4', 'd2', 'd5', 'd3', 'd6', 'd0'],
        chiralities: ['L', 'L', 'R', 'L', 'R', 'L', 'R', 'L'],
        color: '#FF4500',
        createdAt: 1735700005000,
        spritePos: '0% 50%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 0, y: 0 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: 0, y: 100 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: -86.6, y: 50 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: -86.6, y: -50 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: 0, y: -100 }, radius: 1, visualRadius: 50, label: 'D4' },
            { id: 'd5', kind: 'disk', center: { x: 86.6, y: -50 }, radius: 1, visualRadius: 50, label: 'D5' },
            { id: 'd6', kind: 'disk', center: { x: 86.6, y: 50 }, radius: 1, visualRadius: 50, label: 'D6' },
        ],
    },

    // ── 6_2 (6 crossings) ──────────────────────────────────────────────
    // 6 crossings → 7 disks (D_0 + 6 satellites at 60° apart)
    {
        id: 'pre-6_2',
        name: '6_2',
        diskSequence: ['d0', 'd1', 'd3', 'd5', 'd2', 'd6', 'd4', 'd0'],
        chiralities: ['L', 'L', 'L', 'R', 'L', 'R', 'L', 'L'],
        color: '#FF4500',
        createdAt: 1735700006000,
        spritePos: '25% 50%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 0, y: 0 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: 0, y: 100 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: -86.6, y: 50 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: -86.6, y: -50 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: 0, y: -100 }, radius: 1, visualRadius: 50, label: 'D4' },
            { id: 'd5', kind: 'disk', center: { x: 86.6, y: -50 }, radius: 1, visualRadius: 50, label: 'D5' },
            { id: 'd6', kind: 'disk', center: { x: 86.6, y: 50 }, radius: 1, visualRadius: 50, label: 'D6' },
        ],
    },

    // ── 6_3 (6 crossings, amphicheiral) ────────────────────────────────
    // 6 crossings → 7 disks (D_0 + 6 satellites at 60° apart)
    {
        id: 'pre-6_3',
        name: '6_3',
        diskSequence: ['d0', 'd1', 'd4', 'd6', 'd3', 'd5', 'd2', 'd0'],
        chiralities: ['L', 'R', 'L', 'R', 'L', 'R', 'L', 'R'],
        color: '#FF4500',
        createdAt: 1735700007000,
        spritePos: '50% 50%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 0, y: 0 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: 0, y: 100 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: -86.6, y: 50 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: -86.6, y: -50 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: 0, y: -100 }, radius: 1, visualRadius: 50, label: 'D4' },
            { id: 'd5', kind: 'disk', center: { x: 86.6, y: -50 }, radius: 1, visualRadius: 50, label: 'D5' },
            { id: 'd6', kind: 'disk', center: { x: 86.6, y: 50 }, radius: 1, visualRadius: 50, label: 'D6' },
        ],
    },

    // ── 7_1 = T(7,2) ──────────────────────────────────────────────────
    // 7 crossings → 8 disks (D_0 + 7 satellites at 360°/7 ≈ 51.43° apart)
    // Step-by-2 visiting: 1 → 3 → 5 → 7 → 2 → 4 → 6
    // Rib = 14 + 2π (T(p,2) family: Rib = 2p + 2π)
    {
        id: 'pre-7_1',
        name: '7_1',
        diskSequence: ['d0', 'd1', 'd3', 'd5', 'd7', 'd2', 'd4', 'd6', 'd0'],
        chiralities: ['L', 'L', 'L', 'L', 'L', 'L', 'L', 'L', 'L'],
        color: '#FF4500',
        createdAt: 1735700008000,
        spritePos: '75% 50%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 0, y: 0 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: 0, y: 100 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: -78.18, y: 62.35 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: -97.49, y: -22.25 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: -43.39, y: -90.1 }, radius: 1, visualRadius: 50, label: 'D4' },
            { id: 'd5', kind: 'disk', center: { x: 43.39, y: -90.1 }, radius: 1, visualRadius: 50, label: 'D5' },
            { id: 'd6', kind: 'disk', center: { x: 97.49, y: -22.25 }, radius: 1, visualRadius: 50, label: 'D6' },
            { id: 'd7', kind: 'disk', center: { x: 78.18, y: 62.35 }, radius: 1, visualRadius: 50, label: 'D7' },
        ],
    },

    // ── 7_2 (7 crossings) ──────────────────────────────────────────────
    // 7 crossings → 8 disks (D_0 + 7 satellites)
    // Step-by-3 visiting: 1 → 4 → 7 → 3 → 6 → 2 → 5
    {
        id: 'pre-7_2',
        name: '7_2',
        diskSequence: ['d0', 'd1', 'd4', 'd7', 'd3', 'd6', 'd2', 'd5', 'd0'],
        chiralities: ['L', 'L', 'R', 'L', 'R', 'L', 'R', 'L', 'L'],
        color: '#FF4500',
        createdAt: 1735700009000,
        spritePos: '100% 50%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 0, y: 0 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: 0, y: 100 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: -78.18, y: 62.35 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: -97.49, y: -22.25 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: -43.39, y: -90.1 }, radius: 1, visualRadius: 50, label: 'D4' },
            { id: 'd5', kind: 'disk', center: { x: 43.39, y: -90.1 }, radius: 1, visualRadius: 50, label: 'D5' },
            { id: 'd6', kind: 'disk', center: { x: 97.49, y: -22.25 }, radius: 1, visualRadius: 50, label: 'D6' },
            { id: 'd7', kind: 'disk', center: { x: 78.18, y: 62.35 }, radius: 1, visualRadius: 50, label: 'D7' },
        ],
    },

    // ── 7_3 (7 crossings) ──────────────────────────────────────────────
    {
        id: 'pre-7_3',
        name: '7_3',
        diskSequence: ['d0', 'd1', 'd5', 'd2', 'd6', 'd3', 'd7', 'd4', 'd0'],
        chiralities: ['L', 'L', 'L', 'R', 'L', 'R', 'L', 'L', 'L'],
        color: '#FF4500',
        createdAt: 1735700010000,
        spritePos: '0% 100%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 0, y: 0 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: 0, y: 100 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: -78.18, y: 62.35 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: -97.49, y: -22.25 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: -43.39, y: -90.1 }, radius: 1, visualRadius: 50, label: 'D4' },
            { id: 'd5', kind: 'disk', center: { x: 43.39, y: -90.1 }, radius: 1, visualRadius: 50, label: 'D5' },
            { id: 'd6', kind: 'disk', center: { x: 97.49, y: -22.25 }, radius: 1, visualRadius: 50, label: 'D6' },
            { id: 'd7', kind: 'disk', center: { x: 78.18, y: 62.35 }, radius: 1, visualRadius: 50, label: 'D7' },
        ],
    },

    // ── 7_4 (7 crossings) ──────────────────────────────────────────────
    {
        id: 'pre-7_4',
        name: '7_4',
        diskSequence: ['d0', 'd1', 'd4', 'd2', 'd6', 'd3', 'd7', 'd5', 'd0'],
        chiralities: ['L', 'R', 'L', 'R', 'L', 'L', 'R', 'L', 'L'],
        color: '#FF4500',
        createdAt: 1735700011000,
        spritePos: '25% 100%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 0, y: 0 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: 0, y: 100 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: -78.18, y: 62.35 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: -97.49, y: -22.25 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: -43.39, y: -90.1 }, radius: 1, visualRadius: 50, label: 'D4' },
            { id: 'd5', kind: 'disk', center: { x: 43.39, y: -90.1 }, radius: 1, visualRadius: 50, label: 'D5' },
            { id: 'd6', kind: 'disk', center: { x: 97.49, y: -22.25 }, radius: 1, visualRadius: 50, label: 'D6' },
            { id: 'd7', kind: 'disk', center: { x: 78.18, y: 62.35 }, radius: 1, visualRadius: 50, label: 'D7' },
        ],
    },

    // ── 7_5 (7 crossings) ──────────────────────────────────────────────
    {
        id: 'pre-7_5',
        name: '7_5',
        diskSequence: ['d0', 'd1', 'd5', 'd3', 'd7', 'd4', 'd2', 'd6', 'd0'],
        chiralities: ['L', 'L', 'L', 'R', 'L', 'R', 'L', 'L', 'R'],
        color: '#FF4500',
        createdAt: 1735700012000,
        spritePos: '50% 100%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 0, y: 0 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: 0, y: 100 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: -78.18, y: 62.35 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: -97.49, y: -22.25 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: -43.39, y: -90.1 }, radius: 1, visualRadius: 50, label: 'D4' },
            { id: 'd5', kind: 'disk', center: { x: 43.39, y: -90.1 }, radius: 1, visualRadius: 50, label: 'D5' },
            { id: 'd6', kind: 'disk', center: { x: 97.49, y: -22.25 }, radius: 1, visualRadius: 50, label: 'D6' },
            { id: 'd7', kind: 'disk', center: { x: 78.18, y: 62.35 }, radius: 1, visualRadius: 50, label: 'D7' },
        ],
    },

    // ── 7_6 (7 crossings) ──────────────────────────────────────────────
    {
        id: 'pre-7_6',
        name: '7_6',
        diskSequence: ['d0', 'd1', 'd6', 'd4', 'd2', 'd7', 'd5', 'd3', 'd0'],
        chiralities: ['L', 'L', 'R', 'L', 'R', 'L', 'R', 'L', 'L'],
        color: '#FF4500',
        createdAt: 1735700013000,
        spritePos: '75% 100%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 0, y: 0 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: 0, y: 100 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: -78.18, y: 62.35 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: -97.49, y: -22.25 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: -43.39, y: -90.1 }, radius: 1, visualRadius: 50, label: 'D4' },
            { id: 'd5', kind: 'disk', center: { x: 43.39, y: -90.1 }, radius: 1, visualRadius: 50, label: 'D5' },
            { id: 'd6', kind: 'disk', center: { x: 97.49, y: -22.25 }, radius: 1, visualRadius: 50, label: 'D6' },
            { id: 'd7', kind: 'disk', center: { x: 78.18, y: 62.35 }, radius: 1, visualRadius: 50, label: 'D7' },
        ],
    },

    // ── 7_7 (7 crossings) ──────────────────────────────────────────────
    {
        id: 'pre-7_7',
        name: '7_7',
        diskSequence: ['d0', 'd1', 'd3', 'd6', 'd2', 'd5', 'd7', 'd4', 'd0'],
        chiralities: ['L', 'R', 'L', 'L', 'R', 'L', 'L', 'R', 'L'],
        color: '#FF4500',
        createdAt: 1735700014000,
        spritePos: '100% 100%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 0, y: 0 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: 0, y: 100 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: -78.18, y: 62.35 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: -97.49, y: -22.25 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: -43.39, y: -90.1 }, radius: 1, visualRadius: 50, label: 'D4' },
            { id: 'd5', kind: 'disk', center: { x: 43.39, y: -90.1 }, radius: 1, visualRadius: 50, label: 'D5' },
            { id: 'd6', kind: 'disk', center: { x: 97.49, y: -22.25 }, radius: 1, visualRadius: 50, label: 'D6' },
            { id: 'd7', kind: 'disk', center: { x: 78.18, y: 62.35 }, radius: 1, visualRadius: 50, label: 'D7' },
        ],
    },
];
