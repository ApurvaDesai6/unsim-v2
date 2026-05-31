/**
 * Ingest GDELT events from Google BigQuery (public dataset).
 *
 * GDELT's full event database is freely queryable on BigQuery:
 * - Table: `gdelt-bq.gdeltv2.events` (events since 2015)
 * - Table: `gdelt-bq.full.events` (events since 1979)
 *
 * BigQuery free tier: 1TB/month of queries.
 * GDELT tables are ~500GB total, but filtered queries use <1GB.
 *
 * To use:
 * 1. Go to https://console.cloud.google.com/bigquery
 * 2. Enable BigQuery API on a GCP project
 * 3. Create a service account key (JSON) or use Application Default Credentials
 * 4. Set GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
 *    OR authenticate via: gcloud auth application-default login
 *
 * Alternatively, you can run these queries directly in the BigQuery console
 * (no authentication needed for public datasets) and export results as CSV.
 *
 * Usage: npx tsx scripts/ingest-gdelt-bigquery.ts
 *
 * Manual BigQuery queries (paste into console.cloud.google.com/bigquery):
 */

const GDELT_QUERIES = {
  // Diplomatic cooperation/conflict events between UN member states (2020-2024)
  diplomaticEvents: `
    SELECT
      GLOBALEVENTID,
      SQLDATE,
      Actor1CountryCode,
      Actor2CountryCode,
      EventCode,
      EventRootCode,
      GoldsteinScale,
      NumMentions,
      AvgTone,
      SOURCEURL
    FROM \`gdelt-bq.gdeltv2.events\`
    WHERE SQLDATE >= 20200101
      AND Actor1CountryCode IS NOT NULL
      AND Actor2CountryCode IS NOT NULL
      AND Actor1CountryCode != Actor2CountryCode
      AND EventRootCode IN ('03','04','05','06','07','10','11','12','13','14')
      AND NumMentions >= 5
    ORDER BY SQLDATE DESC
    LIMIT 10000
  `,

  // UN-specific events (Security Council, General Assembly actions)
  unEvents: `
    SELECT
      GLOBALEVENTID,
      SQLDATE,
      Actor1CountryCode,
      Actor2CountryCode,
      EventCode,
      GoldsteinScale,
      NumMentions,
      SOURCEURL
    FROM \`gdelt-bq.gdeltv2.events\`
    WHERE SQLDATE >= 20200101
      AND (Actor1Name LIKE '%UNITED NATIONS%' OR Actor2Name LIKE '%UNITED NATIONS%'
           OR Actor1Name LIKE '%SECURITY COUNCIL%' OR Actor2Name LIKE '%SECURITY COUNCIL%')
      AND NumMentions >= 3
    ORDER BY SQLDATE DESC
    LIMIT 5000
  `,

  // Bilateral cooperation/conflict tone by country pair (aggregated)
  bilateralTone: `
    SELECT
      Actor1CountryCode AS country1,
      Actor2CountryCode AS country2,
      AVG(GoldsteinScale) AS avgTone,
      COUNT(*) AS eventCount,
      SUM(CASE WHEN GoldsteinScale > 0 THEN 1 ELSE 0 END) AS cooperativeEvents,
      SUM(CASE WHEN GoldsteinScale < 0 THEN 1 ELSE 0 END) AS conflictEvents
    FROM \`gdelt-bq.gdeltv2.events\`
    WHERE SQLDATE >= 20220101
      AND Actor1CountryCode IS NOT NULL
      AND Actor2CountryCode IS NOT NULL
      AND Actor1CountryCode != Actor2CountryCode
    GROUP BY Actor1CountryCode, Actor2CountryCode
    HAVING COUNT(*) >= 20
    ORDER BY eventCount DESC
    LIMIT 5000
  `,
};

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  GDELT BigQuery Ingestion");
  console.log("═══════════════════════════════════════════════════════════\n");

  // Check if BigQuery credentials are available
  const hasCredentials = !!(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_CLOUD_PROJECT);

  if (!hasCredentials) {
    console.log("  BigQuery credentials not configured.");
    console.log("  To use programmatic access:");
    console.log("    1. gcloud auth application-default login");
    console.log("    2. OR set GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json");
    console.log("");
    console.log("  ALTERNATIVE: Run these queries manually in BigQuery Console:");
    console.log("  https://console.cloud.google.com/bigquery\n");

    for (const [name, query] of Object.entries(GDELT_QUERIES)) {
      console.log(`  ─── ${name} ───`);
      console.log(query.trim());
      console.log("");
    }

    console.log("  Export results as CSV, then run:");
    console.log("    npx tsx scripts/ingest-gdelt-csv.ts data/gdelt-diplomatic.csv");
    console.log("");
    return;
  }

  // If credentials available, run queries
  const { BigQuery } = await import("@google-cloud/bigquery");
  const bigquery = new BigQuery();

  console.log("  Running bilateral tone query...");
  const [rows] = await bigquery.query({ query: GDELT_QUERIES.bilateralTone, location: "US" });
  console.log(`  Got ${rows.length} country-pair tone measurements`);

  // Process and push to Neo4j
  if (process.env.NEO4J_URI) {
    const neo4j = await import("neo4j-driver");
    const driver = neo4j.default.driver(
      process.env.NEO4J_URI,
      neo4j.default.auth.basic(process.env.NEO4J_USER || "neo4j", process.env.NEO4J_PASSWORD || "")
    );
    const session = driver.session({ database: process.env.NEO4J_DATABASE || "neo4j" });

    const edges = rows
      .filter((r: { country1: string; country2: string }) => r.country1.length <= 3 && r.country2.length <= 3)
      .map((r: { country1: string; country2: string; avgTone: number; eventCount: number; cooperativeEvents: number; conflictEvents: number }) => ({
        c1: r.country1,
        c2: r.country2,
        tone: r.avgTone,
        events: r.eventCount,
        cooperative: r.cooperativeEvents,
        conflict: r.conflictEvents,
      }));

    await session.run(`
      UNWIND $edges AS e
      MATCH (c1:Country {iso3: e.c1})
      MATCH (c2:Country {iso3: e.c2})
      MERGE (c1)-[r:GDELT_INTERACTION]->(c2)
      SET r.avgTone = e.tone,
          r.eventCount = e.events,
          r.cooperativeEvents = e.cooperative,
          r.conflictEvents = e.conflict,
          r.period = '2022-2024',
          r.source = 'gdelt_bigquery'
    `, { edges: edges.slice(0, 2000) });

    console.log(`  ✓ ${Math.min(edges.length, 2000)} GDELT interaction edges added to Neo4j`);

    await session.close();
    await driver.close();
  }

  console.log("\n═══════════════════════════════════════════════════════════\n");
}

main().catch(console.error);
