// Simple TF cosine similarity over tokens
function toks(s:string){ return s.toLowerCase().match(/[a-z0-9]+/g) ?? []; }

export function cosineSim(a: string, b: string) {
  const A = toks(a), B = toks(b);
  const map = new Map<string, [number, number]>();
  A.forEach(t => map.set(t, [ (map.get(t)?.[0] ?? 0)+1, map.get(t)?.[1] ?? 0 ]));
  B.forEach(t => map.set(t, [ map.get(t)?.[0] ?? 0, (map.get(t)?.[1] ?? 0)+1 ]));
  let dot=0, na=0, nb=0;
  for (const [x,y] of map.values()){ dot += x*y; na += x*x; nb += y*y; }
  return na && nb ? dot / (Math.sqrt(na)*Math.sqrt(nb)) : 0;
}


