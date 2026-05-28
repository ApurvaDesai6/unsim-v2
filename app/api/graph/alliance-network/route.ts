import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import path from "path";

let cachedData: { nodes: unknown[]; edges: unknown[] } | null = null;

export async function GET() {
  if (cachedData) return NextResponse.json(cachedData);

  try {
    const filePath = path.join(process.cwd(), "data", "graph-viz.json");
    const raw = JSON.parse(readFileSync(filePath, "utf-8"));

    const nodes = raw.graph.nodes.map((n: { key: string; attributes: Record<string, unknown> }) => {
      const attrs = n.attributes as {
        type: string;
        iso3?: string;
        name?: string;
        shortName?: string;
        region?: string;
        idealPoint?: number;
        population?: number;
        memberCount?: number;
        cohesionScore?: number;
      };

      if (attrs.type === "country") {
        return {
          id: attrs.iso3,
          label: attrs.name,
          region: attrs.region,
          idealPoint: attrs.idealPoint,
          size: Math.log10((attrs.population || 1000000) + 1) * 1.5,
          nodeType: "country",
        };
      } else if (attrs.type === "bloc") {
        return {
          id: `bloc:${attrs.shortName}`,
          label: attrs.name,
          region: "BLOC",
          idealPoint: 0,
          size: (attrs.memberCount || 10) * 0.3,
          nodeType: "bloc",
        };
      } else if (attrs.type === "topic") {
        return {
          id: `topic:${attrs.name}`,
          label: attrs.name,
          region: "TOPIC",
          idealPoint: 0,
          size: 5,
          nodeType: "topic",
        };
      }
      return null;
    }).filter(Boolean);

    const edges = raw.graph.edges
      .filter((e: { attributes: { edgeType: string } }) => e.attributes.edgeType === "ALLIES_WITH")
      .map((e: { source: string; target: string; attributes: { similarity?: number; edgeType: string } }) => ({
        source: e.source.replace("country:", ""),
        target: e.target.replace("country:", ""),
        weight: e.attributes.similarity || 0.5,
        type: e.attributes.edgeType,
      }));

    cachedData = { nodes, edges };
    return NextResponse.json(cachedData);
  } catch (e) {
    console.error("Failed to load graph-viz.json:", e);
    return NextResponse.json({ error: "Failed to load graph data" }, { status: 500 });
  }
}
