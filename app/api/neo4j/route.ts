import { NextRequest, NextResponse } from "next/server";
import { isNeo4jConfigured, runQuery, healthCheck } from "@/lib/neo4j";

/**
 * Neo4j Query API — direct Cypher queries against the live knowledge graph.
 *
 * This replaces the in-memory graphology queries with real graph database
 * traversals. Supports predefined query templates and (for admins) raw Cypher.
 *
 * Query templates:
 * - health: check connection status
 * - country: get full country profile with all relationships
 * - path: shortest path between two countries
 * - allies: top voting allies for a country
 * - rivals: top voting rivals
 * - bloc-cohesion: how a bloc votes on a given topic
 * - influence-chain: trace influence paths (aid → voting alignment)
 * - community: find voting communities via graph algorithms
 */
export async function GET(request: NextRequest) {
  if (!isNeo4jConfigured()) {
    return NextResponse.json({
      error: "Neo4j not configured",
      message: "Set NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD, NEO4J_DATABASE environment variables",
      fallback: "Using in-memory graphology engine",
    }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  try {
    if (action === "health") {
      const status = await healthCheck();
      return NextResponse.json(status);
    }

    if (action === "country") {
      const iso3 = searchParams.get("iso3")?.toUpperCase();
      if (!iso3) return NextResponse.json({ error: "iso3 required" }, { status: 400 });

      const result = await runQuery(`
        MATCH (c:Country {iso3: $iso3})
        OPTIONAL MATCH (c)-[a:ALLIES_WITH]->(ally:Country)
        OPTIONAL MATCH (c)-[r:RIVALS_WITH]->(rival:Country)
        OPTIONAL MATCH (c)-[:MEMBER_OF]->(b:Bloc)
        OPTIONAL MATCH (c)-[p:POSITION_ON]->(t:Topic)
        RETURN c {.*} AS country,
               collect(DISTINCT {iso3: ally.iso3, name: ally.name, similarity: a.similarity}) AS allies,
               collect(DISTINCT {iso3: rival.iso3, name: rival.name, intensity: r.intensity}) AS rivals,
               collect(DISTINCT {name: b.name, shortName: b.shortName, cohesion: b.cohesionScore}) AS blocs,
               collect(DISTINCT {topic: t.name, yesRate: p.yesRate, noRate: p.noRate, abstainRate: p.abstainRate, sampleSize: p.sampleSize}) AS positions
      `, { iso3 });

      if (!result.length) return NextResponse.json({ error: "Country not found" }, { status: 404 });
      return NextResponse.json(result[0]);
    }

    if (action === "path") {
      const from = searchParams.get("from")?.toUpperCase();
      const to = searchParams.get("to")?.toUpperCase();
      if (!from || !to) return NextResponse.json({ error: "from and to required" }, { status: 400 });

      const result = await runQuery(`
        MATCH path = shortestPath(
          (a:Country {iso3: $from})-[:ALLIES_WITH*..6]-(b:Country {iso3: $to})
        )
        RETURN [n IN nodes(path) | {iso3: n.iso3, name: n.name, region: n.region}] AS nodes,
               [r IN relationships(path) | {type: type(r), similarity: r.similarity}] AS edges,
               length(path) AS hops
      `, { from, to });

      if (!result.length) {
        return NextResponse.json({ path: null, message: `No alliance path between ${from} and ${to}` });
      }

      const pathData = result[0] as { nodes: { iso3: string; name: string; region: string }[]; edges: unknown[]; hops: number };
      return NextResponse.json({
        path: pathData.nodes,
        hops: pathData.hops,
        interpretation: pathData.nodes.length <= 2
          ? `${pathData.nodes[0].name} and ${pathData.nodes[1].name} are directly allied.`
          : `${pathData.nodes[0].name} reaches ${pathData.nodes[pathData.nodes.length - 1].name} through ${pathData.hops - 1} intermediar${pathData.hops > 2 ? "ies" : "y"}: ${pathData.nodes.slice(1, -1).map((n) => n.name).join(" → ")}.`,
      });
    }

    if (action === "allies") {
      const iso3 = searchParams.get("iso3")?.toUpperCase();
      const limit = parseInt(searchParams.get("limit") || "10");
      if (!iso3) return NextResponse.json({ error: "iso3 required" }, { status: 400 });

      const result = await runQuery(`
        MATCH (c:Country {iso3: $iso3})-[a:ALLIES_WITH]-(ally:Country)
        RETURN ally.iso3 AS iso3, ally.name AS name, ally.region AS region, a.similarity AS similarity
        ORDER BY a.similarity DESC
        LIMIT $limit
      `, { iso3, limit: neo4jInt(limit) });

      return NextResponse.json({ country: iso3, allies: result });
    }

    if (action === "rivals") {
      const iso3 = searchParams.get("iso3")?.toUpperCase();
      if (!iso3) return NextResponse.json({ error: "iso3 required" }, { status: 400 });

      const result = await runQuery(`
        MATCH (c:Country {iso3: $iso3})-[r:RIVALS_WITH]-(rival:Country)
        RETURN rival.iso3 AS iso3, rival.name AS name, rival.region AS region, r.intensity AS intensity
        ORDER BY r.intensity DESC
        LIMIT 10
      `, { iso3 });

      return NextResponse.json({ country: iso3, rivals: result });
    }

    if (action === "bloc-members") {
      const bloc = searchParams.get("bloc");
      if (!bloc) return NextResponse.json({ error: "bloc required" }, { status: 400 });

      const result = await runQuery(`
        MATCH (c:Country)-[:MEMBER_OF]->(b:Bloc {shortName: $bloc})
        RETURN c.iso3 AS iso3, c.name AS name, c.region AS region, c.idealPoint AS idealPoint
        ORDER BY c.idealPoint
      `, { bloc });

      return NextResponse.json({ bloc, members: result, count: result.length });
    }

    if (action === "stats") {
      const result = await runQuery(`
        MATCH (n)
        WITH labels(n)[0] AS label, count(n) AS count
        RETURN label, count
        ORDER BY count DESC
      `);
      const edgeResult = await runQuery(`
        MATCH ()-[r]->()
        WITH type(r) AS type, count(r) AS count
        RETURN type, count
        ORDER BY count DESC
      `);

      return NextResponse.json({ nodes: result, edges: edgeResult });
    }

    return NextResponse.json({
      actions: ["health", "country", "path", "allies", "rivals", "bloc-members", "stats"],
      status: "Neo4j connected",
    });

  } catch (e) {
    console.error("Neo4j query error:", e);
    return NextResponse.json({ error: "Query failed", details: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}

function neo4jInt(n: number) {
  return n;
}
