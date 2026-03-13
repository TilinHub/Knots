/**
 * parseKnotTxt.ts
 *
 * Parser for the compact .txt ribbon-knot format produced by TilinHub/Knot-Generator.
 *
 * Format spec (one data line per knot, fields separated by single spaces):
 *
 *   name alias type n_disks contacts disk_positions core_length ribbonlength rib_formula rib_section
 *
 * Field details
 * -------------
 *   name           string identifier  (no spaces)
 *   alias          standard notation  e.g. 3_1  L2a1  T(3,2)
 *   type           "knot" | "link"
 *   n_disks        integer | "null"
 *   contacts       comma-separated i-j pairs  e.g. 0-1,0-2,0-3
 *                  OR "null" (unknot has no contact pairs)
 *   disk_positions semicolon-separated x:y pairs  e.g. 0.0:0.0;0.0:2.0;...
 *                  OR "null"
 *   core_length    decimal (10 sig figs) | "null"
 *   ribbonlength   decimal (10 sig figs) | "null"   Rib(γ) = core_length / 2
 *   rib_formula    ascii closed-form e.g. 6+2pi  4+2pi  open  (pi = π)
 *   rib_section    section of arXiv:2005.13168 e.g. s6.1  s6.2  "null"
 *
 * Comment lines (starting with #) are ignored.
 *
 * Mathematical precision
 * ----------------------
 * Disk coordinates are given to 10 significant figures.
 * For the T(p,2) family (§6.7 of arXiv:2005.13168) the exact values are:
 *   D_0  = (0, 0)
 *   D_i  = (2·cos(2πi/p),  2·sin(2πi/p))   i = 1…p
 * e.g. trefoil (p=3):
 *   D_1 = (0, 2),  D_2 = (-√3, -1),  D_3 = (√3, -1)
 *   √3 ≈ 1.7320508076  (10 sig figs)
 *
 * Segment-length formula between two disk centres a, b  (Theorem 4.1):
 *   d = |a - b|
 *   if d ≤ 2:  L_seg = π                           (tangent disks)
 *   if d > 2:  L_seg = 2·(π/2 + arcsin((d-2)/2)) + √(d²-4)
 */

export interface DiskCentre {
  x: number;
  y: number;
}

export interface RibbonKnot {
  /** identifier string, no spaces */
  name: string;
  /** standard notation: 3_1, L2a1, T(3,2) … */
  alias: string;
  /** topological type */
  type: 'knot' | 'link';
  /** number of unit disks (= bounded complementary regions of the diagram) */
  nDisks: number | null;
  /**
   * Contact pairs [i, j]: the core has a cs-arc from D_i to D_j.
   * Pairs follow traversal order of the core γ.
   */
  contacts: [number, number][];
  /**
   * Centres of the unit disks (radius always 1).
   * D_0 is the central disk at index 0.
   */
  disks: DiskCentre[];
  /**
   * Total length |γ| of the core curve.
   * Exact value proved in §6 of arXiv:2005.13168.
   * null = open problem (e.g. figure-eight knot 4_1).
   */
  coreLength: number | null;
  /**
   * Rib(γ) = |γ| / 2  (ribbon width normalised to 2, Definition 1.1).
   * null = open problem.
   */
  ribbonLength: number | null;
  /** Closed-form formula string, π written as "pi", e.g. "6+2pi" */
  ribFormula: string;
  /** Section of arXiv:2005.13168 where the value is proved, e.g. "s6.2" */
  ribSection: string | null;
}

/**
 * Length of the cs-arc of the core between disk centres a and b.
 *
 * Implements Theorem 4.1 of arXiv:2005.13168:
 *   - Tangent disks (d ≤ 2): two quarter-circle arcs, no straight part → L = π
 *   - Non-tangent (d > 2):  L = 2·arc + straight
 *     where arc   = π/2 + arcsin((d-2)/2)
 *           straight = √(d²-4)
 */
export function segmentLength(a: DiskCentre, b: DiskCentre): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d <= 2 + 1e-10) return Math.PI;
  const straight = Math.sqrt(d * d - 4);
  const arcEach = Math.PI / 2 + Math.asin((d - 2) / 2);
  return 2 * arcEach + straight;
}

/**
 * Recompute core length from disk positions and contact list.
 * Useful for verifying loaded data against the paper's proved values.
 */
export function computeCoreLength(
  disks: DiskCentre[],
  contacts: [number, number][],
): number {
  return contacts.reduce((sum, [i, j]) => sum + segmentLength(disks[i], disks[j]), 0);
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

function parseNullable(s: string): number | null {
  return s === 'null' ? null : parseFloat(s);
}

function parseContacts(s: string): [number, number][] {
  if (s === 'null' || s === '') return [];
  return s.split(',').map((pair) => {
    const [a, b] = pair.split('-').map(Number);
    return [a, b] as [number, number];
  });
}

function parseDisks(s: string): DiskCentre[] {
  if (s === 'null' || s === '') return [];
  return s.split(';').map((xy) => {
    const [x, y] = xy.split(':').map(parseFloat);
    return { x, y };
  });
}

/**
 * Parse a single data line into a RibbonKnot.
 * Throws if the line has fewer than 10 fields.
 */
export function parseKnotLine(line: string): RibbonKnot {
  const fields = line.trim().split(' ');
  if (fields.length < 10) {
    throw new Error(
      `parseKnotLine: expected ≥10 fields, got ${fields.length}: "${line}"`
    );
  }

  const [name, alias, type, nDisksRaw, contacts, diskPos,
         coreLenRaw, ribLenRaw, ribFormula, ribSection] = fields;

  return {
    name,
    alias,
    type: type as 'knot' | 'link',
    nDisks: nDisksRaw === 'null' ? null : parseInt(nDisksRaw, 10),
    contacts: parseContacts(contacts),
    disks: parseDisks(diskPos),
    coreLength: parseNullable(coreLenRaw),
    ribbonLength: parseNullable(ribLenRaw),
    ribFormula,
    ribSection: ribSection === 'null' ? null : ribSection,
  };
}

/**
 * Parse the full content of a .txt file into an array of RibbonKnot.
 * Skips comment lines (starting with #) and blank lines.
 */
export function parseKnotTxt(content: string): RibbonKnot[] {
  const knots: RibbonKnot[] = [];
  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    try {
      knots.push(parseKnotLine(line));
    } catch (e) {
      console.warn('[parseKnotTxt]', e);
    }
  }
  return knots;
}

export default parseKnotTxt;
