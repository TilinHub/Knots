import type { CSDisk } from '../src/core/types/cs';
import { convertDisksToDiagram } from '../src/features/editor/utils/diagramAdapter';
import { analyzeDiagram } from '../src/features/analysis/first_variation/analyzer';
import * as matrices from '../src/features/analysis/first_variation/matrices';
import * as gaugeLib from '../src/features/analysis/first_variation/gauge';
import * as checks from '../src/features/analysis/first_variation/checks';
import * as func from '../src/features/analysis/first_variation/functional';
import * as fs from 'fs';

// Mock CSDisk
const createDisk = (id: string, x: number, y: number): CSDisk =>
  ({
    id,
    center: { x, y },
    visualRadius: 1.0, // Scale 1
    kind: 'disk',
    radius: 1.0,
  }) as any;

const disks = [createDisk('0', 0, 0), createDisk('1', 2.0, 0), createDisk('2', 3.72744, 1.01694)];

// Helper to log to file
const logStream = fs.createWriteStream('debug_output.txt');
const log = (msg: any) => {
  console.log(msg);
  logStream.write(msg + '\n');
};

log('--- Converting Diagram ---');
const diagram = convertDisksToDiagram(disks);

if (diagram) {
  log('--- Running Analysis ---');
  // Helper to print matrix
  const pMat = (name: string, m: any) => {
    log(`--- ${name} (${m.rows}x${m.cols}) ---`);
    for (let r = 0; r < m.rows; r++) {
      let rowStr = '';
      for (let c = 0; c < m.cols; c++) {
        rowStr += m.get(r, c).toFixed(4) + '\t';
      }
      log(rowStr.trim());
    }
  };

  const A = matrices.constructA(diagram);
  pMat('A', A);

  log('--- Disks ---');
  diagram.disks.forEach((d) =>
    log(`D${d.index}: (${d.center.x.toFixed(4)}, ${d.center.y.toFixed(4)})`),
  );

  log('--- Segments ---');
  const tRes = checks.checkAndComputeTangents(diagram);
  diagram.segments.forEach((s) => {
    const d1 = diagram.disks[parseInt(s.startTangencyId.split('-')[1])];
    const d2 = diagram.disks[parseInt(s.endTangencyId.split('-')[1])];

    const pAlpha = tRes.tangents[s.startTangencyId];
    // Wait, tRes.tangents is the VECTOR t_alpha?
    // functional uses tangent POINT from diagram logic?
    // functional uses: const pAlpha = tAlpha.point;
    // The tangent vector T_alpha is from tMap.
    // Let's stick to functional logic.
    const tObjA = diagram.tangencies.find((t) => t.id === s.startTangencyId)!;
    const tObjB = diagram.tangencies.find((t) => t.id === s.endTangencyId)!;

    const pA = tObjA.point;
    const pB = tObjB.point;
    const vec = { x: pB.x - pA.x, y: pB.y - pA.y };
    log(
      `Seg ${s.startTangencyId}->${s.endTangencyId}: P(${pA.x.toFixed(2)},${pA.y.toFixed(2)})->P(${pB.x.toFixed(2)},${pB.y.toFixed(2)}) Vec(${vec.x.toFixed(2)},${vec.y.toFixed(2)})`,
    );

    // Force on Beta (End Disk): +Vec
    if (tObjB.diskIndex === 1) {
      log(`  -> Force on D1 (Beta): +(${vec.x.toFixed(2)}, ${vec.y.toFixed(2)})`);
    }
    // Force on Alpha (Start Disk): -Vec
    if (tObjA.diskIndex === 1) {
      log(`  -> Force on D1 (Alpha): -(${vec.x.toFixed(2)}, ${vec.y.toFixed(2)})`);
    }
  });

  const U_roll = matrices.getRoll(diagram);
  pMat('U_roll', U_roll);
  // Should be 2N - Rank(A) = 6 - 2 = 4

  const gauge = gaugeLib.constructGaugeBasis(diagram, U_roll);
  pMat('Ug', gauge.Ug);
  // Should be 1

  // Check singular values of A or U_roll effectively?
  // U_roll should have 3 Rigid + 1 Internal = 4 dims?
  // Matrix size 2N = 6. Constraints = 2. Dim(Ker) = 4.

  const report = analyzeDiagram(diagram);
  if (report.criticality) {
    // Note: analyzeDiagram doesn't export g_red in interface typically,
    // assuming I need to reconstruct it or cast.
    // Let's assume I can't access it easily, so I'll reconstruct it here.

    // Re-compute g_red locally using imported modules
    const tRes = checks.checkAndComputeTangents(diagram);
    const Tc = matrices.constructTc(diagram, tRes.tangents);
    const { gc, gw } = func.assembleFunctional(diagram, tRes.tangents);
    const gred = func.reduceFunctional(gc, gw, Tc);

    pMat('g_red', gred);

    // r
    const r = gauge.Ug.transpose().multiply(gred);
    pMat('r', r);
  }
  log('--- Report ---');
  log(`Is Critical: ${report.criticality?.isCritical}`);
  log(`Ratio: ${report.criticality?.ratio}`);
  log(`Norm R: ${report.criticality?.normR}`);
  log(`Norm Gred: ${report.criticality?.normGred}`);
  logStream.end();
} else {
  log('Failed to convert diagram');
  logStream.end();
}
