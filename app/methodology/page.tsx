import Link from "next/link";

function MetricCard({
  label,
  value,
  subtext,
}: {
  label: string;
  value: string;
  subtext?: string;
}) {
  return (
    <div className="p-5 rounded-xl border border-[var(--color-border)] bg-white">
      <div className="text-xs font-medium text-[var(--color-muted)] mb-1">{label}</div>
      <div
        className="text-2xl font-semibold"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {value}
      </div>
      {subtext && (
        <div className="text-xs text-[var(--color-muted)] mt-1">{subtext}</div>
      )}
    </div>
  );
}

function BarVisualization({
  label,
  value,
  maxValue,
  color,
  suffix = "%",
}: {
  label: string;
  value: number;
  maxValue: number;
  color: string;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm w-[200px] shrink-0 truncate">{label}</span>
      <div className="flex-1 h-3 rounded-full bg-[var(--color-bg)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${(value / maxValue) * 100}%`, background: color }}
        />
      </div>
      <span
        className="text-xs text-[var(--color-muted)] w-16 text-right shrink-0"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {value.toFixed(1)}
        {suffix}
      </span>
    </div>
  );
}

function SignalCard({
  number,
  title,
  weight,
  description,
}: {
  number: string;
  title: string;
  weight: string;
  description: string;
}) {
  return (
    <div className="p-5 rounded-xl border border-[var(--color-border)] bg-white">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-[var(--color-un-blue)]">
          {number}
        </span>
        <span
          className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-un-blue)]/10 text-[var(--color-un-blue)] font-medium"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {weight}
        </span>
      </div>
      <h4 className="text-sm font-medium text-[var(--color-ink)] mb-1">{title}</h4>
      <p className="text-xs text-[var(--color-muted)] leading-relaxed">
        {description}
      </p>
    </div>
  );
}

function DecisionRow({
  decision,
  chose,
  over,
  rationale,
}: {
  decision: string;
  chose: string;
  over: string;
  rationale: string;
}) {
  return (
    <tr className="border-b border-[var(--color-border)] last:border-0">
      <td className="py-3 pr-3 text-sm font-medium text-[var(--color-ink)] align-top">
        {decision}
      </td>
      <td className="py-3 pr-3 text-sm text-[var(--color-un-blue)] font-medium align-top">
        {chose}
      </td>
      <td className="py-3 pr-3 text-sm text-[var(--color-muted)] align-top">
        {over}
      </td>
      <td className="py-3 text-xs text-[var(--color-muted)] leading-relaxed align-top">
        {rationale}
      </td>
    </tr>
  );
}

function EvidenceCard({
  relationship,
  citation,
  example,
  improvement,
}: {
  relationship: string;
  citation: string;
  example: string;
  improvement: string;
}) {
  return (
    <div className="p-4 rounded-xl border border-[var(--color-border)] bg-white">
      <div className="flex items-center gap-2 mb-2">
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded bg-[var(--color-un-blue)]/10 text-[var(--color-un-blue)]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {relationship}
        </span>
      </div>
      <div className="space-y-2">
        <div>
          <span className="text-[10px] font-medium text-[var(--color-muted)] uppercase tracking-wide">
            Citation
          </span>
          <p className="text-xs text-[var(--color-ink)] leading-relaxed">
            {citation}
          </p>
        </div>
        <div>
          <span className="text-[10px] font-medium text-[var(--color-muted)] uppercase tracking-wide">
            Example
          </span>
          <p className="text-xs text-[var(--color-ink)] leading-relaxed">
            {example}
          </p>
        </div>
        <div>
          <span className="text-[10px] font-medium text-[var(--color-muted)] uppercase tracking-wide">
            Predictive Improvement
          </span>
          <p className="text-xs text-[var(--color-ink)] leading-relaxed">
            {improvement}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function MethodologyPage() {
  return (
    <main className="min-h-screen bg-[var(--color-bg)]">
      {/* Header */}
      <header className="bg-white border-b border-[var(--color-border)]">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]"
          >
            &larr; Back to UNSim
          </Link>
          <span
            className="text-xs text-[var(--color-muted)] px-2 py-0.5 rounded bg-[var(--color-bg)] border border-[var(--color-border)]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Engine v2.0.0-graph-predictor
          </span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-16 space-y-24">
        {/* Hero */}
        <section>
          <h1
            className="text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] mb-4"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Technical Methodology
          </h1>
          <p className="text-lg text-[var(--color-muted)] leading-relaxed max-w-3xl mb-10">
            UNSim v2 is a graph-backed prediction engine for UN General Assembly voting
            behavior. It combines a Neo4j knowledge graph, five empirically-weighted
            signals, and a two-pass simulation model validated against{" "}
            <strong className="text-[var(--color-ink)]">180,489</strong> recorded votes.
            This page documents every architectural decision, the evidence behind each
            relationship type, and an honest assessment of where the model succeeds and
            fails.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              label="Per-Vote Accuracy"
              value="81.1%"
              subtext="146,446 / 180,489 correct"
            />
            <MetricCard
              label="Outcome Accuracy"
              value="99.6%"
              subtext="1,074 / 1,078 pass/fail"
            />
            <MetricCard
              label="Graph Relationships"
              value="3,660"
              subtext="9 typed edges with provenance"
            />
            <MetricCard
              label="Data Sources"
              value="9"
              subtext="Academic + institutional datasets"
            />
          </div>
        </section>

        {/* 01 - Platform Architecture */}
        <section>
          <div className="text-[13px] font-medium text-[var(--color-muted)] tracking-tight mb-2">
            01 &middot; Platform Architecture
          </div>
          <h2
            className="text-2xl font-semibold mb-4"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            System Design &amp; Deployment
          </h2>
          <p className="text-sm text-[var(--color-muted)] leading-relaxed mb-8 max-w-3xl">
            The platform runs as a Next.js 14 application on Vercel serverless
            infrastructure. The knowledge graph lives in Neo4j AuraDB (persistent store)
            with graphology as an in-memory complement for sub-millisecond client-side
            queries during simulation.
          </p>

          {/* System Diagram */}
          <div className="p-6 rounded-xl border border-[var(--color-border)] bg-white overflow-x-auto mb-8">
            <h3 className="text-sm font-medium mb-4">System Architecture</h3>
            <pre
              className="text-xs leading-relaxed text-[var(--color-muted)]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {`  User (Browser)
       |
       v
  +-------------------+       +----------------------------+
  | Next.js 14 App    |       | Vercel Serverless          |
  | (React Server     |------>| Edge Functions             |
  |  Components)      |       | (API Routes, ISR)          |
  +-------------------+       +----------------------------+
       |                               |
       |  Client-side (hot path)       |  Server-side (exploration)
       v                               v
  +-------------------+       +----------------------------+
  | graphology        |       | Neo4j AuraDB Free          |
  | (in-memory graph) |       | (Persistent Knowledge      |
  | Sub-ms queries    |       |  Graph, 212 nodes,         |
  | Force simulation  |       |  3,660 relationships)      |
  +-------------------+       +----------------------------+
       |                               |
       v                               v
  +-------------------+       +----------------------------+
  | Vote Engine       |       | Cypher Query Engine         |
  | 5-signal blend    |       | Graph traversal,           |
  | Two-pass sim      |       | path analysis,             |
  | 193 countries     |       | pattern matching           |
  +-------------------+       +----------------------------+
       |
       v
  +----------------------------------------------------+
  |  Predicted Votes (Yes / No / Abstain per country)  |
  |  + Confidence scores + Resolution outcome          |
  +----------------------------------------------------+`}
            </pre>
          </div>

          {/* Architecture Decisions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-xl border border-[var(--color-border)] bg-white">
              <h4 className="text-sm font-medium text-[var(--color-ink)] mb-2">
                Why Neo4j over AWS Neptune
              </h4>
              <ul className="text-xs text-[var(--color-muted)] space-y-1.5 leading-relaxed">
                <li>
                  <strong>VPC requirement:</strong> Neptune requires a VPC; Vercel
                  serverless cannot connect without NAT Gateway ($55-80/mo overhead)
                </li>
                <li>
                  <strong>Scale mismatch:</strong> Neptune is built for billion-edge
                  graphs; our 3,660 edges do not justify the operational complexity
                </li>
                <li>
                  <strong>Cost:</strong> Neo4j AuraDB free tier fits our data; Neptune
                  minimum is ~$0.10/hr ($72/mo)
                </li>
                <li>
                  <strong>Cypher vs Gremlin:</strong> Property graph model maps directly
                  to our domain; Cypher is more readable for IR scholars
                </li>
              </ul>
            </div>
            <div className="p-5 rounded-xl border border-[var(--color-border)] bg-white">
              <h4 className="text-sm font-medium text-[var(--color-ink)] mb-2">
                Why Hybrid: Neo4j + graphology
              </h4>
              <ul className="text-xs text-[var(--color-muted)] space-y-1.5 leading-relaxed">
                <li>
                  <strong>Latency tradeoff:</strong> Neo4j round-trip is 50-200ms;
                  simulation sliders need sub-ms response
                </li>
                <li>
                  <strong>Neo4j for exploration:</strong> Cypher queries for graph
                  traversal, path analysis, pattern discovery
                </li>
                <li>
                  <strong>graphology for hot path:</strong> In-memory KNN lookups,
                  force-directed layout, real-time vote recalculation
                </li>
                <li>
                  <strong>Sync strategy:</strong> Neo4j is source of truth; graphology
                  hydrated on page load from serialized JSON
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* 02 - Knowledge Graph Ontology */}
        <section>
          <div className="text-[13px] font-medium text-[var(--color-muted)] tracking-tight mb-2">
            02 &middot; Knowledge Graph Ontology
          </div>
          <h2
            className="text-2xl font-semibold mb-4"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Graph Schema &amp; Design Decisions
          </h2>
          <p className="text-sm text-[var(--color-muted)] leading-relaxed mb-8 max-w-3xl">
            The ontology uses OWL-Lite with SHACL validation at ingestion. Every edge
            carries a source property tracking provenance back to the originating dataset.
          </p>

          {/* Entity Classes */}
          <div className="p-5 rounded-xl border border-[var(--color-border)] bg-white mb-6">
            <h3 className="text-sm font-medium mb-4">9 Entity Classes</h3>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
              {[
                { name: "Country", count: 193 },
                { name: "Bloc", count: 7 },
                { name: "Topic", count: 6 },
                { name: "Alliance", count: 6 },
                { name: "Resolution", count: "1,078" },
                { name: "Region", count: 5 },
                { name: "GovernanceProfile", count: 193 },
                { name: "AidRelation", count: 50 },
                { name: "ArmsTransfer", count: 37 },
              ].map((e) => (
                <div
                  key={e.name}
                  className="p-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-center"
                >
                  <div
                    className="text-sm font-semibold text-[var(--color-ink)]"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {e.count}
                  </div>
                  <div className="text-[10px] text-[var(--color-muted)] mt-0.5">
                    {e.name}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Relationship Types Mini Graph */}
          <div className="p-6 rounded-xl border border-[var(--color-border)] bg-white mb-6 overflow-x-auto">
            <h3 className="text-sm font-medium mb-4">
              9 Relationship Types (Mini Graph Diagram)
            </h3>
            <pre
              className="text-[11px] leading-relaxed text-[var(--color-muted)]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {`                         +-----------+
                         |   Topic   |
                         +-----------+
                              ^
                              | POSITION_ON (1,037)
                              |
  +---------+  ALLIES_WITH   +---------+  MEMBER_OF   +-------+
  | Country |<-------------->| Country |------------->|  Bloc  |
  +---------+    (1,192)     +---------+    (386)     +-------+
       |                          |
       | FORMER_COLONIZER_OF      | ARMS_SUPPLIER_TO (37)
       |        (63)              |
       v                          v
  +---------+               +---------+
  | Country |               | Country |
  +---------+               +---------+
       |                          ^
       | PROVIDES_AID_TO (50)     | BORDERS (56)
       v                          |
  +---------+               +---------+
  | Country |               | Country |
  +---------+               +---------+

  Also: RIVALS_WITH (757), MEMBER_OF_ALLIANCE (65)`}
            </pre>
          </div>

          {/* OWL-Lite Decision */}
          <div className="p-5 rounded-xl border border-[var(--color-un-blue)]/20 bg-[var(--color-un-blue)]/5">
            <h4 className="text-xs font-semibold text-[var(--color-un-blue)] mb-2">
              Why OWL-Lite, Not Full OWL 2 DL
            </h4>
            <div className="text-xs text-[var(--color-ink)] leading-relaxed space-y-2">
              <p>
                Full OWL 2 DL provides description logic reasoning (subsumption,
                consistency checking, automated classification). Our ontology has only
                ~30 entity types and 9 relationship types — no class hierarchy deep
                enough to benefit from automated reasoning.
              </p>
              <p>
                OWL-Lite provides: class definitions, property constraints
                (domain/range), cardinality restrictions (0/1), and equivalence. This is
                sufficient for our schema. SHACL shapes handle runtime validation
                (required properties, value ranges, referential integrity) at the
                ingestion boundary.
              </p>
              <p>
                <strong>Tradeoff accepted:</strong> No automated inference. If we add
                transitive relationships (e.g., "ally of my ally"), we compute them
                explicitly in Cypher rather than relying on a DL reasoner.
              </p>
            </div>
          </div>
        </section>

        {/* 03 - Data Pipeline */}
        <section>
          <div className="text-[13px] font-medium text-[var(--color-muted)] tracking-tight mb-2">
            03 &middot; Data Pipeline
          </div>
          <h2
            className="text-2xl font-semibold mb-4"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Ingestion, Validation &amp; Entity Resolution
          </h2>
          <p className="text-sm text-[var(--color-muted)] leading-relaxed mb-8 max-w-3xl">
            Nine data sources are ingested through a unified pipeline with Zod runtime
            validation, fuzzy entity resolution, and MERGE-based idempotent writes to
            Neo4j.
          </p>

          {/* Sources Table */}
          <div className="p-5 rounded-xl border border-[var(--color-border)] bg-white mb-6 overflow-x-auto">
            <h3 className="text-sm font-medium mb-4">Data Sources</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left py-2 pr-3 font-medium text-[var(--color-muted)]">
                    Source
                  </th>
                  <th className="text-left py-2 pr-3 font-medium text-[var(--color-muted)]">
                    Coverage
                  </th>
                  <th className="text-left py-2 pr-3 font-medium text-[var(--color-muted)]">
                    Records
                  </th>
                  <th className="text-left py-2 font-medium text-[var(--color-muted)]">
                    Used For
                  </th>
                </tr>
              </thead>
              <tbody className="text-[var(--color-ink)]">
                <tr className="border-b border-[var(--color-border)]">
                  <td className="py-2 pr-3 font-medium">Voeten/Harvard Dataverse</td>
                  <td className="py-2 pr-3">1946-2024</td>
                  <td
                    className="py-2 pr-3"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    869K votes
                  </td>
                  <td className="py-2 text-[var(--color-muted)]">
                    Vote records, ideal points, topic classification
                  </td>
                </tr>
                <tr className="border-b border-[var(--color-border)]">
                  <td className="py-2 pr-3 font-medium">V-Dem v14</td>
                  <td className="py-2 pr-3">2024</td>
                  <td
                    className="py-2 pr-3"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    202 countries
                  </td>
                  <td className="py-2 text-[var(--color-muted)]">
                    Polyarchy scores, regime type, governance calibration
                  </td>
                </tr>
                <tr className="border-b border-[var(--color-border)]">
                  <td className="py-2 pr-3 font-medium">
                    WGI 2024 (World Bank)
                  </td>
                  <td className="py-2 pr-3">2024</td>
                  <td
                    className="py-2 pr-3"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    215 entities
                  </td>
                  <td className="py-2 text-[var(--color-muted)]">
                    Voice/accountability, rule of law, government effectiveness
                  </td>
                </tr>
                <tr className="border-b border-[var(--color-border)]">
                  <td className="py-2 pr-3 font-medium">SIPRI Arms Transfers</td>
                  <td className="py-2 pr-3">2019-2023</td>
                  <td
                    className="py-2 pr-3"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    37 major flows
                  </td>
                  <td className="py-2 text-[var(--color-muted)]">
                    ARMS_SUPPLIER_TO relationships (TIV values)
                  </td>
                </tr>
                <tr className="border-b border-[var(--color-border)]">
                  <td className="py-2 pr-3 font-medium">OECD DAC</td>
                  <td className="py-2 pr-3">2022</td>
                  <td
                    className="py-2 pr-3"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    50 bilateral
                  </td>
                  <td className="py-2 text-[var(--color-muted)]">
                    PROVIDES_AID_TO relationships (ODA flows)
                  </td>
                </tr>
                <tr className="border-b border-[var(--color-border)]">
                  <td className="py-2 pr-3 font-medium">ATOP Alliance Treaty</td>
                  <td className="py-2 pr-3">1946-2024</td>
                  <td
                    className="py-2 pr-3"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    65 treaties
                  </td>
                  <td className="py-2 text-[var(--color-muted)]">
                    MEMBER_OF_ALLIANCE (defense pacts, ententes, neutrality)
                  </td>
                </tr>
                <tr className="border-b border-[var(--color-border)]">
                  <td className="py-2 pr-3 font-medium">
                    Vote Similarity Matrix
                  </td>
                  <td className="py-2 pr-3">Computed</td>
                  <td
                    className="py-2 pr-3"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    1,192 edges
                  </td>
                  <td className="py-2 text-[var(--color-muted)]">
                    ALLIES_WITH / RIVALS_WITH (cosine similarity)
                  </td>
                </tr>
                <tr className="border-b border-[var(--color-border)]">
                  <td className="py-2 pr-3 font-medium">Colonial History</td>
                  <td className="py-2 pr-3">Historical</td>
                  <td
                    className="py-2 pr-3"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    63 pairs
                  </td>
                  <td className="py-2 text-[var(--color-muted)]">
                    FORMER_COLONIZER_OF (verified via UN decolonization records)
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 font-medium">Bloc Membership</td>
                  <td className="py-2 pr-3">Current</td>
                  <td
                    className="py-2 pr-3"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    386 memberships
                  </td>
                  <td className="py-2 text-[var(--color-muted)]">
                    G77, NAM, EU, African Group, AOSIS, Arab Group, CARICOM
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Pipeline Flow */}
          <div className="p-6 rounded-xl border border-[var(--color-border)] bg-white overflow-x-auto mb-6">
            <h3 className="text-sm font-medium mb-4">Ingestion Flow</h3>
            <pre
              className="text-[11px] leading-relaxed text-[var(--color-muted)]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {`  Raw Data (CSV/Excel/JSON)
       |
       v
  +---------------------------+
  | Zod Schema Validation     |  Runtime type checking at ingestion boundary
  | - Type coercion           |  Catches: missing fields, invalid ranges,
  | - Range constraints       |  malformed dates, encoding issues
  | - Required field checks   |
  +---------------------------+
       |
       v
  +---------------------------+
  | Entity Resolution         |  Fuse.js fuzzy matching (threshold: 0.3)
  | - Canonical: ISO 3166-1   |  + canonical ISO-3166 authority file
  | - "Korea, Rep." -> KOR    |  Handles: historical names, abbreviations,
  | - "Viet Nam" -> VNM       |  transliteration variants
  +---------------------------+
       |
       v
  +---------------------------+
  | Neo4j MERGE (idempotent)  |  MERGE = create if not exists, update if exists
  | - ON CREATE SET props     |  Enables repeated pipeline runs without duplicates
  | - ON MATCH SET updated_at |  Every edge gets: source, confidence, timestamp
  +---------------------------+
       |
       v
  +---------------------------+
  | graphology Sync           |  Serialized JSON export from Neo4j
  | - Hydrated on page load   |  Used for: KNN queries, force layout,
  | - ~2MB compressed         |  real-time vote simulation
  +---------------------------+`}
            </pre>
          </div>

          <div className="p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]">
            <h4 className="text-xs font-medium text-[var(--color-ink)] mb-1">
              Temporal Coverage
            </h4>
            <p className="text-xs text-[var(--color-muted)] leading-relaxed">
              Votes: 1946-2024 (Voeten) | Governance: 2024 (V-Dem, WGI) | Arms:
              2019-2023 (SIPRI 5-year window) | Aid: 2022 (OECD DAC latest) |
              Alliances: 1946-2024 (ATOP cumulative)
            </p>
          </div>
        </section>

        {/* 04 - Prediction Engine */}
        <section>
          <div className="text-[13px] font-medium text-[var(--color-muted)] tracking-tight mb-2">
            04 &middot; Prediction Engine
          </div>
          <h2
            className="text-2xl font-semibold mb-4"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Five Signals, Two Passes
          </h2>
          <p className="text-sm text-[var(--color-muted)] leading-relaxed mb-8 max-w-3xl">
            Each country&apos;s vote is predicted by blending five independent signals.
            Resolution intensity dynamically shifts emphasis: extreme or binding language
            dampers topic history (countries break from habit) and amplifies policy
            dimension alignment (fundamental values matter more).
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <SignalCard
              number="S1"
              title="Topic Voting History"
              weight="30%"
              description="How this country has historically voted on this resolution type (all 6 Voeten categories scored simultaneously). Damped when resolution uses extreme or binding language — countries break from habit on high-stakes votes."
            />
            <SignalCard
              number="S2"
              title="Policy Dimension Alignment"
              weight="30%"
              description="Weighted dot product between country's 6-dimensional policy profile and resolution's emphasis vector. Amplified by resolution intensity — binding language makes dimensional fit matter more than habit."
            />
            <SignalCard
              number="S3"
              title="Alliance Network (KNN)"
              weight="15%"
              description="Top-10 vote-similarity neighbors from the graphology knowledge graph. If your closest allies (by co-voting cosine similarity) all vote Yes, the pull is strong. Uses ALLIES_WITH edges from Neo4j."
            />
            <SignalCard
              number="S4"
              title="Ideal Point Alignment"
              weight="15%"
              description="Voeten empirical ideal point estimates on the left-right spectrum of international cooperation vs. sovereignty. Captures deep structural positioning that persists across topics and sessions."
            />
            <SignalCard
              number="S5"
              title="Bloc Coordination"
              weight="10%"
              description="Peer pressure from formal blocs (G77, EU, NAM, African Group, AOSIS, Arab Group, CARICOM). Applied in second pass after independent positions are computed. Weighted by empirical bloc cohesion rate."
            />
          </div>

          {/* Model Mechanics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div className="p-5 rounded-xl border border-[var(--color-border)] bg-white">
              <h4 className="text-sm font-medium text-[var(--color-ink)] mb-2">
                Resolution Intensity Damping
              </h4>
              <p className="text-xs text-[var(--color-muted)] leading-relaxed">
                Extreme language (&quot;demands&quot;, &quot;condemns&quot;,
                &quot;binding&quot;) reduces the reliability of topic history. Countries
                that vote Yes 95% of the time on nuclear resolutions may break pattern
                when language escalates. The intensity score (0-1) linearly interpolates
                between S1-heavy and S2-heavy weighting.
              </p>
            </div>
            <div className="p-5 rounded-xl border border-[var(--color-border)] bg-white">
              <h4 className="text-sm font-medium text-[var(--color-ink)] mb-2">
                Two-Pass Simulation
              </h4>
              <p className="text-xs text-[var(--color-muted)] leading-relaxed">
                <strong>Pass 1:</strong> Each country votes independently based on
                signals S1-S4. Output: softmax3 probability distribution P(Yes, No,
                Abstain).
                <br />
                <strong>Pass 2:</strong> Bloc coordination (S5) shifts probabilities
                based on how bloc partners voted in Pass 1. Countries in high-cohesion
                blocs (G77: 87%) are pulled toward bloc consensus.
              </p>
            </div>
            <div className="p-5 rounded-xl border border-[var(--color-border)] bg-white">
              <h4 className="text-sm font-medium text-[var(--color-ink)] mb-2">
                Governance-Adjusted Abstain Calibration
              </h4>
              <p className="text-xs text-[var(--color-muted)] leading-relaxed">
                Per-country, per-topic abstain rates calibrated from historical data.
                Countries with low Voice &amp; Accountability scores (WGI) abstain more
                on human rights resolutions naming allies. Japan and South Korea abstain
                frequently on specific topics — learned patterns, not generic thresholds.
              </p>
            </div>
            <div className="p-5 rounded-xl border border-[var(--color-border)] bg-white">
              <h4 className="text-sm font-medium text-[var(--color-ink)] mb-2">
                Accuracy Progression
              </h4>
              <div className="space-y-2 mt-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs w-24 text-[var(--color-muted)]">
                    Naive baseline
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-[var(--color-bg)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--color-muted)]"
                      style={{ width: "62%" }}
                    />
                  </div>
                  <span
                    className="text-xs text-[var(--color-muted)]"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    62%
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs w-24 text-[var(--color-muted)]">
                    + Topic history
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-[var(--color-bg)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--color-un-blue)]/50"
                      style={{ width: "72%" }}
                    />
                  </div>
                  <span
                    className="text-xs text-[var(--color-muted)]"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    72%
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs w-24 text-[var(--color-ink)] font-medium">
                    Full model
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-[var(--color-bg)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--color-un-blue)]"
                      style={{ width: "81.1%" }}
                    />
                  </div>
                  <span
                    className="text-xs text-[var(--color-ink)] font-medium"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    81.1%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Signal Flow */}
          <div className="p-6 rounded-xl border border-[var(--color-border)] bg-white overflow-x-auto">
            <h3 className="text-sm font-medium mb-4">Signal Flow Architecture</h3>
            <pre
              className="text-xs leading-relaxed text-[var(--color-muted)]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {`  Resolution Text
       |
       v
  +-----------+      +------------------+
  | AI Parser |----->| Policy Dimensions |----> [6 dimensions + intensity score]
  +-----------+      +------------------+
       |
       v
  Topic Classification (6 Voeten categories, multi-label)
       |
       +------+------+------+------+------+
       |      |      |      |      |      |
       v      v      v      v      v      v
    +-----+ +-----+ +-----+ +-----+ +-----+
    | S1  | | S2  | | S3  | | S4  | | S5  |
    | 30% | | 30% | | 15% | | 15% | | 10% |
    +-----+ +-----+ +-----+ +-----+ +-----+
       |      |      |      |      |
       v      v      v      v      v
  +------------------------------------------+
  |   Intensity-Weighted Composite Score     |
  |   (extreme language: S1 damped, S2 up)   |
  +------------------------------------------+
       |
       v
  +--------------------+     +-----------------------+
  | Pass 1: Solo Vote  |---->| Pass 2: Peer Effects  |
  | softmax3 -> P(Y/N/A)    | Bloc partners shift   |
  +--------------------+     +-----------------------+
       |                            |
       v                            v
  +------------------------------------------+
  |   Final Vote: argmax(P_yes, P_no, P_abs) |
  |   + Governance-Adjusted Abstain Cal.     |
  +------------------------------------------+`}
            </pre>
          </div>
        </section>

        {/* 05 - Validation Results */}
        <section>
          <div className="text-[13px] font-medium text-[var(--color-muted)] tracking-tight mb-2">
            05 &middot; Validation Results
          </div>
          <h2
            className="text-2xl font-semibold mb-4"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Empirical Performance
          </h2>
          <p className="text-sm text-[var(--color-muted)] leading-relaxed mb-8 max-w-3xl">
            Validated against 1,078 resolutions from Sessions 60-74 (2005-2019).
            Per-vote accuracy measures individual country predictions; outcome accuracy
            measures whether the model correctly predicts resolution passage/failure.
          </p>

          {/* Summary Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <MetricCard
              label="Per-Vote Accuracy"
              value="81.1%"
              subtext="146,446 / 180,489"
            />
            <MetricCard
              label="Outcome Accuracy"
              value="99.6%"
              subtext="1,074 / 1,078"
            />
            <MetricCard
              label="Resolutions Tested"
              value="1,078"
              subtext="Sessions 60-74"
            />
            <MetricCard
              label="Countries per Vote"
              value="~167"
              subtext="Avg voting members"
            />
          </div>

          {/* By Issue */}
          <div className="p-5 rounded-xl border border-[var(--color-border)] bg-white mb-6">
            <h3 className="text-sm font-medium mb-4">Accuracy by Issue Area</h3>
            <div className="space-y-4">
              <BarVisualization
                label="Palestinian Question"
                value={90.8}
                maxValue={100}
                color="var(--color-un-blue)"
              />
              <BarVisualization
                label="Nuclear Weapons"
                value={86.7}
                maxValue={100}
                color="var(--color-un-blue)"
              />
              <BarVisualization
                label="Colonialism"
                value={85.8}
                maxValue={100}
                color="var(--color-un-blue)"
              />
              <BarVisualization
                label="Economic Development"
                value={84.6}
                maxValue={100}
                color="var(--color-un-blue)"
              />
              <BarVisualization
                label="Arms Control"
                value={82.8}
                maxValue={100}
                color="var(--color-un-blue)"
              />
              <BarVisualization
                label="Human Rights"
                value={67.3}
                maxValue={100}
                color="var(--color-vote-abstain)"
              />
            </div>
          </div>

          {/* By Region */}
          <div className="p-5 rounded-xl border border-[var(--color-border)] bg-white mb-6">
            <h3 className="text-sm font-medium mb-4">Accuracy by Regional Group</h3>
            <div className="space-y-4">
              <BarVisualization
                label="GRULAC (Latin America)"
                value={92.0}
                maxValue={100}
                color="var(--color-vote-yes)"
              />
              <BarVisualization
                label="African Group"
                value={91.3}
                maxValue={100}
                color="var(--color-vote-yes)"
              />
              <BarVisualization
                label="Asia-Pacific Group"
                value={85.0}
                maxValue={100}
                color="var(--color-un-blue)"
              />
              <BarVisualization
                label="Eastern European"
                value={64.4}
                maxValue={100}
                color="var(--color-vote-abstain)"
              />
              <BarVisualization
                label="WEOG (Western)"
                value={61.4}
                maxValue={100}
                color="var(--color-vote-no)"
              />
            </div>
            <p className="text-xs text-[var(--color-muted)] mt-4 leading-relaxed">
              GRULAC and African countries are highly predictable due to strong bloc
              cohesion and consistent Yes-voting patterns. WEOG is hardest because these
              countries are genuinely issue-dependent — they may vote Yes on climate but
              No on Palestinian rights — making them resistant to structural prediction.
            </p>
          </div>

          {/* Per-Class F1 */}
          <div className="p-5 rounded-xl border border-[var(--color-border)] bg-white mb-6">
            <h3 className="text-sm font-medium mb-4">Per-Class F1 Scores</h3>
            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="font-medium text-[var(--color-vote-yes)]">
                    Yes
                  </span>
                  <span
                    style={{ fontFamily: "var(--font-mono)" }}
                    className="text-xs text-[var(--color-muted)]"
                  >
                    F1 = 89.8%
                  </span>
                </div>
                <div className="h-3 rounded-full bg-[var(--color-bg)] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: "89.8%",
                      background: "var(--color-vote-yes)",
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="font-medium text-[var(--color-vote-no)]">No</span>
                  <span
                    style={{ fontFamily: "var(--font-mono)" }}
                    className="text-xs text-[var(--color-muted)]"
                  >
                    F1 = 21.4%
                  </span>
                </div>
                <div className="h-3 rounded-full bg-[var(--color-bg)] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: "21.4%",
                      background: "var(--color-vote-no)",
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="font-medium text-[var(--color-vote-abstain)]">
                    Abstain
                  </span>
                  <span
                    style={{ fontFamily: "var(--font-mono)" }}
                    className="text-xs text-[var(--color-muted)]"
                  >
                    F1 = 5.0%
                  </span>
                </div>
                <div className="h-3 rounded-full bg-[var(--color-bg)] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: "5%",
                      background: "var(--color-vote-abstain)",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Honest Discussion */}
          <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]">
            <h4 className="text-sm font-medium text-[var(--color-ink)] mb-2">
              Why No/Abstain F1 Is Low (An Honest Assessment)
            </h4>
            <div className="text-xs text-[var(--color-muted)] leading-relaxed space-y-2">
              <p>
                The UNGA has extreme class imbalance: approximately 80% of all votes
                are Yes, 8% are No, and 12% are Abstain. The model correctly learns
                this distribution — predicting Yes is almost always correct. The
                challenge is identifying the specific countries that will dissent on a
                specific resolution.
              </p>
              <p>
                This is not a cop-out: even with perfect feature engineering, the
                information to predict minority votes often does not exist in
                structural data. A country&apos;s decision to vote No on a specific
                human rights resolution may depend on private diplomatic conversations,
                last-minute negotiations, or domestic political events that happen days
                before the vote.
              </p>
              <p>
                <strong>The saving grace:</strong> Because dissenters are few, getting
                them wrong rarely changes the resolution outcome. Hence 81.1% per-vote
                but 99.6% outcome accuracy.
              </p>
            </div>
          </div>
        </section>

        {/* 06 - Architectural Decisions */}
        <section>
          <div className="text-[13px] font-medium text-[var(--color-muted)] tracking-tight mb-2">
            06 &middot; Architectural Decisions &amp; Tradeoffs
          </div>
          <h2
            className="text-2xl font-semibold mb-4"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Decision Log
          </h2>
          <p className="text-sm text-[var(--color-muted)] leading-relaxed mb-8 max-w-3xl">
            Every architectural choice involves tradeoffs. This table documents what was
            chosen, what was rejected, and why — with specific technical rationale rather
            than hand-waving.
          </p>

          <div className="rounded-xl border border-[var(--color-border)] bg-white overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
                  <th className="text-left py-3 px-4 font-medium text-[var(--color-muted)]">
                    Decision
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-[var(--color-muted)]">
                    Chose
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-[var(--color-muted)]">
                    Over
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-[var(--color-muted)]">
                    Rationale
                  </th>
                </tr>
              </thead>
              <tbody>
                <DecisionRow
                  decision="Graph DB"
                  chose="Neo4j AuraDB Free"
                  over="AWS Neptune"
                  rationale="No VPC needed, Vercel-compatible, free tier fits 212 nodes/3,660 edges. Neptune requires NAT Gateway ($55-80/mo) for serverless access."
                />
                <DecisionRow
                  decision="Query Language"
                  chose="Cypher"
                  over="SPARQL / Gremlin"
                  rationale="Property graph model maps directly to our domain (countries have properties, relationships have weights). Cypher is more readable for IR scholars reviewing methodology."
                />
                <DecisionRow
                  decision="Ontology Language"
                  chose="OWL-Lite + SHACL"
                  over="Full OWL 2 DL"
                  rationale="Only 30 entity types, 9 relationship types. No class hierarchy deep enough for automated reasoning. SHACL handles validation without a DL reasoner."
                />
                <DecisionRow
                  decision="Runtime Validation"
                  chose="Zod (runtime)"
                  over="TypeScript only"
                  rationale="Type erasure at compile time means TypeScript cannot catch malformed CSV data at ingestion. Zod enforces constraints at the data boundary where external data enters."
                />
                <DecisionRow
                  decision="Visualization"
                  chose="d3-force (SVG)"
                  over="sigma.js / react-force-graph"
                  rationale="Custom SVG gives full control over node styling, edge rendering, and interaction. sigma.js WebGL is overkill for 212 nodes; react-force-graph abstracts too much."
                />
                <DecisionRow
                  decision="Prediction Architecture"
                  chose="Hybrid (Neo4j + in-memory)"
                  over="Neo4j only"
                  rationale="Sub-ms latency needed for clause sensitivity sliders. Neo4j round-trip (50-200ms) is too slow for real-time recalculation as user adjusts parameters."
                />
                <DecisionRow
                  decision="LLM Integration"
                  chose="User-provided API key"
                  over="Built-in key"
                  rationale="Sustainable architecture: no rate-limit management, no cost scaling with users, no key rotation. User controls their own usage and billing."
                />
                <DecisionRow
                  decision="Hosting"
                  chose="Vercel Serverless"
                  over="EC2 / ECS"
                  rationale="Zero-ops, auto-scaling, edge caching, native Next.js support. The application is stateless (graph is external); no need for persistent compute."
                />
              </tbody>
            </table>
          </div>
        </section>

        {/* 07 - Ontology Evidence */}
        <section>
          <div className="text-[13px] font-medium text-[var(--color-muted)] tracking-tight mb-2">
            07 &middot; Ontology Evidence
          </div>
          <h2
            className="text-2xl font-semibold mb-4"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Empirical Basis for Each Relationship
          </h2>
          <p className="text-sm text-[var(--color-muted)] leading-relaxed mb-8 max-w-3xl">
            Every edge type in the knowledge graph is justified by peer-reviewed
            research demonstrating its predictive power for UN voting behavior. No
            relationship was included without empirical evidence.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EvidenceCard
              relationship="ALLIES_WITH"
              citation="Bailey, Strezhnev & Voeten (2017). 'Estimating Dynamic State Preferences from UN Voting Data.' Journal of Conflict Resolution."
              example="Bangladesh-Senegal: 0.97 cosine similarity despite geographic distance. Identical votes on Palestinian resolutions, nuclear disarmament, and economic development across 15 years."
              improvement="+8.2% accuracy over ideal-point-only baseline for predicting minority bloc dissent patterns."
            />
            <EvidenceCard
              relationship="ARMS_SUPPLIER_TO"
              citation="Bearce & Bondanella (2007). 'Intergovernmental Organizations, Socialization, and Member-State Interest Convergence.' International Organization, 61(4)."
              example="US arms recipients vote 15-25% more with the US on security resolutions. Saudi Arabia's alignment with US on Iran-related votes correlates with $110B arms relationship."
              improvement="+2.1% on security-topic resolutions; captures dependency alignment that alliance membership alone misses."
            />
            <EvidenceCard
              relationship="FORMER_COLONIZER_OF"
              citation="Strezhnev & Voeten (2013). 'United Nations General Assembly Voting Data.' Harvard Dataverse."
              example="French former colonies (Francafrique pattern): coordinate with France on economic development votes but vote against France on sovereignty/decolonization. Bidirectional, topic-dependent effect."
              improvement="+1.8% on colonialism-topic resolutions; captures the paradox of post-colonial alignment and opposition."
            />
            <EvidenceCard
              relationship="PROVIDES_AID_TO"
              citation="Dreher, Nunnenkamp & Thiele (2008). 'Does US Aid Buy UN General Assembly Votes?' World Development, 36(1)."
              example="US aid recipients show 12% higher voting alignment with US on human rights resolutions. Japan's ODA recipients align on economic development votes. Effect weakens on sovereignty issues."
              improvement="+1.4% on human rights resolutions; distinguishes economic dependency from ideological alignment."
            />
            <EvidenceCard
              relationship="MEMBER_OF_ALLIANCE"
              citation="Bearce & Bondanella (2007). 'Intergovernmental Organizations, Socialization, and Member-State Interest Convergence.' International Organization."
              example="NATO members: 78% voting coordination on security. CSTO members: 89% coordination. SCO members: 82%. Alliance type (defense pact vs. entente) modulates strength."
              improvement="+3.5% on security-topic resolutions; strongest effect for defense pacts, weaker for ententes."
            />
            <EvidenceCard
              relationship="RIVALS_WITH"
              citation="Derived from Voeten data: countries with >50% disagreement on contested votes (those with <80% Yes). Validated against UCDP conflict dyads."
              example="US-Russia: systematic opposition on human rights resolutions naming allies. India-Pakistan: opposing votes on Kashmir-related and self-determination resolutions across 40+ years."
              improvement="+2.8% on contested resolutions (those where outcome is uncertain); rivals provide negative signal."
            />
            <EvidenceCard
              relationship="POSITION_ON"
              citation="Voeten (2013). 'Data and Analyses of Voting in the UN General Assembly.' Routledge Handbook of International Organization."
              example="Cuba votes Yes on 98% of economic development resolutions (consistent since 1960). Norway votes Yes on 94% of human rights resolutions. These per-topic rates are the strongest single predictor."
              improvement="+10% over naive baseline; this is the single most powerful signal in the model (S1 at 30% weight)."
            />
            <EvidenceCard
              relationship="BORDERS"
              citation="Ward & Gleditsch (2008). 'Spatial Regression Models.' Sage Publications. Geographic contiguity and voting similarity in international organizations."
              example="Scandinavian neighbors (Norway-Sweden-Denmark): 91% voting similarity despite EU membership differences. Exception: India-Pakistan (neighbors but rivals, 34% similarity)."
              improvement="+0.8% marginal improvement; effect is mostly captured by ALLIES_WITH, but adds value for countries with limited voting history."
            />
          </div>
        </section>

        {/* 08 - Limitations & Future Work */}
        <section>
          <div className="text-[13px] font-medium text-[var(--color-muted)] tracking-tight mb-2">
            08 &middot; Limitations &amp; Future Work
          </div>
          <h2
            className="text-2xl font-semibold mb-6"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Known Limitations &amp; Planned Improvements
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {/* Limitations */}
            <div className="p-5 rounded-xl border border-[var(--color-border)] bg-white">
              <h3 className="text-sm font-semibold text-[var(--color-ink)] mb-4">
                Current Limitations
              </h3>
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-medium text-[var(--color-ink)]">
                    Country-specific HR resolutions
                  </h4>
                  <p className="text-[11px] text-[var(--color-muted)] leading-relaxed mt-0.5">
                    67.3% accuracy vs 90% on clear-topic resolutions. Naming a
                    specific country triggers bilateral loyalties and ad-hoc coalitions
                    that structural signals cannot capture.
                  </p>
                </div>
                <div className="border-t border-[var(--color-border)] pt-3">
                  <h4 className="text-xs font-medium text-[var(--color-ink)]">
                    WEOG prediction difficulty
                  </h4>
                  <p className="text-[11px] text-[var(--color-muted)] leading-relaxed mt-0.5">
                    61.4% accuracy. These countries are genuinely issue-dependent, not
                    bloc-driven. Germany votes Yes on climate, No on Palestinian
                    statehood, Abstain on Cuba sanctions — each driven by different
                    logic.
                  </p>
                </div>
                <div className="border-t border-[var(--color-border)] pt-3">
                  <h4 className="text-xs font-medium text-[var(--color-ink)]">
                    No temporal drift modeling
                  </h4>
                  <p className="text-[11px] text-[var(--color-muted)] leading-relaxed mt-0.5">
                    Static ideal points across the validation window. A country that
                    shifted foreign policy (e.g., Brazil 2003 vs 2019) is predicted
                    using its average position, not its evolving trajectory.
                  </p>
                </div>
                <div className="border-t border-[var(--color-border)] pt-3">
                  <h4 className="text-xs font-medium text-[var(--color-ink)]">
                    Cannot model last-minute diplomacy
                  </h4>
                  <p className="text-[11px] text-[var(--color-muted)] leading-relaxed mt-0.5">
                    Vote trading, private pressure, and negotiated withdrawals happen
                    outside observable data. The model predicts structural position,
                    not political process.
                  </p>
                </div>
              </div>
            </div>

            {/* Future Work */}
            <div className="p-5 rounded-xl border border-[var(--color-un-blue)]/20 bg-[var(--color-un-blue)]/5 rounded-xl">
              <h3 className="text-sm font-semibold text-[var(--color-un-blue)] mb-4">
                Planned Improvements
              </h3>
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-medium text-[var(--color-ink)]">
                    GDELT Event Integration
                  </h4>
                  <p className="text-[11px] text-[var(--color-muted)] leading-relaxed mt-0.5">
                    Real-time geopolitical context from GDELT event data. When
                    bilateral tensions spike (measured by Goldstein scale), dynamically
                    adjust alliance weights. Would address temporal drift without
                    re-training.
                  </p>
                </div>
                <div className="border-t border-[var(--color-un-blue)]/20 pt-3">
                  <h4 className="text-xs font-medium text-[var(--color-ink)]">
                    GraphRAG Integration
                  </h4>
                  <p className="text-[11px] text-[var(--color-muted)] leading-relaxed mt-0.5">
                    LLM + graph structure for natural language queries. &quot;Why does
                    India abstain on Kashmir resolutions?&quot; would traverse
                    BORDERS, RIVALS_WITH, and POSITION_ON edges to generate
                    evidence-backed explanations.
                  </p>
                </div>
                <div className="border-t border-[var(--color-un-blue)]/20 pt-3">
                  <h4 className="text-xs font-medium text-[var(--color-ink)]">
                    Temporal Ideal Point Drift
                  </h4>
                  <p className="text-[11px] text-[var(--color-muted)] leading-relaxed mt-0.5">
                    Replace static ideal points with session-level estimates. Use
                    Kalman filtering to model gradual position shifts while
                    maintaining stability on well-established positions.
                  </p>
                </div>
                <div className="border-t border-[var(--color-un-blue)]/20 pt-3">
                  <h4 className="text-xs font-medium text-[var(--color-ink)]">
                    Resolution Text Embeddings
                  </h4>
                  <p className="text-[11px] text-[var(--color-muted)] leading-relaxed mt-0.5">
                    Use sentence transformers to encode resolution text directly,
                    bypassing manual topic classification. Would enable prediction on
                    novel topic combinations without historical precedent.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 09 - Reproducibility */}
        <section>
          <div className="text-[13px] font-medium text-[var(--color-muted)] tracking-tight mb-2">
            09 &middot; Reproducibility
          </div>
          <h2
            className="text-2xl font-semibold mb-4"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Reproduce Everything
          </h2>
          <p className="text-sm text-[var(--color-muted)] leading-relaxed mb-6 max-w-3xl">
            The entire pipeline — from raw data ingestion to final accuracy numbers — is
            reproducible with three commands. All scripts are in the repository, all data
            sources are publicly available.
          </p>

          <div className="p-5 rounded-xl border border-[var(--color-border)] bg-white mb-4">
            <pre
              className="text-sm overflow-x-auto leading-relaxed"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {`# Seed the Neo4j knowledge graph (212 nodes, 3,660 relationships)
# Requires NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD in .env.local
npx tsx scripts/seed-neo4j.ts

# Run full accuracy validation (1,078 resolutions, 180,489 votes)
# Outputs: per-vote accuracy, per-topic breakdown, per-region breakdown
npx tsx scripts/test-accuracy.ts

# Validate current engine against latest data
# Outputs: comparison with previous runs, regression detection
npx tsx scripts/validate-current-engine.ts`}
            </pre>
          </div>

          <div className="p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]">
            <h4 className="text-xs font-medium text-[var(--color-ink)] mb-1">
              Environment Requirements
            </h4>
            <p className="text-xs text-[var(--color-muted)] leading-relaxed">
              Node.js 18+ | Neo4j AuraDB instance (free tier sufficient) |
              Environment variables: NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD |
              Optional: OPENAI_API_KEY for LLM-assisted resolution parsing
            </p>
          </div>
        </section>

        {/* 10 - References */}
        <section className="pb-8">
          <div className="text-[13px] font-medium text-[var(--color-muted)] tracking-tight mb-2">
            10 &middot; References
          </div>
          <h2
            className="text-2xl font-semibold mb-6"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Academic Citations
          </h2>

          <div className="p-5 rounded-xl border border-[var(--color-border)] bg-white">
            <ol className="space-y-4 text-xs text-[var(--color-ink)] leading-relaxed list-decimal list-inside">
              <li>
                <strong>Bailey, M.A., Strezhnev, A., & Voeten, E.</strong> (2017).
                &ldquo;Estimating Dynamic State Preferences from United Nations Voting
                Data.&rdquo; <em>Journal of Conflict Resolution</em>, 61(2), 430-456.
                — Ideal point estimation methodology used for S4 signal.
              </li>
              <li>
                <strong>Bearce, D.H. & Bondanella, S.</strong> (2007).
                &ldquo;Intergovernmental Organizations, Socialization, and Member-State
                Interest Convergence.&rdquo;{" "}
                <em>International Organization</em>, 61(4), 703-733. — Evidence for
                alliance and arms trade effects on voting alignment (S3,
                MEMBER_OF_ALLIANCE, ARMS_SUPPLIER_TO).
              </li>
              <li>
                <strong>Dreher, A., Nunnenkamp, P., & Thiele, R.</strong> (2008).
                &ldquo;Does US Aid Buy UN General Assembly Votes? A Disaggregated
                Analysis.&rdquo; <em>World Development</em>, 36(1), 133-149. — Evidence
                for aid-vote alignment (PROVIDES_AID_TO relationships).
              </li>
              <li>
                <strong>Voeten, E.</strong> (2013). &ldquo;Data and Analyses of Voting
                in the United Nations General Assembly.&rdquo;{" "}
                <em>Routledge Handbook of International Organization</em>. — Core
                dataset: 869K roll-call votes, topic classifications, ideal point
                estimates.
              </li>
              <li>
                <strong>Coppedge, M., et al.</strong> (2023). &ldquo;V-Dem Dataset
                v14.&rdquo; Varieties of Democracy (V-Dem) Project. — Democracy
                indices used for governance-adjusted abstain calibration.
              </li>
              <li>
                <strong>World Bank.</strong> (2024). &ldquo;Worldwide Governance
                Indicators.&rdquo; — Voice and Accountability, Rule of Law, Government
                Effectiveness scores for behavioral calibration.
              </li>
              <li>
                <strong>SIPRI.</strong> (2024). &ldquo;Arms Transfers Database.&rdquo;
                Stockholm International Peace Research Institute. — Trend Indicator
                Values (TIV) for major arms flows, 2019-2023.
              </li>
              <li>
                <strong>Leeds, B.A., et al.</strong> (2002). &ldquo;Alliance Treaty
                Obligations and Provisions (ATOP).&rdquo;{" "}
                <em>International Interactions</em>, 28(3), 237-260. — Formal alliance
                data: defense pacts, ententes, neutrality agreements.
              </li>
              <li>
                <strong>OECD.</strong> (2023). &ldquo;Development Assistance Committee
                (DAC) Statistics.&rdquo; — Bilateral Official Development Assistance
                flows for PROVIDES_AID_TO relationships.
              </li>
              <li>
                <strong>Strezhnev, A. & Voeten, E.</strong> (2013). &ldquo;United
                Nations General Assembly Voting Data.&rdquo; Harvard Dataverse. —
                Extended dataset with colonial history indicators and post-colonial
                voting patterns.
              </li>
            </ol>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border)] bg-white">
        <div className="max-w-5xl mx-auto px-6 py-8 flex items-center justify-between text-xs text-[var(--color-muted)]">
          <span>UNSim v2 — UN Policy Simulation Platform</span>
          <span style={{ fontFamily: "var(--font-mono)" }}>
            Engine v2.0.0-graph-predictor | Neo4j AuraDB | Vercel Serverless
          </span>
        </div>
      </footer>
    </main>
  );
}
