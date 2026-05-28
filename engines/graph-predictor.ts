/**
 * Graph-Enhanced Vote Predictor
 *
 * Uses the knowledge graph's pre-computed data layers for prediction:
 * 1. Graph-derived topic voting history (35%) — actual per-country rates from UNGA votes
 * 2. Alliance network signal (20%) — what similar-voting countries predict
 * 3. Policy dimension alignment (20%) — 6-dim weighted dot product
 * 4. Ideal point alignment (15%) — empirical Voeten ideal points
 * 5. Bloc coordination (10%) — peer pressure from formal blocs
 *
 * Key advantage over the static predictor: topic history and alliance signals
 * come directly from the knowledge graph's pre-computed layers, giving us
 * empirically grounded predictions without runtime graph traversal.
 */

import type {
  AnalyzedResolution,
  Bloc,
  Committee,
  CountryProfile,
  CountryVote,
  PolicyDimensions,
  PositionFactor,
  VoteResult,
} from "@/types";
import { getCommitteeConfig, isP5, isSCMember } from "./committees";

// ─── Types for graph data ────────────────────────────────────────────

interface GraphVotingPatterns {
  [iso3: string]: {
    [topic: string]: { yes: number; no: number; abstain: number; total: number };
  };
}

interface GraphAlliances {
  [countryId: string]: {
    iso3: string;
    name: string;
    similarity: number;
  }[];
}

interface GraphCoreData {
  votingPatterns: GraphVotingPatterns;
  graph: {
    nodes: { key: string; attributes: Record<string, unknown> }[];
    edges: { source: string; target: string; attributes: Record<string, unknown> }[];
  };
}

// ─── Weights ─────────────────────────────────────────────────────────

const WEIGHTS = {
  topicHistory: 0.30,
  allianceSignal: 0.15,
  policyDimension: 0.30,
  idealPoint: 0.15,
  blocPressure: 0.10,
} as const;

// ─── Issue mapping (resolution topics → Voeten categories) ──────────

const ISSUE_MAPPING: Record<string, string[]> = {
  "Palestinian conflict": ["human-rights", "decolonization", "sovereignty"],
  "Nuclear weapons and nuclear material": ["disarmament", "security", "nuclear"],
  "Arms control and disarmament": ["disarmament", "security"],
  "Colonialism": ["decolonization", "sovereignty"],
  "Human rights": ["human-rights"],
  "Economic development": ["development", "trade", "climate"],
};

function findBestMatchingTopic(issueWeights: Record<string, number>): string | null {
  let bestTopic: string | null = null;
  let bestScore = 0;

  for (const [voetanTopic, keywords] of Object.entries(ISSUE_MAPPING)) {
    let score = 0;
    for (const kw of keywords) {
      score += issueWeights[kw] || 0;
    }
    if (score > bestScore) {
      bestScore = score;
      bestTopic = voetanTopic;
    }
  }

  return bestTopic;
}

// ─── Core computation functions ──────────────────────────────────────

function softmax3(scores: [number, number, number]): [number, number, number] {
  const max = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - max)) as [number, number, number];
  const sum = exps[0] + exps[1] + exps[2];
  return [exps[0] / sum, exps[1] / sum, exps[2] / sum];
}

function computeTopicHistoryScore(
  iso3: string,
  resolution: AnalyzedResolution,
  votingPatterns: GraphVotingPatterns,
): { score: number; confidence: number; topic: string | null } {
  const patterns = votingPatterns[iso3];
  if (!patterns) return { score: 0, confidence: 0, topic: null };

  // Multi-topic blended scoring: weight each matching topic by relevance
  const topicScores: { topic: string; score: number; weight: number; confidence: number }[] = [];

  for (const [voetanTopic, keywords] of Object.entries(ISSUE_MAPPING)) {
    let relevance = 0;
    for (const kw of keywords) {
      relevance += resolution.issueWeights[kw] || 0;
    }
    if (relevance <= 0) continue;

    const topicData = patterns[voetanTopic];
    if (!topicData || topicData.total < 10) continue;

    const yesRate = topicData.yes / topicData.total;
    const noRate = topicData.no / topicData.total;
    const score = yesRate - noRate;
    const sampleConfidence = Math.min(1, topicData.total / 100);

    topicScores.push({ topic: voetanTopic, score, weight: relevance, confidence: sampleConfidence });
  }

  if (topicScores.length === 0) {
    return { score: 0, confidence: 0, topic: null };
  }

  // Weighted blend of all matching topics
  let weightedScore = 0;
  let totalWeight = 0;
  let maxConfidence = 0;
  let primaryTopic = topicScores[0].topic;

  for (const ts of topicScores) {
    weightedScore += ts.score * ts.weight * ts.confidence;
    totalWeight += ts.weight * ts.confidence;
    if (ts.weight > (topicScores.find((t) => t.topic === primaryTopic)?.weight || 0)) {
      primaryTopic = ts.topic;
    }
    maxConfidence = Math.max(maxConfidence, ts.confidence);
  }

  const finalScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
  const decisiveness = Math.abs(finalScore);

  return {
    score: finalScore,
    confidence: decisiveness * maxConfidence,
    topic: primaryTopic,
  };
}

function computeAllianceSignal(
  iso3: string,
  firstPassScores: Map<string, number>,
  alliances: GraphAlliances,
): number {
  const allyKey = `country:${iso3}`;
  const allies = alliances[allyKey];
  if (!allies || allies.length === 0) return 0;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const ally of allies.slice(0, 10)) {
    const allyScore = firstPassScores.get(ally.iso3);
    if (allyScore === undefined) continue;
    const weight = ally.similarity;
    weightedSum += allyScore * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? Math.max(-1, Math.min(1, weightedSum / totalWeight)) : 0;
}

function computeDimensionScore(country: PolicyDimensions, resolution: PolicyDimensions): number {
  const keys: (keyof PolicyDimensions)[] = [
    "sovereignty", "humanRights", "development", "security", "environment", "decolonization",
  ];
  let sum = 0;
  let weightSum = 0;
  for (const k of keys) {
    const resVal = resolution[k] || 0;
    const weight = Math.abs(resVal);
    sum += (country[k] || 0) * resVal * weight;
    weightSum += weight;
  }
  return weightSum > 0 ? Math.max(-1, Math.min(1, sum / weightSum)) : 0;
}

function computeIdealPointScore(countryIdealPoint: number, resolutionVector: PolicyDimensions): number {
  const vals = Object.values(resolutionVector);
  const resPosition = vals.reduce((a, b) => a + b, 0) / vals.length;
  return 1 - Math.abs(countryIdealPoint - resPosition) * 1.5;
}

// ─── Main simulation function ─────────────────────────────────────────

export function simulateWithGraph(
  profiles: CountryProfile[],
  resolution: AnalyzedResolution,
  committee: Committee,
  blocs: Bloc[],
  graphData: GraphCoreData,
): VoteResult {
  const config = getCommitteeConfig(committee);

  const members = committee === "SECURITY_COUNCIL"
    ? profiles.filter((p) => isSCMember(p.iso3))
    : profiles;

  // Build alliance lookup from graph edges
  const alliances: GraphAlliances = {};
  for (const edge of graphData.graph.edges) {
    const ea = edge.attributes as { edgeType?: string; similarity?: number };
    if (ea.edgeType !== "ALLIES_WITH") continue;
    if (!alliances[edge.source]) alliances[edge.source] = [];
    const targetNode = graphData.graph.nodes.find((n) => n.key === edge.target);
    const targetAttrs = targetNode?.attributes as { iso3?: string; name?: string } | undefined;
    if (targetAttrs) {
      alliances[edge.source].push({
        iso3: targetAttrs.iso3 || edge.target.replace("country:", ""),
        name: targetAttrs.name || "",
        similarity: ea.similarity || 0.5,
      });
    }
  }

  // First pass: compute without alliance signal
  const firstPassScores = new Map<string, number>();

  for (const country of members) {
    const topicResult = computeTopicHistoryScore(country.iso3, resolution, graphData.votingPatterns);
    const dimScore = computeDimensionScore(country.policyDimensions, resolution.policyVector);
    const idealScore = computeIdealPointScore(country.idealPoint, resolution.policyVector);

    const firstPassComposite =
      (WEIGHTS.topicHistory / 0.7) * topicResult.score * (topicResult.confidence > 0.3 ? 1 : 0.5) +
      (WEIGHTS.policyDimension / 0.7) * dimScore +
      (WEIGHTS.idealPoint / 0.7) * idealScore;

    firstPassScores.set(country.iso3, firstPassComposite);
  }

  // Second pass: full computation with alliance signal
  const countryVotes: CountryVote[] = [];
  const totals = { yes: 0, no: 0, abstain: 0 };

  for (const country of members) {
    const factors: PositionFactor[] = [];

    const topicResult = computeTopicHistoryScore(country.iso3, resolution, graphData.votingPatterns);
    factors.push({
      name: "Topic Voting History",
      weight: WEIGHTS.topicHistory,
      score: topicResult.score,
      description: topicResult.topic
        ? `Historical voting rate on "${topicResult.topic}" (confidence: ${(topicResult.confidence * 100).toFixed(0)}%)`
        : "No matching topic found in voting history",
    });

    const allianceScore = computeAllianceSignal(country.iso3, firstPassScores, alliances);
    factors.push({
      name: "Alliance Network",
      weight: WEIGHTS.allianceSignal,
      score: allianceScore,
      description: "Signal from top-10 most similar voting partners in the knowledge graph",
    });

    const dimScore = computeDimensionScore(country.policyDimensions, resolution.policyVector);
    factors.push({
      name: "Policy Dimensions",
      weight: WEIGHTS.policyDimension,
      score: dimScore,
      description: "6-dimensional policy alignment (sovereignty, human rights, development, security, environment, decolonization)",
    });

    const idealScore = computeIdealPointScore(country.idealPoint, resolution.policyVector);
    factors.push({
      name: "Ideal Point Alignment",
      weight: WEIGHTS.idealPoint,
      score: idealScore,
      description: "Voeten empirical ideal point vs resolution aggregate position",
    });

    // Bloc pressure from graph membership
    let blocScore = 0;
    const countryBlocs = graphData.graph.edges
      .filter((e) => e.source === `country:${country.iso3}` && (e.attributes as { edgeType?: string }).edgeType === "MEMBER_OF")
      .map((e) => e.target.replace("bloc:", ""));

    if (countryBlocs.length > 0) {
      let blocSum = 0;
      let blocWeight = 0;
      for (const blocId of countryBlocs) {
        const bloc = blocs.find((b) => b.shortName === blocId);
        if (!bloc) continue;
        let peerSum = 0;
        let peerCount = 0;
        for (const memberId of bloc.members) {
          if (memberId === country.iso3) continue;
          const peerScore = firstPassScores.get(memberId);
          if (peerScore !== undefined) {
            peerSum += peerScore;
            peerCount++;
          }
        }
        if (peerCount > 0) {
          blocSum += (peerSum / peerCount) * bloc.cohesionScore;
          blocWeight += bloc.cohesionScore;
        }
      }
      blocScore = blocWeight > 0 ? blocSum / blocWeight : 0;
    }

    factors.push({
      name: "Bloc Coordination",
      weight: WEIGHTS.blocPressure,
      score: blocScore,
      description: `Peer pressure from ${countryBlocs.join(", ") || "no"} bloc memberships`,
    });

    // Resolution intensity: how extreme/binding is the language?
    // Higher intensity = more contentious = topic history less reliable
    const resIntensity = Object.values(resolution.policyVector).reduce((s, v) => s + Math.abs(v), 0) / 6;
    const topicDamping = Math.max(0.3, 1 - resIntensity * 0.7);

    // Composite score — intense resolutions weight dimensions more, topic less
    const composite =
      WEIGHTS.topicHistory * topicResult.score * topicDamping * (topicResult.confidence > 0.3 ? 1 : 0.5) +
      WEIGHTS.allianceSignal * allianceScore +
      WEIGHTS.policyDimension * dimScore * (1 + resIntensity * 0.5) +
      WEIGHTS.idealPoint * idealScore * (1 + resIntensity * 0.3) +
      WEIGHTS.blocPressure * blocScore;

    // Abstain calibration using empirical abstain rate from graph
    const patterns = graphData.votingPatterns[country.iso3];
    const matchedTopic = findBestMatchingTopic(resolution.issueWeights);
    const empiricalAbstainRate = patterns?.[matchedTopic || ""]
      ? patterns[matchedTopic!].abstain / patterns[matchedTopic!].total
      : 0.1;
    const abstainBias = empiricalAbstainRate * 1.5 + (1 - Math.abs(composite)) * 0.3;

    const rawScores: [number, number, number] = [
      composite * 3.5,
      -composite * 3.5,
      abstainBias - 0.4,
    ];

    const [pYes, pNo, pAbstain] = softmax3(rawScores);

    let vote: "Yes" | "No" | "Abstain";
    if (pYes >= pNo && pYes >= pAbstain) vote = "Yes";
    else if (pNo >= pYes && pNo >= pAbstain) vote = "No";
    else vote = "Abstain";

    countryVotes.push({
      iso3: country.iso3,
      name: country.name,
      vote,
      probability: { yes: pYes, no: pNo, abstain: pAbstain },
      confidence: Math.max(pYes, pNo, pAbstain),
      factors,
    });

    if (vote === "Yes") totals.yes++;
    else if (vote === "No") totals.no++;
    else totals.abstain++;
  }

  // Outcome determination
  let passed: boolean;
  let vetoedBy: string[] | undefined;

  if (config.hasVeto) {
    vetoedBy = countryVotes
      .filter((v) => isP5(v.iso3) && v.vote === "No")
      .map((v) => v.iso3);
    passed = vetoedBy.length === 0 && totals.yes / (totals.yes + totals.no || 1) >= config.threshold;
  } else {
    const voting = totals.yes + totals.no;
    passed = voting > 0 && totals.yes / voting >= config.threshold;
  }

  return {
    committee,
    totals,
    passed,
    vetoedBy: vetoedBy && vetoedBy.length > 0 ? vetoedBy : undefined,
    countryVotes,
    timestamp: Date.now(),
  };
}
