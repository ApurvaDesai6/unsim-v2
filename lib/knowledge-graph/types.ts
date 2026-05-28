export type NodeType = "country" | "resolution" | "topic" | "bloc" | "treaty";

export type EdgeType =
  | "VOTED_ON"
  | "MEMBER_OF"
  | "SIGNED"
  | "ADDRESSES"
  | "ALLIES_WITH"
  | "RIVALS_WITH"
  | "SPONSORS"
  | "CO_SPONSORS"
  | "LED_BY";

export interface CountryNodeAttrs {
  type: "country";
  name: string;
  iso3: string;
  region: string;
  idealPoint: number;
  democracyIndex: number;
  governmentType: string;
  gdpPerCapita: number;
  population: number;
  scStatus: "P5" | "elected" | "none";
}

export interface ResolutionNodeAttrs {
  type: "resolution";
  rcid: number;
  session: number;
  date: string;
  unres: string;
  shortTitle: string;
  description: string;
  importantVote: boolean;
  isAmendment: boolean;
  topic?: string;
}

export interface TopicNodeAttrs {
  type: "topic";
  name: string;
  category: string;
  resolutionCount: number;
}

export interface BlocNodeAttrs {
  type: "bloc";
  name: string;
  shortName: string;
  memberCount: number;
  cohesionScore: number;
  policyLeanings: Record<string, number>;
}

export type AnyNodeAttrs =
  | CountryNodeAttrs
  | ResolutionNodeAttrs
  | TopicNodeAttrs
  | BlocNodeAttrs;

export interface VoteEdgeAttrs {
  edgeType: "VOTED_ON";
  vote: "yes" | "no" | "abstain";
  session: number;
  year: number;
}

export interface AllianceEdgeAttrs {
  edgeType: "ALLIES_WITH" | "RIVALS_WITH";
  similarity: number;
  sharedVotes: number;
  period: string;
}

export interface MembershipEdgeAttrs {
  edgeType: "MEMBER_OF";
  since?: number;
}

export interface AddressesEdgeAttrs {
  edgeType: "ADDRESSES";
}

export type AnyEdgeAttrs =
  | VoteEdgeAttrs
  | AllianceEdgeAttrs
  | MembershipEdgeAttrs
  | AddressesEdgeAttrs;

export interface TemporalSlice {
  startYear: number;
  endYear: number;
}

export interface VotingPattern {
  topic: string;
  yesRate: number;
  noRate: number;
  abstainRate: number;
  sampleSize: number;
}

export interface CountryGraphProfile {
  iso3: string;
  name: string;
  allies: { iso3: string; name: string; similarity: number }[];
  rivals: { iso3: string; name: string; similarity: number }[];
  blocs: string[];
  votingPatterns: VotingPattern[];
  resolutionCount: number;
  idealPoint: number;
  region: string;
}

export interface GraphStats {
  countries: number;
  resolutions: number;
  topics: number;
  blocs: number;
  voteEdges: number;
  allianceEdges: number;
  membershipEdges: number;
}
