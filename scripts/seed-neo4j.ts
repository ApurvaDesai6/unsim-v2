/**
 * Seed Neo4j AuraDB with UNSim knowledge graph data.
 *
 * Prerequisites:
 * 1. Create a free AuraDB instance at https://console.neo4j.io
 * 2. Set environment variables:
 *    export NEO4J_URI="neo4j+s://xxxxx.databases.neo4j.io"
 *    export NEO4J_USER="neo4j"
 *    export NEO4J_PASSWORD="your-password"
 *
 * Usage: npx tsx scripts/seed-neo4j.ts
 */

import { readFileSync } from "fs";
import path from "path";
import neo4j from "neo4j-driver";

const DATA_DIR = path.join(__dirname, "../data");

async function main() {
  const uri = process.env.NEO4J_URI;
  const user = process.env.NEO4J_USER || "neo4j";
  const password = process.env.NEO4J_PASSWORD;

  if (!uri || !password) {
    console.error("ERROR: Set NEO4J_URI and NEO4J_PASSWORD environment variables.");
    console.error("  Get these from https://console.neo4j.io after creating a free AuraDB instance.");
    process.exit(1);
  }

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Seeding Neo4j AuraDB with UNSim Knowledge Graph");
  console.log("═══════════════════════════════════════════════════════════\n");

  const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

  try {
    const info = await driver.getServerInfo();
    console.log(`  Connected to Neo4j (protocol v${info.protocolVersion})\n`);
  } catch (e) {
    console.error("Failed to connect:", e);
    process.exit(1);
  }

  const session = driver.session({ database: "neo4j" });

  try {
    // ─── Step 1: Create constraints and indexes ──────────────────
    console.log("Step 1: Creating constraints and indexes...");
    const constraints = [
      "CREATE CONSTRAINT country_iso3 IF NOT EXISTS FOR (c:Country) REQUIRE c.iso3 IS UNIQUE",
      "CREATE CONSTRAINT resolution_rcid IF NOT EXISTS FOR (r:Resolution) REQUIRE r.rcid IS UNIQUE",
      "CREATE CONSTRAINT bloc_id IF NOT EXISTS FOR (b:Bloc) REQUIRE b.shortName IS UNIQUE",
      "CREATE CONSTRAINT topic_name IF NOT EXISTS FOR (t:Topic) REQUIRE t.name IS UNIQUE",
    ];
    for (const stmt of constraints) {
      await session.run(stmt);
    }
    console.log(`  ✓ ${constraints.length} constraints created\n`);

    // ─── Step 2: Load countries ──────────────────────────────────
    console.log("Step 2: Loading 193 countries...");
    const profiles = JSON.parse(readFileSync(path.join(DATA_DIR, "country-profiles.json"), "utf-8"));
    await session.run(`
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
          country.decolonization = c.policyDimensions.decolonization
    `, { countries: profiles });
    console.log(`  ✓ ${profiles.length} countries loaded\n`);

    // ─── Step 3: Load blocs ──────────────────────────────────────
    console.log("Step 3: Loading voting blocs...");
    const blocs = JSON.parse(readFileSync(path.join(DATA_DIR, "blocs.json"), "utf-8"));
    for (const b of blocs) {
      await session.run(`
        MERGE (bloc:Bloc {shortName: $shortName})
        SET bloc.name = $name, bloc.cohesionScore = $cohesion, bloc.description = $desc
        WITH bloc
        UNWIND $members AS memberIso3
        MATCH (c:Country {iso3: memberIso3})
        MERGE (c)-[:MEMBER_OF]->(bloc)
      `, { shortName: b.shortName, name: b.name, cohesion: b.cohesionScore, desc: b.description, members: b.members });
    }
    console.log(`  ✓ ${blocs.length} blocs + membership edges\n`);

    // ─── Step 4: Load topics ─────────────────────────────────────
    console.log("Step 4: Loading topics and country positions...");
    const topicHistory = JSON.parse(readFileSync(path.join(DATA_DIR, "topic-history.json"), "utf-8"));
    const topics = ["Palestinian conflict", "Nuclear weapons and nuclear material", "Arms control and disarmament", "Colonialism", "Human rights", "Economic development"];

    for (const topic of topics) {
      await session.run("MERGE (t:Topic {name: $name})", { name: topic });
    }

    // Load positions in batches
    const nameToIso3 = new Map<string, string>();
    for (const p of profiles) nameToIso3.set(p.name, p.iso3);

    const positions: { iso3: string; topic: string; yesRate: number; noRate: number; abstainRate: number; sampleSize: number }[] = [];
    for (const [countryName, topicData] of Object.entries(topicHistory)) {
      const iso3 = nameToIso3.get(countryName);
      if (!iso3) continue;
      for (const [topic, rates] of Object.entries(topicData as Record<string, { yesRate: number; noRate: number; abstainRate: number; sampleSize: number }>)) {
        if (rates.sampleSize >= 20) {
          positions.push({ iso3, topic, ...rates });
        }
      }
    }

    // Batch insert positions
    for (let i = 0; i < positions.length; i += 500) {
      const batch = positions.slice(i, i + 500);
      await session.run(`
        UNWIND $positions AS p
        MATCH (c:Country {iso3: p.iso3})
        MATCH (t:Topic {name: p.topic})
        MERGE (c)-[r:POSITION_ON]->(t)
        SET r.yesRate = p.yesRate, r.noRate = p.noRate, r.abstainRate = p.abstainRate, r.sampleSize = p.sampleSize
      `, { positions: batch });
    }
    console.log(`  ✓ ${topics.length} topics, ${positions.length} position edges\n`);

    // ─── Step 5: Load alliances/rivalries ────────────────────────
    console.log("Step 5: Loading alliance and rivalry edges...");
    const simData = JSON.parse(readFileSync(path.join(DATA_DIR, "vote-similarity.json"), "utf-8"));

    const alliances: { source: string; target: string; similarity: number; shared: number }[] = [];
    const rivalries: { source: string; target: string; intensity: number; shared: number }[] = [];
    const addedPairs = new Set<string>();

    for (const [name, data] of Object.entries(simData.similarities || {})) {
      const iso3 = nameToIso3.get(name);
      if (!iso3) continue;
      const sim = data as { mostSimilar?: { country: string; similarity: number; shared: number }[]; mostDissimilar?: { country: string; similarity: number; shared: number }[] };

      for (const ally of (sim.mostSimilar || []).slice(0, 10)) {
        const targetIso = nameToIso3.get(ally.country);
        if (!targetIso) continue;
        const key = [iso3, targetIso].sort().join("-");
        if (addedPairs.has(key)) continue;
        addedPairs.add(key);
        alliances.push({ source: iso3, target: targetIso, similarity: ally.similarity, shared: ally.shared });
      }

      for (const rival of (sim.mostDissimilar || []).slice(0, 5)) {
        const targetIso = nameToIso3.get(rival.country);
        if (!targetIso) continue;
        const key = [iso3, targetIso].sort().join("-");
        if (addedPairs.has(key)) continue;
        addedPairs.add(key);
        rivalries.push({ source: iso3, target: targetIso, intensity: Math.abs(rival.similarity), shared: rival.shared });
      }
    }

    for (let i = 0; i < alliances.length; i += 500) {
      const batch = alliances.slice(i, i + 500);
      await session.run(`
        UNWIND $edges AS e
        MATCH (c1:Country {iso3: e.source})
        MATCH (c2:Country {iso3: e.target})
        MERGE (c1)-[r:ALLIES_WITH]->(c2)
        SET r.similarity = e.similarity, r.sharedVotes = e.shared, r.period = '2000-2019', r.source = 'voeten'
      `, { edges: batch });
    }

    for (let i = 0; i < rivalries.length; i += 500) {
      const batch = rivalries.slice(i, i + 500);
      await session.run(`
        UNWIND $edges AS e
        MATCH (c1:Country {iso3: e.source})
        MATCH (c2:Country {iso3: e.target})
        MERGE (c1)-[r:RIVALS_WITH]->(c2)
        SET r.intensity = e.intensity, r.sharedVotes = e.shared, r.period = '2000-2019', r.source = 'voeten'
      `, { edges: batch });
    }

    console.log(`  ✓ ${alliances.length} alliances, ${rivalries.length} rivalries\n`);

    // ─── Summary ─────────────────────────────────────────────────
    const stats = await session.run(`
      MATCH (n) RETURN labels(n)[0] AS type, count(n) AS count
      UNION ALL
      MATCH ()-[r]->() RETURN type(r) AS type, count(r) AS count
    `);

    console.log("═══════════════════════════════════════════════════════════");
    console.log("  Neo4j Seed Complete");
    console.log("═══════════════════════════════════════════════════════════");
    for (const record of stats.records) {
      console.log(`  ${record.get("type")}: ${record.get("count")}`);
    }
    console.log("═══════════════════════════════════════════════════════════\n");

  } finally {
    await session.close();
    await driver.close();
  }
}

main().catch(console.error);
