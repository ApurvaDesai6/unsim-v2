/**
 * Ontology Engine — OWL/RDF-based semantic layer for the UN Knowledge Graph.
 *
 * Uses N3.js for RDF triple storage and querying.
 * The ontology defines the formal schema (classes, properties, constraints)
 * while the knowledge graph instances populate it with real data.
 *
 * This enables:
 * - Formal validation of graph modifications (does this edge make semantic sense?)
 * - Visual ontology editing (users can see/modify the schema)
 * - SPARQL-like queries over the graph
 * - Export to standard formats (Turtle, JSON-LD) for interop with Neptune/Neo4j
 * - Inference (if A alliedWith B and B alliedWith C, suggest A may cooperate with C)
 */

import { Store, Parser, Writer, DataFactory, type Quad } from "n3";

const { namedNode, literal, quad: makeQuad } = DataFactory;

const UN = "http://unsim.apurvad.xyz/ontology#";
const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const RDFS = "http://www.w3.org/2000/01/rdf-schema#";
const OWL = "http://www.w3.org/2002/07/owl#";
const XSD = "http://www.w3.org/2001/XMLSchema#";

export class OntologyEngine {
  private store: Store;
  private schemaLoaded: boolean = false;

  constructor() {
    this.store = new Store();
  }

  get tripleCount(): number {
    return this.store.size;
  }

  /**
   * Load the ontology schema from Turtle string.
   */
  async loadSchema(ttl: string): Promise<void> {
    const parser = new Parser();
    const quads = parser.parse(ttl);
    this.store.addQuads(quads);
    this.schemaLoaded = true;
  }

  /**
   * Add a country instance to the graph.
   */
  addCountry(iso3: string, name: string, attrs: {
    idealPoint: number;
    democracyIndex: number;
    region: string;
    population?: number;
    gdpPerCapita?: number;
    sovereignty?: number;
    humanRights?: number;
    development?: number;
    security?: number;
    environment?: number;
    decolonization?: number;
  }): void {
    const subject = namedNode(`${UN}country_${iso3}`);

    this.store.addQuad(makeQuad(subject, namedNode(`${RDF}type`), namedNode(`${UN}Country`)));
    this.store.addQuad(makeQuad(subject, namedNode(`${RDFS}label`), literal(name)));
    this.store.addQuad(makeQuad(subject, namedNode(`${UN}iso3Code`), literal(iso3)));
    this.store.addQuad(makeQuad(subject, namedNode(`${UN}idealPoint`), literal(attrs.idealPoint.toString(), namedNode(`${XSD}float`))));
    this.store.addQuad(makeQuad(subject, namedNode(`${UN}democracyIndex`), literal(attrs.democracyIndex.toString(), namedNode(`${XSD}float`))));
    this.store.addQuad(makeQuad(subject, namedNode(`${UN}belongsToRegion`), namedNode(`${UN}${attrs.region}`)));

    if (attrs.population) this.store.addQuad(makeQuad(subject, namedNode(`${UN}population`), literal(attrs.population.toString(), namedNode(`${XSD}integer`))));
    if (attrs.gdpPerCapita) this.store.addQuad(makeQuad(subject, namedNode(`${UN}gdpPerCapita`), literal(attrs.gdpPerCapita.toString(), namedNode(`${XSD}float`))));
    if (attrs.sovereignty !== undefined) this.store.addQuad(makeQuad(subject, namedNode(`${UN}sovereignty`), literal(attrs.sovereignty.toString(), namedNode(`${XSD}float`))));
    if (attrs.humanRights !== undefined) this.store.addQuad(makeQuad(subject, namedNode(`${UN}humanRights`), literal(attrs.humanRights.toString(), namedNode(`${XSD}float`))));
    if (attrs.development !== undefined) this.store.addQuad(makeQuad(subject, namedNode(`${UN}development`), literal(attrs.development.toString(), namedNode(`${XSD}float`))));
    if (attrs.security !== undefined) this.store.addQuad(makeQuad(subject, namedNode(`${UN}security`), literal(attrs.security.toString(), namedNode(`${XSD}float`))));
    if (attrs.environment !== undefined) this.store.addQuad(makeQuad(subject, namedNode(`${UN}environment`), literal(attrs.environment.toString(), namedNode(`${XSD}float`))));
    if (attrs.decolonization !== undefined) this.store.addQuad(makeQuad(subject, namedNode(`${UN}decolonization`), literal(attrs.decolonization.toString(), namedNode(`${XSD}float`))));
  }

  /**
   * Add an alliance relationship between two countries.
   */
  addAlliance(country1: string, country2: string, similarity: number): void {
    const s1 = namedNode(`${UN}country_${country1}`);
    const s2 = namedNode(`${UN}country_${country2}`);
    this.store.addQuad(makeQuad(s1, namedNode(`${UN}alliedWith`), s2));
    // Reified to store similarity score
    const edgeNode = namedNode(`${UN}alliance_${country1}_${country2}`);
    this.store.addQuad(makeQuad(edgeNode, namedNode(`${RDF}type`), namedNode(`${OWL}NamedIndividual`)));
    this.store.addQuad(makeQuad(edgeNode, namedNode(`${UN}voteSimilarity`), literal(similarity.toString(), namedNode(`${XSD}float`))));
  }

  /**
   * Add a rivalry relationship.
   */
  addRivalry(country1: string, country2: string, intensity: number): void {
    const s1 = namedNode(`${UN}country_${country1}`);
    const s2 = namedNode(`${UN}country_${country2}`);
    this.store.addQuad(makeQuad(s1, namedNode(`${UN}opposedBy`), s2));
  }

  /**
   * Add bloc membership.
   */
  addBlocMembership(countryIso3: string, blocId: string): void {
    const country = namedNode(`${UN}country_${countryIso3}`);
    const bloc = namedNode(`${UN}bloc_${blocId}`);
    this.store.addQuad(makeQuad(country, namedNode(`${UN}memberOf`), bloc));
  }

  /**
   * Query: Get all countries in a specific region.
   */
  getCountriesInRegion(region: string): string[] {
    const quads = this.store.getQuads(null, namedNode(`${UN}belongsToRegion`), namedNode(`${UN}${region}`), null);
    return quads.map((q) => {
      const uri = q.subject.value;
      return uri.replace(`${UN}country_`, "");
    });
  }

  /**
   * Query: Get all allies of a country.
   */
  getAllies(iso3: string): string[] {
    const subject = namedNode(`${UN}country_${iso3}`);
    const quads = this.store.getQuads(subject, namedNode(`${UN}alliedWith`), null, null);
    return quads.map((q) => q.object.value.replace(`${UN}country_`, ""));
  }

  /**
   * Query: Get all rivals of a country.
   */
  getRivals(iso3: string): string[] {
    const subject = namedNode(`${UN}country_${iso3}`);
    const quads = this.store.getQuads(subject, namedNode(`${UN}opposedBy`), null, null);
    return quads.map((q) => q.object.value.replace(`${UN}country_`, ""));
  }

  /**
   * Query: Get all blocs a country belongs to.
   */
  getBlocs(iso3: string): string[] {
    const subject = namedNode(`${UN}country_${iso3}`);
    const quads = this.store.getQuads(subject, namedNode(`${UN}memberOf`), null, null);
    return quads.map((q) => q.object.value.replace(`${UN}bloc_`, ""));
  }

  /**
   * Query: Get all classes defined in the ontology.
   */
  getClasses(): { uri: string; label: string; comment: string }[] {
    const classQuads = this.store.getQuads(null, namedNode(`${RDF}type`), namedNode(`${OWL}Class`), null);
    return classQuads.map((q) => {
      const uri = q.subject.value;
      const labelQuads = this.store.getQuads(q.subject, namedNode(`${RDFS}label`), null, null);
      const commentQuads = this.store.getQuads(q.subject, namedNode(`${RDFS}comment`), null, null);
      return {
        uri,
        label: labelQuads[0]?.object.value || uri.split("#").pop() || "",
        comment: commentQuads[0]?.object.value || "",
      };
    });
  }

  /**
   * Query: Get all properties (object + datatype) defined in the ontology.
   */
  getProperties(): { uri: string; label: string; domain: string; range: string; type: "object" | "datatype" }[] {
    const objProps = this.store.getQuads(null, namedNode(`${RDF}type`), namedNode(`${OWL}ObjectProperty`), null);
    const dataProps = this.store.getQuads(null, namedNode(`${RDF}type`), namedNode(`${OWL}DatatypeProperty`), null);

    const results: { uri: string; label: string; domain: string; range: string; type: "object" | "datatype" }[] = [];

    for (const q of objProps) {
      const labelQuads = this.store.getQuads(q.subject, namedNode(`${RDFS}label`), null, null);
      const domainQuads = this.store.getQuads(q.subject, namedNode(`${RDFS}domain`), null, null);
      const rangeQuads = this.store.getQuads(q.subject, namedNode(`${RDFS}range`), null, null);
      results.push({
        uri: q.subject.value,
        label: labelQuads[0]?.object.value || q.subject.value.split("#").pop() || "",
        domain: domainQuads[0]?.object.value.split("#").pop() || "",
        range: rangeQuads[0]?.object.value.split("#").pop() || "",
        type: "object",
      });
    }

    for (const q of dataProps) {
      const labelQuads = this.store.getQuads(q.subject, namedNode(`${RDFS}label`), null, null);
      const domainQuads = this.store.getQuads(q.subject, namedNode(`${RDFS}domain`), null, null);
      const rangeQuads = this.store.getQuads(q.subject, namedNode(`${RDFS}range`), null, null);
      results.push({
        uri: q.subject.value,
        label: labelQuads[0]?.object.value || q.subject.value.split("#").pop() || "",
        domain: domainQuads[0]?.object.value.split("#").pop() || "",
        range: rangeQuads[0]?.object.value.split("#").pop() || "",
        type: "datatype",
      });
    }

    return results;
  }

  /**
   * Validate: Check if a proposed edge is valid according to the ontology.
   * Returns null if valid, error message if not.
   */
  validateEdge(sourceType: string, property: string, targetType: string): string | null {
    const propNode = namedNode(`${UN}${property}`);
    const domainQuads = this.store.getQuads(propNode, namedNode(`${RDFS}domain`), null, null);
    const rangeQuads = this.store.getQuads(propNode, namedNode(`${RDFS}range`), null, null);

    if (domainQuads.length === 0 && rangeQuads.length === 0) {
      return `Property "${property}" not found in ontology`;
    }

    if (domainQuads.length > 0) {
      const expectedDomain = domainQuads[0].object.value.split("#").pop();
      if (expectedDomain && expectedDomain !== sourceType) {
        return `Property "${property}" expects domain "${expectedDomain}", got "${sourceType}"`;
      }
    }

    if (rangeQuads.length > 0) {
      const expectedRange = rangeQuads[0].object.value.split("#").pop();
      if (expectedRange && expectedRange !== targetType) {
        return `Property "${property}" expects range "${expectedRange}", got "${targetType}"`;
      }
    }

    return null;
  }

  /**
   * Inference: Find potential alliances through transitivity.
   * If A is allied with B, and B is allied with C, then A may cooperate with C.
   */
  inferTransitiveAlliances(iso3: string, depth: number = 2): { iso3: string; path: string[]; confidence: number }[] {
    const directAllies = new Set(this.getAllies(iso3));
    const inferred: Map<string, { path: string[]; confidence: number }> = new Map();

    for (const ally of directAllies) {
      const allyAllies = this.getAllies(ally);
      for (const candidate of allyAllies) {
        if (candidate === iso3 || directAllies.has(candidate)) continue;
        const existing = inferred.get(candidate);
        if (!existing || existing.confidence < 0.5) {
          inferred.set(candidate, { path: [iso3, ally, candidate], confidence: 0.5 });
        }
      }
    }

    return [...inferred.entries()].map(([iso, data]) => ({ iso3: iso, ...data }));
  }

  /**
   * Export the entire graph as Turtle for Neptune/external tool import.
   */
  exportTurtle(): string {
    const writer = new Writer({
      prefixes: {
        un: UN,
        rdf: RDF,
        rdfs: RDFS,
        owl: OWL,
        xsd: XSD,
      },
    });
    for (const quad of this.store) {
      writer.addQuad(quad as Quad);
    }
    let result = "";
    writer.end((error, output) => { result = output || ""; });
    return result;
  }

  /**
   * Export as JSON-LD for web consumption.
   */
  exportJsonLd(): object[] {
    const entities: object[] = [];
    const countryQuads = this.store.getQuads(null, namedNode(`${RDF}type`), namedNode(`${UN}Country`), null);

    for (const cq of countryQuads) {
      const subject = cq.subject;
      const props: Record<string, unknown> = {
        "@id": subject.value,
        "@type": "un:Country",
      };
      for (const pq of this.store.getQuads(subject, null, null, null)) {
        const prop = pq.predicate.value.split("#").pop() || pq.predicate.value;
        const val = pq.object.termType === "Literal" ? pq.object.value : pq.object.value;
        props[prop] = val;
      }
      entities.push(props);
    }

    return entities;
  }

  /**
   * Get ontology summary for display.
   */
  getSummary(): {
    classes: number;
    objectProperties: number;
    datatypeProperties: number;
    individuals: number;
    totalTriples: number;
  } {
    const classes = this.store.getQuads(null, namedNode(`${RDF}type`), namedNode(`${OWL}Class`), null).length;
    const objProps = this.store.getQuads(null, namedNode(`${RDF}type`), namedNode(`${OWL}ObjectProperty`), null).length;
    const dataProps = this.store.getQuads(null, namedNode(`${RDF}type`), namedNode(`${OWL}DatatypeProperty`), null).length;
    const individuals = this.store.getQuads(null, namedNode(`${RDF}type`), namedNode(`${UN}Country`), null).length;

    return {
      classes,
      objectProperties: objProps,
      datatypeProperties: dataProps,
      individuals,
      totalTriples: this.store.size,
    };
  }
}
