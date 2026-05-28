import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import path from "path";
import type { AnalyzedResolution, Committee, PolicyDimensions, CountryProfile, Bloc } from "@/types";
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

const TOPIC_TO_ISSUE_WEIGHTS: Record<string, Record<string, number>> = {
  "Palestinian conflict": { "human-rights": 0.6, decolonization: 0.8, sovereignty: 0.5 },
  "Nuclear weapons and nuclear material": { disarmament: 0.9, security: 0.7, nuclear: 1.0 },
  "Arms control and disarmament": { disarmament: 1.0, security: 0.8 },
  "Colonialism": { decolonization: 1.0, sovereignty: 0.7 },
  "Human rights": { "human-rights": 1.0 },
  "Economic development": { development: 1.0, trade: 0.5, climate: 0.3 },
};

interface OntologyOverride {
  nodes: { id: string; type: string; label: string; attributes: Record<string, number | string> }[];
  edges: { source: string; target: string; type: string; weight: number }[];
  modifiedAttributes: Record<string, Record<string, number>>;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rcid, overrides } = body as { rcid: number; overrides: OntologyOverride };

    if (!rcid) {
      return NextResponse.json({ error: "No resolution ID provided" }, { status: 400 });
    }

    const catalog = loadCatalog();
    const resolution = catalog.find((r: Record<string, unknown>) => r.rcid === rcid) as {
      rcid: number; title: string; description: string; topic: string;
      actualVote: { yes: number; no: number; abstain: number }; passed: boolean; totalVoters: number;
    } | undefined;

    if (!resolution) {
      return NextResponse.json({ error: "Resolution not found" }, { status: 404 });
    }

    const policyVector = TOPIC_TO_POLICY_VECTOR[resolution.topic] || {
      sovereignty: 0, humanRights: 0, development: 0, security: 0, environment: 0, decolonization: 0,
    };
    const issueWeights = TOPIC_TO_ISSUE_WEIGHTS[resolution.topic] || {};

    const analyzedResolution: AnalyzedResolution = {
      id: `whatif-${rcid}`,
      title: resolution.title,
      committee: "GA_PLENARY" as Committee,
      preamble: [],
      operativeClauses: [{ id: "op1", text: resolution.description, strength: 0.7, topics: Object.keys(issueWeights), policyDimensions: policyVector }],
      sponsors: [],
      policyVector,
      issueWeights,
      contentionPoints: [],
      historicalPrecedents: [],
    };

    let profiles = await loadCountryProfiles();
    const blocs = await loadBlocs();
    const graphData = loadGraphCore() as {
      votingPatterns: Record<string, Record<string, { yes: number; no: number; abstain: number; total: number }>>;
      graph: {
        nodes: { key: string; attributes: Record<string, unknown> }[];
        edges: { source: string; target: string; attributes: Record<string, unknown> }[];
      };
    };

    // Apply ontology overrides
    let modifiedGraphData = graphData;
    if (overrides) {
      // Deep clone graph data for modification
      modifiedGraphData = {
        votingPatterns: { ...graphData.votingPatterns },
        graph: {
          nodes: [...graphData.graph.nodes],
          edges: [...graphData.graph.edges],
        },
      };

      // Apply attribute modifications to country profiles
      if (overrides.modifiedAttributes) {
        profiles = profiles.map((p: CountryProfile) => {
          const mods = overrides.modifiedAttributes[`country:${p.iso3}`];
          if (!mods) return p;

          const modified = { ...p };
          if (mods.idealPoint !== undefined) modified.idealPoint = mods.idealPoint;
          if (mods.democracyIndex !== undefined) modified.democracyIndex = mods.democracyIndex;

          // Policy dimension overrides
          const dimMods: Partial<PolicyDimensions> = {};
          if (mods.sovereignty !== undefined) dimMods.sovereignty = mods.sovereignty;
          if (mods.humanRights !== undefined) dimMods.humanRights = mods.humanRights;
          if (mods.development !== undefined) dimMods.development = mods.development;
          if (mods.security !== undefined) dimMods.security = mods.security;
          if (mods.environment !== undefined) dimMods.environment = mods.environment;
          if (mods.decolonization !== undefined) dimMods.decolonization = mods.decolonization;

          if (Object.keys(dimMods).length > 0) {
            modified.policyDimensions = { ...p.policyDimensions, ...dimMods };
          }

          return modified;
        });
      }

      // When idealPoint shifts dramatically, adjust voting patterns to reflect new alignment.
      // If a country moves from +0.7 (Global South) to -0.5 (Western), their voting pattern
      // on topics like "Palestinian conflict" should flip accordingly.
      if (overrides.modifiedAttributes) {
        const originalProfiles = await loadCountryProfiles();
        for (const [key, mods] of Object.entries(overrides.modifiedAttributes)) {
          const iso3 = key.replace("country:", "");
          if (mods.idealPoint === undefined) continue;

          const original = originalProfiles.find((p: CountryProfile) => p.iso3 === iso3);
          if (!original) continue;

          const shift = mods.idealPoint - original.idealPoint;
          if (Math.abs(shift) < 0.3) continue;

          // Significant shift — interpolate voting patterns toward a reference country
          // that represents the new position
          const currentPatterns = modifiedGraphData.votingPatterns[iso3];
          if (!currentPatterns) continue;

          // Find a reference country near the new idealPoint
          const newIdealPoint = mods.idealPoint;
          let referenceIso: string | null = null;
          let bestDist = Infinity;
          for (const p of originalProfiles) {
            if (p.iso3 === iso3) continue;
            const dist = Math.abs(p.idealPoint - newIdealPoint);
            if (dist < bestDist && modifiedGraphData.votingPatterns[p.iso3]) {
              bestDist = dist;
              referenceIso = p.iso3;
            }
          }

          if (referenceIso && modifiedGraphData.votingPatterns[referenceIso]) {
            const refPatterns = modifiedGraphData.votingPatterns[referenceIso];
            const blendFactor = Math.min(1, Math.abs(shift) / 1.5);
            const blended: Record<string, { yes: number; no: number; abstain: number; total: number }> = {};

            for (const topic of Object.keys(currentPatterns)) {
              const orig = currentPatterns[topic];
              const ref = refPatterns[topic];
              if (!ref) { blended[topic] = orig; continue; }

              blended[topic] = {
                yes: Math.round(orig.yes * (1 - blendFactor) + ref.yes * blendFactor),
                no: Math.round(orig.no * (1 - blendFactor) + ref.no * blendFactor),
                abstain: Math.round(orig.abstain * (1 - blendFactor) + ref.abstain * blendFactor),
                total: orig.total,
              };
            }

            modifiedGraphData.votingPatterns = { ...modifiedGraphData.votingPatterns, [iso3]: blended };
          }
        }
      }

      // Add new alliance/rivalry edges
      if (overrides.edges && overrides.edges.length > 0) {
        for (const edge of overrides.edges) {
          if (edge.type === "ALLIES_WITH" || edge.type === "RIVALS_WITH") {
            modifiedGraphData.graph.edges.push({
              source: `country:${edge.source}`,
              target: `country:${edge.target}`,
              attributes: { edgeType: edge.type, similarity: edge.weight, sharedVotes: 0, period: "custom" },
            });
          }
        }
      }
    }

    // Run simulation with base graph
    const baseResult = simulateWithGraph(profiles, analyzedResolution, "GA_PLENARY", blocs, graphData);

    // Run simulation with modified graph
    const modifiedResult = overrides
      ? simulateWithGraph(profiles, analyzedResolution, "GA_PLENARY", blocs, modifiedGraphData)
      : baseResult;

    // Compute diffs
    const diffs: { iso3: string; name: string; basePrediction: string; modifiedPrediction: string; shifted: boolean }[] = [];
    if (overrides) {
      for (let i = 0; i < baseResult.countryVotes.length; i++) {
        const base = baseResult.countryVotes[i];
        const mod = modifiedResult.countryVotes[i];
        if (base.vote !== mod.vote) {
          diffs.push({
            iso3: base.iso3,
            name: base.name,
            basePrediction: base.vote,
            modifiedPrediction: mod.vote,
            shifted: true,
          });
        }
      }
    }

    return NextResponse.json({
      resolution: { rcid: resolution.rcid, title: resolution.title, topic: resolution.topic },
      baseline: { totals: baseResult.totals, passed: baseResult.passed },
      modified: { totals: modifiedResult.totals, passed: modifiedResult.passed, countryVotes: modifiedResult.countryVotes },
      actual: { totals: resolution.actualVote, passed: resolution.passed },
      diffs,
      overridesApplied: overrides ? {
        attributeChanges: Object.keys(overrides.modifiedAttributes || {}).length,
        edgesAdded: (overrides.edges || []).length,
        nodesAdded: (overrides.nodes || []).length,
      } : null,
    });
  } catch (e) {
    console.error("What-if simulation failed:", e);
    return NextResponse.json({ error: "Simulation failed" }, { status: 500 });
  }
}
