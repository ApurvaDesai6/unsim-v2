/**
 * Validate the current graph-predictor engine against real UNGA votes.
 * Produces an updated validation report with per-vote accuracy, outcome accuracy,
 * regional breakdown, issue breakdown, and calibration data.
 *
 * Usage: npx tsx scripts/validate-current-engine.ts
 */

import { readFileSync, writeFileSync } from "fs";
import path from "path";
import type { CountryProfile, Bloc, PolicyDimensions, AnalyzedResolution } from "../types";
import { simulateWithGraph } from "../engines/graph-predictor";

const DATA_DIR = path.join(__dirname, "../data");

const profiles: CountryProfile[] = JSON.parse(readFileSync(path.join(DATA_DIR, "country-profiles.json"), "utf-8"));
const blocs: Bloc[] = JSON.parse(readFileSync(path.join(DATA_DIR, "blocs.json"), "utf-8"));
const graphCore = JSON.parse(readFileSync(path.join(DATA_DIR, "graph-core.json"), "utf-8"));
const topicHistory: Record<string, Record<string, { yesRate: number; noRate: number; abstainRate: number; sampleSize: number }>> = JSON.parse(readFileSync(path.join(DATA_DIR, "topic-history.json"), "utf-8"));

// Load raw votes for validation
const RAW_DIR = path.join(DATA_DIR, "raw");
const votesCsv = readFileSync(path.join(RAW_DIR, "unvotes.csv"), "utf-8");
const rcCsv = readFileSync(path.join(RAW_DIR, "roll_calls.csv"), "utf-8");
const issuesCsv = readFileSync(path.join(RAW_DIR, "issues.csv"), "utf-8");

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === "," && !inQuotes) { fields.push(current); current = ""; }
    else current += ch;
  }
  fields.push(current);
  return fields;
}

// Parse roll calls
const rcLines = rcCsv.split("\n").slice(1);
const rcMeta = new Map<number, { session: number; date: string }>();
for (const line of rcLines) {
  if (!line.trim()) continue;
  const fields = parseCSVLine(line);
  const rcid = parseInt(fields[0]);
  const session = parseInt(fields[1]);
  const date = fields[3];
  if (!isNaN(rcid)) rcMeta.set(rcid, { session, date });
}

// Parse issues
const issueLines = issuesCsv.split("\n").slice(1);
const rcidToIssue = new Map<number, string>();
for (const line of issueLines) {
  if (!line.trim()) continue;
  const parts = line.split(",");
  const rcid = parseInt(parts[0]);
  const issue = parts.slice(2).join(",").replace(/"/g, "").trim();
  if (!isNaN(rcid) && issue) rcidToIssue.set(rcid, issue);
}

// Issue → policy vector mapping
const ISSUE_VECTORS: Record<string, PolicyDimensions> = {
  "Palestinian conflict": { sovereignty: 0.5, humanRights: 0.6, development: 0.1, security: -0.2, environment: 0.0, decolonization: 0.7 },
  "Nuclear weapons and nuclear material": { sovereignty: 0.2, humanRights: 0.2, development: 0.0, security: -0.7, environment: 0.1, decolonization: 0.1 },
  "Arms control and disarmament": { sovereignty: 0.1, humanRights: 0.1, development: 0.0, security: -0.6, environment: 0.0, decolonization: 0.0 },
  "Colonialism": { sovereignty: 0.6, humanRights: 0.4, development: 0.3, security: 0.0, environment: 0.0, decolonization: 0.9 },
  "Human rights": { sovereignty: -0.3, humanRights: 0.8, development: 0.1, security: 0.0, environment: 0.0, decolonization: 0.1 },
  "Economic development": { sovereignty: 0.3, humanRights: 0.1, development: 0.8, security: 0.0, environment: 0.2, decolonization: 0.2 },
};

const ISSUE_WEIGHTS: Record<string, Record<string, number>> = {
  "Palestinian conflict": { "human-rights": 0.6, decolonization: 0.8, sovereignty: 0.5 },
  "Nuclear weapons and nuclear material": { disarmament: 0.9, security: 0.7, nuclear: 1.0 },
  "Arms control and disarmament": { disarmament: 1.0, security: 0.8 },
  "Colonialism": { decolonization: 1.0, sovereignty: 0.7 },
  "Human rights": { "human-rights": 1.0 },
  "Economic development": { development: 1.0, trade: 0.5, climate: 0.3 },
};

// Name matching
const nameToIso3 = new Map<string, string>();
for (const p of profiles) {
  nameToIso3.set(p.name.toLowerCase(), p.iso3);
}
const NAME_FIXES: Record<string, string> = {
  "united states": "USA", "united kingdom": "GBR", "russia": "RUS", "russian federation": "RUS",
  "china": "CHN", "south korea": "KOR", "republic of korea": "KOR", "north korea": "PRK",
  "iran": "IRN", "iran (islamic republic of)": "IRN", "syria": "SYR", "syrian arab republic": "SYR",
  "tanzania": "TZA", "united republic of tanzania": "TZA", "venezuela": "VEN",
  "bolivia": "BOL", "bolivia (plurinational state of)": "BOL", "laos": "LAO",
  "vietnam": "VNM", "viet nam": "VNM", "ivory coast": "CIV", "côte d'ivoire": "CIV",
  "myanmar": "MMR", "congo": "COG", "dr congo": "COD", "democratic republic of the congo": "COD",
  "czech republic": "CZE", "czechia": "CZE", "swaziland": "SWZ", "eswatini": "SWZ",
  "cape verde": "CPV", "cabo verde": "CPV", "micronesia": "FSM",
  "micronesia (federated states of)": "FSM", "moldova": "MDA", "republic of moldova": "MDA",
  "north macedonia": "MKD", "brunei": "BRN", "brunei darussalam": "BRN",
};

function resolveCountry(name: string): string | undefined {
  const lower = name.toLowerCase().trim();
  return NAME_FIXES[lower] || nameToIso3.get(lower);
}

console.log("═══════════════════════════════════════════════════════════");
console.log("  Graph Predictor Validation (Current Engine)");
console.log("═══════════════════════════════════════════════════════════\n");

// Load actual votes for sessions 60-74 (2005-2019)
const MIN_SESSION = 60;
const validRcids = new Set<number>();
for (const [rcid, meta] of rcMeta) {
  if (meta.session >= MIN_SESSION && rcidToIssue.has(rcid)) validRcids.add(rcid);
}
console.log(`Evaluating ${validRcids.size} resolutions (sessions ${MIN_SESSION}+, with issue classification)\n`);

// Parse actual votes
const actualVotes = new Map<number, Map<string, string>>(); // rcid → (iso3 → vote)
const voteLines = votesCsv.split("\n").slice(1);
for (const line of voteLines) {
  if (!line.trim()) continue;
  const commaIdx1 = line.indexOf(",");
  const commaIdx2 = line.indexOf(",", commaIdx1 + 1);
  const lastComma = line.lastIndexOf(",");
  const rcid = parseInt(line.substring(0, commaIdx1));
  if (!validRcids.has(rcid)) continue;
  const countryName = line.substring(commaIdx1 + 1, commaIdx2);
  const vote = line.substring(lastComma + 1).trim();
  const iso3 = resolveCountry(countryName);
  if (!iso3) continue;
  if (!actualVotes.has(rcid)) actualVotes.set(rcid, new Map());
  actualVotes.get(rcid)!.set(iso3, vote);
}

// Run predictions
let totalPredictions = 0;
let correctPredictions = 0;
let outcomeCorrect = 0;
let outcomeTotal = 0;
const perClass: Record<string, { tp: number; fp: number; fn: number }> = {
  yes: { tp: 0, fp: 0, fn: 0 },
  no: { tp: 0, fp: 0, fn: 0 },
  abstain: { tp: 0, fp: 0, fn: 0 },
};
const byIssue: Record<string, { correct: number; total: number }> = {};
const byRegion: Record<string, { correct: number; total: number }> = {};

let processedResolutions = 0;
for (const rcid of validRcids) {
  const issue = rcidToIssue.get(rcid)!;
  const policyVector = ISSUE_VECTORS[issue];
  const issueWeights = ISSUE_WEIGHTS[issue];
  if (!policyVector || !issueWeights) continue;

  const resolution: AnalyzedResolution = {
    id: `val-${rcid}`,
    title: issue,
    committee: "GA_PLENARY",
    preamble: [],
    operativeClauses: [{ id: "op1", text: "", strength: 0.7, topics: Object.keys(issueWeights), policyDimensions: policyVector }],
    sponsors: [],
    policyVector,
    issueWeights,
    contentionPoints: [],
    historicalPrecedents: [],
  };

  const result = simulateWithGraph(profiles, resolution, "GA_PLENARY", blocs, graphCore);
  const votes = actualVotes.get(rcid);
  if (!votes) continue;

  // Outcome accuracy
  const actualYes = [...votes.values()].filter((v) => v === "yes").length;
  const actualNo = [...votes.values()].filter((v) => v === "no").length;
  const actualTotal = actualYes + actualNo;
  const actualPassed = actualTotal > 0 && actualYes / actualTotal >= 0.5;
  if (result.passed === actualPassed) outcomeCorrect++;
  outcomeTotal++;

  // Per-vote accuracy
  for (const cv of result.countryVotes) {
    const actualVote = votes.get(cv.iso3);
    if (!actualVote) continue;
    const predicted = cv.vote.toLowerCase();
    const actual = actualVote.toLowerCase();

    totalPredictions++;
    if (predicted === actual) correctPredictions++;

    // Per-class metrics
    if (predicted === actual) perClass[predicted].tp++;
    else {
      perClass[predicted].fp++;
      perClass[actual].fn++;
    }

    // By issue
    if (!byIssue[issue]) byIssue[issue] = { correct: 0, total: 0 };
    byIssue[issue].total++;
    if (predicted === actual) byIssue[issue].correct++;

    // By region
    const profile = profiles.find((p) => p.iso3 === cv.iso3);
    if (profile) {
      if (!byRegion[profile.region]) byRegion[profile.region] = { correct: 0, total: 0 };
      byRegion[profile.region].total++;
      if (predicted === actual) byRegion[profile.region].correct++;
    }
  }

  processedResolutions++;
  if (processedResolutions % 200 === 0) {
    console.log(`  Processed ${processedResolutions} resolutions...`);
  }
}

console.log(`\n  Processed ${processedResolutions} resolutions total\n`);

// Compute F1 scores
function f1(cls: { tp: number; fp: number; fn: number }): number {
  const precision = cls.tp / (cls.tp + cls.fp || 1);
  const recall = cls.tp / (cls.tp + cls.fn || 1);
  return 2 * precision * recall / (precision + recall || 1);
}

const report = {
  meta: {
    generatedAt: new Date().toISOString(),
    engineVersion: "2.0.0-graph-predictor",
    dataSource: "Voeten UNGA Voting Data (sessions 60-74, 2005-2019)",
    dataUrl: "https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/LEJUQZ",
    originalSource: "Bailey, Strezhnev, and Voeten (2017), Journal of Conflict Resolution",
    totalPredictions,
    resolutionsEvaluated: processedResolutions,
  },
  overall: {
    perVoteAccuracy: correctPredictions / totalPredictions,
    resolutionOutcomeAccuracy: outcomeCorrect / outcomeTotal,
    correctPredictions,
    totalPredictions,
    outcomeCorrect,
    outcomeTotal,
  },
  perClass: Object.fromEntries(
    Object.entries(perClass).map(([cls, metrics]) => [cls, {
      precision: metrics.tp / (metrics.tp + metrics.fp || 1),
      recall: metrics.tp / (metrics.tp + metrics.fn || 1),
      f1: f1(metrics),
      tp: metrics.tp, fp: metrics.fp, fn: metrics.fn,
    }]),
  ),
  byIssue: Object.fromEntries(
    Object.entries(byIssue).map(([issue, m]) => [issue, { accuracy: m.correct / m.total, total: m.total, correct: m.correct }]),
  ),
  byRegion: Object.fromEntries(
    Object.entries(byRegion).map(([region, m]) => [region, { accuracy: m.correct / m.total, total: m.total, correct: m.correct }]),
  ),
  methodology: {
    approach: "Graph-enhanced multi-signal predictor with intensity-adaptive weighting. For each resolution with known issue classification, computes predicted votes for all 193 countries and compares to actual recorded vote.",
    weights: "Topic Voting History (30%, damped by resolution intensity), Policy Dimension Alignment (30%, amplified by intensity), Alliance Network KNN (15%), Ideal Point Alignment (15%, amplified), Bloc Coordination (10%)",
    features: [
      "Multi-topic blended scoring (weighted across all 6 Voeten categories simultaneously)",
      "Resolution intensity damping: extreme/binding language reduces reliance on historical averages",
      "Alliance signal from vote-similarity KNN (top-10 neighbors)",
      "Empirical abstain rate calibration from per-country per-topic graph data",
      "Two-pass computation: first pass without alliance signal, second pass with peer effects",
    ],
    limitations: [
      "Uses static policy vectors per issue category rather than per-resolution text analysis",
      "Country-specific resolutions (naming a particular state) have higher error due to sovereignty dynamics not captured in topic averages",
      "Temporal drift not modeled — uses same ideal points for all years in validation window",
      "WEOG accuracy lower because Western countries show more issue-dependent variation",
    ],
    dataSources: [
      "Erik Voeten UNGA Voting Data (Harvard Dataverse): 869K roll-call votes, ideal points, issue categories",
      "Vote Similarity Matrix: pairwise cosine similarity from co-voting patterns (sessions 55-74)",
      "V-Dem v14: democracy indices, regime classification",
      "Bloc memberships: G77, NAM, EU, African Group, AOSIS, Arab Group, CARICOM",
    ],
  },
};

console.log("═══════════════════════════════════════════════════════════");
console.log("  RESULTS");
console.log("═══════════════════════════════════════════════════════════");
console.log(`  Per-vote accuracy:     ${(report.overall.perVoteAccuracy * 100).toFixed(1)}% (${correctPredictions}/${totalPredictions})`);
console.log(`  Outcome accuracy:      ${(report.overall.resolutionOutcomeAccuracy * 100).toFixed(1)}% (${outcomeCorrect}/${outcomeTotal})`);
console.log("");
console.log("  Per-class F1:");
for (const [cls, m] of Object.entries(report.perClass)) {
  console.log(`    ${cls.padEnd(8)} F1=${(m.f1 * 100).toFixed(1)}%  P=${(m.precision * 100).toFixed(1)}%  R=${(m.recall * 100).toFixed(1)}%`);
}
console.log("");
console.log("  By issue:");
for (const [issue, m] of Object.entries(report.byIssue).sort((a, b) => b[1].accuracy - a[1].accuracy)) {
  console.log(`    ${issue.padEnd(40)} ${(m.accuracy * 100).toFixed(1)}% (${m.correct}/${m.total})`);
}
console.log("");
console.log("  By region:");
for (const [region, m] of Object.entries(report.byRegion).sort((a, b) => b[1].accuracy - a[1].accuracy)) {
  console.log(`    ${region.padEnd(10)} ${(m.accuracy * 100).toFixed(1)}% (${m.correct}/${m.total})`);
}

const outPath = path.join(DATA_DIR, "validation-report-large.json");
writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(`\n  Written to ${outPath}`);
console.log("═══════════════════════════════════════════════════════════\n");
