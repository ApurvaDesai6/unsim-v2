import Graph from "graphology";
import type {
  AnyNodeAttrs,
  AnyEdgeAttrs,
  CountryNodeAttrs,
  ResolutionNodeAttrs,
  TopicNodeAttrs,
  BlocNodeAttrs,
  VoteEdgeAttrs,
  AllianceEdgeAttrs,
  TemporalSlice,
  VotingPattern,
  CountryGraphProfile,
  GraphStats,
} from "./types";

/**
 * UNSim Knowledge Graph — built on graphology.
 *
 * Wraps graphology with domain-specific query methods for UN diplomatic data.
 * The graph is multi-directed (multiple edges between same nodes are possible,
 * e.g. a country votes on many resolutions).
 *
 * Node ID conventions:
 *   - Countries: "country:{iso3}" e.g. "country:USA"
 *   - Resolutions: "resolution:{rcid}" e.g. "resolution:3"
 *   - Topics: "topic:{name}" e.g. "topic:Palestinian conflict"
 *   - Blocs: "bloc:{id}" e.g. "bloc:g77"
 */
export class UNKnowledgeGraph {
  readonly graph: Graph<AnyNodeAttrs, AnyEdgeAttrs>;

  constructor() {
    this.graph = new Graph<AnyNodeAttrs, AnyEdgeAttrs>({
      multi: true,
      type: "directed",
    });
  }

  // ─── Node creation ───────────────────────────────────────────────────

  addCountry(attrs: CountryNodeAttrs): void {
    this.graph.addNode(`country:${attrs.iso3}`, attrs);
  }

  addResolution(attrs: ResolutionNodeAttrs): void {
    this.graph.addNode(`resolution:${attrs.rcid}`, attrs);
  }

  addTopic(attrs: TopicNodeAttrs): void {
    this.graph.addNode(`topic:${attrs.name}`, attrs);
  }

  addBloc(attrs: BlocNodeAttrs): void {
    this.graph.addNode(`bloc:${attrs.shortName}`, attrs);
  }

  // ─── Edge creation ───────────────────────────────────────────────────

  addVote(countryIso3: string, rcid: number, attrs: VoteEdgeAttrs): void {
    const src = `country:${countryIso3}`;
    const tgt = `resolution:${rcid}`;
    if (!this.graph.hasNode(src) || !this.graph.hasNode(tgt)) return;
    this.graph.addEdge(src, tgt, attrs);
  }

  addAlliance(country1: string, country2: string, attrs: AllianceEdgeAttrs): void {
    const src = `country:${country1}`;
    const tgt = `country:${country2}`;
    if (!this.graph.hasNode(src) || !this.graph.hasNode(tgt)) return;
    this.graph.addEdge(src, tgt, attrs);
  }

  addMembership(countryIso3: string, blocId: string): void {
    const src = `country:${countryIso3}`;
    const tgt = `bloc:${blocId}`;
    if (!this.graph.hasNode(src) || !this.graph.hasNode(tgt)) return;
    this.graph.addEdge(src, tgt, { edgeType: "MEMBER_OF" as const });
  }

  addResolutionTopic(rcid: number, topicName: string): void {
    const src = `resolution:${rcid}`;
    const tgt = `topic:${topicName}`;
    if (!this.graph.hasNode(src) || !this.graph.hasNode(tgt)) return;
    this.graph.addEdge(src, tgt, { edgeType: "ADDRESSES" as const });
  }

  // ─── Queries ─────────────────────────────────────────────────────────

  getCountryNode(iso3: string): CountryNodeAttrs | undefined {
    const id = `country:${iso3}`;
    if (!this.graph.hasNode(id)) return undefined;
    return this.graph.getNodeAttributes(id) as CountryNodeAttrs;
  }

  getAllCountries(): CountryNodeAttrs[] {
    return this.graph
      .filterNodes((_, attrs) => attrs.type === "country")
      .map((id) => this.graph.getNodeAttributes(id) as CountryNodeAttrs);
  }

  getAllBlocs(): BlocNodeAttrs[] {
    return this.graph
      .filterNodes((_, attrs) => attrs.type === "bloc")
      .map((id) => this.graph.getNodeAttributes(id) as BlocNodeAttrs);
  }

  /**
   * Get all blocs a country belongs to.
   */
  getCountryBlocs(iso3: string): BlocNodeAttrs[] {
    const countryId = `country:${iso3}`;
    if (!this.graph.hasNode(countryId)) return [];

    const blocs: BlocNodeAttrs[] = [];
    this.graph.forEachOutEdge(countryId, (_, attrs, __, target) => {
      if ((attrs as AnyEdgeAttrs).edgeType === "MEMBER_OF") {
        const blocAttrs = this.graph.getNodeAttributes(target);
        if (blocAttrs.type === "bloc") blocs.push(blocAttrs as BlocNodeAttrs);
      }
    });
    return blocs;
  }

  /**
   * Get all members of a bloc.
   */
  getBlocMembers(blocId: string): CountryNodeAttrs[] {
    const nodeId = `bloc:${blocId}`;
    if (!this.graph.hasNode(nodeId)) return [];

    const members: CountryNodeAttrs[] = [];
    this.graph.forEachInEdge(nodeId, (_, attrs, source) => {
      if ((attrs as AnyEdgeAttrs).edgeType === "MEMBER_OF") {
        const countryAttrs = this.graph.getNodeAttributes(source);
        if (countryAttrs.type === "country") members.push(countryAttrs as CountryNodeAttrs);
      }
    });
    return members;
  }

  /**
   * Get a country's allies (sorted by similarity, descending).
   */
  getCountryAllies(iso3: string, limit: number = 10): { country: CountryNodeAttrs; similarity: number }[] {
    const countryId = `country:${iso3}`;
    if (!this.graph.hasNode(countryId)) return [];

    const allies: { country: CountryNodeAttrs; similarity: number }[] = [];
    this.graph.forEachOutEdge(countryId, (_, attrs, __, target) => {
      const ea = attrs as AnyEdgeAttrs;
      if (ea.edgeType === "ALLIES_WITH") {
        const targetAttrs = this.graph.getNodeAttributes(target);
        if (targetAttrs.type === "country") {
          allies.push({
            country: targetAttrs as CountryNodeAttrs,
            similarity: (ea as AllianceEdgeAttrs).similarity,
          });
        }
      }
    });

    allies.sort((a, b) => b.similarity - a.similarity);
    return allies.slice(0, limit);
  }

  /**
   * Get a country's rivals (sorted by dissimilarity).
   */
  getCountryRivals(iso3: string, limit: number = 5): { country: CountryNodeAttrs; similarity: number }[] {
    const countryId = `country:${iso3}`;
    if (!this.graph.hasNode(countryId)) return [];

    const rivals: { country: CountryNodeAttrs; similarity: number }[] = [];
    this.graph.forEachOutEdge(countryId, (_, attrs, __, target) => {
      const ea = attrs as AnyEdgeAttrs;
      if (ea.edgeType === "RIVALS_WITH") {
        const targetAttrs = this.graph.getNodeAttributes(target);
        if (targetAttrs.type === "country") {
          rivals.push({
            country: targetAttrs as CountryNodeAttrs,
            similarity: (ea as AllianceEdgeAttrs).similarity,
          });
        }
      }
    });

    rivals.sort((a, b) => a.similarity - b.similarity);
    return rivals.slice(0, limit);
  }

  /**
   * How did a country vote on resolutions about a specific topic?
   * Supports temporal filtering.
   */
  getCountryVotesOnTopic(
    iso3: string,
    topicName: string,
    temporal?: TemporalSlice,
  ): { vote: string; resolution: ResolutionNodeAttrs }[] {
    const countryId = `country:${iso3}`;
    if (!this.graph.hasNode(countryId)) return [];

    const topicResolutions = new Set<string>();
    const topicId = `topic:${topicName}`;
    if (this.graph.hasNode(topicId)) {
      this.graph.forEachInEdge(topicId, (_, attrs, source) => {
        if ((attrs as AnyEdgeAttrs).edgeType === "ADDRESSES") {
          topicResolutions.add(source);
        }
      });
    }

    const results: { vote: string; resolution: ResolutionNodeAttrs }[] = [];
    this.graph.forEachOutEdge(countryId, (_, attrs, __, target) => {
      const ea = attrs as AnyEdgeAttrs;
      if (ea.edgeType !== "VOTED_ON") return;
      if (!topicResolutions.has(target)) return;

      const voteAttrs = ea as VoteEdgeAttrs;
      if (temporal) {
        if (voteAttrs.year < temporal.startYear || voteAttrs.year > temporal.endYear) return;
      }

      const resAttrs = this.graph.getNodeAttributes(target) as ResolutionNodeAttrs;
      results.push({ vote: voteAttrs.vote, resolution: resAttrs });
    });

    return results;
  }

  /**
   * Compute voting pattern for a country on a given topic with temporal filter.
   */
  getVotingPattern(iso3: string, topicName: string, temporal?: TemporalSlice): VotingPattern | null {
    const votes = this.getCountryVotesOnTopic(iso3, topicName, temporal);
    if (votes.length === 0) return null;

    let yes = 0, no = 0, abstain = 0;
    for (const v of votes) {
      if (v.vote === "yes") yes++;
      else if (v.vote === "no") no++;
      else abstain++;
    }

    const total = votes.length;
    return {
      topic: topicName,
      yesRate: yes / total,
      noRate: no / total,
      abstainRate: abstain / total,
      sampleSize: total,
    };
  }

  /**
   * Get all voting patterns for a country across all topics.
   */
  getCountryVotingPatterns(iso3: string, temporal?: TemporalSlice): VotingPattern[] {
    const topics = this.graph
      .filterNodes((_, attrs) => attrs.type === "topic")
      .map((id) => (this.graph.getNodeAttributes(id) as TopicNodeAttrs).name);

    const patterns: VotingPattern[] = [];
    for (const topic of topics) {
      const pattern = this.getVotingPattern(iso3, topic, temporal);
      if (pattern && pattern.sampleSize >= 5) patterns.push(pattern);
    }
    return patterns;
  }

  /**
   * Get a full graph profile for a country (used by CountryPanel component).
   */
  getCountryProfile(iso3: string): CountryGraphProfile | null {
    const node = this.getCountryNode(iso3);
    if (!node) return null;

    const allies = this.getCountryAllies(iso3, 10).map((a) => ({
      iso3: a.country.iso3,
      name: a.country.name,
      similarity: a.similarity,
    }));

    const rivals = this.getCountryRivals(iso3, 5).map((r) => ({
      iso3: r.country.iso3,
      name: r.country.name,
      similarity: r.similarity,
    }));

    const blocs = this.getCountryBlocs(iso3).map((b) => b.shortName);
    const votingPatterns = this.getCountryVotingPatterns(iso3);

    let resolutionCount = 0;
    this.graph.forEachOutEdge(`country:${iso3}`, (_, attrs) => {
      if ((attrs as AnyEdgeAttrs).edgeType === "VOTED_ON") resolutionCount++;
    });

    return {
      iso3: node.iso3,
      name: node.name,
      allies,
      rivals,
      blocs,
      votingPatterns,
      resolutionCount,
      idealPoint: node.idealPoint,
      region: node.region,
    };
  }

  /**
   * Find countries that voted the same way on a set of resolutions.
   * Useful for finding ad-hoc coalitions on a specific issue.
   */
  findCoalition(rcids: number[], vote: "yes" | "no" | "abstain"): CountryNodeAttrs[] {
    const resolutionIds = new Set(rcids.map((r) => `resolution:${r}`));
    const countryCounts = new Map<string, number>();

    for (const resId of resolutionIds) {
      if (!this.graph.hasNode(resId)) continue;
      this.graph.forEachInEdge(resId, (_, attrs, source) => {
        const ea = attrs as AnyEdgeAttrs;
        if (ea.edgeType === "VOTED_ON" && (ea as VoteEdgeAttrs).vote === vote) {
          countryCounts.set(source, (countryCounts.get(source) ?? 0) + 1);
        }
      });
    }

    return [...countryCounts.entries()]
      .filter(([_, count]) => count === rcids.length)
      .map(([id]) => this.graph.getNodeAttributes(id) as CountryNodeAttrs);
  }

  /**
   * Compute how a bloc actually voted on a resolution (empirical cohesion).
   */
  getBlocVoteOnResolution(blocId: string, rcid: number): { yes: number; no: number; abstain: number; cohesion: number } {
    const members = this.getBlocMembers(blocId);
    const resId = `resolution:${rcid}`;
    if (!this.graph.hasNode(resId)) return { yes: 0, no: 0, abstain: 0, cohesion: 0 };

    let yes = 0, no = 0, abstain = 0;

    for (const member of members) {
      const countryId = `country:${member.iso3}`;
      const edges = this.graph.edges(countryId, resId);
      for (const edgeId of edges) {
        const attrs = this.graph.getEdgeAttributes(edgeId) as VoteEdgeAttrs;
        if (attrs.edgeType === "VOTED_ON") {
          if (attrs.vote === "yes") yes++;
          else if (attrs.vote === "no") no++;
          else abstain++;
        }
      }
    }

    const total = yes + no + abstain;
    const maxVote = Math.max(yes, no, abstain);
    const cohesion = total > 0 ? maxVote / total : 0;

    return { yes, no, abstain, cohesion };
  }

  /**
   * Get graph statistics.
   */
  getStats(): GraphStats {
    let countries = 0, resolutions = 0, topics = 0, blocs = 0;
    let voteEdges = 0, allianceEdges = 0, membershipEdges = 0;

    this.graph.forEachNode((_, attrs) => {
      switch (attrs.type) {
        case "country": countries++; break;
        case "resolution": resolutions++; break;
        case "topic": topics++; break;
        case "bloc": blocs++; break;
      }
    });

    this.graph.forEachEdge((_, attrs) => {
      switch ((attrs as AnyEdgeAttrs).edgeType) {
        case "VOTED_ON": voteEdges++; break;
        case "ALLIES_WITH":
        case "RIVALS_WITH": allianceEdges++; break;
        case "MEMBER_OF": membershipEdges++; break;
      }
    });

    return { countries, resolutions, topics, blocs, voteEdges, allianceEdges, membershipEdges };
  }

  /**
   * Export a subgraph for visualization (country alliance network).
   * Returns nodes and edges suitable for sigma.js or react-force-graph.
   */
  exportAllianceNetwork(): {
    nodes: { id: string; label: string; region: string; idealPoint: number; size: number }[];
    edges: { source: string; target: string; weight: number }[];
  } {
    const nodes: { id: string; label: string; region: string; idealPoint: number; size: number }[] = [];
    const edges: { source: string; target: string; weight: number }[] = [];

    this.graph.forEachNode((id, attrs) => {
      if (attrs.type === "country") {
        const c = attrs as CountryNodeAttrs;
        nodes.push({
          id: c.iso3,
          label: c.name,
          region: c.region,
          idealPoint: c.idealPoint,
          size: Math.log10(c.population + 1) * 2,
        });
      }
    });

    this.graph.forEachEdge((_, attrs, source, target) => {
      const ea = attrs as AnyEdgeAttrs;
      if (ea.edgeType === "ALLIES_WITH") {
        const srcIso = source.replace("country:", "");
        const tgtIso = target.replace("country:", "");
        edges.push({
          source: srcIso,
          target: tgtIso,
          weight: (ea as AllianceEdgeAttrs).similarity,
        });
      }
    });

    return { nodes, edges };
  }

  /**
   * Export a topic-focused subgraph showing how countries relate through a topic.
   */
  exportTopicNetwork(topicName: string): {
    nodes: { id: string; label: string; vote: string; region: string }[];
    edges: { source: string; target: string; type: string }[];
  } {
    const topicId = `topic:${topicName}`;
    if (!this.graph.hasNode(topicId)) return { nodes: [], edges: [] };

    const resolutions = new Set<string>();
    this.graph.forEachInEdge(topicId, (_, attrs, source) => {
      if ((attrs as AnyEdgeAttrs).edgeType === "ADDRESSES") resolutions.add(source);
    });

    const countryVotes = new Map<string, { yes: number; no: number; abstain: number }>();

    for (const resId of resolutions) {
      this.graph.forEachInEdge(resId, (_, attrs, source) => {
        const ea = attrs as AnyEdgeAttrs;
        if (ea.edgeType !== "VOTED_ON") return;
        const voteAttrs = ea as VoteEdgeAttrs;
        const existing = countryVotes.get(source) ?? { yes: 0, no: 0, abstain: 0 };
        existing[voteAttrs.vote]++;
        countryVotes.set(source, existing);
      });
    }

    const nodes: { id: string; label: string; vote: string; region: string }[] = [];
    for (const [countryId, votes] of countryVotes) {
      const attrs = this.graph.getNodeAttributes(countryId) as CountryNodeAttrs;
      const dominantVote = votes.yes >= votes.no && votes.yes >= votes.abstain
        ? "yes"
        : votes.no >= votes.abstain
          ? "no"
          : "abstain";
      nodes.push({
        id: attrs.iso3,
        label: attrs.name,
        vote: dominantVote,
        region: attrs.region,
      });
    }

    const edges: { source: string; target: string; type: string }[] = [];

    return { nodes, edges };
  }
}
