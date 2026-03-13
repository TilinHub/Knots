import fs from 'fs';

const knotsData = [
  { name: 'Unknot', seq: [0, 1, 2, 3], col: 0, row: 0 },
  { name: '3_1', seq: [0, 3, 1, 4, 2, 5], col: 1, row: 0 },
  { name: '4_1', seq: [0, 4, 1, 5, 2, 6, 3, 7], col: 2, row: 0 },
  { name: '5_1', seq: [0, 2, 4, 1, 3], col: 3, row: 0 },
  { name: '5_2', seq: [0, 3, 6, 2, 5, 1, 4], col: 4, row: 0 },
  { name: '6_1', seq: [0, 2, 4, 6, 8, 1, 3, 5, 7], col: 0, row: 1 },
  { name: '6_2', seq: [0, 3, 6, 1, 4, 7, 2, 5], col: 1, row: 1 },
  { name: '6_3', seq: [0, 3, 6, 9, 2, 5, 8, 1, 4, 7], col: 2, row: 1 },
  { name: '7_1', seq: [0, 2, 4, 6, 1, 3, 5], col: 3, row: 1 },
  { name: '7_2', seq: [0, 3, 6, 1, 4, 7, 2, 5, 8], col: 4, row: 1 },
  { name: '7_3', seq: [0, 3, 6, 9, 1, 4, 7, 10, 2, 5, 8], col: 0, row: 2 },
  { name: '7_4', seq: [0, 4, 8, 2, 6, 1, 5, 9, 3, 7], col: 1, row: 2 },
  { name: '7_5', seq: [0, 4, 8, 1, 5, 9, 2, 6, 10, 3, 7], col: 2, row: 2 },
  { name: '7_6', seq: [0, 5, 10, 3, 8, 1, 6, 11, 4, 9, 2, 7], col: 3, row: 2 },
  { name: '7_7', seq: [0, 5, 10, 2, 7, 12, 4, 9, 1, 6, 11, 3, 8], col: 4, row: 2 }
];

let out = `import type { SavedKnot } from '../../editor/hooks/useEditorState';\n\n`;
out += `export const PRELOADED_KNOTS: SavedKnot[] = [\n`;

knotsData.forEach((k, i) => {
  const N = Math.max(...k.seq) + 1;
  const seqWithReturn = [...k.seq, k.seq[0]]; // Close the loop
  const strSeq = seqWithReturn.map(idx => `'d${idx}'`);
  const chir = seqWithReturn.map(() => "'L'");
  // We need the side length of the N-gon to be at least 110 (2 * visualRadius + padding)
  // Distance between adjacent vertices is 2 * radius * Math.sin(Math.PI / N)
  // So radius >= 55 / Math.sin(Math.PI / N)
  const minRequiredRadius = 60 / Math.sin(Math.PI / N);
  const radius = Math.max(130, minRequiredRadius); // Ensure at least 130 for small N
  
  const blocks = [];
  for (let j = 0; j < N; j++) {
      const angle = (Math.PI * 2 * j) / N;
      // Subtract Math.PI/2 to start from top
      const x = Math.round(Math.cos(angle - Math.PI / 2) * radius * 10) / 10;
      const y = Math.round(Math.sin(angle - Math.PI / 2) * radius * 10) / 10;
      blocks.push(`{ id: 'd${j}', kind: 'disk', center: { x: ${x}, y: ${y} }, radius: 1, visualRadius: 50, label: 'D${j}' }`);
  }

  const idName = k.name.toLowerCase() === 'unknot' ? 'unknot' : k.name;
  
  out += `    {
        id: 'pre-${idName}',
        name: '${k.name}',
        diskSequence: [${strSeq.join(', ')}],
        chiralities: [${chir.join(', ')}],
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
console.log('Successfully generated preloaded knots.');
