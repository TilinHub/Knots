/**
 * Contact Matrix Construction for CS Diagrams
 *
 * Implements A(c), Tc(c), L(c), Roll(c), and ker L(c) from the
 * CS diagram protocol (Sections 2.7 -- 2.9).
 *
 * The contact matrix A(c) encodes the linearised distance constraints
 * between touching disk pairs.  Together with the tangency operator
 * Tc(c) they form the full linear operator L(c) whose kernel
 * describes the admissible infinitesimal motions of the configuration.
 */

import { Matrix, nullspace } from './linearAlgebra';
import type { CSDiagram, Point, Vector } from './types';

// ----------------------------------------------------------------
// Vector helpers (local, to keep the module self-contained)
// ----------------------------------------------------------------

function sub(a: Point, b: Point): Vector {
  return { x: a.x - b.x, y: a.y - b.y };
}

function norm(v: Vector): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

function normalize(v: Vector): Vector {
  const n = norm(v);
  return n === 0 ? { x: 0, y: 0 } : { x: v.x / n, y: v.y / n };
}

function J(v: Vector): Vector {
  return { x: -v.y, y: v.x };
}

// ----------------------------------------------------------------
// Tangent computation (minimal, for internal use)
// ----------------------------------------------------------------

/**
 * Computes the tangent map t_alpha for every tangency in the diagram.
 * Uses the convention t_alpha = J(n_alpha) where n = p - c (unit normal).
 */
export function computeTangentMap(
  diagram: CSDiagram,
): Record<string, Vector> {
  const { disks, tangencies } = diagram;
  const tMap: Record<string, Vector> = {};

  for (const t of tangencies) {
    const disk = disks[t.diskIndex];
    const n = sub(t.point, disk.center);
    tMap[t.id] = J(n);
  }

  return tMap;
}

// ----------------------------------------------------------------
// A(c) -- Contact matrix
// ----------------------------------------------------------------

/**
 * Section 2.7 -- Construct A(c).
 *
 * Rows: |E| contacts.  Cols: 2N (center coordinates).
 * Each row encodes the linearised constraint  u_ij^T (delta c_i - delta c_j) = 0
 * where u_ij is the unit vector from c_j to c_i.
 */
export function constructA(diagram: CSDiagram): Matrix {
  const { disks } = diagram;
  const contacts = diagram.contacts || [];
  const N = disks.length;
  const A = Matrix.zeros(contacts.length, 2 * N);

  contacts.forEach((contact, rowIndex) => {
    const i = contact.diskA;
    const j = contact.diskB;
    const uij = normalize(sub(disks[i].center, disks[j].center));

    A.set(rowIndex, 2 * i, uij.x);
    A.set(rowIndex, 2 * i + 1, uij.y);
    A.set(rowIndex, 2 * j, -uij.x);
    A.set(rowIndex, 2 * j + 1, -uij.y);
  });

  return A;
}

// ----------------------------------------------------------------
// Tc(c) -- Tangency matrix
// ----------------------------------------------------------------

/**
 * Section 2.8 -- Construct Tc(c).
 *
 * Rows: |T| tangencies.  Cols: 2N (center coordinates).
 * Each row places the tangent vector t_alpha^T at the columns of disk k(alpha).
 */
export function constructTc(
  diagram: CSDiagram,
  tangentsMap?: Record<string, Vector>,
): Matrix {
  const { disks } = diagram;
  const tangencies = diagram.tangencies || [];
  const N = disks.length;
  const Tc = Matrix.zeros(tangencies.length, 2 * N);

  const tMap = tangentsMap ?? computeTangentMap(diagram);

  tangencies.forEach((t, rowIndex) => {
    const k = t.diskIndex;
    const tVector = tMap[t.id];
    if (!tVector) throw new Error(`Tangent vector not found for ${t.id}`);

    Tc.set(rowIndex, 2 * k, tVector.x);
    Tc.set(rowIndex, 2 * k + 1, tVector.y);
  });

  return Tc;
}

// ----------------------------------------------------------------
// Tw(c) -- Tangency omega block (identity)
// ----------------------------------------------------------------

/**
 * The omega block in L(c) is simply I_{|T|}.
 */
export function constructTw(diagram: CSDiagram): Matrix {
  const numTangencies = diagram.tangencies?.length || 0;
  return Matrix.identity(numTangencies);
}

// ----------------------------------------------------------------
// L(c) -- Full linear operator
// ----------------------------------------------------------------

/**
 * Section 2.9 -- Full block operator L(c).
 *
 *   L(c) = [ A(c)    0     ]
 *          [ Tc(c)   I_{|T|} ]
 *
 * Rows: |E| + |T|.  Cols: 2N + |T|.
 */
export function constructL(diagram: CSDiagram, A: Matrix, Tc: Matrix): Matrix {
  const numContacts = diagram.contacts?.length || 0;
  const numTangencies = diagram.tangencies?.length || 0;
  const N = diagram.disks.length;

  const totalRows = numContacts + numTangencies;
  const totalCols = 2 * N + numTangencies;

  const L = Matrix.zeros(totalRows, totalCols);

  // Top-left: A(c)
  for (let r = 0; r < A.rows; r++) {
    for (let c = 0; c < A.cols; c++) {
      L.set(r, c, A.get(r, c));
    }
  }

  // Bottom-left: Tc(c)
  for (let r = 0; r < Tc.rows; r++) {
    for (let c = 0; c < Tc.cols; c++) {
      L.set(numContacts + r, c, Tc.get(r, c));
    }
  }

  // Bottom-right: I_{|T|}
  for (let i = 0; i < numTangencies; i++) {
    L.set(numContacts + i, 2 * N + i, 1.0);
  }

  return L;
}

// ----------------------------------------------------------------
// Roll(c) and ker L(c)
// ----------------------------------------------------------------

/**
 * Roll(c) = ker A(c).
 * Returns a Matrix whose columns form an orthonormal basis of the kernel.
 */
export function getRoll(diagram: CSDiagram): Matrix {
  const A = constructA(diagram);
  return nullspace(A, diagram.tolerances.lin);
}

/**
 * ker L(c) -- full kernel including omega components.
 */
export function getKerL(diagram: CSDiagram): Matrix {
  const A = constructA(diagram);
  const Tc = constructTc(diagram);
  const L = constructL(diagram, A, Tc);
  return nullspace(L, diagram.tolerances.lin);
}

// ----------------------------------------------------------------
// Jacobian from raw disk arrays (envelope / contact-graph layer)
// ----------------------------------------------------------------

export interface ContactInfo {
  index1: number;
  index2: number;
  point: { x: number; y: number };
  normal: { x: number; y: number };
}

/**
 * Builds the contact Jacobian matrix directly from an array of disks
 * with variable radii.  This is the lower-level variant used by the
 * envelope/contact-graph code (contactGraph.ts).
 *
 * Unlike constructA which works with the CSDiagram protocol (unit
 * disks, explicit contact list), this function auto-detects contacts
 * via pairwise distance and works with arbitrary radii.
 */
export function calculateJacobianMatrix(
  disks: { center: { x: number; y: number }; radius: number }[],
): { matrix: number[][]; contacts: ContactInfo[] } {
  const contacts: ContactInfo[] = [];
  const n = disks.length;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d1 = disks[i];
      const d2 = disks[j];
      const dx = d2.center.x - d1.center.x;
      const dy = d2.center.y - d1.center.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const rSum = d1.radius + d2.radius;

      const contactTolerance = rSum * 0.01;
      if (Math.abs(dist - rSum) < contactTolerance || dist < rSum) {
        const normal = { x: dx / dist, y: dy / dist };
        const point = {
          x: d1.center.x + normal.x * d1.radius,
          y: d1.center.y + normal.y * d1.radius,
        };
        contacts.push({ index1: i, index2: j, point, normal });
      }
    }
  }

  const numContacts = contacts.length;
  const numCoords = n * 2;
  const matrix: number[][] = [];
  for (let k = 0; k < numContacts; k++) {
    matrix[k] = new Array(numCoords).fill(0);
  }

  contacts.forEach((contact, rowIdx) => {
    const i = contact.index1;
    const j = contact.index2;
    const nx = contact.normal.x;
    const ny = contact.normal.y;

    matrix[rowIdx][2 * i] = -nx;
    matrix[rowIdx][2 * i + 1] = -ny;
    matrix[rowIdx][2 * j] = nx;
    matrix[rowIdx][2 * j + 1] = ny;
  });

  return { matrix, contacts };
}
