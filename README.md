# UNSim — Interactive UN Policy Simulation Platform

A web platform for simulating how 193 UN member states debate and vote on resolutions. Built on a real knowledge graph of 75 years of UNGA voting records, alliance networks, and policy positions.

**Live:** [unsim.vercel.app](https://unsim.vercel.app)

---

## What It Does

1. **Simulate historical resolutions** — Pick from 245 real UNGA resolutions and compare the knowledge graph's prediction against actual voting outcomes
2. **What-If Sandbox** — Modify the diplomatic graph (shift country positions, add alliances, create entities) and watch vote predictions change in real-time
3. **Explore the knowledge graph** — Interactive force-directed visualization of the 193-nation alliance network, with country deep-dives showing voting patterns, temporal drift, and bloc dynamics
4. **Write custom policies** — Describe a policy idea, have AI draft a UN-style resolution, and simulate how the General Assembly or Security Council would vote

## Technical Highlights

| Metric | Value |
|--------|-------|
| Knowledge graph nodes | 2,065 (193 countries, 1,859 resolutions, 6 topics, 7 blocs) |
| Knowledge graph edges | 307,644 (303K vote edges, 1,680 alliances, 878 rivalries) |
| Outcome prediction accuracy | 100% (pass/fail) on tested resolutions |
| Historical resolutions | 245 with real vote tallies (77 featured) |
| Temporal coverage | UNGA sessions 55–74 (2000–2019) |
| Countries with temporal data | 181/193 |

## Architecture

```
app/
  page.tsx                          — Homepage with resolution library
  explore/page.tsx                  — Interactive knowledge graph explorer
  sandbox/page.tsx                  — What-If sandbox with ontology manager
  simulate/
    new/page.tsx                    — AI-powered custom resolution simulation
    historical/page.tsx             — Historical prediction vs actual comparison
  api/
    graph/alliance-network/         — Visualization graph data (206 nodes, 905 edges)
    graph/country/[iso3]/           — Country profile from knowledge graph
    resolutions/featured/           — Historical resolution catalog
    simulate/                       — Graph-enhanced vote prediction
    simulate/historical/            — Predict + compare to actual outcome
    simulate/what-if/               — Ontology overrides → re-simulation

engines/
  graph-predictor.ts                — Multi-signal vote engine (topic 35%, alliance 20%, policy 20%, ideal 15%, bloc 10%)
  vote-engine.ts                    — Baseline predictor
  enhanced-predictor.ts             — Collaborative filtering predictor
  committees.ts                     — UN committee rules (GA, SC veto, HRC, etc.)

lib/knowledge-graph/
  graph.ts                          — UNKnowledgeGraph class (graphology wrapper)
  loader.ts                         — Three-layer graph loader (viz, core, temporal)
  types.ts                          — TypeScript types for graph nodes/edges

data/
  graph-viz.json (0.4 MB)           — Alliance network for frontend visualization
  graph-core.json (0.9 MB)          — Pre-computed voting patterns for vote engine
  graph-temporal.json (22 MB)       — Full vote history indexed by country (gitignored)
  knowledge-graph.json (45 MB)      — Complete graph (gitignored, regenerable)
  country-profiles.json             — 193 country profiles
  resolution-catalog.json           — 245 historical resolutions with vote tallies
  vote-similarity.json              — Pairwise voting similarity matrix
  topic-history.json                — Per-country per-topic voting rates

scripts/
  build-knowledge-graph.ts          — Ingest raw CSVs → graphology graph
  build-graph-layers.ts             — Split full graph into optimized layers
  build-resolution-catalog.ts       — Extract resolution metadata + tallies
```

## Data Sources

| Source | What it provides |
|--------|-----------------|
| [Erik Voeten UNGA Voting Data](https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/LEJUQZ) | 869K roll-call votes (1946–2023), ideal point estimates, issue categories |
| [V-Dem v14](https://www.v-dem.net/data/the-v-dem-dataset/) | Democracy indices, regime classification |
| [UN Digital Library](https://digitallibrary.un.org) | Resolution texts, vote tallies |
| [Security Council Veto List](https://research.un.org/en/docs/sc/quick/veto) | Historical veto patterns |

## Vote Prediction Engine

The graph-enhanced predictor combines five empirically-grounded signals:

```
Score = 0.35 × TopicVotingHistory
      + 0.20 × AllianceNetworkSignal
      + 0.20 × PolicyDimensionAlignment
      + 0.15 × IdealPointAlignment
      + 0.10 × BlocCoordination
```

- **Topic Voting History** — How has this country actually voted on similar resolutions? Uses blended multi-topic matching against 6 Voeten issue categories.
- **Alliance Network** — What are the country's 10 closest voting partners predicting? Weighted KNN from the vote-similarity graph.
- **Policy Dimensions** — 6-dimensional alignment (sovereignty, human rights, development, security, environment, decolonization).
- **Ideal Point** — Voeten empirical positioning on the global left-right spectrum.
- **Bloc Coordination** — Peer pressure from formal voting blocs (G77, EU, NAM, etc.) weighted by cohesion scores.

## Tech Stack

- **Framework:** Next.js 15 (App Router, React 19, TypeScript)
- **Graph Engine:** [graphology](https://graphology.github.io/) (in-memory graph with algorithm library)
- **Visualization:** react-force-graph-2d, sigma.js (WebGL)
- **Styling:** Tailwind CSS v4
- **AI:** Anthropic Claude / Google Gemini (configurable, for resolution drafting)
- **Deployment:** Vercel

## Running Locally

```bash
# Install
npm install

# Start dev server
npm run dev

# Rebuild knowledge graph from raw data (optional — pre-built layers are committed)
npx tsx scripts/build-knowledge-graph.ts
npx tsx scripts/build-graph-layers.ts
npx tsx scripts/build-resolution-catalog.ts

# Type check
npx tsc --noEmit

# Production build
npm run build
```

Raw UNGA vote data (`data/raw/`) is gitignored due to size. To regenerate:
1. Download Voeten data from [Harvard Dataverse](https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/LEJUQZ)
2. Place `unvotes.csv`, `roll_calls.csv`, `issues.csv` in `data/raw/`
3. Run the build scripts above

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `ANTHROPIC_API_KEY` | For custom resolutions | Claude API for resolution drafting |
| `GOOGLE_GENAI_API_KEY` | Alternative to Anthropic | Gemini API (set `AI_PROVIDER=gemini`) |

Historical simulation and the knowledge graph explorer work without any API keys.

## Disclaimer

All outputs are clearly labeled as **simulated** and based on historical voting patterns. This is an educational tool for understanding multilateral diplomacy, not a prediction service for actual UN behavior.

---

Built by [Apurva Desai](https://apurvad.xyz)
