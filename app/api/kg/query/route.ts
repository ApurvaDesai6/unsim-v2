import { NextRequest, NextResponse } from "next/server";
import { isNeo4jConfigured, runQuery } from "@/lib/neo4j";
import {
  getAlliances,
  getRivalries,
  getBlocMemberships,
  getIssuePositions,
  getGraphStats,
  getCountryNode,
  predictVoteFromGraph,
} from "@/lib/knowledge-graph";

/**
 * Knowledge Graph Query API.
 * Uses Neo4j when configured, graphology (same data) otherwise.
 * Both are the real KG — just different runtimes.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const iso3 = searchParams.get("iso3")?.toUpperCase() ?? null;
  const issue = searchParams.get("issue");

  try {
    if (isNeo4jConfigured()) {
      return await handleNeo4j(action, iso3, issue);
    }
    return handleGraphology(action, iso3, issue);
  } catch (e) {
    console.error("Neo4j query failed, falling back to graphology:", e);
    try {
      return handleGraphology(action, iso3, issue);
    } catch (e2) {
      return NextResponse.json({ error: "Query failed" }, { status: 500 });
    }
  }
}

async function handleNeo4j(action: string | null, iso3: string | null, issue: string | null) {
  if (action === "stats") {
    const nodes = await runQuery<{ label: string; count: unknown }>(
      `MATCH (n) WITH labels(n)[0] AS label, count(n) AS count RETURN label, count`
    );
    const edges = await runQuery<{ type: string; count: unknown }>(
      `MATCH ()-[r]->() WITH type(r) AS type, count(r) AS count RETURN type, count`
    );
    const toNum = (v: unknown) => typeof v === "object" && v !== null && "low" in v ? (v as { low: number }).low : Number(v);
    const nodeMap: Record<string, number> = {};
    const edgeMap: Record<string, number> = {};
    for (const n of nodes) nodeMap[n.label] = toNum(n.count);
    for (const e of edges) edgeMap[e.type] = toNum(e.count);
    return NextResponse.json({
      countries: nodeMap["Country"] || 193,
      blocs: nodeMap["Bloc"] || 7,
      issues: nodeMap["Topic"] || 6,
      alliances: edgeMap["ALLIES_WITH"] || 0,
      rivalries: edgeMap["RIVALS_WITH"] || 0,
      positions: edgeMap["POSITION_ON"] || 0,
      nodes: Object.values(nodeMap).reduce((a, b) => a + b, 0),
      edges: Object.values(edgeMap).reduce((a, b) => a + b, 0),
    });
  }

  if (action === "relationships" && iso3) {
    const result = await runQuery<{ country: Record<string, unknown>; allies: unknown[]; rivals: unknown[]; blocs: unknown[]; positions: unknown[] }>(`
      MATCH (c:Country {iso3: $iso3})
      OPTIONAL MATCH (c)-[a:ALLIES_WITH]-(ally:Country)
      OPTIONAL MATCH (c)-[r:RIVALS_WITH]-(rival:Country)
      OPTIONAL MATCH (c)-[:MEMBER_OF]->(b:Bloc)
      OPTIONAL MATCH (c)-[p:POSITION_ON]->(t:Topic)
      WITH c,
           collect(DISTINCT CASE WHEN ally IS NOT NULL THEN {iso3: ally.iso3, name: ally.name, strength: a.similarity} END) AS allies,
           collect(DISTINCT CASE WHEN rival IS NOT NULL THEN {iso3: rival.iso3, name: rival.name, intensity: r.intensity} END) AS rivals,
           collect(DISTINCT CASE WHEN b IS NOT NULL THEN {id: b.shortName, name: b.name, cohesion: b.cohesionScore} END) AS blocs,
           collect(DISTINCT CASE WHEN t IS NOT NULL THEN {issue: t.name, issueName: t.name, stance: p.yesRate - p.noRate, yesRate: p.yesRate, noRate: p.noRate, abstainRate: p.abstainRate, sampleSize: p.sampleSize} END) AS positions
      RETURN c {.*} AS country,
             [a IN allies WHERE a IS NOT NULL] AS allies,
             [r IN rivals WHERE r IS NOT NULL] AS rivals,
             [b IN blocs WHERE b IS NOT NULL] AS blocs,
             [p IN positions WHERE p IS NOT NULL] AS positions
    `, { iso3 });
    if (!result.length) return NextResponse.json({ error: "Country not found" }, { status: 404 });
    return NextResponse.json(result[0]);
  }

  if (action === "predict" && iso3 && issue) {
    const result = await runQuery<{ yesRate: number; noRate: number; abstainRate: number; sampleSize: number }>(`
      MATCH (c:Country {iso3: $iso3})-[p:POSITION_ON]->(t:Topic)
      WHERE t.name CONTAINS $issue
      RETURN p.yesRate AS yesRate, p.noRate AS noRate, p.abstainRate AS abstainRate, p.sampleSize AS sampleSize
      LIMIT 1
    `, { iso3, issue });
    if (result.length > 0) return NextResponse.json({ ...result[0], method: "neo4j" });
    return NextResponse.json({ yes: 0.5, no: 0.2, abstain: 0.3, method: "no-data" });
  }

  return NextResponse.json({ error: "Use ?action=stats|relationships|predict" }, { status: 400 });
}

function handleGraphology(action: string | null, iso3: string | null, issue: string | null) {
  if (action === "stats") {
    return NextResponse.json(getGraphStats());
  }

  if (action === "relationships" && iso3) {
    return NextResponse.json({
      country: getCountryNode(iso3),
      allies: getAlliances(iso3),
      rivals: getRivalries(iso3),
      blocs: getBlocMemberships(iso3),
      positions: getIssuePositions(iso3),
    });
  }

  if (action === "predict" && iso3 && issue) {
    return NextResponse.json(predictVoteFromGraph(iso3, issue));
  }

  return NextResponse.json({ error: "Use ?action=stats|relationships|predict" }, { status: 400 });
}
