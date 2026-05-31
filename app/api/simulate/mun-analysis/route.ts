import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import path from "path";
import type { AnalyzedResolution, Committee, PolicyDimensions } from "@/types";
import { simulateWithGraph } from "@/engines/graph-predictor";
import { loadCountryProfiles, loadBlocs } from "@/lib/data/loader";
import { getIssuePositions, getAlliances, getRivalries, getBlocMemberships } from "@/lib/knowledge-graph";

let graphCoreCache: Record<string, unknown> | null = null;

function loadGraphCore() {
  if (graphCoreCache) return graphCoreCache;
  graphCoreCache = JSON.parse(readFileSync(path.join(process.cwd(), "data", "graph-core.json"), "utf-8"));
  return graphCoreCache!;
}

interface MunRequest {
  policy: string;
  committee: Committee;
  sponsorCountry?: string;
  apiKey?: string;
  provider?: "gemini" | "anthropic";
}

export async function POST(request: NextRequest) {
  try {
    const body: MunRequest = await request.json();
    const { policy, committee, sponsorCountry } = body;

    if (!policy || policy.length < 20) {
      return NextResponse.json({ error: "Policy description must be at least 20 characters" }, { status: 400 });
    }

    // Build resolution from policy text using keyword heuristics (no AI needed for this part)
    const policyVector = extractPolicyVector(policy);
    const issueWeights = extractIssueWeights(policy);

    const analyzedResolution: AnalyzedResolution = {
      id: `mun-${Date.now()}`,
      title: policy.length > 100 ? policy.substring(0, 97) + "..." : policy,
      committee: committee || "GA_PLENARY",
      preamble: [],
      operativeClauses: [{
        id: "op1",
        text: policy,
        strength: 0.7,
        topics: Object.entries(issueWeights).filter(([_, v]) => v > 0.3).map(([k]) => k),
        policyDimensions: policyVector,
      }],
      sponsors: sponsorCountry ? [sponsorCountry] : [],
      policyVector,
      issueWeights,
      contentionPoints: [],
      historicalPrecedents: [],
    };

    // Run simulation
    const profiles = await loadCountryProfiles();
    const blocs = await loadBlocs();
    const graphData = loadGraphCore() as {
      votingPatterns: Record<string, Record<string, { yes: number; no: number; abstain: number; total: number }>>;
      graph: { nodes: { key: string; attributes: Record<string, unknown> }[]; edges: { source: string; target: string; attributes: Record<string, unknown> }[] };
    };

    const result = simulateWithGraph(profiles, analyzedResolution, committee, blocs, graphData);

    // Build MUN briefing data
    const yesVoters = result.countryVotes.filter((v) => v.vote === "Yes").sort((a, b) => b.confidence - a.confidence);
    const noVoters = result.countryVotes.filter((v) => v.vote === "No").sort((a, b) => b.confidence - a.confidence);
    const abstainVoters = result.countryVotes.filter((v) => v.vote === "Abstain");

    // Get detailed KG data for key countries
    const keyCountries = [...yesVoters.slice(0, 5), ...noVoters.slice(0, 5)].map((v) => {
      const positions = getIssuePositions(v.iso3);
      const allies = getAlliances(v.iso3);
      const rivals = getRivalries(v.iso3);
      const blocList = getBlocMemberships(v.iso3);

      return {
        iso3: v.iso3,
        name: v.name,
        predictedVote: v.vote,
        confidence: v.confidence,
        factors: v.factors,
        kgData: {
          positions: positions.slice(0, 6),
          topAllies: allies.slice(0, 3).map((a) => a.name),
          topRivals: rivals.slice(0, 3).map((r) => r.name),
          blocs: blocList.map((b) => b.name),
        },
      };
    });

    // Identify persuadable countries (low confidence, could swing)
    const persuadable = result.countryVotes
      .filter((v) => v.confidence < 0.6 && v.confidence > 0.35)
      .sort((a, b) => a.confidence - b.confidence)
      .slice(0, 10)
      .map((v) => {
        const positions = getIssuePositions(v.iso3);
        return {
          iso3: v.iso3,
          name: v.name,
          currentPrediction: v.vote,
          confidence: v.confidence,
          swingFactors: v.factors.filter((f) => Math.abs(f.score) < 0.3).map((f) => f.name),
          positions: positions.slice(0, 3),
        };
      });

    // Build coalition suggestions
    const strongYes = yesVoters.filter((v) => v.confidence > 0.75);
    const coalitionBlocs = new Map<string, number>();
    for (const voter of strongYes) {
      const memberBlocs = getBlocMemberships(voter.iso3);
      for (const b of memberBlocs) {
        coalitionBlocs.set(b.name, (coalitionBlocs.get(b.name) || 0) + 1);
      }
    }

    return NextResponse.json({
      resolution: analyzedResolution,
      simulation: {
        totals: result.totals,
        passed: result.passed,
        committee,
      },
      briefing: {
        supporters: yesVoters.slice(0, 15).map((v) => ({ iso3: v.iso3, name: v.name, confidence: v.confidence })),
        opponents: noVoters.slice(0, 15).map((v) => ({ iso3: v.iso3, name: v.name, confidence: v.confidence })),
        abstainers: abstainVoters.slice(0, 10).map((v) => ({ iso3: v.iso3, name: v.name, confidence: v.confidence })),
        keyCountryAnalysis: keyCountries,
        persuadableCountries: persuadable,
        coalitionStrategy: {
          strongSupportBlocs: [...coalitionBlocs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ bloc: name, supporters: count })),
          totalStrongSupport: strongYes.length,
          marginOfVictory: result.totals.yes - result.totals.no,
        },
      },
      policyVector,
      issueWeights,
    });
  } catch (e) {
    console.error("MUN analysis failed:", e);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}

function extractPolicyVector(policy: string): PolicyDimensions {
  const lower = policy.toLowerCase();
  const signals: PolicyDimensions = { sovereignty: 0, humanRights: 0, development: 0, security: 0, environment: 0, decolonization: 0 };

  const patterns: { keywords: string[]; dimension: keyof PolicyDimensions; weight: number }[] = [
    { keywords: ["sovereignty", "non-interference", "territorial", "self-determination", "domestic affairs"], dimension: "sovereignty", weight: 0.7 },
    { keywords: ["binding", "mandatory", "enforcement", "compliance", "sanctions", "penalties"], dimension: "sovereignty", weight: -0.5 },
    { keywords: ["human rights", "civil liberties", "freedom", "dignity", "discrimination", "torture", "refugee"], dimension: "humanRights", weight: 0.7 },
    { keywords: ["development", "poverty", "education", "infrastructure", "aid", "sdg", "developing"], dimension: "development", weight: 0.7 },
    { keywords: ["climate", "emissions", "carbon", "renewable", "environmental", "biodiversity", "pollution"], dimension: "environment", weight: 0.8 },
    { keywords: ["nuclear", "disarmament", "weapons", "arms", "military", "security", "peacekeeping"], dimension: "security", weight: -0.6 },
    { keywords: ["colonial", "occupation", "indigenous", "self-determination", "decolonization"], dimension: "decolonization", weight: 0.7 },
    { keywords: ["trade", "economic", "investment", "tariff", "market", "finance"], dimension: "development", weight: 0.5 },
    { keywords: ["technology", "ai", "digital", "cyber", "internet", "data"], dimension: "development", weight: 0.4 },
  ];

  for (const { keywords, dimension, weight } of patterns) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        signals[dimension] += weight * 0.3;
      }
    }
  }

  // Clamp
  for (const key of Object.keys(signals) as (keyof PolicyDimensions)[]) {
    signals[key] = Math.max(-1, Math.min(1, signals[key]));
  }

  return signals;
}

function extractIssueWeights(policy: string): Record<string, number> {
  const lower = policy.toLowerCase();
  const weights: Record<string, number> = {};

  const mappings: { keywords: string[]; issue: string }[] = [
    { keywords: ["human rights", "rights", "freedom", "dignity", "refugee", "women"], issue: "human-rights" },
    { keywords: ["climate", "emissions", "carbon", "environment", "biodiversity"], issue: "climate" },
    { keywords: ["development", "poverty", "education", "health", "infrastructure", "water"], issue: "development" },
    { keywords: ["nuclear", "disarmament", "weapons", "arms", "missile"], issue: "disarmament" },
    { keywords: ["security", "terrorism", "peacekeeping", "conflict", "military"], issue: "security" },
    { keywords: ["sovereignty", "non-interference", "territorial"], issue: "sovereignty" },
    { keywords: ["trade", "economic", "tariff", "sanctions", "investment"], issue: "trade" },
    { keywords: ["technology", "ai", "digital", "cyber", "internet"], issue: "technology" },
    { keywords: ["colonial", "occupation", "self-determination", "indigenous"], issue: "decolonization" },
  ];

  for (const { keywords, issue } of mappings) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        weights[issue] = (weights[issue] || 0) + 0.3;
      }
    }
  }

  const maxW = Math.max(...Object.values(weights), 0.1);
  for (const key of Object.keys(weights)) {
    weights[key] = Math.min(1, weights[key] / maxW);
  }

  return weights;
}
