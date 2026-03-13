import fs from 'fs';

const knots = [
  { name: 'Unknot', crossings: 3, id: 'unknot', col: 0, row: 0 },
  { name: '3_1', crossings: 3, id: '3_1', col: 1, row: 0 },
  { name: '4_1', crossings: 4, id: '4_1', col: 2, row: 0 },
  { name: '5_1', crossings: 5, id: '5_1', col: 3, row: 0 },
  { name: '5_2', crossings: 5, id: '5_2', col: 4, row: 0 },
  { name: '6_1', crossings: 6, id: '6_1', col: 0, row: 1 },
  { name: '6_2', crossings: 6, id: '6_2', col: 1, row: 1 },
  { name: '6_3', crossings: 6, id: '6_3', col: 2, row: 1 },
  { name: '7_1', crossings: 7, id: '7_1', col: 3, row: 1 },
  { name: '7_2', crossings: 7, id: '7_2', col: 4, row: 1 },
  { name: '7_3', crossings: 7, id: '7_3', col: 0, row: 2 },
  { name: '7_4', crossings: 7, id: '7_4', col: 1, row: 2 },
  { name: '7_5', crossings: 7, id: '7_5', col: 2, row: 2 },
  { name: '7_6', crossings: 7, id: '7_6', col: 3, row: 2 },
  { name: '7_7', crossings: 7, id: '7_7', col: 4, row: 2 },
];

let out = `import type { SavedKnot } from '../../editor/hooks/useEditorState';\n\n`;
out += `export const PRELOADED_KNOTS: SavedKnot[] = [\n`;

knots.forEach((k, i) => {
  const N = k.crossings;
  const seq = Array.from({length: N}, (_, j) => 'd' + j);
  const chir = Array.from({length: N}, () => 'L');
  const blocks = seq.map((id, j) => {
    const angle = (Math.PI * 2 * j) / N;
    const x = Math.round(Math.cos(angle) * 133.3 * 10) / 10;
    const y = Math.round(Math.sin(angle) * 133.3 * 10) / 10;
    return `{ id: '${id}', kind: 'disk', center: { x: ${x}, y: ${y} }, radius: 1, visualRadius: 50, label: 'D${j}' }`;
  });

  out += `    {
        id: 'pre-${k.id}',
        name: '${k.name}',
        diskSequence: [${seq.map(s => `'${s}'`).join(', ')}],
        chiralities: [${chir.map(s => `'${s}'`).join(', ')}],
        color: '#FF4500',
        createdAt: ${1735700000000 + i * 1000},
        spritePos: '${k.col * 25}% ${k.row * 50}%',
        blocks: [
            ${blocks.join(',\n            ')}
        ]
    },\n`;
});

out += `];\n`;
fs.writeFileSync('src/features/gallery/logic/preloaded.ts', out);
