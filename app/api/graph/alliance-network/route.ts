import { NextRequest, NextResponse } from "next/server";
import { isNeo4jConfigured, runQuery } from "@/lib/neo4j";
import { readFileSync } from "fs";
import path from "path";

let neo4jCache: Record<string, unknown> | null = null;
let jsonCache: Record<string, unknown> | null = null;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const includeRivalries = searchParams.get("rivalries") === "true";
  const includeBlocs = searchParams.get("blocs") === "true";
  const minSimilarity = parseFloat(searchParams.get("minSimilarity") || "0");

  try {
    // ─── Neo4j path (primary) ───────────────────────────────────────
    if (isNeo4jConfigured()) {
      // Cache the full dataset, filter client-side for params
      if (!neo4jCache) {
        const countryNodes = await runQuery<{
          iso3: string; name: string; region: string; idealPoint: number;
          population: number; scStatus: string; govEffectiveness: number | null;
        }>(`
          MATCH (c:Country)
          RETURN c.iso3 AS iso3, c.name AS name, c.region AS region,
                 c.idealPoint AS idealPoint, c.population AS population,
                 c.scStatus AS scStatus, c.govEffectiveness AS govEffectiveness
          ORDER BY c.name
        `);

        const allianceEdges = await runQuery<{
          source: string; target: string; similarity: number;
        }>(`
          MATCH (c1:Country)-[a:ALLIES_WITH]->(c2:Country)
          RETURN c1.iso3 AS source, c2.iso3 AS target, a.similarity AS similarity
        `);

        const rivalryEdges = await runQuery<{
          source: string; target: string; intensity: number;
        }>(`
          MATCH (c1:Country)-[r:RIVALS_WITH]->(c2:Country)
          RETURN c1.iso3 AS source, c2.iso3 AS target, r.intensity AS intensity
        `);

        neo4jCache = {
          nodes: countryNodes.map((n) => ({
            id: n.iso3,
            label: n.name,
            region: n.region,
            idealPoint: n.idealPoint,
            population: n.population,
            size: Math.max(2, Math.log10((n.population || 1000000) + 1) * 1.5),
            nodeType: "country",
            scStatus: n.scStatus === "P5" ? "P5" : undefined,
            govEffectiveness: n.govEffectiveness,
          })),
          alliances: allianceEdges.map((e) => ({
            source: e.source,
            target: e.target,
            weight: e.similarity,
            type: "ALLIES_WITH",
          })),
          rivalries: rivalryEdges.map((e) => ({
            source: e.source,
            target: e.target,
            weight: e.intensity,
            type: "RIVALS_WITH",
          })),
        };
      }

      const cache = neo4jCache as { nodes: unknown[]; alliances: { weight: number }[]; rivalries: unknown[] };
      let edges: unknown[] = [];

      if (includeRivalries) {
        edges = [
          ...cache.alliances.filter((e) => !minSimilarity || e.weight >= minSimilarity),
          ...(cache.rivalries as unknown[]),
        ];
      } else {
        edges = cache.alliances.filter((e) => !minSimilarity || e.weight >= minSimilarity);
      }

      return NextResponse.json({ nodes: cache.nodes, edges, source: "neo4j" });
    }

    // ─── JSON fallback (for local dev without Neo4j) ────────────────
    if (!jsonCache) {
      const filePath = path.join(process.cwd(), "data", "graph-viz.json");
      const raw = JSON.parse(readFileSync(filePath, "utf-8"));

      const nodes = raw.graph.nodes
        .filter((n: { attributes: { type: string } }) => n.attributes.type === "country")
        .map((n: { attributes: Record<string, unknown> }) => {
          const a = n.attributes;
          return {
            id: a.iso3, label: a.name, region: a.region,
            idealPoint: a.idealPoint, population: a.population,
            size: Math.max(2, Math.log10(((a.population as number) || 1000000) + 1) * 1.5),
            nodeType: "country",
            scStatus: ["USA", "GBR", "FRA", "RUS", "CHN"].includes(a.iso3 as string) ? "P5" : undefined,
          };
        });

      const alliances = raw.graph.edges
        .filter((e: { attributes: { edgeType: string } }) => e.attributes.edgeType === "ALLIES_WITH")
        .map((e: { source: string; target: string; attributes: { similarity?: number } }) => ({
          source: e.source.replace("country:", ""),
          target: e.target.replace("country:", ""),
          weight: e.attributes.similarity || 0.5,
          type: "ALLIES_WITH",
        }));

      const rivalries = raw.graph.edges
        .filter((e: { attributes: { edgeType: string } }) => e.attributes.edgeType === "RIVALS_WITH")
        .map((e: { source: string; target: string; attributes: { similarity?: number } }) => ({
          source: e.source.replace("country:", ""),
          target: e.target.replace("country:", ""),
          weight: Math.abs(e.attributes.similarity || 0.5),
          type: "RIVALS_WITH",
        }));

      jsonCache = { nodes, alliances, rivalries };
    }

    const cache = jsonCache as { nodes: unknown[]; alliances: { weight: number }[]; rivalries: unknown[] };
    let edges: unknown[] = cache.alliances.filter((e) => !minSimilarity || e.weight >= minSimilarity);
    if (includeRivalries) edges = [...edges, ...(cache.rivalries as unknown[])];

    return NextResponse.json({ nodes: cache.nodes, edges, source: "json-fallback" });
  } catch (e) {
    console.error("Alliance network API error:", e);
    return NextResponse.json({ error: "Failed to load graph data" }, { status: 500 });
  }
}
