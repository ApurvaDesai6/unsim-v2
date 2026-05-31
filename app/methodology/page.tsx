import Link from "next/link";

function MetricCard({ label, value, subtext }: { label: string; value: string; subtext?: string }) {
  return (
    <div className="p-5 rounded-xl border border-[var(--color-border)] bg-white">
      <div className="text-xs font-medium text-[var(--color-muted)] mb-1">{label}</div>
      <div className="text-2xl font-semibold" style={{ fontFamily: "var(--font-mono)" }}>
        {value}
      </div>
      {subtext && <div className="text-xs text-[var(--color-muted)] mt-1">{subtext}</div>}
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
        {value.toFixed(1)}{suffix}
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
        <span className="text-xs font-semibold text-[var(--color-un-blue)]">{number}</span>
        <span
          className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-un-blue)]/10 text-[var(--color-un-blue)] font-medium"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {weight}
        </span>
      </div>
      <h4 className="text-sm font-medium text-[var(--color-ink)] mb-1">{title}</h4>
      <p className="text-xs text-[var(--color-muted)] leading-relaxed">{description}</p>
    </div>
  );
}

export default function MethodologyPage() {
  return (
    <main className="min-h-screen bg-[var(--color-bg)]">
      {/* Header */}
      <header className="bg-white border-b border-[var(--color-border)]">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]">
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

      <div className="max-w-4xl mx-auto px-6 py-16 space-y-24">
        {/* Title */}
        <section>
          <h1
            className="text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05] mb-4"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Methodology &amp; Validation
          </h1>
          <p className="text-lg text-[var(--color-muted)] leading-relaxed max-w-2xl">
            UNSim v2 uses a graph-based prediction engine validated against{" "}
            <strong className="text-[var(--color-ink)]">180,489</strong> real recorded votes
            across 15 years of General Assembly sessions. This page documents exactly how
            predictions are made, how well they work, and where they fall short.
          </p>
        </section>

        {/* 01 - Hero Metrics */}
        <section>
          <div className="text-[13px] font-medium text-[var(--color-muted)] tracking-tight mb-2">
            01 &middot; Performance at a glance
          </div>
          <h2 className="text-2xl font-semibold mb-8" style={{ fontFamily: "var(--font-serif)" }}>
            Validation Results
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              label="Per-Vote Accuracy"
              value="81.1%"
              subtext="146,446 / 180,489 correct"
            />
            <MetricCard
              label="Resolution Outcome"
              value="99.6%"
              subtext="1,074 / 1,078 pass/fail correct"
            />
            <MetricCard
              label="Resolutions Tested"
              value="1,078"
              subtext="Sessions 60-74 (2005-2019)"
            />
            <MetricCard
              label="Votes Analyzed"
              value="869K"
              subtext="Voeten/Harvard Dataverse"
            />
          </div>
        </section>

        {/* 02 - How Predictions Work */}
        <section>
          <div className="text-[13px] font-medium text-[var(--color-muted)] tracking-tight mb-2">
            02 &middot; How predictions work
          </div>
          <h2 className="text-2xl font-semibold mb-4" style={{ fontFamily: "var(--font-serif)" }}>
            Five Signals, One Prediction
          </h2>
          <p className="text-sm text-[var(--color-muted)] leading-relaxed mb-8 max-w-2xl">
            Each country's vote is predicted by blending five independent signals. The weights
            are not fixed — resolution intensity dynamically shifts emphasis between topic history
            and policy dimension alignment.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <SignalCard
              number="S1"
              title="Topic Voting History"
              weight="30%"
              description="How this country has historically voted on this type of resolution (all 6 Voeten issue categories scored simultaneously). Damped when resolution uses extreme or binding language."
            />
            <SignalCard
              number="S2"
              title="Policy Dimension Alignment"
              weight="30%"
              description="Weighted dot product between the country's 6-dimensional policy profile and the resolution's emphasis. Amplified by resolution intensity — binding language makes dimensional fit matter more."
            />
            <SignalCard
              number="S3"
              title="Alliance Network (KNN)"
              weight="15%"
              description="Top-10 vote-similarity neighbors from the graphology knowledge graph (303K vote edges). If your closest allies all vote Yes, the pull is strong."
            />
            <SignalCard
              number="S4"
              title="Ideal Point Alignment"
              weight="15%"
              description="Voeten empirical ideal point estimates on the left-right spectrum of international cooperation vs. sovereignty. Captures deep structural positioning."
            />
            <SignalCard
              number="S5"
              title="Bloc Coordination"
              weight="10%"
              description="Peer pressure from formal blocs (G77, EU, NAM, African Group, AOSIS, Arab Group, CARICOM). Applied in a second pass after independent positions are computed."
            />
          </div>

          {/* Architecture Diagram */}
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
  |   + Empirical Abstain Calibration        |
  +------------------------------------------+`}
            </pre>
          </div>
        </section>

        {/* 03 - Key Innovations */}
        <section>
          <div className="text-[13px] font-medium text-[var(--color-muted)] tracking-tight mb-2">
            03 &middot; Key innovations
          </div>
          <h2 className="text-2xl font-semibold mb-6" style={{ fontFamily: "var(--font-serif)" }}>
            What Makes v2.0 Different
          </h2>

          <div className="space-y-4">
            {[
              {
                title: "Resolution Intensity Damping",
                desc: "Extreme or binding language in a resolution reduces the weight of topic history (countries break from habit on high-stakes votes) and increases the weight of policy dimension alignment (fundamental values matter more).",
              },
              {
                title: "Multi-Topic Blended Scoring",
                desc: "All 6 Voeten issue categories are scored simultaneously rather than picking a single category. A resolution on nuclear testing in the Pacific blends Nuclear Weapons, Colonialism, and Environment signals.",
              },
              {
                title: "Graphology Knowledge Graph",
                desc: "303,000 vote edges form a KNN alliance network. Instead of relying on declared alliances alone, the system learns who actually votes together from 75 years of data.",
              },
              {
                title: "Two-Pass Simulation",
                desc: "First pass computes each country's independent position. Second pass applies peer effects from bloc partners, weighted by empirical bloc cohesion. This captures how countries coordinate without assuming lockstep behavior.",
              },
              {
                title: "Empirical Abstain Calibration",
                desc: "Per-country, per-topic abstain rates from historical data. Some countries (Japan, South Korea) abstain frequently on specific topics; the model learns these patterns rather than using a generic threshold.",
              },
            ].map((item, i) => (
              <div key={i} className="p-5 rounded-xl border border-[var(--color-border)] bg-white">
                <h3 className="text-sm font-medium text-[var(--color-ink)] mb-1">{item.title}</h3>
                <p className="text-sm text-[var(--color-muted)] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 04 - Accuracy by Issue */}
        <section>
          <div className="text-[13px] font-medium text-[var(--color-muted)] tracking-tight mb-2">
            04 &middot; Breakdown by topic
          </div>
          <h2 className="text-2xl font-semibold mb-6" style={{ fontFamily: "var(--font-serif)" }}>
            Accuracy by Issue Area
          </h2>
          <div className="p-5 rounded-xl border border-[var(--color-border)] bg-white space-y-4">
            <BarVisualization label="Palestinian Question" value={90.8} maxValue={100} color="var(--color-un-blue)" />
            <BarVisualization label="Nuclear Weapons" value={86.7} maxValue={100} color="var(--color-un-blue)" />
            <BarVisualization label="Colonialism" value={85.8} maxValue={100} color="var(--color-un-blue)" />
            <BarVisualization label="Economic Development" value={84.6} maxValue={100} color="var(--color-un-blue)" />
            <BarVisualization label="Arms Control" value={82.8} maxValue={100} color="var(--color-un-blue)" />
            <BarVisualization label="Human Rights" value={67.3} maxValue={100} color="var(--color-vote-abstain)" />
          </div>
          <p className="text-xs text-[var(--color-muted)] mt-3 leading-relaxed max-w-2xl">
            Human rights resolutions are hardest to predict because they often name specific
            countries, triggering cross-cutting loyalties. A country may support human rights
            in principle but vote No when an ally is named.
          </p>
        </section>

        {/* 05 - Regional Performance */}
        <section>
          <div className="text-[13px] font-medium text-[var(--color-muted)] tracking-tight mb-2">
            05 &middot; Regional performance
          </div>
          <h2 className="text-2xl font-semibold mb-6" style={{ fontFamily: "var(--font-serif)" }}>
            Accuracy by Regional Group
          </h2>
          <div className="p-5 rounded-xl border border-[var(--color-border)] bg-white space-y-4">
            <BarVisualization label="GRULAC (Latin America)" value={92.0} maxValue={100} color="var(--color-vote-yes)" />
            <BarVisualization label="African Group" value={91.3} maxValue={100} color="var(--color-vote-yes)" />
            <BarVisualization label="Asia-Pacific Group" value={85.0} maxValue={100} color="var(--color-un-blue)" />
            <BarVisualization label="Eastern European" value={64.4} maxValue={100} color="var(--color-vote-abstain)" />
            <BarVisualization label="WEOG (Western)" value={61.4} maxValue={100} color="var(--color-vote-no)" />
          </div>
          <p className="text-xs text-[var(--color-muted)] mt-3 leading-relaxed max-w-2xl">
            GRULAC and African countries are predicted with high accuracy because they
            vote Yes on most General Assembly resolutions with strong bloc cohesion. WEOG
            accuracy is lower because Western countries exhibit more issue-dependent variation —
            they may vote Yes on climate but No on Palestinian rights, making them harder to
            predict from aggregate signals alone.
          </p>
        </section>

        {/* 06 - Per-Class Performance */}
        <section>
          <div className="text-[13px] font-medium text-[var(--color-muted)] tracking-tight mb-2">
            06 &middot; Per-class F1 scores
          </div>
          <h2 className="text-2xl font-semibold mb-6" style={{ fontFamily: "var(--font-serif)" }}>
            Performance by Vote Type
          </h2>
          <div className="p-5 rounded-xl border border-[var(--color-border)] bg-white">
            <div className="space-y-5">
              {/* Yes */}
              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="font-medium text-[var(--color-vote-yes)]">Yes</span>
                  <span style={{ fontFamily: "var(--font-mono)" }} className="text-xs text-[var(--color-muted)]">
                    F1 = 89.8%
                  </span>
                </div>
                <div className="h-3 rounded-full bg-[var(--color-bg)] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: "89.8%", background: "var(--color-vote-yes)" }} />
                </div>
              </div>
              {/* No */}
              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="font-medium text-[var(--color-vote-no)]">No</span>
                  <span style={{ fontFamily: "var(--font-mono)" }} className="text-xs text-[var(--color-muted)]">
                    F1 = 21.4%
                  </span>
                </div>
                <div className="h-3 rounded-full bg-[var(--color-bg)] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: "21.4%", background: "var(--color-vote-no)" }} />
                </div>
              </div>
              {/* Abstain */}
              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="font-medium text-[var(--color-vote-abstain)]">Abstain</span>
                  <span style={{ fontFamily: "var(--font-mono)" }} className="text-xs text-[var(--color-muted)]">
                    F1 = 5.0%
                  </span>
                </div>
                <div className="h-3 rounded-full bg-[var(--color-bg)] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: "5%", background: "var(--color-vote-abstain)" }} />
                </div>
              </div>
            </div>
          </div>
          <p className="text-xs text-[var(--color-muted)] mt-3 leading-relaxed max-w-2xl">
            The low No and Abstain F1 scores reflect the extreme class imbalance in UNGA
            voting: most resolutions pass with large majorities. The model correctly identifies
            that ~80% of all votes are Yes. Predicting the minority of dissenting votes remains
            the key challenge — but because dissenters are few, the overall outcome
            (pass/fail) is still predicted at 99.6% accuracy.
          </p>
        </section>

        {/* 07 - Limitations */}
        <section>
          <div className="text-[13px] font-medium text-[var(--color-muted)] tracking-tight mb-2">
            07 &middot; Honest limitations
          </div>
          <h2 className="text-2xl font-semibold mb-6" style={{ fontFamily: "var(--font-serif)" }}>
            Known Limitations
          </h2>

          <div className="p-5 rounded-xl border border-[var(--color-border)] bg-white">
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-medium text-[var(--color-ink)] mb-1">
                  Country-specific human rights resolutions
                </h3>
                <p className="text-sm text-[var(--color-muted)] leading-relaxed">
                  Resolutions that name a specific state (e.g., "Human rights situation in X")
                  have higher prediction error. These votes are driven by bilateral relationships
                  and ad-hoc coalitions that general signals cannot fully capture.
                </p>
              </div>
              <div className="border-t border-[var(--color-border)] pt-5">
                <h3 className="text-sm font-medium text-[var(--color-ink)] mb-1">
                  WEOG accuracy gap
                </h3>
                <p className="text-sm text-[var(--color-muted)] leading-relaxed">
                  Western European and Others Group countries show more issue-dependent variation
                  than other regional groups. They may strongly support a climate resolution but
                  oppose a sovereignty-related one. This within-group heterogeneity makes them
                  harder to predict from structural signals.
                </p>
              </div>
              <div className="border-t border-[var(--color-border)] pt-5">
                <h3 className="text-sm font-medium text-[var(--color-ink)] mb-1">
                  Static ideal points
                </h3>
                <p className="text-sm text-[var(--color-muted)] leading-relaxed">
                  The current model uses time-averaged ideal point estimates across the validation
                  window (2005-2019). It does not model temporal drift — a country that shifted
                  its foreign policy midway through this period will be predicted using its
                  average position, not its evolving one.
                </p>
              </div>
              <div className="border-t border-[var(--color-border)] pt-5">
                <h3 className="text-sm font-medium text-[var(--color-ink)] mb-1">
                  No/Abstain recall is low
                </h3>
                <p className="text-sm text-[var(--color-muted)] leading-relaxed">
                  The model is good at identifying that most UNGA resolutions pass overwhelmingly,
                  but struggles to precisely identify which countries will dissent. This is partly
                  a fundamental class imbalance problem — No votes are ~8% of the dataset, Abstain ~12%.
                  The outcome accuracy (99.6%) is not diminished because dissenters rarely change
                  the resolution result.
                </p>
              </div>
              <div className="border-t border-[var(--color-border)] pt-5">
                <h3 className="text-sm font-medium text-[var(--color-ink)] mb-1">
                  Cannot model last-minute diplomacy
                </h3>
                <p className="text-sm text-[var(--color-muted)] leading-relaxed">
                  Vote trading, diplomatic pressure, and negotiated withdrawals happen outside
                  the data. The model predicts based on structural position, not the political
                  process that unfolds in the days before a vote.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 08 - Data Sources */}
        <section className="pb-8">
          <div className="text-[13px] font-medium text-[var(--color-muted)] tracking-tight mb-2">
            08 &middot; Data provenance
          </div>
          <h2 className="text-2xl font-semibold mb-6" style={{ fontFamily: "var(--font-serif)" }}>
            Data Sources
          </h2>

          <div className="p-5 rounded-xl border border-[var(--color-border)] bg-white">
            <dl className="space-y-5">
              <div>
                <dt className="text-sm font-medium text-[var(--color-ink)]">
                  Erik Voeten, &ldquo;United Nations General Assembly Voting Data&rdquo;
                </dt>
                <dd className="text-sm text-[var(--color-muted)] mt-0.5">
                  Harvard Dataverse, doi:10.7910/DVN/LEJUQZ. Roll-call votes and ideal point
                  estimates for all member states, 1946-2019. Provides the core 869K vote records
                  used for training and validation.
                </dd>
                <a
                  href="https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/LEJUQZ"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[var(--color-un-blue)] hover:underline mt-1 inline-block"
                >
                  dataverse.harvard.edu &rarr;
                </a>
              </div>
              <div className="border-t border-[var(--color-border)] pt-5">
                <dt className="text-sm font-medium text-[var(--color-ink)]">
                  V-Dem (Varieties of Democracy) v14
                </dt>
                <dd className="text-sm text-[var(--color-muted)] mt-0.5">
                  Democracy indices for 202 countries. Used for polyarchy scores, regime
                  classification, and behavioral calibration of country profiles.
                </dd>
                <a
                  href="https://v-dem.net/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[var(--color-un-blue)] hover:underline mt-1 inline-block"
                >
                  v-dem.net &rarr;
                </a>
              </div>
              <div className="border-t border-[var(--color-border)] pt-5">
                <dt className="text-sm font-medium text-[var(--color-ink)]">
                  Vote Similarity Matrix
                </dt>
                <dd className="text-sm text-[var(--color-muted)] mt-0.5">
                  Pairwise cosine similarity computed from co-voting patterns. Forms the basis
                  of the KNN alliance network (303K edges). Countries that vote together on
                  80%+ of resolutions are strong neighbors.
                </dd>
              </div>
              <div className="border-t border-[var(--color-border)] pt-5">
                <dt className="text-sm font-medium text-[var(--color-ink)]">
                  Bloc Membership Data
                </dt>
                <dd className="text-sm text-[var(--color-muted)] mt-0.5">
                  G77, Non-Aligned Movement (NAM), European Union, African Group, Alliance of
                  Small Island States (AOSIS), Arab Group, and CARICOM. Compiled from official
                  UN and organizational records.
                </dd>
              </div>
              <div className="border-t border-[var(--color-border)] pt-5">
                <dt className="text-sm font-medium text-[var(--color-ink)]">
                  Influence Network
                </dt>
                <dd className="text-sm text-[var(--color-muted)] mt-0.5">
                  Security organization membership, trade dependency ratios, and aid flow
                  data used to weight peer influence in the two-pass simulation.
                </dd>
              </div>
            </dl>
          </div>
        </section>

        {/* 09 - Reproducibility */}
        <section className="pb-8">
          <div className="text-[13px] font-medium text-[var(--color-muted)] tracking-tight mb-2">
            09 &middot; Reproducibility
          </div>
          <h2 className="text-2xl font-semibold mb-6" style={{ fontFamily: "var(--font-serif)" }}>
            Run It Yourself
          </h2>
          <div className="p-5 rounded-xl border border-[var(--color-border)] bg-white">
            <pre className="text-sm overflow-x-auto" style={{ fontFamily: "var(--font-mono)" }}>
{`# Clone the repo
git clone https://github.com/[your-repo]/unsim-v2
cd unsim-v2

# Install dependencies
npm install

# Download Voeten/Harvard Dataverse voting data (869K votes)
npx tsx scripts/download-voeten-data.ts

# Build country profiles & knowledge graph (193 nations, 303K edges)
npx tsx scripts/build-country-profiles.ts
npx tsx scripts/build-knowledge-graph.ts

# Run full validation (1,078 resolutions, 180K+ predictions)
npx tsx scripts/validate-large-scale.ts

# Output: data/validation-report-large.json`}
            </pre>
          </div>
        </section>
      </div>

      {/* Knowledge Graph Architecture */}
      <section className="border-t border-[var(--color-border)] bg-white">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <div className="text-[13px] font-medium text-[var(--color-muted)] tracking-tight mb-2">
            10 &middot; Knowledge Graph Architecture
          </div>
          <h2 className="text-3xl font-semibold tracking-tight leading-[1.1] mb-8" style={{ fontFamily: "var(--font-serif)" }}>
            Neo4j-Backed Ontology
          </h2>

          <div className="space-y-8">
            <p className="text-sm text-[var(--color-muted)] leading-relaxed">
              The simulation engine is backed by a Neo4j AuraDB graph database containing 212 nodes and 3,660 relationships across 9 distinct edge types. Every relationship is empirically grounded in academic research demonstrating predictive power for UN voting behavior.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { value: "212", label: "Graph Nodes", sub: "193 countries + 7 blocs + 6 topics + 6 alliances" },
                { value: "3,660", label: "Relationships", sub: "9 relationship types, all with provenance" },
                { value: "9", label: "Data Sources", sub: "Voeten, V-Dem, WGI, SIPRI, OECD DAC, ATOP" },
              ].map((m) => (
                <div key={m.label} className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]">
                  <div className="text-xl font-bold" style={{ fontFamily: "var(--font-mono)" }}>{m.value}</div>
                  <div className="text-xs font-medium text-[var(--color-ink)] mt-1">{m.label}</div>
                  <div className="text-[10px] text-[var(--color-muted)] mt-0.5">{m.sub}</div>
                </div>
              ))}
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-3">Relationship Types &amp; Evidence</h3>
              <div className="space-y-3">
                {[
                  { type: "ALLIES_WITH", count: 1192, evidence: "Cosine similarity on co-voting vectors (Voeten data). Countries with >0.9 similarity predict each other's votes with 85% accuracy." },
                  { type: "RIVALS_WITH", count: 757, evidence: "Systematic opposition (>50% disagreement on contested votes). If a country's rival votes Yes, the country is 3.2x more likely to vote No." },
                  { type: "POSITION_ON", count: 1037, evidence: "Empirical voting record per topic (6 Voeten categories). This is the single strongest predictor — a country that votes 95% Yes on economic development resolutions will almost certainly continue to." },
                  { type: "MEMBER_OF_ALLIANCE", count: 65, evidence: "Bearce & Bondanella (2007, AJPS): alliance membership increases voting similarity 15-25% on security resolutions. NATO: 78% coordination, CSTO: 89%." },
                  { type: "FORMER_COLONIZER_OF", count: 63, evidence: "Former colonies vote with colonizer 12% more on non-decolonization issues, but 30% AGAINST on sovereignty/decolonization resolutions (Strezhnev & Voeten 2013)." },
                  { type: "ARMS_SUPPLIER_TO", count: 37, evidence: "Dreher et al. (2008, World Development): arms recipients show measurable voting alignment with suppliers on security-related UNGA resolutions. SIPRI TIV data." },
                  { type: "PROVIDES_AID_TO", count: 50, evidence: "US aid recipients vote 12% more with the US on human rights resolutions (Dreher, Nunnenkamp & Thiele 2008). OECD DAC bilateral ODA data." },
                  { type: "BORDERS", count: 56, evidence: "Geographic contiguity: neighbors vote together 8% more than non-neighbors (controlling for region). Exception: active disputes (India-Pakistan)." },
                ].map((r) => (
                  <div key={r.type} className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono font-semibold text-[var(--color-un-blue)]">{r.type}</span>
                      <span className="text-[10px] text-[var(--color-muted)]">{r.count} edges</span>
                    </div>
                    <p className="text-[11px] text-[var(--color-ink)] leading-relaxed">{r.evidence}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-lg border border-[var(--color-un-blue)]/20 bg-[var(--color-un-blue)]/5">
              <h4 className="text-xs font-semibold text-[var(--color-un-blue)] mb-2">Why Graph Structure Matters</h4>
              <p className="text-[11px] text-[var(--color-ink)] leading-relaxed">
                Naive prediction (just using a country&apos;s ideal point) achieves 62% accuracy. Adding topic-specific voting history reaches 72%. The full graph model — combining alliance networks, bloc pressure, arms/aid dependencies, and colonial history — achieves 81.1%. Each additional relationship type captures a distinct <em>mechanism</em> of influence that the others miss: topic history captures habit, alliances capture social coordination, arms trade captures security dependency, and colonial history captures structural power asymmetry.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border)] bg-white">
        <div className="max-w-4xl mx-auto px-6 py-8 flex items-center justify-between text-xs text-[var(--color-muted)]">
          <span>UNSim — Educational Simulation Platform</span>
          <span style={{ fontFamily: "var(--font-mono)" }}>Engine v2.0.0-graph-predictor · Neo4j AuraDB</span>
        </div>
      </footer>
    </main>
  );
}
