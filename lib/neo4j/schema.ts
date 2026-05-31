/**
 * Neo4j Schema — Cypher statements to initialize the graph database.
 *
 * Run once when setting up a new AuraDB instance.
 * Creates constraints, indexes, and the base schema.
 */

export const SCHEMA_STATEMENTS = [
  // ─── Constraints (uniqueness + existence) ─────────────────────
  `CREATE CONSTRAINT country_iso3 IF NOT EXISTS FOR (c:Country) REQUIRE c.iso3 IS UNIQUE`,
  `CREATE CONSTRAINT resolution_rcid IF NOT EXISTS FOR (r:Resolution) REQUIRE r.rcid IS UNIQUE`,
  `CREATE CONSTRAINT bloc_id IF NOT EXISTS FOR (b:Bloc) REQUIRE b.shortName IS UNIQUE`,
  `CREATE CONSTRAINT topic_name IF NOT EXISTS FOR (t:Topic) REQUIRE t.name IS UNIQUE`,
  `CREATE CONSTRAINT treaty_id IF NOT EXISTS FOR (tr:Treaty) REQUIRE tr.id IS UNIQUE`,
  `CREATE CONSTRAINT event_id IF NOT EXISTS FOR (e:Event) REQUIRE e.id IS UNIQUE`,
  `CREATE CONSTRAINT era_name IF NOT EXISTS FOR (era:Era) REQUIRE era.name IS UNIQUE`,

  // ─── Indexes for common queries ───────────────────────────────
  `CREATE INDEX country_region IF NOT EXISTS FOR (c:Country) ON (c.region)`,
  `CREATE INDEX country_idealpoint IF NOT EXISTS FOR (c:Country) ON (c.idealPoint)`,
  `CREATE INDEX resolution_session IF NOT EXISTS FOR (r:Resolution) ON (r.session)`,
  `CREATE INDEX resolution_year IF NOT EXISTS FOR (r:Resolution) ON (r.year)`,
  `CREATE INDEX vote_year IF NOT EXISTS FOR ()-[v:VOTED_ON]-() ON (v.year)`,
];

/**
 * Cypher query to load countries from JSON data.
 */
export const LOAD_COUNTRIES = `
UNWIND $countries AS c
MERGE (country:Country {iso3: c.iso3})
SET country.name = c.name,
    country.region = c.region,
    country.idealPoint = c.idealPoint,
    country.democracyIndex = c.democracyIndex,
    country.governmentType = c.governmentType,
    country.population = c.population,
    country.gdpPerCapita = c.gdpPerCapita,
    country.scStatus = c.scStatus,
    country.sovereignty = c.policyDimensions.sovereignty,
    country.humanRights = c.policyDimensions.humanRights,
    country.development = c.policyDimensions.development,
    country.security = c.policyDimensions.security,
    country.environment = c.policyDimensions.environment,
    country.decolonization = c.policyDimensions.decolonization,
    country.source = 'voeten_vdem',
    country.updatedAt = datetime()
`;

/**
 * Cypher query to load blocs and memberships.
 */
export const LOAD_BLOCS = `
UNWIND $blocs AS b
MERGE (bloc:Bloc {shortName: b.shortName})
SET bloc.name = b.name,
    bloc.cohesionScore = b.cohesionScore,
    bloc.description = b.description,
    bloc.memberCount = size(b.members)
WITH bloc, b
UNWIND b.members AS memberIso3
MATCH (c:Country {iso3: memberIso3})
MERGE (c)-[:MEMBER_OF {source: 'curated'}]->(bloc)
`;

/**
 * Cypher query to load alliance edges from vote-similarity matrix.
 */
export const LOAD_ALLIANCES = `
UNWIND $alliances AS a
MATCH (c1:Country {iso3: a.source})
MATCH (c2:Country {iso3: a.target})
MERGE (c1)-[r:ALLIES_WITH]->(c2)
SET r.similarity = a.similarity,
    r.sharedVotes = a.sharedVotes,
    r.period = a.period,
    r.source = 'voeten_cosine_similarity'
`;

/**
 * Cypher query to load rivalry edges.
 */
export const LOAD_RIVALRIES = `
UNWIND $rivalries AS a
MATCH (c1:Country {iso3: a.source})
MATCH (c2:Country {iso3: a.target})
MERGE (c1)-[r:RIVALS_WITH]->(c2)
SET r.intensity = a.intensity,
    r.sharedVotes = a.sharedVotes,
    r.period = a.period,
    r.source = 'voeten_cosine_similarity'
`;

/**
 * Cypher query to load topics and country positions.
 */
export const LOAD_TOPICS = `
UNWIND $topics AS t
MERGE (topic:Topic {name: t.name})
SET topic.category = t.category,
    topic.resolutionCount = t.resolutionCount
`;

export const LOAD_POSITIONS = `
UNWIND $positions AS p
MATCH (c:Country {iso3: p.iso3})
MATCH (t:Topic {name: p.topic})
MERGE (c)-[r:POSITION_ON]->(t)
SET r.yesRate = p.yesRate,
    r.noRate = p.noRate,
    r.abstainRate = p.abstainRate,
    r.sampleSize = p.sampleSize,
    r.stance = p.yesRate - p.noRate,
    r.source = 'voeten_topic_history'
`;

/**
 * Cypher query to load vote edges (bulk — use UNWIND for performance).
 */
export const LOAD_VOTES = `
UNWIND $votes AS v
MATCH (c:Country {iso3: v.iso3})
MATCH (r:Resolution {rcid: v.rcid})
CREATE (c)-[:VOTED_ON {
  vote: v.vote,
  year: v.year,
  session: v.session,
  source: 'voeten'
}]->(r)
`;

/**
 * Cypher query to load resolutions.
 */
export const LOAD_RESOLUTIONS = `
UNWIND $resolutions AS r
MERGE (res:Resolution {rcid: r.rcid})
SET res.session = r.session,
    res.date = r.date,
    res.unres = r.unres,
    res.shortTitle = r.shortTitle,
    res.description = r.description,
    res.importantVote = r.importantVote,
    res.topic = r.topic,
    res.source = 'voeten'
WITH res, r
WHERE r.topic IS NOT NULL
MATCH (t:Topic {name: r.topic})
MERGE (res)-[:ADDRESSES]->(t)
`;
