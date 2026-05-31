import { NextRequest, NextResponse } from "next/server";
import { isNeo4jConfigured, runQuery } from "@/lib/neo4j";
import { readFileSync } from "fs";
import path from "path";
import type { CountryProfile } from "@/types";

let countriesCache: CountryProfile[] | null = null;

function loadCountriesFromJSON(): CountryProfile[] {
  if (countriesCache) return countriesCache;
  countriesCache = JSON.parse(readFileSync(path.join(process.cwd(), "data", "country-profiles.json"), "utf-8"));
  return countriesCache!;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  try {
    if (isNeo4jConfigured()) {
      // ─── Neo4j queries ──────────────────────────────────────────
      if (action === "countries") {
        const countries = await runQuery<{
          iso3: string; name: string; region: string; idealPoint: number;
          democracyIndex: number; scStatus: string; govEffectiveness: number | null;
          population: number; gdpPerCapita: number;
        }>(`
          MATCH (c:Country)
          OPTIONAL MATCH (c)-[:MEMBER_OF]->(b:Bloc)
          WITH c, collect(b.shortName) AS blocNames
          RETURN c.iso3 AS iso3, c.name AS name, c.region AS region,
                 c.idealPoint AS idealPoint, c.democracyIndex AS democracyIndex,
                 c.scStatus AS scStatus, c.govEffectiveness AS govEffectiveness,
                 c.population AS population, c.gdpPerCapita AS gdpPerCapita,
                 blocNames AS blocs
          ORDER BY c.name
        `);
        return NextResponse.json(countries);
      }

      if (action === "regions") {
        const regions = await runQuery<{
          region: string; count: number; avgIdealPoint: number; avgDemocracy: number;
        }>(`
          MATCH (c:Country)
          WITH c.region AS region, count(c) AS count,
               avg(c.idealPoint) AS avgIdealPoint, avg(c.democracyIndex) AS avgDemocracy
          RETURN region, count, avgIdealPoint, avgDemocracy
          ORDER BY count DESC
        `);
        const result: Record<string, { count: number; avgIdealPoint: number; avgDemocracy: number }> = {};
        for (const r of regions) {
          result[r.region] = { count: typeof r.count === "object" ? (r.count as { low: number }).low : Number(r.count), avgIdealPoint: r.avgIdealPoint, avgDemocracy: r.avgDemocracy };
        }
        return NextResponse.json(result);
      }

      if (action === "search") {
        const q = (searchParams.get("q") || "").toLowerCase();
        if (!q) return NextResponse.json([]);
        const results = await runQuery<{ iso3: string; name: string; region: string }>(`
          MATCH (c:Country)
          WHERE toLower(c.name) CONTAINS $q OR toLower(c.iso3) CONTAINS $q
          RETURN c.iso3 AS iso3, c.name AS name, c.region AS region
          LIMIT 20
        `, { q });
        return NextResponse.json(results);
      }

      return NextResponse.json({ error: "Use ?action=countries|regions|search" }, { status: 400 });
    }

    // ─── JSON fallback (local dev) ──────────────────────────────────
    if (action === "countries") {
      const countries = loadCountriesFromJSON().map((c) => ({
        iso3: c.iso3, name: c.name, region: c.region,
        idealPoint: c.idealPoint, democracyIndex: c.democracyIndex,
        scStatus: c.scStatus, blocs: c.blocs,
      }));
      return NextResponse.json(countries);
    }

    if (action === "regions") {
      const countries = loadCountriesFromJSON();
      const regions: Record<string, { count: number; avgIdealPoint: number; avgDemocracy: number }> = {};
      for (const c of countries) {
        if (!regions[c.region]) regions[c.region] = { count: 0, avgIdealPoint: 0, avgDemocracy: 0 };
        regions[c.region].count++;
        regions[c.region].avgIdealPoint += c.idealPoint;
        regions[c.region].avgDemocracy += c.democracyIndex;
      }
      for (const r of Object.values(regions)) {
        r.avgIdealPoint /= r.count;
        r.avgDemocracy /= r.count;
      }
      return NextResponse.json(regions);
    }

    if (action === "search") {
      const q = (searchParams.get("q") || "").toLowerCase();
      if (!q) return NextResponse.json([]);
      return NextResponse.json(
        loadCountriesFromJSON()
          .filter((c) => c.name.toLowerCase().includes(q) || c.iso3.toLowerCase().includes(q))
          .slice(0, 20)
          .map((c) => ({ iso3: c.iso3, name: c.name, region: c.region }))
      );
    }

    return NextResponse.json({ error: "Use ?action=countries|regions|search" }, { status: 400 });
  } catch (e) {
    console.error("Explore query failed:", e);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }
}
