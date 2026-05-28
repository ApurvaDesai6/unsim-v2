import Graph from "graphology";
import type { AnyNodeAttrs, AnyEdgeAttrs } from "./types";
import { readFileSync } from "fs";
import path from "path";

interface CoreLayer {
  meta: Record<string, unknown>;
  stats: Record<string, unknown>;
  graph: {
    options: Record<string, unknown>;
    attributes: Record<string, unknown>;
    nodes: { key: string; attributes: Record<string, unknown> }[];
    edges: { key: string; source: string; target: string; attributes: Record<string, unknown> }[];
  };
  votingPatterns: Record<string, Record<string, { yes: number; no: number; abstain: number; total: number }>>;
  temporalPatterns: Record<string, Record<string, Record<string, { yes: number; no: number; abstain: number; total: number }>>>;
}

interface TemporalLayer {
  meta: Record<string, unknown>;
  stats: Record<string, unknown>;
  voteIndex: Record<string, { rcid: number; vote: string; year: number; session: number; topic?: string }[]>;
}

let vizGraphCache: Graph<AnyNodeAttrs, AnyEdgeAttrs> | null = null;
let coreLayerCache: CoreLayer | null = null;
let temporalLayerCache: TemporalLayer | null = null;

/**
 * Load the visualization graph (country alliance network).
 * ~0.4MB, suitable for client-side use.
 */
export async function loadVizGraph(): Promise<Graph<AnyNodeAttrs, AnyEdgeAttrs>> {
  if (vizGraphCache) return vizGraphCache;

  const filePath = path.join(process.cwd(), "data", "graph-viz.json");
  const data = JSON.parse(readFileSync(filePath, "utf-8"));
  const graph = new Graph<AnyNodeAttrs, AnyEdgeAttrs>({ multi: true, type: "directed" });

  for (const node of data.graph.nodes) {
    graph.addNode(node.key, node.attributes as AnyNodeAttrs);
  }
  for (const edge of data.graph.edges) {
    graph.addEdge(edge.source, edge.target, edge.attributes as unknown as AnyEdgeAttrs);
  }

  vizGraphCache = graph;
  return graph;
}

/**
 * Load the core graph layer (voting patterns + alliance edges).
 * ~0.9MB, used server-side by the vote engine.
 */
export async function loadCoreLayer(): Promise<CoreLayer> {
  if (coreLayerCache) return coreLayerCache;

  const filePath = path.join(process.cwd(), "data", "graph-core.json");
  coreLayerCache = JSON.parse(readFileSync(filePath, "utf-8"));
  return coreLayerCache!;
}

/**
 * Load the temporal vote index for deep queries.
 * ~22MB, loaded on-demand for country deep-dive pages.
 */
export async function loadTemporalLayer(): Promise<TemporalLayer> {
  if (temporalLayerCache) return temporalLayerCache;

  const filePath = path.join(process.cwd(), "data", "graph-temporal.json");
  temporalLayerCache = JSON.parse(readFileSync(filePath, "utf-8"));
  return temporalLayerCache!;
}

/**
 * Get pre-computed voting pattern for a country on a topic.
 * Uses the core layer (sub-1ms lookup).
 */
export async function getVotingPattern(
  iso3: string,
  topic: string,
): Promise<{ yesRate: number; noRate: number; abstainRate: number; sampleSize: number } | null> {
  const core = await loadCoreLayer();
  const countryData = core.votingPatterns[iso3];
  if (!countryData) return null;
  const pattern = countryData[topic];
  if (!pattern || pattern.total === 0) return null;

  return {
    yesRate: pattern.yes / pattern.total,
    noRate: pattern.no / pattern.total,
    abstainRate: pattern.abstain / pattern.total,
    sampleSize: pattern.total,
  };
}

/**
 * Get temporal voting trend for a country on a topic (by decade).
 */
export async function getTemporalTrend(
  iso3: string,
  topic: string,
): Promise<{ decade: string; yesRate: number; noRate: number; abstainRate: number; sampleSize: number }[]> {
  const core = await loadCoreLayer();
  const countryData = core.temporalPatterns?.[iso3];
  if (!countryData) return [];
  const topicData = countryData[topic];
  if (!topicData) return [];

  return Object.entries(topicData)
    .map(([decade, counts]) => ({
      decade,
      yesRate: counts.total > 0 ? counts.yes / counts.total : 0,
      noRate: counts.total > 0 ? counts.no / counts.total : 0,
      abstainRate: counts.total > 0 ? counts.abstain / counts.total : 0,
      sampleSize: counts.total,
    }))
    .sort((a, b) => a.decade.localeCompare(b.decade));
}

/**
 * Get a country's full vote history from the temporal layer.
 * Supports filtering by topic and year range.
 */
export async function getCountryVoteHistory(
  iso3: string,
  options?: { topic?: string; startYear?: number; endYear?: number; limit?: number },
): Promise<{ rcid: number; vote: string; year: number; session: number; topic?: string }[]> {
  const temporal = await loadTemporalLayer();
  let votes = temporal.voteIndex[iso3] || [];

  if (options?.topic) {
    votes = votes.filter((v) => v.topic === options.topic);
  }
  if (options?.startYear) {
    votes = votes.filter((v) => v.year >= options.startYear!);
  }
  if (options?.endYear) {
    votes = votes.filter((v) => v.year <= options.endYear!);
  }
  if (options?.limit) {
    votes = votes.slice(-options.limit);
  }

  return votes;
}

/**
 * Get alliance data from the core graph layer.
 */
export async function getCountryAlliances(iso3: string): Promise<{
  allies: { iso3: string; name: string; similarity: number }[];
  rivals: { iso3: string; name: string; similarity: number }[];
}> {
  const core = await loadCoreLayer();
  const countryId = `country:${iso3}`;

  const allies: { iso3: string; name: string; similarity: number }[] = [];
  const rivals: { iso3: string; name: string; similarity: number }[] = [];

  for (const edge of core.graph.edges) {
    if (edge.source !== countryId) continue;
    const ea = edge.attributes as unknown as AnyEdgeAttrs;

    if (ea.edgeType === "ALLIES_WITH") {
      const targetIso = edge.target.replace("country:", "");
      const targetNode = core.graph.nodes.find((n) => n.key === edge.target);
      const name = (targetNode?.attributes as { name?: string })?.name ?? targetIso;
      allies.push({ iso3: targetIso, name, similarity: (ea as { similarity: number }).similarity });
    } else if (ea.edgeType === "RIVALS_WITH") {
      const targetIso = edge.target.replace("country:", "");
      const targetNode = core.graph.nodes.find((n) => n.key === edge.target);
      const name = (targetNode?.attributes as { name?: string })?.name ?? targetIso;
      rivals.push({ iso3: targetIso, name, similarity: (ea as { similarity: number }).similarity });
    }
  }

  allies.sort((a, b) => b.similarity - a.similarity);
  rivals.sort((a, b) => a.similarity - b.similarity);

  return { allies: allies.slice(0, 10), rivals: rivals.slice(0, 5) };
}
