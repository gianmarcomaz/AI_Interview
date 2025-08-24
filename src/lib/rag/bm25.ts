import elasticlunr from "elasticlunr";

export type FactDoc = { id: string; text: string };

// Minimal shape of an elasticlunr search hit
type SearchHit = { ref: string; score?: number; matchData?: unknown };

export function buildIndex(docs: FactDoc[]) {
  // Build index
  const idx = (elasticlunr as any)(function (this: any) {
    this.addField("text");
    this.setRef("id");
  });
  docs.forEach((d) => idx.addDoc(d));

  return (q: string, k = 3): FactDoc[] => {
    const hits = idx.search(q, { expand: true }) as SearchHit[];

    return hits
      .slice(0, k)
      .map((hit: SearchHit) => docs.find((d) => d.id === hit.ref) ?? null)
      // Narrow nulls away so return type is FactDoc[]
      .filter((d): d is FactDoc => d !== null);
  };
}
