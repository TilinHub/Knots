/**
 * loadRibbonKnots.ts
 *
 * Loads ribbon-knot .txt files produced by TilinHub/Knot-Generator
 * and returns typed RibbonKnot arrays.
 *
 * File layout expected under public/data/:
 *   all_knots.txt        — full catalogue
 *   torus.txt            — torus knots and links  T(p,2)
 *   twist.txt            — twist knots (figure-eight, stevedore…)
 *   classic.txt          — unknot, Whitehead link…
 *   alternating.txt      — alternating knots
 *
 * Each file follows the knot_ribbon_v1 format (see parseKnotTxt.ts).
 */

import parseKnotTxt, { type RibbonKnot } from './parseKnotTxt';

export type RibbonKnotSet = {
  /** category label ("torus", "twist", "classic", "alternating", "all") */
  label: string;
  knots: RibbonKnot[];
};

const CATEGORIES = ['torus', 'twist', 'classic', 'alternating'] as const;

/**
 * Load all per-category .txt files.
 * Uses Vite's BASE_URL so it works on GitHub Pages and localhost alike.
 */
export async function loadRibbonKnots(): Promise<RibbonKnotSet[]> {
  const base = import.meta.env.BASE_URL + 'data/';
  const sets: RibbonKnotSet[] = [];

  for (const cat of CATEGORIES) {
    const url = `${base}${cat}.txt`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`[loadRibbonKnots] ${url} → ${res.status}`);
        continue;
      }
      const txt = await res.text();
      if (txt.trimStart().startsWith('<!DOCTYPE') || txt.trimStart().startsWith('<html')) {
        console.warn(`[loadRibbonKnots] ${url} returned HTML (wrong path?)`);
        continue;
      }
      const knots = parseKnotTxt(txt);
      if (knots.length > 0) sets.push({ label: cat, knots });
    } catch (e) {
      console.warn(`[loadRibbonKnots] failed to load ${url}:`, e);
    }
  }

  return sets;
}

/**
 * Load a single flat array of all knots from all_knots.txt.
 * Convenient when you don't need per-category grouping.
 */
export async function loadAllRibbonKnots(): Promise<RibbonKnot[]> {
  const url = import.meta.env.BASE_URL + 'data/all_knots.txt';
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[loadAllRibbonKnots] ${url} → ${res.status}`);
      return [];
    }
    const txt = await res.text();
    return parseKnotTxt(txt);
  } catch (e) {
    console.warn('[loadAllRibbonKnots] failed:', e);
    return [];
  }
}
