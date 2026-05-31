import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import path from "path";
import type { AnalyzedResolution, Committee, PolicyDimensions, CountryProfile } from "@/types";
import { simulateWithGraph } from "@/engines/graph-predictor";
import { loadCountryProfiles, loadBlocs } from "@/lib/data/loader";

let graphCoreCache: Record<string, unknown> | null = null;

function loadGraphCore() {
  if (graphCoreCache) return graphCoreCache;
  graphCoreCache = JSON.parse(readFileSync(path.join(process.cwd(), "data", "graph-core.json"), "utf-8"));
  return graphCoreCache!;
}

/**
 * Geopolitical What-If Simulator
 *
 * Accepts a geopolitical event/scenario description + a resolution context,
 * computes how the event would shift country positions in the knowledge graph,
 * and re-runs the simulation to show the impact.
 *
 * Without AI: uses keyword extraction to map events to country position shifts
 * With AI (user provides key): uses LLM to analyze event → country impacts
 */

interface GeoEvent {
  description: string;
  resolution: {
    policy: string;
    committee: Committee;
  };
  apiKey?: string;
  provider?: "gemini" | "anthropic";
}

// Event → country impact mapping (heuristic, no AI needed)
const EVENT_PATTERNS: { keywords: string[]; impacts: { countries: string[]; dimension: keyof PolicyDimensions; shift: number }[] }[] = [
  {
    keywords: ["strait of hormuz", "hormuz", "persian gulf blockade", "iran blockade"],
    impacts: [
      { countries: ["IRN"], dimension: "security", shift: 0.5 },
      { countries: ["SAU", "ARE", "KWT", "QAT", "BHR", "OMN"], dimension: "security", shift: -0.4 },
      { countries: ["USA", "GBR", "FRA"], dimension: "security", shift: -0.3 },
      { countries: ["CHN", "IND", "JPN", "KOR"], dimension: "sovereignty", shift: 0.2 },
    ],
  },
  {
    keywords: ["china taiwan", "taiwan strait", "taiwan invasion", "cross-strait"],
    impacts: [
      { countries: ["CHN"], dimension: "sovereignty", shift: 0.8 },
      { countries: ["USA", "JPN", "AUS", "GBR"], dimension: "security", shift: -0.5 },
      { countries: ["KOR", "PHL", "VNM"], dimension: "security", shift: -0.3 },
      { countries: ["RUS", "PRK"], dimension: "sovereignty", shift: 0.4 },
    ],
  },
  {
    keywords: ["russia ukraine", "ukraine war", "russian invasion"],
    impacts: [
      { countries: ["RUS", "BLR"], dimension: "sovereignty", shift: 0.5 },
      { countries: ["UKR", "POL", "EST", "LVA", "LTU"], dimension: "security", shift: -0.6 },
      { countries: ["DEU", "FRA", "GBR", "USA"], dimension: "security", shift: -0.3 },
      { countries: ["CHN", "IND"], dimension: "sovereignty", shift: 0.2 },
    ],
  },
  {
    keywords: ["climate catastrophe", "climate emergency", "tipping point", "sea level"],
    impacts: [
      { countries: ["MDV", "KIR", "TUV", "MHL", "FJI", "WSM", "TON", "VUT", "SLB"], dimension: "environment", shift: 0.9 },
      { countries: ["USA", "AUS", "CAN", "RUS", "SAU"], dimension: "environment", shift: -0.2 },
      { countries: ["IND", "CHN", "BRA"], dimension: "development", shift: 0.3 },
    ],
  },
  {
    keywords: ["nuclear test", "nuclear weapon test", "nuclear detonation"],
    impacts: [
      { countries: ["PRK", "IRN"], dimension: "security", shift: 0.5 },
      { countries: ["USA", "GBR", "FRA", "JPN", "KOR", "AUS"], dimension: "security", shift: -0.6 },
      { countries: ["RUS", "CHN"], dimension: "security", shift: -0.2 },
    ],
  },
  {
    keywords: ["pandemic", "outbreak", "virus", "epidemic", "who emergency"],
    impacts: [
      { countries: ["CHN", "USA", "GBR", "DEU", "FRA"], dimension: "sovereignty", shift: -0.3 },
      { countries: ["IND", "BRA", "ZAF", "NGA"], dimension: "development", shift: 0.4 },
    ],
  },
  {
    keywords: ["sanctions", "economic sanctions", "trade war", "embargo"],
    impacts: [
      { countries: ["USA", "GBR", "EU"], dimension: "sovereignty", shift: -0.3 },
      { countries: ["RUS", "CHN", "IRN", "VEN", "CUB", "PRK"], dimension: "sovereignty", shift: 0.5 },
      { countries: ["IND", "BRA", "ZAF"], dimension: "sovereignty", shift: 0.2 },
    ],
  },
  {
    keywords: ["coup", "military coup", "overthrow", "junta"],
    impacts: [
      { countries: ["USA", "GBR", "FRA", "DEU"], dimension: "humanRights", shift: 0.3 },
      { countries: ["RUS", "CHN"], dimension: "sovereignty", shift: 0.3 },
    ],
  },
];

function computeEventImpacts(eventDescription: string): Map<string, Partial<PolicyDimensions>> {
  const lower = eventDescription.toLowerCase();
  const impacts = new Map<string, Partial<PolicyDimensions>>();

  for (const pattern of EVENT_PATTERNS) {
    if (pattern.keywords.some((kw) => lower.includes(kw))) {
      for (const impact of pattern.impacts) {
        for (const iso3 of impact.countries) {
          const existing = impacts.get(iso3) || {};
          existing[impact.dimension] = (existing[impact.dimension] || 0) + impact.shift;
          impacts.set(iso3, existing);
        }
      }
    }
  }

  // Also handle generic "war between X and Y" or "conflict in X"
  const warMatch = lower.match(/war (?:between|involving) (\w+) and (\w+)/);
  if (warMatch) {
    // Generic war increases security concerns globally
    for (const [iso3] of impacts) {
      const existing = impacts.get(iso3) || {};
      existing.security = (existing.security || 0) - 0.2;
      impacts.set(iso3, existing);
    }
  }

  return impacts;
}

export async function POST(request: NextRequest) {
  try {
    const body: GeoEvent = await request.json();
    const { description, resolution } = body;

    if (!description || !resolution?.policy) {
      return NextResponse.json({ error: "description and resolution.policy required" }, { status: 400 });
    }

    // Compute event impacts on country positions
    const eventImpacts = computeEventImpacts(description);

    // Build resolution
    const policyVector = extractPolicyVector(resolution.policy);
    const issueWeights = extractIssueWeights(resolution.policy);
    const committee = resolution.committee || "GA_PLENARY";

    const analyzedResolution: AnalyzedResolution = {
      id: `geowhatif-${Date.now()}`,
      title: resolution.policy.length > 80 ? resolution.policy.substring(0, 77) + "..." : resolution.policy,
      committee,
      preamble: [],
      operativeClauses: [{ id: "op1", text: resolution.policy, strength: 0.7, topics: Object.keys(issueWeights), policyDimensions: policyVector }],
      sponsors: [],
      policyVector,
      issueWeights,
      contentionPoints: [],
      historicalPrecedents: [],
    };

    // Run baseline simulation
    let profiles = await loadCountryProfiles();
    const blocs = await loadBlocs();
    const graphData = loadGraphCore() as {
      votingPatterns: Record<string, Record<string, { yes: number; no: number; abstain: number; total: number }>>;
      graph: { nodes: { key: string; attributes: Record<string, unknown> }[]; edges: { source: string; target: string; attributes: Record<string, unknown> }[] };
    };

    const baselineResult = simulateWithGraph(profiles, analyzedResolution, committee, blocs, graphData);

    // Apply event impacts to country profiles
    const modifiedProfiles = profiles.map((p: CountryProfile) => {
      const impact = eventImpacts.get(p.iso3);
      if (!impact) return p;
      const modified = { ...p, policyDimensions: { ...p.policyDimensions } };
      for (const [dim, shift] of Object.entries(impact)) {
        const key = dim as keyof PolicyDimensions;
        modified.policyDimensions[key] = Math.max(-1, Math.min(1, (modified.policyDimensions[key] || 0) + (shift as number)));
      }
      return modified;
    });

    const modifiedResult = simulateWithGraph(modifiedProfiles, analyzedResolution, committee, blocs, graphData);

    // Compute diffs
    const shifts: { iso3: string; name: string; from: string; to: string; confidenceChange: number }[] = [];
    for (let i = 0; i < baselineResult.countryVotes.length; i++) {
      const base = baselineResult.countryVotes[i];
      const mod = modifiedResult.countryVotes[i];
      if (base.vote !== mod.vote || Math.abs(base.confidence - mod.confidence) > 0.1) {
        shifts.push({
          iso3: base.iso3,
          name: base.name,
          from: base.vote,
          to: mod.vote,
          confidenceChange: mod.confidence - base.confidence,
        });
      }
    }

    return NextResponse.json({
      event: description,
      affectedCountries: eventImpacts.size,
      baseline: { totals: baselineResult.totals, passed: baselineResult.passed },
      modified: { totals: modifiedResult.totals, passed: modifiedResult.passed },
      shifts: shifts.sort((a, b) => Math.abs(b.confidenceChange) - Math.abs(a.confidenceChange)),
      eventImpacts: [...eventImpacts.entries()].map(([iso3, dims]) => ({ iso3, shifts: dims })),
    });
  } catch (e) {
    console.error("Geopolitical simulation failed:", e);
    return NextResponse.json({ error: "Simulation failed" }, { status: 500 });
  }
}

function extractPolicyVector(policy: string): PolicyDimensions {
  const lower = policy.toLowerCase();
  const signals: PolicyDimensions = { sovereignty: 0, humanRights: 0, development: 0, security: 0, environment: 0, decolonization: 0 };
  const patterns: { keywords: string[]; dimension: keyof PolicyDimensions; weight: number }[] = [
    { keywords: ["sovereignty", "non-interference", "territorial"], dimension: "sovereignty", weight: 0.7 },
    { keywords: ["binding", "mandatory", "enforcement", "sanctions"], dimension: "sovereignty", weight: -0.5 },
    { keywords: ["human rights", "freedom", "dignity", "refugee"], dimension: "humanRights", weight: 0.7 },
    { keywords: ["development", "poverty", "education", "aid"], dimension: "development", weight: 0.7 },
    { keywords: ["climate", "emissions", "environmental"], dimension: "environment", weight: 0.8 },
    { keywords: ["nuclear", "disarmament", "weapons", "arms", "military"], dimension: "security", weight: -0.6 },
    { keywords: ["colonial", "occupation", "decolonization"], dimension: "decolonization", weight: 0.7 },
  ];
  for (const { keywords, dimension, weight } of patterns) {
    for (const kw of keywords) {
      if (lower.includes(kw)) signals[dimension] += weight * 0.3;
    }
  }
  for (const key of Object.keys(signals) as (keyof PolicyDimensions)[]) {
    signals[key] = Math.max(-1, Math.min(1, signals[key]));
  }
  return signals;
}

function extractIssueWeights(policy: string): Record<string, number> {
  const lower = policy.toLowerCase();
  const weights: Record<string, number> = {};
  const mappings: { keywords: string[]; issue: string }[] = [
    { keywords: ["human rights", "rights", "freedom"], issue: "human-rights" },
    { keywords: ["climate", "emissions", "environment"], issue: "climate" },
    { keywords: ["development", "poverty", "education"], issue: "development" },
    { keywords: ["nuclear", "disarmament", "weapons"], issue: "disarmament" },
    { keywords: ["security", "terrorism", "peacekeeping"], issue: "security" },
    { keywords: ["sovereignty", "non-interference"], issue: "sovereignty" },
  ];
  for (const { keywords, issue } of mappings) {
    for (const kw of keywords) {
      if (lower.includes(kw)) weights[issue] = (weights[issue] || 0) + 0.3;
    }
  }
  const maxW = Math.max(...Object.values(weights), 0.1);
  for (const key of Object.keys(weights)) weights[key] = Math.min(1, weights[key] / maxW);
  return weights;
}
