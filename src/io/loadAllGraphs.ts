import parseGraph6, { type Graph } from "./parseGraph6";

export type GraphSet = { label: string; graphs: Graph[] };

export default async function loadAllGraphs(): Promise<GraphSet[]> {
  // Use Vite's base URL (e.g., '/Knots/') to construct correct path
  const urlBase = import.meta.env.BASE_URL + "data/";
  const graphSets: GraphSet[] = [];

  const contactNumbers = [3, 4, 5, 6, 7, 8, 9, 10];

  for (const num of contactNumbers) {
    const url = `${urlBase}graphs${num}.txt`;
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Failed to fetch ${url}: ${response.status}`);
      continue;
    }
    const txt = await response.text();
    // Validate content - Graph6 files shouldn't start with <!DOCTYPE html
    if (txt.trim().startsWith("<!DOCTYPE") || txt.trim().startsWith("<html")) {
      console.warn(`Fetch returned HTML instead of data for ${url}. Path might be wrong.`);
      continue;
    }

    const codes = txt.split(/\s+/).filter(Boolean);
    const graphs = codes.map(parseGraph6);
    graphSets.push({ label: `${num} discos`, graphs });
  }

  // extra de 8 discos
  try {
    const url = `${urlBase}graphs8_extra.txt`;
    const response = await fetch(url);
    if (response.ok) {
      const txt = await response.text();
      if (!txt.trim().startsWith("<!DOCTYPE") && !txt.trim().startsWith("<html")) {
        const codes = txt.split(/\s+/).filter(Boolean);
        const graphs = codes.map(parseGraph6);
        graphSets.push({ label: "11 que faltaban (8 discos)", graphs });
      }
    }
  } catch (e) {
    console.warn("Failed to load extra graphs:", e);
  }

  return graphSets;
}
