/**
 * Build the UNSim Knowledge Graph from raw data sources.
 *
 * Ingests:
 * 1. Country profiles → country nodes
 * 2. Blocs → bloc nodes + MEMBER_OF edges
 * 3. Raw UNGA votes (869K records) → resolution nodes + VOTED_ON edges
 * 4. Issues → topic nodes + ADDRESSES edges
 * 5. Vote similarity matrix → ALLIES_WITH / RIVALS_WITH edges
 *
 * Output: data/knowledge-graph.json (serialized graphology graph)
 *
 * Usage: npx tsx scripts/build-knowledge-graph.ts
 */

import { readFileSync, writeFileSync } from "fs";
import path from "path";
import Graph from "graphology";
import type {
  CountryNodeAttrs,
  ResolutionNodeAttrs,
  TopicNodeAttrs,
  BlocNodeAttrs,
  VoteEdgeAttrs,
  AllianceEdgeAttrs,
  AnyNodeAttrs,
  AnyEdgeAttrs,
} from "../lib/knowledge-graph/types";

const DATA_DIR = path.join(__dirname, "../data");
const RAW_DIR = path.join(DATA_DIR, "raw");

console.log("═══════════════════════════════════════════════════════════");
console.log("  UNSim Knowledge Graph Builder");
console.log("═══════════════════════════════════════════════════════════\n");

const graph = new Graph<AnyNodeAttrs, AnyEdgeAttrs>({
  multi: true,
  type: "directed",
});

// ─── Step 1: Country nodes ────────────────────────────────────────────

console.log("Step 1: Loading country profiles...");
const profiles = JSON.parse(readFileSync(path.join(DATA_DIR, "country-profiles.json"), "utf-8"));

for (const p of profiles) {
  const attrs: CountryNodeAttrs = {
    type: "country",
    name: p.name,
    iso3: p.iso3,
    region: p.region,
    idealPoint: p.idealPoint,
    democracyIndex: p.democracyIndex,
    governmentType: p.governmentType,
    gdpPerCapita: p.gdpPerCapita,
    population: p.population,
    scStatus: p.scStatus,
  };
  graph.addNode(`country:${p.iso3}`, attrs);
}
console.log(`  ✓ ${profiles.length} country nodes`);

// ─── Step 2: Bloc nodes + membership edges ────────────────────────────

console.log("Step 2: Loading blocs...");
const blocs = JSON.parse(readFileSync(path.join(DATA_DIR, "blocs.json"), "utf-8"));

for (const b of blocs) {
  const attrs: BlocNodeAttrs = {
    type: "bloc",
    name: b.name,
    shortName: b.shortName,
    memberCount: b.members.length,
    cohesionScore: b.cohesionScore,
    policyLeanings: b.policyLeanings,
  };
  graph.addNode(`bloc:${b.shortName}`, attrs);

  for (const memberIso3 of b.members) {
    const countryId = `country:${memberIso3}`;
    if (graph.hasNode(countryId)) {
      graph.addEdge(countryId, `bloc:${b.shortName}`, { edgeType: "MEMBER_OF" as const });
    }
  }
}
console.log(`  ✓ ${blocs.length} bloc nodes + membership edges`);

// ─── Step 3: Topic nodes ──────────────────────────────────────────────

console.log("Step 3: Loading topics/issues...");
const issuesCsv = readFileSync(path.join(RAW_DIR, "issues.csv"), "utf-8");
const issueLines = issuesCsv.split("\n").slice(1);

const rcidToIssue = new Map<number, string>();
const topicCounts = new Map<string, number>();

for (const line of issueLines) {
  if (!line.trim()) continue;
  const parts = line.split(",");
  const rcid = parseInt(parts[0]);
  const issueName = parts.slice(2).join(",").replace(/"/g, "").trim();
  if (isNaN(rcid) || !issueName) continue;
  rcidToIssue.set(rcid, issueName);
  topicCounts.set(issueName, (topicCounts.get(issueName) ?? 0) + 1);
}

for (const [topicName, count] of topicCounts) {
  const attrs: TopicNodeAttrs = {
    type: "topic",
    name: topicName,
    category: topicName,
    resolutionCount: count,
  };
  graph.addNode(`topic:${topicName}`, attrs);
}
console.log(`  ✓ ${topicCounts.size} topic nodes (from ${rcidToIssue.size} issue mappings)`);

// ─── Step 4: Resolution nodes + vote edges ────────────────────────────

console.log("Step 4: Loading roll calls and votes (this may take a moment)...");
const rollCallsCsv = readFileSync(path.join(RAW_DIR, "roll_calls.csv"), "utf-8");
const rcLines = rollCallsCsv.split("\n").slice(1);

const rcMeta = new Map<number, { session: number; date: string; unres: string; short: string; descr: string; importantVote: boolean; amend: boolean }>();

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

for (const line of rcLines) {
  if (!line.trim()) continue;
  const fields = parseCSVLine(line);
  if (fields.length < 8) continue;

  const rcid = parseInt(fields[0]);
  const session = parseInt(fields[1]);
  const important = fields[2] === "1";
  const date = fields[3];
  const unres = fields[4];
  const amend = fields[5] === "1";
  const shortTitle = fields[7] || "";
  const descr = fields[8] || "";

  if (isNaN(rcid) || isNaN(session)) continue;
  rcMeta.set(rcid, { session, date, unres, short: shortTitle, descr, importantVote: important, amend });
}

console.log(`  Parsed ${rcMeta.size} roll call records`);

// Filter to sessions 55+ (2000-present) for manageable graph size
// while still maintaining historical depth
const MIN_SESSION = 55;
const recentRcids = new Set<number>();
for (const [rcid, meta] of rcMeta) {
  if (meta.session >= MIN_SESSION) recentRcids.add(rcid);
}
console.log(`  Filtering to session ${MIN_SESSION}+ → ${recentRcids.size} resolutions`);

// Add resolution nodes for recent sessions
for (const rcid of recentRcids) {
  const meta = rcMeta.get(rcid)!;
  const yearMatch = meta.date.match(/^(\d{4})/);
  const attrs: ResolutionNodeAttrs = {
    type: "resolution",
    rcid,
    session: meta.session,
    date: meta.date,
    unres: meta.unres,
    shortTitle: meta.short,
    description: meta.descr,
    importantVote: meta.importantVote,
    isAmendment: meta.amend,
    topic: rcidToIssue.get(rcid),
  };
  graph.addNode(`resolution:${rcid}`, attrs);

  // ADDRESSES edge to topic
  const topic = rcidToIssue.get(rcid);
  if (topic && graph.hasNode(`topic:${topic}`)) {
    graph.addEdge(`resolution:${rcid}`, `topic:${topic}`, { edgeType: "ADDRESSES" as const });
  }
}
console.log(`  ✓ ${recentRcids.size} resolution nodes`);

// Load votes
console.log("  Loading vote edges...");
const votesCsv = readFileSync(path.join(RAW_DIR, "unvotes.csv"), "utf-8");
const voteLines = votesCsv.split("\n").slice(1);

// Build country code → ISO3 mapping
const codeToIso3 = new Map<string, string>();
for (const p of profiles) {
  // The unvotes CSV uses 2-letter codes; we need to map them
  codeToIso3.set(p.iso3.substring(0, 2), p.iso3);
}

// The CSV has country_code as 2-letter ISO — build a proper mapping
const COUNTRY_CODE_MAP: Record<string, string> = {};
const votesByCountryName = new Map<string, string>(); // name → iso3

for (const p of profiles) {
  votesByCountryName.set(p.name.toLowerCase(), p.iso3);
}

// Additional mappings for common name discrepancies in UN data
const NAME_FIXES: Record<string, string> = {
  "united states": "USA", "united states of america": "USA",
  "united kingdom": "GBR", "united kingdom of great britain and northern ireland": "GBR",
  "russia": "RUS", "russian federation": "RUS",
  "china": "CHN", "people's republic of china": "CHN",
  "france": "FRA", "french republic": "FRA",
  "south korea": "KOR", "republic of korea": "KOR", "korea, republic of": "KOR",
  "north korea": "PRK", "democratic people's republic of korea": "PRK", "korea, democratic people's republic of": "PRK",
  "iran": "IRN", "iran (islamic republic of)": "IRN", "iran, islamic republic of": "IRN",
  "syria": "SYR", "syrian arab republic": "SYR",
  "tanzania": "TZA", "united republic of tanzania": "TZA",
  "venezuela": "VEN", "venezuela (bolivarian republic of)": "VEN", "venezuela, bolivarian republic of": "VEN",
  "bolivia": "BOL", "bolivia (plurinational state of)": "BOL", "bolivia, plurinational state of": "BOL",
  "laos": "LAO", "lao people's democratic republic": "LAO",
  "vietnam": "VNM", "viet nam": "VNM",
  "ivory coast": "CIV", "côte d'ivoire": "CIV", "cote d'ivoire": "CIV",
  "myanmar": "MMR", "burma": "MMR",
  "congo": "COG", "republic of the congo": "COG",
  "dr congo": "COD", "democratic republic of the congo": "COD", "congo, democratic republic of the": "COD",
  "czech republic": "CZE", "czechia": "CZE",
  "swaziland": "SWZ", "eswatini": "SWZ",
  "cape verde": "CPV", "cabo verde": "CPV",
  "east timor": "TLS", "timor-leste": "TLS",
  "micronesia (federated states of)": "FSM", "micronesia": "FSM",
  "moldova": "MDA", "republic of moldova": "MDA", "moldova, republic of": "MDA",
  "macedonia": "MKD", "north macedonia": "MKD", "the former yugoslav republic of macedonia": "MKD",
  "brunei": "BRN", "brunei darussalam": "BRN",
  "palestine": "PSE", "state of palestine": "PSE",
};

function resolveCountryName(name: string): string | undefined {
  const lower = name.toLowerCase().trim();
  const fix = NAME_FIXES[lower];
  if (fix) return fix;
  const match = votesByCountryName.get(lower);
  if (match) return match;
  return undefined;
}

let voteEdgeCount = 0;
let skippedVotes = 0;

for (const line of voteLines) {
  if (!line.trim()) continue;
  const commaIdx1 = line.indexOf(",");
  const commaIdx2 = line.indexOf(",", commaIdx1 + 1);
  const commaIdx3 = line.indexOf(",", commaIdx2 + 1);

  const rcid = parseInt(line.substring(0, commaIdx1));
  const countryName = line.substring(commaIdx1 + 1, commaIdx2);
  const vote = line.substring(commaIdx3 + 1).trim();

  if (!recentRcids.has(rcid)) continue;

  const iso3 = resolveCountryName(countryName);
  if (!iso3 || !graph.hasNode(`country:${iso3}`)) {
    skippedVotes++;
    continue;
  }

  const resId = `resolution:${rcid}`;
  if (!graph.hasNode(resId)) continue;

  const normalizedVote = vote === "yes" ? "yes" : vote === "no" ? "no" : "abstain";
  const meta = rcMeta.get(rcid)!;
  const yearMatch = meta.date.match(/^(\d{4})/);
  const year = yearMatch ? parseInt(yearMatch[1]) : 2000;

  const attrs: VoteEdgeAttrs = {
    edgeType: "VOTED_ON",
    vote: normalizedVote as "yes" | "no" | "abstain",
    session: meta.session,
    year,
  };

  graph.addEdge(`country:${iso3}`, resId, attrs);
  voteEdgeCount++;
}

console.log(`  ✓ ${voteEdgeCount.toLocaleString()} vote edges (${skippedVotes} skipped due to name mismatches)`);

// ─── Step 5: Alliance/rivalry edges from vote-similarity ──────────────

console.log("Step 5: Loading vote similarity → alliance/rivalry edges...");
const simData = JSON.parse(readFileSync(path.join(DATA_DIR, "vote-similarity.json"), "utf-8"));

let allianceCount = 0;
let rivalCount = 0;

for (const [countryName, data] of Object.entries(simData.similarities || {})) {
  const iso3 = resolveCountryName(countryName);
  if (!iso3 || !graph.hasNode(`country:${iso3}`)) continue;

  const countryData = data as { mostSimilar?: { country: string; similarity: number; shared: number }[]; mostDissimilar?: { country: string; similarity: number; shared: number }[] };

  // Top 10 allies
  for (const ally of (countryData.mostSimilar || []).slice(0, 10)) {
    const allyIso3 = resolveCountryName(ally.country);
    if (!allyIso3 || !graph.hasNode(`country:${allyIso3}`)) continue;

    const attrs: AllianceEdgeAttrs = {
      edgeType: "ALLIES_WITH",
      similarity: ally.similarity,
      sharedVotes: ally.shared,
      period: "2000-2019",
    };
    graph.addEdge(`country:${iso3}`, `country:${allyIso3}`, attrs);
    allianceCount++;
  }

  // Top 5 rivals
  for (const rival of (countryData.mostDissimilar || []).slice(0, 5)) {
    const rivalIso3 = resolveCountryName(rival.country);
    if (!rivalIso3 || !graph.hasNode(`country:${rivalIso3}`)) continue;

    const attrs: AllianceEdgeAttrs = {
      edgeType: "RIVALS_WITH",
      similarity: rival.similarity,
      sharedVotes: rival.shared,
      period: "2000-2019",
    };
    graph.addEdge(`country:${iso3}`, `country:${rivalIso3}`, attrs);
    rivalCount++;
  }
}

console.log(`  ✓ ${allianceCount} alliance edges, ${rivalCount} rivalry edges`);

// ─── Step 6: Serialize and write ──────────────────────────────────────

console.log("\nStep 6: Serializing graph...");

const serialized = {
  meta: {
    generatedAt: new Date().toISOString(),
    graphologyVersion: "0.25",
    sessions: `${MIN_SESSION}–74`,
    options: graph.type,
  },
  stats: {
    nodes: graph.order,
    edges: graph.size,
    countries: profiles.length,
    resolutions: recentRcids.size,
    topics: topicCounts.size,
    blocs: blocs.length,
    voteEdges: voteEdgeCount,
    allianceEdges: allianceCount,
    rivalryEdges: rivalCount,
  },
  graph: graph.export(),
};

const outPath = path.join(DATA_DIR, "knowledge-graph.json");
writeFileSync(outPath, JSON.stringify(serialized));
const fileSizeMB = (Buffer.byteLength(JSON.stringify(serialized)) / 1024 / 1024).toFixed(1);

console.log(`\n═══════════════════════════════════════════════════════════`);
console.log(`  Knowledge Graph Built Successfully`);
console.log(`═══════════════════════════════════════════════════════════`);
console.log(`  Nodes: ${graph.order.toLocaleString()}`);
console.log(`  Edges: ${graph.size.toLocaleString()}`);
console.log(`  File:  ${outPath} (${fileSizeMB} MB)`);
console.log(`═══════════════════════════════════════════════════════════\n`);
