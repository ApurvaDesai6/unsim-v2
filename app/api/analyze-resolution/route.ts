import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import path from "path";
import type { Committee, PolicyDimensions, AnalyzedResolution } from "@/types";

interface PresetScenario {
  id: string;
  title: string;
  description: string;
  committee: Committee;
  preamble: { id: string; text: string }[];
  operativeClauses: { id: string; text: string; strength: number; topics: string[] }[];
  policyVector: PolicyDimensions;
  issueWeights: Record<string, number>;
}

let presetsCache: PresetScenario[] | null = null;

function loadPresets(): PresetScenario[] {
  if (presetsCache) return presetsCache;
  presetsCache = JSON.parse(readFileSync(path.join(process.cwd(), "data", "preset-scenarios.json"), "utf-8"));
  return presetsCache!;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { policy, preset, committee } = body;

    const presets = loadPresets();

    // If it's a preset, use pre-computed data (no LLM needed)
    if (preset) {
      const scenario = presets.find((p) => p.id === preset);
      if (!scenario) {
        return NextResponse.json({ error: `Unknown preset: ${preset}` }, { status: 400 });
      }

      const analyzedResolution: AnalyzedResolution = {
        id: `preset-${scenario.id}`,
        title: scenario.title,
        committee: scenario.committee,
        preamble: scenario.preamble,
        operativeClauses: scenario.operativeClauses.map((c) => ({
          ...c,
          policyDimensions: scenario.policyVector,
        })),
        sponsors: [],
        policyVector: scenario.policyVector,
        issueWeights: scenario.issueWeights,
        contentionPoints: [],
        historicalPrecedents: [],
      };

      return NextResponse.json({
        resolution: {
          title: scenario.title,
          preamble: scenario.preamble,
          clauses: scenario.operativeClauses.map((c) => ({
            id: c.id,
            text: c.text,
            strength: c.strength,
            topics: c.topics,
          })),
        },
        analyzedResolution,
      });
    }

    // Custom policy — try LLM, fall back to heuristic
    if (policy) {
      const targetCommittee = (committee || "GA_PLENARY") as Committee;
      const analyzedResolution = buildHeuristicResolution(policy, targetCommittee);

      return NextResponse.json({
        resolution: {
          title: analyzedResolution.title,
          clauses: analyzedResolution.operativeClauses.map((c) => ({
            id: c.id,
            text: c.text,
            strength: c.strength,
            topics: c.topics,
          })),
        },
        analyzedResolution,
      });
    }

    return NextResponse.json({ error: "No policy or preset provided" }, { status: 400 });
  } catch (e) {
    console.error("Resolution analysis failed:", e);
    return NextResponse.json({ error: "Failed to analyze resolution" }, { status: 500 });
  }
}

function buildHeuristicResolution(policy: string, committee: Committee): AnalyzedResolution {
  const lower = policy.toLowerCase();

  const topicSignals: Record<string, number> = {
    "human-rights": 0, climate: 0, development: 0, security: 0,
    disarmament: 0, sovereignty: 0, trade: 0, decolonization: 0, technology: 0,
  };

  const keywords: Record<string, string[]> = {
    "human-rights": ["human rights", "rights", "freedom", "dignity", "discrimination", "torture", "refugee", "women", "children"],
    climate: ["climate", "emissions", "warming", "carbon", "renewable", "fossil", "paris agreement", "environment", "biodiversity"],
    development: ["development", "poverty", "education", "health", "infrastructure", "sdg", "aid", "water", "sanitation"],
    security: ["security", "terrorism", "conflict", "peacekeeping", "military", "war", "peace", "aggression"],
    disarmament: ["nuclear", "weapons", "disarmament", "arms", "nonproliferation", "missile", "ban"],
    sovereignty: ["sovereignty", "intervention", "self-determination", "territorial", "non-interference"],
    trade: ["trade", "tariff", "economic", "sanctions", "investment", "debt", "finance", "corporation"],
    decolonization: ["colonial", "occupation", "self-determination", "indigenous", "reparation"],
    technology: ["ai", "artificial intelligence", "cyber", "digital", "technology", "internet", "data"],
  };

  for (const [topic, words] of Object.entries(keywords)) {
    for (const word of words) {
      if (lower.includes(word)) topicSignals[topic] += 0.3;
    }
  }

  // Normalize
  const maxSignal = Math.max(...Object.values(topicSignals), 0.1);
  const issueWeights: Record<string, number> = {};
  for (const [k, v] of Object.entries(topicSignals)) {
    if (v > 0) issueWeights[k] = v / maxSignal;
  }

  const topicToDim: Record<string, keyof PolicyDimensions> = {
    "human-rights": "humanRights", climate: "environment", development: "development",
    security: "security", disarmament: "security", sovereignty: "sovereignty",
    trade: "development", decolonization: "decolonization", technology: "development",
  };

  const policyVector: PolicyDimensions = { sovereignty: 0, humanRights: 0, development: 0, security: 0, environment: 0, decolonization: 0 };
  for (const [topic, weight] of Object.entries(issueWeights)) {
    const dim = topicToDim[topic];
    if (dim) policyVector[dim] = Math.min(1, (policyVector[dim] || 0) + weight * 0.6);
  }

  const title = policy.length > 80 ? policy.substring(0, 77) + "..." : policy;

  return {
    id: `custom-${Date.now()}`,
    title,
    committee,
    preamble: [],
    operativeClauses: [{
      id: "op1",
      text: policy,
      strength: 0.7,
      topics: Object.entries(issueWeights).filter(([_, v]) => v > 0.3).map(([k]) => k),
      policyDimensions: policyVector,
    }],
    sponsors: [],
    policyVector,
    issueWeights,
    contentionPoints: [],
    historicalPrecedents: [],
  };
}
