import parseGraph6, { type Graph } from "./parseGraph6";

export type GraphSet = { label: string; graphs: Graph[] };

export default async function loadAllGraphs(): Promise<GraphSet[]> {
  const urlBase = "/data/"; // apunta a public/data
  const graphSets: GraphSet[] = [];

  const contactNumbers = [3, 4, 5, 6, 7, 8, 9, 10];

  for (const num of contactNumbers) {
    const url = `${urlBase}graphs${num}.txt`;
    const txt = await fetch(url).then((r) => r.text());
    const codes = txt.split(/\s+/).filter(Boolean);
    const graphs = codes.map(parseGraph6);
    graphSets.push({ label: `${num} discos`, graphs });
  }

  // extra de 8 discos
  try {
    const url = `${urlBase}graphs8_extra.txt`;
    const txt = await fetch(url).then((r) => r.text());
    const codes = txt.split(/\s+/).filter(Boolean);
    const graphs = codes.map(parseGraph6);
    graphSets.push({ label: "11 que faltaban (8 discos)", graphs });
  } catch {
    // opcional
  }

  return graphSets;
}
