import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import path from "path";
import type { AnalyzedResolution, Committee, PolicyDimensions } from "@/types";
import { simulateWithGraph } from "@/engines/graph-predictor";
import { loadCountryProfiles, loadBlocs } from "@/lib/data/loader";

let graphCoreCache: Record<string, unknown> | null = null;
let catalogCache: Record<string, unknown>[] | null = null;

function loadGraphCore() {
  if (graphCoreCache) return graphCoreCache;
  graphCoreCache = JSON.parse(readFileSync(path.join(process.cwd(), "data", "graph-core.json"), "utf-8"));
  return graphCoreCache!;
}

function loadCatalog() {
  if (catalogCache) return catalogCache;
  catalogCache = JSON.parse(readFileSync(path.join(process.cwd(), "data", "resolution-catalog.json"), "utf-8"));
  return catalogCache!;
}

const TOPIC_TO_POLICY_VECTOR: Record<string, PolicyDimensions> = {
  "Palestinian conflict": { sovereignty: 0.5, humanRights: 0.6, development: 0.1, security: -0.2, environment: 0.0, decolonization: 0.7 },
  "Nuclear weapons and nuclear material": { sovereignty: 0.2, humanRights: 0.2, development: 0.0, security: -0.7, environment: 0.1, decolonization: 0.1 },
  "Arms control and disarmament": { sovereignty: 0.1, humanRights: 0.1, development: 0.0, security: -0.6, environment: 0.0, decolonization: 0.0 },
  "Colonialism": { sovereignty: 0.6, humanRights: 0.4, development: 0.3, security: 0.0, environment: 0.0, decolonization: 0.9 },
  "Human rights": { sovereignty: -0.3, humanRights: 0.8, development: 0.1, security: 0.0, environment: 0.0, decolonization: 0.1 },
  "Economic development": { sovereignty: 0.3, humanRights: 0.1, development: 0.8, security: 0.0, environment: 0.2, decolonization: 0.2 },
};

// Country-specific resolutions (targeting a named country) trigger sovereignty concerns
// which causes many Global South states to abstain
const COUNTRY_SPECIFIC_KEYWORDS = [
  "situation of human rights in", "situation in", "democratic people's republic of korea",
  "human rights in the", "iran", "syria", "belarus", "myanmar", "eritrea", "dpr korea",
  "north korea", "occupied palestinian", "israeli",
];

function isCountrySpecificResolution(title: string, description: string): boolean {
  const combined = (title + " " + description).toLowerCase();
  return COUNTRY_SPECIFIC_KEYWORDS.some((kw) => combined.includes(kw));
}

// Country-specific HR resolutions have INVERTED polarity:
// Western/liberal states vote Yes (condemning), Global South states vote No/Abstain (sovereignty).
// This is the OPPOSITE of general HR or decolonization resolutions.
// We model this by flipping the policyVector so that pro-sovereignty = anti-resolution.
function adjustForCountrySpecific(baseVector: PolicyDimensions): PolicyDimensions {
  return {
    sovereignty: -0.7,        // Negative: resolution CHALLENGES sovereignty (names specific country)
    humanRights: -0.6,        // Negative: from the perspective of sovereignty-oriented states
    development: 0.0,
    security: -0.2,
    environment: 0.0,
    decolonization: -0.5,     // Negative: resolution is seen as neo-colonial by Global South
  };
}

const TOPIC_TO_ISSUE_WEIGHTS: Record<string, Record<string, number>> = {
  "Palestinian conflict": { "human-rights": 0.6, decolonization: 0.8, sovereignty: 0.5 },
  "Nuclear weapons and nuclear material": { disarmament: 0.9, security: 0.7, nuclear: 1.0 },
  "Arms control and disarmament": { disarmament: 1.0, security: 0.8 },
  "Colonialism": { decolonization: 1.0, sovereignty: 0.7 },
  "Human rights": { "human-rights": 1.0 },
  "Economic development": { development: 1.0, trade: 0.5, climate: 0.3 },
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rcid } = body as { rcid: number };

    if (!rcid) {
      return NextResponse.json({ error: "No resolution ID provided" }, { status: 400 });
    }

    const catalog = loadCatalog();
    const resolution = catalog.find((r: Record<string, unknown>) => r.rcid === rcid) as {
      rcid: number;
      session: number;
      date: string;
      unres: string;
      title: string;
      description: string;
      topic: string;
      actualVote: { yes: number; no: number; abstain: number };
      passed: boolean;
      totalVoters: number;
    } | undefined;

    if (!resolution) {
      return NextResponse.json({ error: "Resolution not found in catalog" }, { status: 404 });
    }

    let policyVector = TOPIC_TO_POLICY_VECTOR[resolution.topic] || {
      sovereignty: 0, humanRights: 0, development: 0, security: 0, environment: 0, decolonization: 0,
    };

    const isCountrySpecific = isCountrySpecificResolution(resolution.title, resolution.description);
    if (isCountrySpecific) {
      policyVector = adjustForCountrySpecific(policyVector);
    }

    let issueWeights = TOPIC_TO_ISSUE_WEIGHTS[resolution.topic] || {};

    const analyzedResolution: AnalyzedResolution = {
      id: `historical-${rcid}`,
      title: resolution.title,
      committee: "GA_PLENARY" as Committee,
      preamble: [],
      operativeClauses: [{
        id: "op1",
        text: resolution.description,
        strength: 0.7,
        topics: Object.keys(issueWeights),
        policyDimensions: policyVector,
      }],
      sponsors: [],
      policyVector,
      issueWeights,
      contentionPoints: [],
      historicalPrecedents: [],
    };

    const profiles = await loadCountryProfiles();
    const blocs = await loadBlocs();
    const graphData = loadGraphCore() as {
      votingPatterns: Record<string, Record<string, { yes: number; no: number; abstain: number; total: number }>>;
      graph: {
        nodes: { key: string; attributes: Record<string, unknown> }[];
        edges: { source: string; target: string; attributes: Record<string, unknown> }[];
      };
    };

    const predicted = simulateWithGraph(profiles, analyzedResolution, "GA_PLENARY", blocs, graphData);

    return NextResponse.json({
      resolution: {
        rcid: resolution.rcid,
        title: resolution.title,
        description: resolution.description,
        date: resolution.date,
        session: resolution.session,
        unres: resolution.unres,
        topic: resolution.topic,
      },
      predicted: {
        totals: predicted.totals,
        passed: predicted.passed,
        countryVotes: predicted.countryVotes,
      },
      actual: {
        totals: resolution.actualVote,
        passed: resolution.passed,
        totalVoters: resolution.totalVoters,
      },
    });
  } catch (e) {
    console.error("Historical simulation failed:", e);
    return NextResponse.json({ error: "Simulation failed" }, { status: 500 });
  }
}
