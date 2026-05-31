/**
 * Ingest GDELT geopolitical events into Neo4j.
 *
 * GDELT (Global Database of Events, Language, and Tone) provides real-time
 * event monitoring. We query for UN-relevant diplomatic events and create
 * Event nodes + ENGAGED_IN relationships in the knowledge graph.
 *
 * API: https://api.gdeltproject.org/api/v2/doc/doc
 * Format: JSON, free, no API key needed
 * Coverage: Updated every 15 minutes, spans 1979-present
 *
 * We focus on:
 * - Diplomatic cooperation/conflict between nation-states
 * - UN-related events (Security Council, General Assembly)
 * - Sanctions, treaties, military actions
 *
 * Usage: npx tsx scripts/ingest-gdelt-events.ts
 */

import neo4j from "neo4j-driver";
import { writeFileSync } from "fs";
import path from "path";

const DATA_DIR = path.join(__dirname, "../data");

// GDELT CAMEO event code categories relevant to UN diplomacy
const RELEVANT_EVENT_TYPES: Record<string, string> = {
  "01": "Public Statement",
  "02": "Appeal",
  "03": "Express Intent to Cooperate",
  "04": "Consult",
  "05": "Diplomatic Cooperation",
  "06": "Material Cooperation",
  "07": "Provide Aid",
  "08": "Yield",
  "09": "Investigate",
  "10": "Demand",
  "11": "Disapprove",
  "12": "Reject",
  "13": "Threaten",
  "14": "Protest",
  "15": "Exhibit Force",
  "17": "Coerce",
  "18": "Assault",
  "19": "Fight",
  "20": "Use Unconventional Mass Violence",
};

interface GDELTArticle {
  url: string;
  title: string;
  seendate: string;
  domain: string;
  language: string;
  sourcecountry: string;
}

interface ProcessedEvent {
  id: string;
  title: string;
  date: string;
  source: string;
  countries: string[];
  eventType: string;
  tone: number;
  relevance: number;
}

async function fetchGDELTEvents(query: string, timespan: string = "3months"): Promise<GDELTArticle[]> {
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=artlist&format=json&timespan=${timespan}&maxrecords=50&sort=datedesc`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`GDELT API error: ${res.status}`);

  const data = await res.json();
  return data.articles || [];
}

// ISO2 country code extraction from GDELT source countries
const ISO2_TO_ISO3: Record<string, string> = {
  US: "USA", GB: "GBR", FR: "FRA", DE: "DEU", CN: "CHN", RU: "RUS", IN: "IND",
  JP: "JPN", BR: "BRA", AU: "AUS", CA: "CAN", IT: "ITA", ES: "ESP", KR: "KOR",
  IL: "ISR", IR: "IRN", SA: "SAU", TR: "TUR", EG: "EGY", NG: "NGA", ZA: "ZAF",
  MX: "MEX", AR: "ARG", ID: "IDN", PK: "PAK", UA: "UKR", PL: "POL", NL: "NLD",
  BE: "BEL", SE: "SWE", NO: "NOR", DK: "DNK", FI: "FIN", CH: "CHE", AT: "AUT",
  IE: "IRL", NZ: "NZL", SG: "SGP", MY: "MYS", TH: "THA", PH: "PHL", VN: "VNM",
};

function extractCountriesFromTitle(title: string): string[] {
  const countries: string[] = [];
  const countryPatterns: [string, string][] = [
    ["united states", "USA"], ["china", "CHN"], ["russia", "RUS"], ["ukraine", "UKR"],
    ["israel", "ISR"], ["iran", "IRN"], ["india", "IND"], ["brazil", "BRA"],
    ["france", "FRA"], ["germany", "DEU"], ["japan", "JPN"], ["united kingdom", "GBR"],
    ["saudi arabia", "SAU"], ["turkey", "TUR"], ["egypt", "EGY"], ["pakistan", "PAK"],
    ["south korea", "KOR"], ["north korea", "PRK"], ["australia", "AUS"], ["canada", "CAN"],
    ["mexico", "MEX"], ["nigeria", "NGA"], ["south africa", "ZAF"], ["indonesia", "IDN"],
    ["syria", "SYR"], ["iraq", "IRQ"], ["afghanistan", "AFG"], ["yemen", "YEM"],
    ["venezuela", "VEN"], ["cuba", "CUB"], ["palestine", "PSE"], ["taiwan", "TWN"],
    ["myanmar", "MMR"], ["ethiopia", "ETH"], ["somalia", "SOM"], ["sudan", "SDN"],
  ];

  const lower = title.toLowerCase();
  for (const [name, iso3] of countryPatterns) {
    if (lower.includes(name)) countries.push(iso3);
  }
  return [...new Set(countries)];
}

function classifyEvent(title: string): { type: string; tone: number } {
  const lower = title.toLowerCase();

  if (lower.includes("sanctions") || lower.includes("embargo")) return { type: "sanctions", tone: -4 };
  if (lower.includes("war") || lower.includes("attack") || lower.includes("strike")) return { type: "conflict", tone: -8 };
  if (lower.includes("peace") || lower.includes("ceasefire") || lower.includes("agreement")) return { type: "diplomatic", tone: 5 };
  if (lower.includes("treaty") || lower.includes("accord") || lower.includes("deal")) return { type: "agreement", tone: 6 };
  if (lower.includes("security council") || lower.includes("general assembly") || lower.includes("united nations")) return { type: "un-action", tone: 0 };
  if (lower.includes("veto") || lower.includes("block")) return { type: "veto", tone: -3 };
  if (lower.includes("vote") || lower.includes("resolution")) return { type: "vote", tone: 0 };
  if (lower.includes("crisis") || lower.includes("tension")) return { type: "crisis", tone: -5 };
  if (lower.includes("aid") || lower.includes("humanitarian")) return { type: "humanitarian", tone: 3 };
  if (lower.includes("trade") || lower.includes("economic")) return { type: "economic", tone: 2 };

  return { type: "other", tone: 0 };
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  GDELT Geopolitical Event Ingestion");
  console.log("═══════════════════════════════════════════════════════════\n");

  // Query categories
  const queries = [
    "united nations security council",
    "general assembly resolution",
    "international sanctions",
    "nuclear weapons treaty",
    "human rights violation",
    "climate agreement",
  ];

  const allEvents: ProcessedEvent[] = [];

  for (const query of queries) {
    process.stdout.write(`  Fetching: "${query}"...`);
    try {
      const articles = await fetchGDELTEvents(query, "3months");
      const processed = articles.map((a, i) => {
        const countries = extractCountriesFromTitle(a.title);
        const { type, tone } = classifyEvent(a.title);
        return {
          id: `gdelt-${query.replace(/\s+/g, "-")}-${i}`,
          title: a.title,
          date: a.seendate?.substring(0, 8) || "",
          source: a.domain || "",
          countries,
          eventType: type,
          tone,
          relevance: countries.length > 0 ? 0.8 : 0.4,
        };
      }).filter((e) => e.countries.length > 0);

      allEvents.push(...processed);
      console.log(` ${processed.length} events (${articles.length} articles)`);
    } catch (e) {
      console.log(` ✗ (${e instanceof Error ? e.message : "failed"})`);
    }
    // Rate limit
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(`\n  Total events with identified countries: ${allEvents.length}`);

  // Deduplicate by title similarity
  const seen = new Set<string>();
  const uniqueEvents = allEvents.filter((e) => {
    const key = e.title.substring(0, 60).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`  After deduplication: ${uniqueEvents.length} events`);

  // Write to JSON
  writeFileSync(
    path.join(DATA_DIR, "gdelt-events.json"),
    JSON.stringify({ fetchedAt: new Date().toISOString(), events: uniqueEvents.slice(0, 100) }, null, 2)
  );
  console.log(`  Written to data/gdelt-events.json`);

  // Push to Neo4j if configured
  const uri = process.env.NEO4J_URI;
  const password = process.env.NEO4J_PASSWORD;

  if (uri && password) {
    console.log("\n  Pushing events to Neo4j...");
    const driver = neo4j.driver(uri, neo4j.auth.basic(process.env.NEO4J_USER || "neo4j", password));
    const session = driver.session({ database: process.env.NEO4J_DATABASE || "neo4j" });

    try {
      // Create Event nodes
      await session.run(`
        UNWIND $events AS e
        MERGE (ev:Event {id: e.id})
        SET ev.title = e.title,
            ev.date = e.date,
            ev.source = e.source,
            ev.eventType = e.eventType,
            ev.tone = e.tone,
            ev.relevance = e.relevance,
            ev.dataSource = 'gdelt'
        WITH ev, e
        UNWIND e.countries AS iso3
        MATCH (c:Country {iso3: iso3})
        MERGE (c)-[:ENGAGED_IN]->(ev)
      `, { events: uniqueEvents.slice(0, 80) });

      const count = await session.run(`MATCH (e:Event) RETURN count(e) AS n`);
      console.log(`  ✓ ${count.records[0].get("n")} Event nodes in Neo4j`);
    } finally {
      await session.close();
      await driver.close();
    }
  } else {
    console.log("\n  Neo4j not configured — events saved to JSON only");
  }

  // Print sample
  console.log("\n  Sample events:");
  for (const e of uniqueEvents.slice(0, 5)) {
    console.log(`    [${e.eventType}] ${e.title.substring(0, 70)}...`);
    console.log(`      Countries: ${e.countries.join(", ")} | Tone: ${e.tone}`);
  }

  console.log("\n═══════════════════════════════════════════════════════════\n");
}

main().catch(console.error);
