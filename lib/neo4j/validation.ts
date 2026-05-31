/**
 * Runtime validation schemas for graph data using Zod.
 * Validates all data before it enters the knowledge graph.
 */

import { z } from "zod";

export const CountrySchema = z.object({
  iso3: z.string().length(3).regex(/^[A-Z]{3}$/),
  name: z.string().min(1).max(100),
  region: z.enum(["AFRICAN", "APG", "EEG", "GRULAC", "WEOG"]),
  idealPoint: z.number().min(-3).max(3),
  democracyIndex: z.number().min(0).max(1),
  governmentType: z.string(),
  population: z.number().int().min(0),
  gdpPerCapita: z.number().min(0),
  scStatus: z.enum(["P5", "elected", "none"]),
  policyDimensions: z.object({
    sovereignty: z.number().min(-1).max(1),
    humanRights: z.number().min(-1).max(1),
    development: z.number().min(-1).max(1),
    security: z.number().min(-1).max(1),
    environment: z.number().min(-1).max(1),
    decolonization: z.number().min(-1).max(1),
  }),
});

export const VoteEdgeSchema = z.object({
  iso3: z.string().length(3),
  rcid: z.number().int().min(1),
  vote: z.enum(["yes", "no", "abstain"]),
  year: z.number().int().min(1946).max(2030),
  session: z.number().int().min(1).max(100),
});

export const AllianceEdgeSchema = z.object({
  source: z.string().length(3),
  target: z.string().length(3),
  similarity: z.number().min(-1).max(1),
  sharedVotes: z.number().int().min(0),
  period: z.string(),
});

export const ResolutionSchema = z.object({
  rcid: z.number().int().min(1),
  session: z.number().int().min(1).max(100),
  date: z.string(),
  unres: z.string(),
  shortTitle: z.string(),
  description: z.string(),
  importantVote: z.boolean(),
  topic: z.string().optional(),
});

export const BlocSchema = z.object({
  shortName: z.string().min(1),
  name: z.string().min(1),
  cohesionScore: z.number().min(0).max(1),
  description: z.string(),
  members: z.array(z.string().length(3)),
});

export const TopicPositionSchema = z.object({
  iso3: z.string().length(3),
  topic: z.string(),
  yesRate: z.number().min(0).max(1),
  noRate: z.number().min(0).max(1),
  abstainRate: z.number().min(0).max(1),
  sampleSize: z.number().int().min(0),
});

export const GDELTEventSchema = z.object({
  eventId: z.string(),
  actor1Country: z.string().length(3).optional(),
  actor2Country: z.string().length(3).optional(),
  eventCode: z.string(),
  goldsteinScale: z.number().min(-10).max(10),
  date: z.string(),
  description: z.string().optional(),
  source: z.literal("gdelt"),
});

export const ArmsTransferSchema = z.object({
  supplier: z.string().length(3),
  recipient: z.string().length(3),
  year: z.number().int().min(1950).max(2030),
  tiv: z.number().min(0),
  weaponType: z.string().optional(),
  source: z.literal("sipri"),
});

export const AidFlowSchema = z.object({
  donor: z.string().length(3),
  recipient: z.string().length(3),
  year: z.number().int().min(1960).max(2030),
  amountUSD: z.number().min(0),
  aidType: z.string().optional(),
  source: z.literal("oecd_dac"),
});

export type Country = z.infer<typeof CountrySchema>;
export type VoteEdge = z.infer<typeof VoteEdgeSchema>;
export type AllianceEdge = z.infer<typeof AllianceEdgeSchema>;
export type Resolution = z.infer<typeof ResolutionSchema>;
export type Bloc = z.infer<typeof BlocSchema>;
export type TopicPosition = z.infer<typeof TopicPositionSchema>;
export type GDELTEvent = z.infer<typeof GDELTEventSchema>;
export type ArmsTransfer = z.infer<typeof ArmsTransferSchema>;
export type AidFlow = z.infer<typeof AidFlowSchema>;
