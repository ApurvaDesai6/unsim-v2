import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import path from "path";
import type { AnalyzedResolution, Committee } from "@/types";
import { simulateWithGraph } from "@/engines/graph-predictor";
import { loadCountryProfiles, loadBlocs } from "@/lib/data/loader";

let graphCoreCache: Record<string, unknown> | null = null;

function loadGraphCore() {
  if (graphCoreCache) return graphCoreCache;
  const filePath = path.join(process.cwd(), "data", "graph-core.json");
  graphCoreCache = JSON.parse(readFileSync(filePath, "utf-8"));
  return graphCoreCache!;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { resolution, committee } = body as {
      resolution: AnalyzedResolution;
      committee: Committee;
    };

    if (!resolution) {
      return NextResponse.json({ error: "No resolution provided" }, { status: 400 });
    }

    const profiles = await loadCountryProfiles();
    const blocs = await loadBlocs();
    const graphData = loadGraphCore() as {
      votingPatterns: Record<string, Record<string, { yes: number; no: number; abstain: number; total: number }>>;
      graph: {
        nodes: { key: string; attributes: Record<string, unknown> }[];
        edges: { source: string; target: string; attributes: Record<string, unknown> }[];
      };
    };

    const result = simulateWithGraph(profiles, resolution, committee, blocs, graphData);

    return NextResponse.json({ result });
  } catch (e) {
    console.error("Simulation failed:", e);
    return NextResponse.json(
      { error: "Simulation failed" },
      { status: 500 },
    );
  }
}
