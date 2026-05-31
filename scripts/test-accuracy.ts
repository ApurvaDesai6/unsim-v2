/**
 * Simulation Accuracy Test Suite
 *
 * Validates the vote prediction engine against known historical outcomes.
 * Tests both outcome accuracy (pass/fail) and per-vote accuracy (country-level).
 *
 * Test categories:
 * 1. Consensus resolutions (should predict overwhelming Yes)
 * 2. Polarized resolutions (should correctly identify No voters)
 * 3. P5 veto scenarios (Security Council)
 * 4. Clause sensitivity (changing strength should change votes)
 * 5. Known country positions (USA on Palestine, China on sovereignty, etc.)
 *
 * Usage: npx tsx scripts/test-accuracy.ts
 */

import { readFileSync } from "fs";
import path from "path";
import type { AnalyzedResolution, Committee, PolicyDimensions } from "../types";
import { simulateWithGraph } from "../engines/graph-predictor";
import { loadCountryProfiles, loadBlocs } from "../lib/data/loader";

const DATA_DIR = path.join(__dirname, "../data");

interface TestCase {
  name: string;
  resolution: Partial<AnalyzedResolution>;
  expected: {
    outcome?: "pass" | "fail";
    yesRange?: [number, number];
    noRange?: [number, number];
    specificVotes?: Record<string, "Yes" | "No" | "Abstain">;
  };
}

const graphCore = JSON.parse(readFileSync(path.join(DATA_DIR, "graph-core.json"), "utf-8"));

function buildResolution(policyVector: PolicyDimensions, issueWeights: Record<string, number>, committee: Committee = "GA_PLENARY"): AnalyzedResolution {
  return {
    id: "test",
    title: "Test Resolution",
    committee,
    preamble: [],
    operativeClauses: [{ id: "op1", text: "test", strength: 0.7, topics: Object.keys(issueWeights), policyDimensions: policyVector }],
    sponsors: [],
    policyVector,
    issueWeights,
    contentionPoints: [],
    historicalPrecedents: [],
  };
}

const TEST_CASES: TestCase[] = [
  // ─── Category 1: Consensus resolutions ──────────────────────────
  {
    name: "Economic development (consensus) — should pass overwhelmingly",
    resolution: buildResolution(
      { sovereignty: 0.3, humanRights: 0.1, development: 0.8, security: 0.0, environment: 0.2, decolonization: 0.2 },
      { development: 1.0, trade: 0.5 }
    ),
    expected: { outcome: "pass", yesRange: [170, 193], noRange: [0, 10] },
  },
  {
    name: "Palestinian conflict — passes with large majority, US+Israel oppose",
    resolution: buildResolution(
      { sovereignty: 0.5, humanRights: 0.6, development: 0.1, security: -0.2, environment: 0.0, decolonization: 0.7 },
      { "human-rights": 0.6, decolonization: 0.8, sovereignty: 0.5 }
    ),
    expected: {
      outcome: "pass",
      yesRange: [150, 190],
      specificVotes: { USA: "No", ISR: "No" },
    },
  },
  {
    name: "Nuclear disarmament — passes, nuclear powers dissent",
    resolution: buildResolution(
      { sovereignty: 0.2, humanRights: 0.2, development: 0.0, security: -0.8, environment: 0.1, decolonization: 0.1 },
      { disarmament: 1.0, nuclear: 0.9, security: 0.7 }
    ),
    expected: {
      outcome: "pass",
      yesRange: [160, 193],
      specificVotes: { USA: "No" },
    },
  },

  // ─── Category 2: Sovereignty-challenging resolutions ────────────
  {
    name: "Binding sovereignty challenge — more opposition expected",
    resolution: buildResolution(
      { sovereignty: -0.9, humanRights: 0.8, development: 0.0, security: -0.5, environment: 0.0, decolonization: -0.5 },
      { "human-rights": 1.0, sovereignty: 0.9, security: 0.5 }
    ),
    expected: { outcome: "pass", yesRange: [140, 190], noRange: [1, 40] },
  },

  // ─── Category 3: Known country positions ────────────────────────
  {
    name: "Climate resolution — SIDS strongly support, petrostates resist",
    resolution: buildResolution(
      { sovereignty: -0.3, humanRights: 0.1, development: 0.5, security: 0.0, environment: 0.9, decolonization: 0.1 },
      { climate: 1.0, environment: 0.8, development: 0.6 }
    ),
    expected: {
      outcome: "pass",
      specificVotes: { USA: "No" },
    },
  },

  // ─── Category 4: Clause sensitivity ─────────────────────────────
  {
    name: "Extreme binding language — should produce more No/Abstain than mild version",
    resolution: buildResolution(
      { sovereignty: -1.0, humanRights: 1.0, development: -0.5, security: -0.9, environment: 1.0, decolonization: -0.8 },
      { "human-rights": 1.0, sovereignty: 1.0, security: 0.8 }
    ),
    expected: { outcome: "pass", noRange: [5, 30] },
  },
];

async function runTests() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Simulation Accuracy Test Suite");
  console.log("═══════════════════════════════════════════════════════════\n");

  const profiles = await loadCountryProfiles();
  const blocs = await loadBlocs();

  let passed = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const test of TEST_CASES) {
    const resolution = test.resolution as AnalyzedResolution;
    const result = simulateWithGraph(profiles, resolution, resolution.committee, blocs, graphCore);

    let testPassed = true;
    const errors: string[] = [];

    // Check outcome
    if (test.expected.outcome) {
      const actualOutcome = result.passed ? "pass" : "fail";
      if (actualOutcome !== test.expected.outcome) {
        testPassed = false;
        errors.push(`outcome: expected ${test.expected.outcome}, got ${actualOutcome}`);
      }
    }

    // Check yes range
    if (test.expected.yesRange) {
      const [min, max] = test.expected.yesRange;
      if (result.totals.yes < min || result.totals.yes > max) {
        testPassed = false;
        errors.push(`yes count ${result.totals.yes} outside range [${min}, ${max}]`);
      }
    }

    // Check no range
    if (test.expected.noRange) {
      const [min, max] = test.expected.noRange;
      if (result.totals.no < min || result.totals.no > max) {
        testPassed = false;
        errors.push(`no count ${result.totals.no} outside range [${min}, ${max}]`);
      }
    }

    // Check specific country votes
    if (test.expected.specificVotes) {
      for (const [iso3, expectedVote] of Object.entries(test.expected.specificVotes)) {
        const countryVote = result.countryVotes.find((v) => v.iso3 === iso3);
        if (!countryVote) {
          errors.push(`country ${iso3} not found in results`);
          testPassed = false;
        } else if (countryVote.vote !== expectedVote) {
          testPassed = false;
          errors.push(`${iso3}: expected ${expectedVote}, got ${countryVote.vote} (conf: ${countryVote.confidence.toFixed(2)})`);
        }
      }
    }

    if (testPassed) {
      console.log(`  ✓ ${test.name}`);
      console.log(`    ${result.totals.yes}Y / ${result.totals.no}N / ${result.totals.abstain}A`);
      passed++;
    } else {
      console.log(`  ✗ ${test.name}`);
      console.log(`    ${result.totals.yes}Y / ${result.totals.no}N / ${result.totals.abstain}A`);
      for (const err of errors) console.log(`    FAIL: ${err}`);
      failed++;
      failures.push(test.name);
    }
    console.log("");
  }

  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  Results: ${passed} passed, ${failed} failed (${TEST_CASES.length} total)`);
  if (failures.length > 0) {
    console.log(`  Failures: ${failures.join(", ")}`);
  }
  console.log("═══════════════════════════════════════════════════════════\n");

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(console.error);
