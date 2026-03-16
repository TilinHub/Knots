import type { SavedKnot } from '../../editor/hooks/useEditorState';

/**
 * Preloaded knot gallery — mathematically exact configurations
 *
 * Model: Ayala, Kirszenblat & Rubinstein — "Immersed Flat Ribbon Knots" (arXiv:2005.13168)
 *
 * Central-satellite model:
 *   - D_0 at origin (central disk)
 *   - n satellite disks tangent to D_0
 *   - Core curve visits satellites in a specific order, going DIRECTLY between them
 *     (the crossing tangent lines form the knot shape)
 *   - For torus knots T(p,2): step-by-2 visiting produces star polygon patterns
 *   - For figure-8 (4_1): paper's exact configuration (Fig.15, §6.4)
 *
 * Satellite distances (R = center-to-center distance):
 *   - n ≤ 5: R = 100 (= 2 × visualRadius, tangent to D_0)
 *   - n = 6: R = 106 (prevents adjacent satellite overlap)
 *   - n = 7: R = 121 (prevents adjacent satellite overlap)
 */

export const PRELOADED_KNOTS: SavedKnot[] = [
    // ── Unknot ─────────────────────────────────────────────────────────
    // 0 crossings. Single loop around one disk. Rib = π (§6.1)
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
    // 3 crossings → 4 disks. Step-by-2 → 1,3,2 → three-lobed trefoil shape.
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
    // 4 crossings → 5 disks. Paper's conjectured minimiser (Fig.15, §6.4).
    // D_1↔D_2, D_2↔D_3 tangent pairs form lower loop; D_4↔D_0 forms upper loop.
    {
        id: 'pre-4_1',
        name: '4_1',
        diskSequence: ['d0', 'd4', 'd0', 'd1', 'd2', 'd3', 'd0'],
        chiralities: ['L', 'L', 'L', 'L', 'L', 'L', 'L'],
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
    // 5 crossings → 6 disks. Step-by-2 → 1,3,5,2,4 → pentagram shape.
    // Rib = 10 + 2π (§6.7)
    // ALL-R chiralities: for p≥5 torus knots, RSR tangents go through center (star pattern).
    // LSL tangents would go around the outside (convex hull).
    {
        id: 'pre-5_1',
        name: '5_1',
        diskSequence: ['d0', 'd1', 'd3', 'd5', 'd2', 'd4', 'd0'],
        chiralities: ['R', 'R', 'R', 'R', 'R', 'R', 'R'],
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
    // 5 crossings → 6 disks. Visiting: 1,4,2,5,3 creates twist-knot crossings.
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
    // 6 crossings → 7 disks. R=106 to avoid overlap.
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
            { id: 'd1', kind: 'disk', center: { x: 0, y: 106 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: -91.8, y: 53 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: -91.8, y: -53 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: 0, y: -106 }, radius: 1, visualRadius: 50, label: 'D4' },
            { id: 'd5', kind: 'disk', center: { x: 91.8, y: -53 }, radius: 1, visualRadius: 50, label: 'D5' },
            { id: 'd6', kind: 'disk', center: { x: 91.8, y: 53 }, radius: 1, visualRadius: 50, label: 'D6' },
        ],
    },

    // ── 6_2 (6 crossings) ──────────────────────────────────────────────
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
            { id: 'd1', kind: 'disk', center: { x: 0, y: 106 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: -91.8, y: 53 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: -91.8, y: -53 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: 0, y: -106 }, radius: 1, visualRadius: 50, label: 'D4' },
            { id: 'd5', kind: 'disk', center: { x: 91.8, y: -53 }, radius: 1, visualRadius: 50, label: 'D5' },
            { id: 'd6', kind: 'disk', center: { x: 91.8, y: 53 }, radius: 1, visualRadius: 50, label: 'D6' },
        ],
    },

    // ── 6_3 (6 crossings, amphicheiral) ────────────────────────────────
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
            { id: 'd1', kind: 'disk', center: { x: 0, y: 106 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: -91.8, y: 53 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: -91.8, y: -53 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: 0, y: -106 }, radius: 1, visualRadius: 50, label: 'D4' },
            { id: 'd5', kind: 'disk', center: { x: 91.8, y: -53 }, radius: 1, visualRadius: 50, label: 'D5' },
            { id: 'd6', kind: 'disk', center: { x: 91.8, y: 53 }, radius: 1, visualRadius: 50, label: 'D6' },
        ],
    },

    // ── 7_1 = T(7,2) ──────────────────────────────────────────────────
    // 7 crossings → 8 disks. Step-by-2 → 1,3,5,7,2,4,6 → heptagram.
    // R=121. Rib = 14 + 2π (§6.7)
    {
        id: 'pre-7_1',
        name: '7_1',
        diskSequence: ['d0', 'd1', 'd3', 'd5', 'd7', 'd2', 'd4', 'd6', 'd0'],
        chiralities: ['R', 'R', 'R', 'R', 'R', 'R', 'R', 'R', 'R'],
        color: '#FF4500',
        createdAt: 1735700008000,
        spritePos: '75% 50%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 0, y: 0 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: 0, y: 121 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: -94.6, y: 75.44 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: -117.97, y: -26.93 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: -52.5, y: -109.02 }, radius: 1, visualRadius: 50, label: 'D4' },
            { id: 'd5', kind: 'disk', center: { x: 52.5, y: -109.02 }, radius: 1, visualRadius: 50, label: 'D5' },
            { id: 'd6', kind: 'disk', center: { x: 117.97, y: -26.93 }, radius: 1, visualRadius: 50, label: 'D6' },
            { id: 'd7', kind: 'disk', center: { x: 94.6, y: 75.44 }, radius: 1, visualRadius: 50, label: 'D7' },
        ],
    },

    // ── 7_2 (7 crossings) ──────────────────────────────────────────────
    // Step-by-3 visiting: 1,4,7,3,6,2,5. R=121.
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
            { id: 'd1', kind: 'disk', center: { x: 0, y: 121 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: -94.6, y: 75.44 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: -117.97, y: -26.93 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: -52.5, y: -109.02 }, radius: 1, visualRadius: 50, label: 'D4' },
            { id: 'd5', kind: 'disk', center: { x: 52.5, y: -109.02 }, radius: 1, visualRadius: 50, label: 'D5' },
            { id: 'd6', kind: 'disk', center: { x: 117.97, y: -26.93 }, radius: 1, visualRadius: 50, label: 'D6' },
            { id: 'd7', kind: 'disk', center: { x: 94.6, y: 75.44 }, radius: 1, visualRadius: 50, label: 'D7' },
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
            { id: 'd1', kind: 'disk', center: { x: 0, y: 121 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: -94.6, y: 75.44 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: -117.97, y: -26.93 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: -52.5, y: -109.02 }, radius: 1, visualRadius: 50, label: 'D4' },
            { id: 'd5', kind: 'disk', center: { x: 52.5, y: -109.02 }, radius: 1, visualRadius: 50, label: 'D5' },
            { id: 'd6', kind: 'disk', center: { x: 117.97, y: -26.93 }, radius: 1, visualRadius: 50, label: 'D6' },
            { id: 'd7', kind: 'disk', center: { x: 94.6, y: 75.44 }, radius: 1, visualRadius: 50, label: 'D7' },
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
            { id: 'd1', kind: 'disk', center: { x: 0, y: 121 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: -94.6, y: 75.44 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: -117.97, y: -26.93 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: -52.5, y: -109.02 }, radius: 1, visualRadius: 50, label: 'D4' },
            { id: 'd5', kind: 'disk', center: { x: 52.5, y: -109.02 }, radius: 1, visualRadius: 50, label: 'D5' },
            { id: 'd6', kind: 'disk', center: { x: 117.97, y: -26.93 }, radius: 1, visualRadius: 50, label: 'D6' },
            { id: 'd7', kind: 'disk', center: { x: 94.6, y: 75.44 }, radius: 1, visualRadius: 50, label: 'D7' },
        ],
    },

    // ── 7_5 (7 crossings) ──────────────────────────────────────────────
    {
        id: 'pre-7_5',
        name: '7_5',
        diskSequence: ['d0', 'd1', 'd5', 'd3', 'd7', 'd4', 'd2', 'd6', 'd0'],
        chiralities: ['L', 'L', 'R', 'L', 'R', 'L', 'R', 'L', 'R'],
        color: '#FF4500',
        createdAt: 1735700012000,
        spritePos: '50% 100%',
        blocks: [
            { id: 'd0', kind: 'disk', center: { x: 0, y: 0 }, radius: 1, visualRadius: 50, label: 'D0' },
            { id: 'd1', kind: 'disk', center: { x: 0, y: 121 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: -94.6, y: 75.44 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: -117.97, y: -26.93 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: -52.5, y: -109.02 }, radius: 1, visualRadius: 50, label: 'D4' },
            { id: 'd5', kind: 'disk', center: { x: 52.5, y: -109.02 }, radius: 1, visualRadius: 50, label: 'D5' },
            { id: 'd6', kind: 'disk', center: { x: 117.97, y: -26.93 }, radius: 1, visualRadius: 50, label: 'D6' },
            { id: 'd7', kind: 'disk', center: { x: 94.6, y: 75.44 }, radius: 1, visualRadius: 50, label: 'D7' },
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
            { id: 'd1', kind: 'disk', center: { x: 0, y: 121 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: -94.6, y: 75.44 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: -117.97, y: -26.93 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: -52.5, y: -109.02 }, radius: 1, visualRadius: 50, label: 'D4' },
            { id: 'd5', kind: 'disk', center: { x: 52.5, y: -109.02 }, radius: 1, visualRadius: 50, label: 'D5' },
            { id: 'd6', kind: 'disk', center: { x: 117.97, y: -26.93 }, radius: 1, visualRadius: 50, label: 'D6' },
            { id: 'd7', kind: 'disk', center: { x: 94.6, y: 75.44 }, radius: 1, visualRadius: 50, label: 'D7' },
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
            { id: 'd1', kind: 'disk', center: { x: 0, y: 121 }, radius: 1, visualRadius: 50, label: 'D1' },
            { id: 'd2', kind: 'disk', center: { x: -94.6, y: 75.44 }, radius: 1, visualRadius: 50, label: 'D2' },
            { id: 'd3', kind: 'disk', center: { x: -117.97, y: -26.93 }, radius: 1, visualRadius: 50, label: 'D3' },
            { id: 'd4', kind: 'disk', center: { x: -52.5, y: -109.02 }, radius: 1, visualRadius: 50, label: 'D4' },
            { id: 'd5', kind: 'disk', center: { x: 52.5, y: -109.02 }, radius: 1, visualRadius: 50, label: 'D5' },
            { id: 'd6', kind: 'disk', center: { x: 117.97, y: -26.93 }, radius: 1, visualRadius: 50, label: 'D6' },
            { id: 'd7', kind: 'disk', center: { x: 94.6, y: 75.44 }, radius: 1, visualRadius: 50, label: 'D7' },
        ],
    },
];
