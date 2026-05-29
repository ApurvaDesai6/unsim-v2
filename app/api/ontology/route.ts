import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import path from "path";
import { OntologyEngine } from "@/lib/ontology/engine";
import { getAllPerspectives } from "@/lib/ontology/perspectives";

let engineCache: OntologyEngine | null = null;

async function getEngine(): Promise<OntologyEngine> {
  if (engineCache) return engineCache;

  const engine = new OntologyEngine();
  const ttl = readFileSync(path.join(process.cwd(), "lib", "ontology", "un-diplomacy.ttl"), "utf-8");
  await engine.loadSchema(ttl);

  // Load country data into the ontology
  const profiles = JSON.parse(readFileSync(path.join(process.cwd(), "data", "country-profiles.json"), "utf-8"));
  for (const p of profiles) {
    engine.addCountry(p.iso3, p.name, {
      idealPoint: p.idealPoint,
      democracyIndex: p.democracyIndex,
      region: p.region,
      population: p.population,
      gdpPerCapita: p.gdpPerCapita,
      sovereignty: p.policyDimensions.sovereignty,
      humanRights: p.policyDimensions.humanRights,
      development: p.policyDimensions.development,
      security: p.policyDimensions.security,
      environment: p.policyDimensions.environment,
      decolonization: p.policyDimensions.decolonization,
    });
  }

  // Load alliances
  const simData = JSON.parse(readFileSync(path.join(process.cwd(), "data", "vote-similarity.json"), "utf-8"));
  const nameToIso = new Map<string, string>();
  for (const p of profiles) nameToIso.set(p.name, p.iso3);

  for (const [name, data] of Object.entries(simData.similarities || {})) {
    const iso3 = nameToIso.get(name);
    if (!iso3) continue;
    const simEntry = data as { mostSimilar?: { country: string; similarity: number }[]; mostDissimilar?: { country: string; similarity: number }[] };
    for (const ally of (simEntry.mostSimilar || []).slice(0, 5)) {
      const allyIso = nameToIso.get(ally.country);
      if (allyIso) engine.addAlliance(iso3, allyIso, ally.similarity);
    }
    for (const rival of (simEntry.mostDissimilar || []).slice(0, 3)) {
      const rivalIso = nameToIso.get(rival.country);
      if (rivalIso) engine.addRivalry(iso3, rivalIso, Math.abs(rival.similarity));
    }
  }

  // Load bloc memberships
  const blocs = JSON.parse(readFileSync(path.join(process.cwd(), "data", "blocs.json"), "utf-8"));
  for (const b of blocs) {
    for (const memberIso of b.members) {
      engine.addBlocMembership(memberIso, b.shortName);
    }
  }

  engineCache = engine;
  return engine;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  try {
    if (action === "perspectives") {
      return NextResponse.json({ perspectives: getAllPerspectives() });
    }

    if (action === "schema") {
      const engine = await getEngine();
      return NextResponse.json({
        classes: engine.getClasses(),
        properties: engine.getProperties(),
        summary: engine.getSummary(),
      });
    }

    if (action === "infer") {
      const iso3 = searchParams.get("iso3");
      if (!iso3) return NextResponse.json({ error: "iso3 required" }, { status: 400 });
      const engine = await getEngine();
      const inferred = engine.inferTransitiveAlliances(iso3.toUpperCase());
      return NextResponse.json({ iso3: iso3.toUpperCase(), inferredAlliances: inferred });
    }

    if (action === "validate") {
      const sourceType = searchParams.get("sourceType") || "";
      const property = searchParams.get("property") || "";
      const targetType = searchParams.get("targetType") || "";
      const engine = await getEngine();
      const error = engine.validateEdge(sourceType, property, targetType);
      return NextResponse.json({ valid: !error, error });
    }

    if (action === "export") {
      const format = searchParams.get("format") || "turtle";
      const engine = await getEngine();
      if (format === "jsonld") {
        return NextResponse.json(engine.exportJsonLd());
      }
      const turtle = engine.exportTurtle();
      return new NextResponse(turtle, { headers: { "Content-Type": "text/turtle" } });
    }

    return NextResponse.json({
      actions: ["perspectives", "schema", "infer", "validate", "export"],
      description: "UNSim Ontology API — OWL-Lite schema with SHACL validation",
    });
  } catch (e) {
    console.error("Ontology API error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
