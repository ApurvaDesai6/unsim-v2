import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import path from "path";

let coreCache: Record<string, unknown> | null = null;

function loadCore() {
  if (coreCache) return coreCache;
  const filePath = path.join(process.cwd(), "data", "graph-core.json");
  coreCache = JSON.parse(readFileSync(filePath, "utf-8"));
  return coreCache!;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ iso3: string }> },
) {
  const { iso3 } = await params;
  const upperIso = iso3.toUpperCase();

  try {
    const core = loadCore() as {
      graph: {
        nodes: { key: string; attributes: Record<string, unknown> }[];
        edges: { source: string; target: string; attributes: Record<string, unknown> }[];
      };
      votingPatterns: Record<string, Record<string, { yes: number; no: number; abstain: number; total: number }>>;
      temporalPatterns: Record<string, Record<string, Record<string, { yes: number; no: number; abstain: number; total: number }>>>;
    };

    const countryId = `country:${upperIso}`;
    const countryNode = core.graph.nodes.find((n) => n.key === countryId);
    if (!countryNode) {
      return NextResponse.json({ error: "Country not found" }, { status: 404 });
    }

    // Get alliances and rivalries
    const allies: { iso3: string; name: string; similarity: number }[] = [];
    const rivals: { iso3: string; name: string; similarity: number }[] = [];
    const blocs: string[] = [];

    for (const edge of core.graph.edges) {
      if (edge.source !== countryId) continue;
      const ea = edge.attributes as { edgeType: string; similarity?: number };

      if (ea.edgeType === "ALLIES_WITH") {
        const targetIso = edge.target.replace("country:", "");
        const targetNode = core.graph.nodes.find((n) => n.key === edge.target);
        allies.push({
          iso3: targetIso,
          name: (targetNode?.attributes as { name?: string })?.name || targetIso,
          similarity: ea.similarity || 0,
        });
      } else if (ea.edgeType === "RIVALS_WITH") {
        const targetIso = edge.target.replace("country:", "");
        const targetNode = core.graph.nodes.find((n) => n.key === edge.target);
        rivals.push({
          iso3: targetIso,
          name: (targetNode?.attributes as { name?: string })?.name || targetIso,
          similarity: ea.similarity || 0,
        });
      } else if (ea.edgeType === "MEMBER_OF") {
        const blocId = edge.target.replace("bloc:", "");
        blocs.push(blocId);
      }
    }

    allies.sort((a, b) => b.similarity - a.similarity);
    rivals.sort((a, b) => a.similarity - b.similarity);

    // Get voting patterns
    const patterns = core.votingPatterns[upperIso] || {};
    const votingPatterns = Object.entries(patterns).map(([topic, counts]) => ({
      topic,
      yesRate: counts.total > 0 ? counts.yes / counts.total : 0,
      noRate: counts.total > 0 ? counts.no / counts.total : 0,
      abstainRate: counts.total > 0 ? counts.abstain / counts.total : 0,
      sampleSize: counts.total,
    }));

    // Get temporal trends
    const temporal = core.temporalPatterns?.[upperIso] || {};
    const temporalTrends: Record<string, { decade: string; yesRate: number; noRate: number; abstainRate: number; sampleSize: number }[]> = {};

    for (const [topic, decades] of Object.entries(temporal)) {
      temporalTrends[topic] = Object.entries(decades)
        .map(([decade, counts]) => ({
          decade,
          yesRate: counts.total > 0 ? counts.yes / counts.total : 0,
          noRate: counts.total > 0 ? counts.no / counts.total : 0,
          abstainRate: counts.total > 0 ? counts.abstain / counts.total : 0,
          sampleSize: counts.total,
        }))
        .sort((a, b) => a.decade.localeCompare(b.decade));
    }

    return NextResponse.json({
      country: countryNode.attributes,
      allies: allies.slice(0, 10),
      rivals: rivals.slice(0, 5),
      blocs,
      votingPatterns,
      temporalTrends,
    });
  } catch (e) {
    console.error("Failed to load country graph data:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
