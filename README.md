# UNSim — UN Policy Simulation Platform

An interactive platform for simulating United Nations General Assembly voting. Backed by a Neo4j knowledge graph containing 75 years of real UNGA voting data, arms trade relationships, aid dependencies, alliance networks, and governance indicators across all 193 member states.

**Live:** [unsim.apurvad.xyz](https://unsim.apurvad.xyz)

---

## Platform Capabilities

| Feature | Description |
|---------|-------------|
| **Scenario Simulation** | 12 pre-built resolutions (climate, nuclear, AI governance, etc.) with instant KG-backed vote prediction |
| **MUN Preparation Tool** | Input a resolution idea → get coalition analysis, persuadable countries, co-sponsorship targets, exportable briefing |
| **Knowledge Graph Explorer** | Interactive force-directed graph, query interface, path finding, anomaly detection |
| **Historical Comparison** | 245 real UNGA resolutions — compare KG prediction against actual outcomes |
| **What-If Sandbox** | Modify country positions, add alliances, see vote shifts in real-time |
| **Clause Sensitivity** | Adjust resolution language strength → watch votes shift (no LLM call needed) |
| **Temporal Simulation** | See how a resolution would fare across different geopolitical eras (1979–2024) |

## Validated Accuracy

| Metric | Value | Methodology |
|--------|-------|-------------|
| Per-vote accuracy | **81.1%** | 180,489 individual vote predictions vs. actual recorded votes |
| Outcome accuracy | **99.6%** | 1,074/1,078 resolutions correctly predicted pass/fail |
| Best topic | **Palestinian conflict: 90.8%** | Highly polarized → predictable |
| Best region | **GRULAC: 92.0%** | Strong bloc coordination |
| Improvement over naive | **+19%** | vs. ideal-point-only baseline (62%) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Vercel (Next.js 15, React 19, TypeScript)                  │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │ Scenario Sim │  │ MUN Prep     │  │ KG Explorer      │ │
│  │ /simulate/*  │  │ /mun-prep    │  │ /explore         │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────────┘ │
│         │                  │                  │             │
│  ┌──────▼──────────────────▼──────────────────▼───────────┐ │
│  │              Graph Predictor Engine                      │ │
│  │  Topic History 30% + Dimensions 30% + Alliance KNN 15%  │ │
│  │  + Ideal Point 15% + Bloc Coordination 10%              │ │
│  └──────────────────────┬─────────────────────────────────┘ │
│                         │                                   │
│  ┌──────────────────────▼─────────────────────────────────┐ │
│  │           Neo4j AuraDB (Graph Database)                  │ │
│  │  212 nodes · 3,660 relationships · 9 edge types         │ │
│  │  + graphology (in-memory for sub-ms simulation)         │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

| Decision | Chose | Over | Rationale |
|----------|-------|------|-----------|
| Graph DB | Neo4j AuraDB | AWS Neptune | No VPC needed for Vercel; free tier fits our scale; Cypher more readable than Gremlin |
| Ontology | OWL-Lite + SHACL | Full OWL 2 DL | Only ~30 entity types; no description logic reasoning needed |
| Prediction hot path | graphology (in-memory) | Neo4j-only | Sub-ms latency required for clause sensitivity sliders |
| Validation | Zod (runtime) | TypeScript-only | Catches bad data at ingestion boundary, not just compile time |
| Hosting | Vercel serverless | EC2/ECS | Zero-ops, auto-scaling, native Next.js support |
| LLM features | User-provided API key | Built-in key | Sustainable without rate limiting; user controls cost |

---

## Knowledge Graph

### Neo4j Schema (212 nodes, 3,660 relationships)

**Nodes:**
- `Country` (193) — ISO3, idealPoint, democracyIndex, 6 WGI governance scores, population, GDP
- `Bloc` (7) — G77, NAM, EU, African Group, AOSIS, Arab Group, CARICOM
- `Topic` (6) — Voeten issue categories with resolution counts
- `Alliance` (6) — NATO, CSTO, Five Eyes, AUKUS, SCO, BRICS+

**Relationships:**

| Type | Count | Source | Predictive Evidence |
|------|-------|--------|-------------------|
| `ALLIES_WITH` | 1,192 | Voeten co-voting cosine similarity | 85% accuracy when using top-10 allies as predictors |
| `POSITION_ON` | 1,037 | Voeten topic-specific voting rates | Single strongest signal (30% weight in model) |
| `RIVALS_WITH` | 757 | Systematic opposition (>50% disagreement) | 3.2x more likely to vote opposite of rival |
| `MEMBER_OF` | 403 | Curated bloc rosters | Bloc cascade: >70% alignment → 85% prediction |
| `MEMBER_OF_ALLIANCE` | 65 | ATOP alliance data | 15-25% increased similarity on security votes |
| `FORMER_COLONIZER_OF` | 63 | Historical record | +12% alignment (non-decolonization), -30% (decolonization) |
| `BORDERS` | 56 | Geographic contiguity | +8% alignment (except active disputes) |
| `PROVIDES_AID_TO` | 50 | OECD DAC 2022 bilateral ODA | Recipients vote 12% more with donors on HR resolutions |
| `ARMS_SUPPLIER_TO` | 37 | SIPRI TIV 2019-2023 | Security alignment follows arms dependency |

### Ontology (OWL-Lite + SHACL)

The formal ontology (`lib/ontology/un-diplomacy.ttl`) defines 9 classes, 16 relationship properties, and 22 data properties. SHACL shapes (`lib/ontology/shapes.ttl`) enforce constraints at write time:
- ISO3 codes must be exactly 3 uppercase letters
- Ideal points bounded [-3, +3]
- Democracy index bounded [0, 1]
- Alliance edges can only connect Country→Country (not Country→Bloc)

---

## Data Sources

| Source | Data | Coverage | Format |
|--------|------|----------|--------|
| [Voeten UNGA Voting Data](https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/LEJUQZ) | 869K roll-call votes, ideal points, issue categories | 1946–2023 | CSV |
| [V-Dem v14](https://www.v-dem.net/data/the-v-dem-dataset/) | Democracy indices, regime classification | 1789–2023 | CSV |
| [World Bank WGI 2024](https://www.worldbank.org/en/publication/worldwide-governance-indicators) | 6 governance indicators (official Excel) | 2024 | XLSX |
| [SIPRI Arms Transfers](https://www.sipri.org/databases/armstransfers) | Arms trade (TIV values, weapon systems) | 2019–2023 | Manual/CSV |
| [OECD DAC](https://data-explorer.oecd.org) | Bilateral official development assistance | 2022 | SDMX API |
| [ATOP](https://www.atopdata.org/) | Formal alliance treaties | 1815–2018 | CSV |
| [GDELT](https://www.gdeltproject.org/) | Real-time geopolitical events | 1979–present | BigQuery |

---

## Project Structure

```
app/
  page.tsx                            — Homepage (12 scenario presets + resolution library)
  explore/page.tsx                    — KG explorer (force graph + query interface)
  mun-prep/page.tsx                   — MUN preparation tool (coalition analysis + export)
  sandbox/page.tsx                    — What-If sandbox (ontology overrides)
  simulate/new/page.tsx               — Simulation (clauses, amendments, timeline, hemicycle)
  simulate/historical/page.tsx        — Historical comparison (predicted vs actual)
  methodology/page.tsx                — This documentation (validation, architecture)
  api/
    neo4j/                            — Direct Neo4j Cypher queries
    kg/explore/                       — Country list, search, regions (Neo4j-backed)
    kg/query/                         — Relationships, predictions (Neo4j-backed)
    kg/influence/                     — Influence network entities
    graph/alliance-network/           — Viz data for force graph (Neo4j-backed)
    graph/analyze/                    — Communities, paths, centrality, anomalies
    simulate/                         — Vote prediction engine
    simulate/historical/              — Predict + compare vs actual
    simulate/what-if/                 — Ontology override → re-simulation
    simulate/mun-analysis/            — MUN briefing generator
    simulate/geopolitical/            — What-if event simulator
    simulate/temporal/                — Era-based time travel
    ontology/                         — Schema, perspectives, inference, validation, export
    resolutions/featured/             — 77 featured historical resolutions

engines/
  graph-predictor.ts                  — Primary: 5-signal model with intensity damping
  vote-engine.ts                      — Legacy baseline predictor
  enhanced-predictor.ts               — Collaborative filtering variant
  trained-model.ts                    — Statistical model (cross-validated)
  committees.ts                       — UN committee rules (GA, SC veto, HRC, etc.)

lib/
  neo4j/                              — Driver, schema, Zod validation
  knowledge-graph/                    — graphology engine, N3.js ontology, perspectives
  ontology/                           — OWL-Lite schema, SHACL shapes, perspectives
  simulation/                         — Temporal era engine
  ai/                                 — LLM provider abstraction (Claude/Gemini)

data/
  country-profiles.json               — 193 countries (real WB population/GDP + WGI 2024)
  governance-indicators.json          — WGI 2024 (6 indicators × 215 territories)
  arms-trade.json                     — SIPRI top transfers (38 edges)
  aid-flows.json                      — OECD DAC top flows (50 edges)
  blocs.json                          — 7 voting blocs with memberships
  topic-history.json                  — Per-country per-topic voting rates
  vote-similarity.json                — Pairwise cosine similarity matrix
  resolution-catalog.json             — 245 resolutions with actual vote tallies
  preset-scenarios.json               — 12 pre-built simulation scenarios
  influence-network.json              — Hidden influence entities
  graph-viz.json                      — Visualization layer (fallback)
  graph-core.json                     — Core prediction layer (fallback)
```

---

## Running Locally

```bash
# Install
npm install

# Start dev server (works without Neo4j — uses JSON fallback)
npm run dev

# With Neo4j (full graph database):
export NEO4J_URI="neo4j+s://xxx.databases.neo4j.io"
export NEO4J_USER="neo4j"
export NEO4J_PASSWORD="..."
export NEO4J_DATABASE="..."
npm run dev

# Seed Neo4j from scratch
npx tsx scripts/seed-neo4j.ts

# Run accuracy validation (1,078 resolutions, 180K predictions)
npx tsx scripts/validate-current-engine.ts

# Run test suite
npx tsx scripts/test-accuracy.ts

# Rebuild graph layers (if raw data changes)
npx tsx scripts/build-knowledge-graph.ts
npx tsx scripts/build-graph-layers.ts

# Ingest new data
npx tsx scripts/fix-country-data.ts          # Real WB population/GDP
npx tsx scripts/ingest-world-bank-wgi.ts     # WGI governance (from Excel)
npx tsx scripts/ingest-gdelt-bigquery.ts     # GDELT events (needs GCP auth)
```

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEO4J_URI` | For Neo4j | Connection URI (neo4j+s://...) |
| `NEO4J_USER` | For Neo4j | Username |
| `NEO4J_PASSWORD` | For Neo4j | Password |
| `NEO4J_DATABASE` | For Neo4j | Database name (instance ID for AuraDB Free) |
| `ANTHROPIC_API_KEY` | For AI features | User-provided Claude API key |
| `GOOGLE_GENAI_API_KEY` | For AI features | User-provided Gemini API key |

---

## Academic References

1. Bailey, M., Strezhnev, A., & Voeten, E. (2017). "Estimating Dynamic State Preferences from United Nations Voting Data." *Journal of Conflict Resolution*, 61(2).
2. Bearce, D. & Bondanella, S. (2007). "Intergovernmental Organizations, Socialization, and Member-State Interest Convergence." *AJPS*.
3. Dreher, A., Nunnenkamp, P., & Thiele, R. (2008). "Does US Aid Buy UN General Assembly Votes?" *World Development*, 36(12).
4. Coppedge, M. et al. (2023). "V-Dem Dataset v14." Varieties of Democracy Institute.
5. World Bank (2024). "Worldwide Governance Indicators."
6. SIPRI (2024). "Arms Transfers Database." Stockholm International Peace Research Institute.

## Disclaimer

All outputs are labeled as **simulated** and based on historical voting patterns. This is an educational tool for understanding multilateral diplomacy, not a prediction service.

---

Built by [Apurva Desai](https://apurvad.xyz) · [View Methodology](/methodology)
