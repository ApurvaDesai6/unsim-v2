// v1 KG engine — powers the explore page, KG APIs, and graph queries
export {
  getGraph,
  getCountryNode,
  getNeighbors,
  getAlliances,
  getRivalries,
  getBlocMemberships,
  getIssuePositions,
  getGraphStats,
  getSubgraphForViz,
  predictVoteFromGraph,
} from "./kg-engine";

// v2 graph layers — powers the simulation engine and viz data
export { UNKnowledgeGraph } from "./graph";
export {
  loadVizGraph,
  loadCoreLayer,
  loadTemporalLayer,
  getVotingPattern,
  getTemporalTrend,
  getCountryVoteHistory,
  getCountryAlliances,
} from "./loader";
export type {
  NodeType,
  EdgeType,
  CountryNodeAttrs,
  ResolutionNodeAttrs,
  TopicNodeAttrs,
  BlocNodeAttrs,
  VoteEdgeAttrs,
  AllianceEdgeAttrs,
  VotingPattern,
  CountryGraphProfile,
  GraphStats,
  TemporalSlice,
} from "./types";
