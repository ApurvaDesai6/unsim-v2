import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import path from "path";

let cachedData: Record<string, unknown> | null = null;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const includeRivalries = searchParams.get("rivalries") === "true";
  const includeBlocs = searchParams.get("blocs") === "true";
  const minSimilarity = parseFloat(searchParams.get("minSimilarity") || "0");

  // Use cache for default requests only
  if (!includeRivalries && !includeBlocs && !minSimilarity && cachedData) {
    return NextResponse.json(cachedData);
  }

  try {
    const filePath = path.join(process.cwd(), "data", "graph-viz.json");
    const raw = JSON.parse(readFileSync(filePath, "utf-8"));

    const nodes: unknown[] = [];
    const edges: unknown[] = [];

    for (const n of raw.graph.nodes) {
      const attrs = n.attributes as Record<string, unknown>;

      if (attrs.type === "country") {
        nodes.push({
          id: attrs.iso3,
          label: attrs.name,
          region: attrs.region,
          idealPoint: attrs.idealPoint,
          population: attrs.population,
          size: Math.log10(((attrs.population as number) || 1000000) + 1) * 1.5,
          nodeType: "country",
          scStatus: ["USA", "GBR", "FRA", "RUS", "CHN"].includes(attrs.iso3 as string) ? "P5" : undefined,
        });
      } else if (attrs.type === "bloc" && includeBlocs) {
        nodes.push({
          id: `bloc:${attrs.shortName}`,
          label: attrs.name,
          region: "BLOC",
          idealPoint: 0,
          size: ((attrs.memberCount as number) || 10) * 0.4,
          nodeType: "bloc",
          cohesionScore: attrs.cohesionScore,
        });
      } else if (attrs.type === "topic" && includeBlocs) {
        nodes.push({
          id: `topic:${attrs.name}`,
          label: attrs.name,
          region: "TOPIC",
          idealPoint: 0,
          size: 8,
          nodeType: "topic",
        });
      }
    }

    for (const e of raw.graph.edges) {
      const ea = e.attributes as { edgeType: string; similarity?: number };

      if (ea.edgeType === "ALLIES_WITH") {
        const sim = ea.similarity || 0.5;
        if (minSimilarity && sim < minSimilarity) continue;
        edges.push({
          source: e.source.replace("country:", ""),
          target: e.target.replace("country:", ""),
          weight: sim,
          type: "ALLIES_WITH",
        });
      } else if (ea.edgeType === "RIVALS_WITH" && includeRivalries) {
        edges.push({
          source: e.source.replace("country:", ""),
          target: e.target.replace("country:", ""),
          weight: Math.abs(ea.similarity || 0.5),
          type: "RIVALS_WITH",
        });
      } else if (ea.edgeType === "MEMBER_OF" && includeBlocs) {
        edges.push({
          source: e.source.replace("country:", ""),
          target: e.target.replace("bloc:", "bloc:"),
          weight: 0.5,
          type: "MEMBER_OF",
        });
      }
    }

    const result = { nodes, edges };

    // Cache only default requests
    if (!includeRivalries && !includeBlocs && !minSimilarity) {
      cachedData = result;
    }

    return NextResponse.json(result);
  } catch (e) {
    console.error("Failed to load graph-viz.json:", e);
    return NextResponse.json({ error: "Failed to load graph data" }, { status: 500 });
  }
}
