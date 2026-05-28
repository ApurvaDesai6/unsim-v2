/**
 * Build a catalog of historically significant UNGA resolutions
 * with actual vote outcomes, for the homepage simulation library
 * and for calibration comparisons (predicted vs actual).
 *
 * Sources resolution metadata + actual vote tallies from our raw data.
 * Only includes resolutions marked as "important votes" and with
 * associated topics (so users can compare predictions meaningfully).
 *
 * Usage: npx tsx scripts/build-resolution-catalog.ts
 */

import { readFileSync, writeFileSync } from "fs";
import path from "path";

const DATA_DIR = path.join(__dirname, "../data");
const RAW_DIR = path.join(DATA_DIR, "raw");

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

console.log("Building resolution catalog...\n");

// Load roll calls
const rcLines = readFileSync(path.join(RAW_DIR, "roll_calls.csv"), "utf-8").split("\n").slice(1);
const rcMeta = new Map<number, { session: number; date: string; unres: string; short: string; descr: string; important: boolean; amend: boolean }>();

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
  rcMeta.set(rcid, { session, date, unres, short: shortTitle, descr, important, amend });
}

// Load issues
const issueLines = readFileSync(path.join(RAW_DIR, "issues.csv"), "utf-8").split("\n").slice(1);
const rcidToIssue = new Map<number, string>();
for (const line of issueLines) {
  if (!line.trim()) continue;
  const parts = line.split(",");
  const rcid = parseInt(parts[0]);
  const issue = parts.slice(2).join(",").replace(/"/g, "").trim();
  if (!isNaN(rcid) && issue) rcidToIssue.set(rcid, issue);
}

// Load votes and compute per-resolution tallies
const voteLines = readFileSync(path.join(RAW_DIR, "unvotes.csv"), "utf-8").split("\n").slice(1);
const voteTallies = new Map<number, { yes: number; no: number; abstain: number }>();

for (const line of voteLines) {
  if (!line.trim()) continue;
  const commaIdx = line.indexOf(",");
  const lastComma = line.lastIndexOf(",");
  const rcid = parseInt(line.substring(0, commaIdx));
  const vote = line.substring(lastComma + 1).trim();

  if (!voteTallies.has(rcid)) voteTallies.set(rcid, { yes: 0, no: 0, abstain: 0 });
  const tally = voteTallies.get(rcid)!;
  if (vote === "yes") tally.yes++;
  else if (vote === "no") tally.no++;
  else tally.abstain++;
}

// Build catalog: important votes from session 50+ with topics
const catalog: {
  rcid: number;
  session: number;
  date: string;
  unres: string;
  title: string;
  description: string;
  topic: string;
  isAmendment: boolean;
  actualVote: { yes: number; no: number; abstain: number };
  passed: boolean;
  totalVoters: number;
}[] = [];

for (const [rcid, meta] of rcMeta) {
  if (meta.session < 50) continue; // Focus on modern era (1995+)
  if (!meta.important) continue;   // Only important votes
  if (meta.amend) continue;        // Skip amendments (they're not standalone resolutions)

  const topic = rcidToIssue.get(rcid);
  if (!topic) continue; // Need topic for categorization

  const tally = voteTallies.get(rcid);
  if (!tally) continue;

  const totalVoters = tally.yes + tally.no + tally.abstain;
  if (totalVoters < 50) continue; // Skip low-participation votes

  const voting = tally.yes + tally.no;
  const passed = voting > 0 && tally.yes / voting >= 0.5;

  catalog.push({
    rcid,
    session: meta.session,
    date: meta.date,
    unres: meta.unres,
    title: meta.short,
    description: meta.descr.substring(0, 300),
    topic,
    isAmendment: meta.amend,
    actualVote: tally,
    passed,
    totalVoters,
  });
}

// Sort by session (newest first), then by number of voters (most contentious first)
catalog.sort((a, b) => {
  if (b.session !== a.session) return b.session - a.session;
  return b.totalVoters - a.totalVoters;
});

console.log(`Total important resolutions with topics (session 50+): ${catalog.length}`);
console.log(`By topic:`);
const topicCounts = new Map<string, number>();
for (const r of catalog) {
  topicCounts.set(r.topic, (topicCounts.get(r.topic) ?? 0) + 1);
}
for (const [topic, count] of [...topicCounts.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${topic}: ${count}`);
}

// Write catalog
const outPath = path.join(DATA_DIR, "resolution-catalog.json");
writeFileSync(outPath, JSON.stringify(catalog, null, 2));
console.log(`\n✓ Wrote ${catalog.length} resolutions to ${outPath}`);

// Also build a compact version for the homepage (top 50 per topic)
const featured: typeof catalog = [];
for (const topic of topicCounts.keys()) {
  const topicResolutions = catalog.filter((r) => r.topic === topic);
  featured.push(...topicResolutions.slice(0, 15));
}
featured.sort((a, b) => b.session - a.session);

const featuredPath = path.join(DATA_DIR, "resolution-featured.json");
writeFileSync(featuredPath, JSON.stringify(featured, null, 2));
console.log(`✓ Wrote ${featured.length} featured resolutions to ${featuredPath}`);
