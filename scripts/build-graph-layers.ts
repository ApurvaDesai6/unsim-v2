/**
 * Split the full knowledge graph into optimized layers for different use cases:
 *
 * 1. graph-viz.json (~1-2MB) — country + bloc + topic nodes, alliance/rivalry edges
 *    Used by: frontend visualization (sigma.js / react-force-graph)
 *
 * 2. graph-core.json (~3-5MB) — all nodes + alliance + membership edges + pre-computed
 *    voting patterns per country-topic pair
 *    Used by: vote engine (loaded server-side)
 *
 * 3. graph-temporal.json (~10MB) — full vote edges with year/session for temporal queries
 *    Used by: deep exploration queries (lazy-loaded on demand)
 *
 * Usage: npx tsx scripts/build-graph-layers.ts
 */

import { readFileSync, writeFileSync } from "fs";
import path from "path";

const DATA_DIR = path.join(__dirname, "../data");

console.log("Loading full knowledge graph...");
const fullGraph = JSON.parse(readFileSync(path.join(DATA_DIR, "knowledge-graph.json"), "utf-8"));

const nodes = fullGraph.graph.nodes as { key: string; attributes: Record<string, unknown> }[];
const edges = fullGraph.graph.edges as { key: string; source: string; target: string; attributes: Record<string, unknown> }[];

console.log(`  ${nodes.length} nodes, ${edges.length} edges`);

// ─── Layer 1: Visualization graph ────────────────────────────────────

console.log("\nBuilding Layer 1: Visualization graph...");

const vizNodes = nodes.filter((n) =>
  n.attributes.type === "country" || n.attributes.type === "bloc" || n.attributes.type === "topic"
);

const vizEdges = edges.filter((e) => {
  const et = (e.attributes as { edgeType: string }).edgeType;
  return et === "ALLIES_WITH" || et === "RIVALS_WITH" || et === "MEMBER_OF";
});

// For visualization, only keep top-5 allies per country (reduce edge density)
const allyCountPerCountry = new Map<string, number>();
const filteredVizEdges = vizEdges.filter((e) => {
  const et = (e.attributes as { edgeType: string }).edgeType;
  if (et !== "ALLIES_WITH") return true;
  const count = allyCountPerCountry.get(e.source) ?? 0;
  if (count >= 5) return false;
  allyCountPerCountry.set(e.source, count + 1);
  return true;
});

const vizGraph = {
  meta: { ...fullGraph.meta, layer: "visualization", description: "Country alliance network for interactive graph exploration" },
  stats: { nodes: vizNodes.length, edges: filteredVizEdges.length },
  graph: { options: fullGraph.graph.options, attributes: {}, nodes: vizNodes, edges: filteredVizEdges },
};

const vizPath = path.join(DATA_DIR, "graph-viz.json");
writeFileSync(vizPath, JSON.stringify(vizGraph));
const vizSize = (Buffer.byteLength(JSON.stringify(vizGraph)) / 1024 / 1024).toFixed(1);
console.log(`  ✓ ${vizPath} (${vizSize} MB) — ${vizNodes.length} nodes, ${filteredVizEdges.length} edges`);

// ─── Layer 2: Core graph with pre-computed patterns ──────────────────

console.log("\nBuilding Layer 2: Core graph with voting patterns...");

// Pre-compute voting patterns per country per topic
const votingPatterns: Record<string, Record<string, { yes: number; no: number; abstain: number; total: number }>> = {};

// Build resolution → topic mapping from nodes
const resolutionTopics = new Map<string, string>();
for (const e of edges) {
  if ((e.attributes as { edgeType: string }).edgeType === "ADDRESSES") {
    resolutionTopics.set(e.source, e.target.replace("topic:", ""));
  }
}

// Aggregate votes by country + topic
for (const e of edges) {
  const ea = e.attributes as { edgeType: string; vote?: string; year?: number };
  if (ea.edgeType !== "VOTED_ON") continue;

  const countryIso3 = e.source.replace("country:", "");
  const resId = e.target;
  const topic = resolutionTopics.get(resId);
  if (!topic) continue;

  if (!votingPatterns[countryIso3]) votingPatterns[countryIso3] = {};
  if (!votingPatterns[countryIso3][topic]) votingPatterns[countryIso3][topic] = { yes: 0, no: 0, abstain: 0, total: 0 };

  const bucket = votingPatterns[countryIso3][topic];
  if (ea.vote === "yes") bucket.yes++;
  else if (ea.vote === "no") bucket.no++;
  else bucket.abstain++;
  bucket.total++;
}

// Also compute temporal patterns (decade buckets)
const temporalPatterns: Record<string, Record<string, Record<string, { yes: number; no: number; abstain: number; total: number }>>> = {};

for (const e of edges) {
  const ea = e.attributes as { edgeType: string; vote?: string; year?: number };
  if (ea.edgeType !== "VOTED_ON" || !ea.year) continue;

  const countryIso3 = e.source.replace("country:", "");
  const resId = e.target;
  const topic = resolutionTopics.get(resId);
  if (!topic) continue;

  const decade = `${Math.floor(ea.year / 10) * 10}s`;

  if (!temporalPatterns[countryIso3]) temporalPatterns[countryIso3] = {};
  if (!temporalPatterns[countryIso3][topic]) temporalPatterns[countryIso3][topic] = {};
  if (!temporalPatterns[countryIso3][topic][decade]) temporalPatterns[countryIso3][topic][decade] = { yes: 0, no: 0, abstain: 0, total: 0 };

  const bucket = temporalPatterns[countryIso3][topic][decade];
  if (ea.vote === "yes") bucket.yes++;
  else if (ea.vote === "no") bucket.no++;
  else bucket.abstain++;
  bucket.total++;
}

// Core graph: all non-vote nodes + alliance/membership/addresses edges + computed patterns
const coreNodes = nodes.filter((n) => n.attributes.type !== "resolution");
const coreEdges = edges.filter((e) => {
  const et = (e.attributes as { edgeType: string }).edgeType;
  return et !== "VOTED_ON";
});

const coreGraph = {
  meta: { ...fullGraph.meta, layer: "core", description: "Core graph with pre-computed voting patterns for vote engine" },
  stats: { nodes: coreNodes.length, edges: coreEdges.length, countriesWithPatterns: Object.keys(votingPatterns).length },
  graph: { options: fullGraph.graph.options, attributes: {}, nodes: coreNodes, edges: coreEdges },
  votingPatterns,
  temporalPatterns,
};

const corePath = path.join(DATA_DIR, "graph-core.json");
writeFileSync(corePath, JSON.stringify(coreGraph));
const coreSize = (Buffer.byteLength(JSON.stringify(coreGraph)) / 1024 / 1024).toFixed(1);
console.log(`  ✓ ${corePath} (${coreSize} MB) — ${coreNodes.length} nodes, ${coreEdges.length} edges, ${Object.keys(votingPatterns).length} country patterns`);

// ─── Layer 3: Temporal vote edges (for deep queries) ─────────────────

console.log("\nBuilding Layer 3: Temporal vote edge index...");

// Organize vote edges by country for efficient lookup
const voteIndex: Record<string, { rcid: number; vote: string; year: number; session: number; topic?: string }[]> = {};

for (const e of edges) {
  const ea = e.attributes as { edgeType: string; vote?: string; year?: number; session?: number };
  if (ea.edgeType !== "VOTED_ON") continue;

  const countryIso3 = e.source.replace("country:", "");
  const rcid = parseInt(e.target.replace("resolution:", ""));
  const topic = resolutionTopics.get(e.target);

  if (!voteIndex[countryIso3]) voteIndex[countryIso3] = [];
  voteIndex[countryIso3].push({
    rcid,
    vote: ea.vote!,
    year: ea.year!,
    session: ea.session!,
    topic,
  });
}

// Sort each country's votes by year
for (const iso3 of Object.keys(voteIndex)) {
  voteIndex[iso3].sort((a, b) => a.year - b.year);
}

const temporalData = {
  meta: { ...fullGraph.meta, layer: "temporal", description: "Indexed vote edges by country for temporal queries" },
  stats: { countries: Object.keys(voteIndex).length, totalVotes: edges.filter((e) => (e.attributes as { edgeType: string }).edgeType === "VOTED_ON").length },
  voteIndex,
};

const temporalPath = path.join(DATA_DIR, "graph-temporal.json");
writeFileSync(temporalPath, JSON.stringify(temporalData));
const temporalSize = (Buffer.byteLength(JSON.stringify(temporalData)) / 1024 / 1024).toFixed(1);
console.log(`  ✓ ${temporalPath} (${temporalSize} MB) — ${Object.keys(voteIndex).length} countries indexed`);

// ─── Summary ─────────────────────────────────────────────────────────

console.log("\n═══════════════════════════════════════════════════════════");
console.log("  Graph Layers Complete");
console.log("═══════════════════════════════════════════════════════════");
console.log(`  Layer 1 (viz):      ${vizSize} MB — for frontend graph visualization`);
console.log(`  Layer 2 (core):     ${coreSize} MB — for vote engine (server-side)`);
console.log(`  Layer 3 (temporal): ${temporalSize} MB — for deep exploration queries`);
console.log("═══════════════════════════════════════════════════════════\n");
