/**
 * Matrix Construction for CS Diagram Protocol
 * Sections 2.7, 2.8, 2.9
 */

import type { CSDiagram } from './types';
import { Matrix, nullspace } from './linearAlgebra';
import { sub, normalize, calculateNormal, calculateArcTangent, dist } from './geometry';
import { checkAndComputeTangents } from './checks';

/**
 * 2.7 Construccion de A(c)
 * Rows: |E| contacts
 * Cols: 2N (centers)
 */
export function constructA(diagram: CSDiagram): Matrix {
    const { disks, contacts } = diagram;
    const N = disks.length;
    const A = Matrix.zeros(contacts.length, 2 * N);

    contacts.forEach((contact, rowIndex) => {
        const i = contact.diskA;
        const j = contact.diskB;
        const ci = disks[i].center;
        const cj = disks[j].center;

        // Vector unitario de contacto u_ij
        // uij := (ci - cj) / ||ci - cj||
        // Note: If reusing standard lib, ensure indices match.
        // disks are 0-indexed here.
        const diff = sub(ci, cj);
        const uij = normalize(diff);

        // Row layout:
        // Block at cols for i (2*i, 2*i+1): uij^T
        // Block at cols for j (2*j, 2*j+1): -uij^T

        A.set(rowIndex, 2 * i, uij.x);
        A.set(rowIndex, 2 * i + 1, uij.y);

        A.set(rowIndex, 2 * j, -uij.x);
        A.set(rowIndex, 2 * j + 1, -uij.y);
    });

    return A;
}

/**
 * 2.8 Construccion de Tc(c)
 * Rows: |T| tangencies
 * Cols: 2N (centers)
 */
export function constructTc(diagram: CSDiagram, tangentsMap?: Record<string, { x: number, y: number }>): Matrix {
    const { disks, tangencies } = diagram;
    const N = disks.length;
    const Tc = Matrix.zeros(tangencies.length, 2 * N);

    // If tangents not provided, compute them (without strictly checking, or assume valid)
    // Ideally checks passed before.
    let tMap = tangentsMap;
    if (!tMap) {
        const res = checkAndComputeTangents(diagram);
        tMap = res.tangents;
    }

    tangencies.forEach((t, rowIndex) => {
        // Tangency alpha corresponds to row index (in implicit order of diagram.tangencies)
        const k = t.diskIndex;
        const tVector = tMap[t.id];
        if (!tVector) throw new Error(`Tangent vector not found for ${t.id}`);

        // Block t_alpha^T at cols 2k, 2k+1
        Tc.set(rowIndex, 2 * k, tVector.x);
        Tc.set(rowIndex, 2 * k + 1, tVector.y);
    });

    return Tc;
}

/**
 * 2.9 Operador Lineal Completo L(c)
 * Block Matrix:
 * [ A(c)    0   ]
 * [ Tc(c)  I_|T| ]
 */
export function constructL(diagram: CSDiagram, A: Matrix, Tc: Matrix): Matrix {
    const numContacts = diagram.contacts.length;
    const numTangencies = diagram.tangencies.length;
    const N = diagram.disks.length;

    const totalRows = numContacts + numTangencies;
    const totalCols = 2 * N + numTangencies;

    const L = Matrix.zeros(totalRows, totalCols);

    // Copy A into top-left
    // Rows 0..|E|-1, Cols 0..2N-1
    for (let r = 0; r < A.rows; r++) {
        for (let c = 0; c < A.cols; c++) {
            L.set(r, c, A.get(r, c));
        }
    }

    // Copy Tc into bottom-left
    // Rows |E|..|E|+|T|-1, Cols 0..2N-1
    for (let r = 0; r < Tc.rows; r++) {
        for (let c = 0; c < Tc.cols; c++) {
            L.set(numContacts + r, c, Tc.get(r, c));
        }
    }

    // Copy I_|T| into bottom-right
    // Rows |E|..|E|+|T|-1, Cols 2N..2N+|T|-1
    // Identity matrix for omega part
    for (let i = 0; i < numTangencies; i++) {
        L.set(numContacts + i, 2 * N + i, 1.0);
    }

    return L;
}

export function getRoll(diagram: CSDiagram): Matrix {
    const A = constructA(diagram);
    return nullspace(A, diagram.tolerances.lin);
}

export function getKerL(diagram: CSDiagram): Matrix {
    const A = constructA(diagram);
    const Tc = constructTc(diagram);
    const L = constructL(diagram, A, Tc);
    return nullspace(L, diagram.tolerances.lin);
}
