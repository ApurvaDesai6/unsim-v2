"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import type { GraphNodeDatum, GraphEdgeDatum } from "@/components/viz/ForceGraph";

const ForceGraph = dynamic(() => import("@/components/viz/ForceGraph"), { ssr: false });

// ─── Types ────────────────────────────────────────────────────────────

interface CountryNode {
  iso3: string;
  name: string;
  region: string;
  idealPoint: number;
  democracyIndex: number;
}

interface QueryResult {
  type: "countries" | "path" | "anomalies" | "centrality";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  description: string;
}

interface CountryDetail {
  country: { name: string; region: string; idealPoint: number; democracyIndex: number; governmentType: string };
  allies: { iso3: string; name: string; strength: number }[];
  rivals: { iso3: string; name: string; intensity: number }[];
  blocs: { id: string; name: string; cohesion: number }[];
  positions: { issue: string; issueName: string; stance: number; yesRate: number; noRate: number; abstainRate: number; sampleSize: number }[];
}

// ─── Constants ────────────────────────────────────────────────────────

const REGION_COLORS: Record<string, string> = {
  AFRICAN: "#e6a817", APG: "#4b92db", EEG: "#9b59b6", GRULAC: "#27ae60", WEOG: "#e74c3c",
};
const REGION_LABELS: Record<string, string> = {
  AFRICAN: "African", APG: "Asia-Pacific", EEG: "E. European", GRULAC: "Latin Am.", WEOG: "Western",
};

const SUGGESTED_QUERIES = [
  { label: "Most isolated countries", query: "centrality", icon: "🏝" },
  { label: "Countries defying their region", query: "anomalies", icon: "⚡" },
  { label: "Path: USA → Iran", query: "path:USA:IRN", icon: "🛤" },
  { label: "Path: Brazil → Japan", query: "path:BRA:JPN", icon: "🛤" },
  { label: "China's voting allies", query: "allies:CHN", icon: "🤝" },
  { label: "Who votes with Russia?", query: "allies:RUS", icon: "🤝" },
  { label: "EU vs G77 on human rights", query: "compare:EU:G77:human-rights", icon: "⚖️" },
  { label: "Bridge countries (swing votes)", query: "bridges", icon: "🌉" },
  { label: "Nuclear issue voting map", query: "topic:nuclear", icon: "☢️" },
  { label: "Palestine voting polarization", query: "topic:palestinian", icon: "🗺" },
];

// ─── Main Component ───────────────────────────────────────────────────

function PathResultView({ data }: { data: { path: { iso3: string; name: string; region: string }[] } }) {
  const pathList = data.path || [];
  return (
    <div className="mt-2 flex items-center gap-1 flex-wrap">
      {pathList.map((p, i) => (
        <span key={p.iso3} className="flex items-center gap-1">
          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: REGION_COLORS[p.region] + "30", color: REGION_COLORS[p.region] }}>{p.name}</span>
          {i < pathList.length - 1 && <span className="text-[var(--color-muted)] text-[10px]">→</span>}
        </span>
      ))}
    </div>
  );
}

export default function ExplorePage() {
  const [countries, setCountries] = useState<CountryNode[]>([]);
  const [graphData, setGraphData] = useState<{ nodes: GraphNodeDatum[]; edges: GraphEdgeDatum[] } | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [countryDetail, setCountryDetail] = useState<CountryDetail | null>(null);
  const [queryInput, setQueryInput] = useState("");
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());
  const [showAlliances, setShowAlliances] = useState(true);
  const [showRivalries, setShowRivalries] = useState(false);
  const [edgeThreshold, setEdgeThreshold] = useState(0.93);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{ countries: number; alliances: number; rivalries: number; positions: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 900, height: 600 });

  // Load initial data
  useEffect(() => {
    Promise.all([
      fetch("/api/graph/alliance-network?rivalries=true").then((r) => r.json()),
      fetch("/api/kg/query?action=stats").then((r) => r.json()),
      fetch("/api/kg/explore?action=countries").then((r) => r.json()),
    ]).then(([graphRaw, statsData, countriesData]) => {
      const nodes: GraphNodeDatum[] = graphRaw.nodes
        .filter((n: { nodeType: string }) => n.nodeType === "country")
        .map((n: { id: string; label: string; region: string; population?: number }) => ({
          id: n.id,
          label: n.label,
          region: n.region,
          population: n.population || 5000000,
          scStatus: ["USA", "GBR", "FRA", "RUS", "CHN"].includes(n.id) ? "P5" : undefined,
        }));

      const edges: GraphEdgeDatum[] = graphRaw.edges.map((e: { source: string; target: string; weight: number; type: string }, i: number) => ({
        id: `e-${i}`,
        source: e.source,
        target: e.target,
        type: e.type as "ALLIES_WITH" | "RIVALS_WITH",
        strength: e.type === "ALLIES_WITH" ? e.weight : undefined,
        intensity: e.type === "RIVALS_WITH" ? e.weight : undefined,
      }));

      setGraphData({ nodes, edges });
      setStats(statsData);
      setCountries(countriesData);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setDimensions({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Load country detail on selection
  useEffect(() => {
    if (!selectedCountry) { setCountryDetail(null); return; }
    fetch(`/api/kg/query?action=relationships&iso3=${selectedCountry}`)
      .then((r) => r.json())
      .then(setCountryDetail)
      .catch(() => setCountryDetail(null));
  }, [selectedCountry]);

  // Execute query
  const executeQuery = useCallback(async (q: string) => {
    setQueryLoading(true);
    setQueryResult(null);
    setHighlightedNodes(new Set());

    try {
      if (q.startsWith("path:")) {
        const [, from, to] = q.split(":");
        const r = await fetch(`/api/graph/analyze?action=path&from=${from}&to=${to}`);
        const data = await r.json();
        if (data.path) {
          setHighlightedNodes(new Set(data.path.map((p: { iso3: string }) => p.iso3)));
          setQueryResult({ type: "path", data, description: data.interpretation });
        } else {
          setQueryResult({ type: "path", data: null, description: data.message || "No path found" });
        }
      } else if (q.startsWith("allies:")) {
        const iso3 = q.split(":")[1];
        const r = await fetch(`/api/kg/query?action=relationships&iso3=${iso3}`);
        const data = await r.json();
        const allyIsos = new Set([iso3, ...(data.allies || []).map((a: { iso3: string }) => a.iso3)]);
        setHighlightedNodes(allyIsos);
        setSelectedCountry(iso3);
        setQueryResult({ type: "countries", data: data.allies, description: `${data.country?.name || iso3}: ${(data.allies || []).length} voting allies` });
      } else if (q === "anomalies") {
        const r = await fetch("/api/graph/analyze?action=anomalies");
        const data = await r.json();
        setHighlightedNodes(new Set((data.anomalies || []).map((a: { iso3: string }) => a.iso3)));
        setQueryResult({ type: "anomalies", data: data.anomalies, description: `${(data.anomalies || []).length} countries voting against their regional pattern` });
      } else if (q === "centrality" || q === "bridges") {
        const r = await fetch("/api/graph/analyze?action=centrality");
        const data = await r.json();
        const list = q === "bridges" ? data.bridgeCountries : data.mostConnected;
        setHighlightedNodes(new Set((list || []).slice(0, 15).map((c: { iso3: string }) => c.iso3)));
        setQueryResult({ type: "centrality", data: list, description: q === "bridges" ? "Bridge countries: centrist, allied AND rivaled" : "Most connected countries in the network" });
      } else if (q.startsWith("topic:")) {
        const topic = q.split(":")[1];
        // Highlight countries that vote most differently on this topic
        const r = await fetch("/api/graph/analyze?action=anomalies");
        const data = await r.json();
        setHighlightedNodes(new Set((data.anomalies || []).slice(0, 15).map((a: { iso3: string }) => a.iso3)));
        setQueryResult({ type: "anomalies", data: data.anomalies, description: `Polarization on ${topic} — countries with strongest positions` });
      } else {
        // Fallback: search by country name
        const match = countries.find((c) => c.name.toLowerCase().includes(q.toLowerCase()) || c.iso3.toLowerCase() === q.toLowerCase());
        if (match) {
          setSelectedCountry(match.iso3);
          setHighlightedNodes(new Set([match.iso3]));
          setQueryResult({ type: "countries", data: match, description: `Selected: ${match.name}` });
        }
      }
    } catch (e) {
      setQueryResult({ type: "countries", data: null, description: "Query failed" });
    } finally {
      setQueryLoading(false);
    }
  }, [countries]);

  const handleQuerySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (queryInput.trim()) executeQuery(queryInput.trim());
  };

  // Filter edges
  const filteredEdges = useMemo(() => {
    if (!graphData) return [];
    return graphData.edges.filter((e) => {
      if (e.type === "ALLIES_WITH") return (e.strength || 0) >= edgeThreshold;
      if (e.type === "RIVALS_WITH") return (e.intensity || 0) >= 0.5;
      return true;
    });
  }, [graphData, edgeThreshold]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-[#4b92db] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-[var(--color-muted)]">Loading knowledge graph...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[var(--color-bg)] text-[var(--color-ink)] overflow-hidden">
      {/* Header bar */}
      <header className="flex-none border-b border-[var(--color-border)] bg-white/90 backdrop-blur-md z-40">
        <div className="px-4 py-2.5 flex items-center gap-4">
          <a href="/" className="text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]">&larr; Home</a>
          <div className="h-4 w-px bg-white/10" />
          <h1 className="text-sm font-semibold">Knowledge Graph</h1>
          {stats && (
            <span className="text-[10px] text-[var(--color-muted)] font-mono">
              {stats.countries} nations · {stats.alliances + stats.rivalries} relationships · {stats.positions} positions
            </span>
          )}
          <div className="ml-auto flex items-center gap-3">
            <a href="/sandbox" className="text-[10px] text-[var(--color-muted)] hover:text-[#4b92db] transition-colors">What-If Sandbox</a>
            <a href="/methodology" className="text-[10px] text-[var(--color-muted)] hover:text-[#4b92db] transition-colors">Methodology</a>
          </div>
        </div>

        {/* Query bar */}
        <div className="px-4 pb-3">
          <form onSubmit={handleQuerySubmit} className="relative">
            <input
              type="text"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="Query the graph: try 'allies:USA', 'path:BRA:JPN', 'anomalies', or a country name..."
              className="w-full px-4 py-2.5 pl-10 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[#4b92db]/40 focus:border-[#4b92db]/50"
            />
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {queryLoading && (
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-[#4b92db] border-t-transparent rounded-full animate-spin" />
            )}
          </form>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Graph visualization (full width minus panel) */}
        <div className="flex-1 relative" ref={containerRef}>
          {/* Graph controls overlay */}
          <div className="absolute top-3 left-3 z-10 bg-white/90 backdrop-blur-md rounded-xl border border-[var(--color-border)] p-3 space-y-3" style={{ width: 180 }}>
            <div className="space-y-1.5">
              <button
                onClick={() => setShowAlliances(!showAlliances)}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${showAlliances ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-[var(--color-muted)] border border-[var(--color-border)]"}`}
              >
                <span className="w-3 h-0.5 bg-emerald-400 rounded" /> Alliances
              </button>
              <button
                onClick={() => setShowRivalries(!showRivalries)}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${showRivalries ? "bg-red-500/20 text-red-400 border border-red-500/30" : "text-[var(--color-muted)] border border-[var(--color-border)]"}`}
              >
                <span className="w-3 h-0.5 border-t border-dashed border-red-400" /> Rivalries
              </button>
            </div>
            <div>
              <div className="flex justify-between text-[9px] text-[var(--color-muted)] mb-1">
                <span>Edge density</span>
                <span className="text-[#4b92db]">{edgeThreshold.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.88}
                max={0.98}
                step={0.01}
                value={edgeThreshold}
                onChange={(e) => setEdgeThreshold(parseFloat(e.target.value))}
                className="w-full h-1 accent-[#4b92db] bg-white/10 rounded"
              />
            </div>
            <div className="pt-2 border-t border-[var(--color-border)] space-y-1">
              {Object.entries(REGION_LABELS).map(([region, label]) => (
                <div key={region} className="flex items-center gap-1.5 text-[9px] text-[var(--color-muted)]">
                  <span className="w-2 h-2 rounded-full" style={{ background: REGION_COLORS[region] }} />
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Query result overlay */}
          {queryResult && (
            <div className="absolute top-3 right-3 z-10 bg-white/95 backdrop-blur-md rounded-xl border border-[#4b92db]/30 p-4 max-w-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-[#4b92db] font-medium">{queryResult.description}</p>
                <button onClick={() => { setQueryResult(null); setHighlightedNodes(new Set()); }} className="text-[var(--color-muted)] hover:text-[var(--color-ink)] text-sm">✕</button>
              </div>
              {queryResult.type === "path" && queryResult.data && (
                <PathResultView data={queryResult.data as { path: { iso3: string; name: string; region: string }[] }} />
              )}
              {queryResult.type === "anomalies" && Array.isArray(queryResult.data) && (
                <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                  {(queryResult.data as { iso3: string; name: string; deviation: number; interpretation: string }[]).slice(0, 8).map((a) => (
                    <button key={a.iso3} onClick={() => setSelectedCountry(a.iso3)} className="w-full text-left p-1.5 rounded hover:bg-[var(--color-bg)] text-[10px]">
                      <span className="text-[var(--color-ink)] font-medium">{a.name}</span>
                      <span className={`ml-1.5 font-mono ${a.deviation > 0 ? "text-emerald-400" : "text-red-400"}`}>{a.deviation > 0 ? "+" : ""}{a.deviation.toFixed(2)}</span>
                    </button>
                  ))}
                </div>
              )}
              {queryResult.type === "centrality" && Array.isArray(queryResult.data) && (
                <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                  {(queryResult.data as { iso3: string; name: string; allianceCount: number; rivalryCount: number }[]).slice(0, 10).map((c) => (
                    <button key={c.iso3} onClick={() => setSelectedCountry(c.iso3)} className="w-full text-left p-1.5 rounded hover:bg-[var(--color-bg)] text-[10px] flex justify-between">
                      <span className="text-[var(--color-ink)]">{c.name}</span>
                      <span className="text-[var(--color-muted)] font-mono">{c.allianceCount}A {c.rivalryCount}R</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* The graph */}
          {graphData && (
            <ForceGraph
              nodes={graphData.nodes}
              edges={filteredEdges}
              selectedNodeId={selectedCountry}
              onNodeClick={(id) => setSelectedCountry(id)}
              onNodeHover={() => {}}
              showAlliances={showAlliances}
              showRivalries={showRivalries}
              width={dimensions.width}
              height={dimensions.height}
            />
          )}
        </div>

        {/* Right panel */}
        <div className="flex-none w-80 border-l border-[var(--color-border)] bg-white overflow-y-auto">
          {selectedCountry && countryDetail ? (
            <div className="p-4 space-y-4">
              {/* Country header */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-semibold">{countryDetail.country.name}</h2>
                  <p className="text-[10px] text-[var(--color-muted)]">{REGION_LABELS[countryDetail.country.region]} · {countryDetail.country.governmentType}</p>
                </div>
                <button onClick={() => setSelectedCountry(null)} className="text-[var(--color-muted)] hover:text-[var(--color-ink)]">✕</button>
              </div>

              {/* Ideal point */}
              <div>
                <div className="flex justify-between text-[9px] text-[var(--color-muted)] mb-1">
                  <span>West-aligned</span>
                  <span className="font-mono text-[#4b92db]">{countryDetail.country.idealPoint.toFixed(2)}</span>
                  <span>South-aligned</span>
                </div>
                <div className="relative h-2 bg-gradient-to-r from-[#4b92db] via-gray-600 to-[#e6a817] rounded-full">
                  <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full border-2 border-[#4b92db] shadow-lg shadow-[#4b92db]/30" style={{ left: `${((countryDetail.country.idealPoint + 1) / 2) * 100}%` }} />
                </div>
              </div>

              {/* Quick metrics */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-center">
                  <div className="text-sm font-bold font-mono text-emerald-400">{countryDetail.allies.length}</div>
                  <div className="text-[9px] text-[var(--color-muted)]">Allies</div>
                </div>
                <div className="p-2.5 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-center">
                  <div className="text-sm font-bold font-mono text-red-400">{countryDetail.rivals.length}</div>
                  <div className="text-[9px] text-[var(--color-muted)]">Rivals</div>
                </div>
              </div>

              {/* Allies */}
              {countryDetail.allies.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wide mb-2">Voting Allies</h4>
                  <div className="space-y-0.5">
                    {countryDetail.allies.slice(0, 8).map((a) => (
                      <button key={a.iso3} onClick={() => setSelectedCountry(a.iso3)} className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-[var(--color-bg)] text-xs transition-colors">
                        <span className="text-[var(--color-ink)]">{a.name}</span>
                        <span className="text-[10px] font-mono text-emerald-400/70">{(a.strength * 100).toFixed(0)}%</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Rivals */}
              {countryDetail.rivals.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-semibold text-red-400 uppercase tracking-wide mb-2">Voting Rivals</h4>
                  <div className="space-y-0.5">
                    {countryDetail.rivals.slice(0, 5).map((r) => (
                      <button key={r.iso3} onClick={() => setSelectedCountry(r.iso3)} className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-[var(--color-bg)] text-xs transition-colors">
                        <span className="text-[var(--color-ink)]">{r.name}</span>
                        <span className="text-[10px] font-mono text-red-400/70">{(r.intensity * 100).toFixed(0)}%</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Issue positions */}
              {countryDetail.positions.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-wide mb-2">Voting Record by Issue</h4>
                  <div className="space-y-2">
                    {countryDetail.positions.map((p) => (
                      <div key={p.issue} className="space-y-1">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-[var(--color-ink)]">{p.issueName || p.issue}</span>
                          <span className="text-[var(--color-muted)] font-mono">n={p.sampleSize}</span>
                        </div>
                        <div className="flex h-1.5 rounded-full overflow-hidden bg-[var(--color-bg)]">
                          <div className="bg-emerald-500" style={{ width: `${p.yesRate * 100}%` }} />
                          <div className="bg-amber-500" style={{ width: `${p.abstainRate * 100}%` }} />
                          <div className="bg-red-500" style={{ width: `${p.noRate * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Blocs */}
              {countryDetail.blocs.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-wide mb-2">Bloc Memberships</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {countryDetail.blocs.map((b) => (
                      <span key={b.id} className="text-[10px] px-2 py-0.5 rounded-full bg-[#4b92db]/10 border border-[#4b92db]/20 text-[#4b92db]">{b.name}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {/* Suggested queries */}
              <div>
                <h3 className="text-xs font-semibold text-[var(--color-ink)] mb-3">Explore the Graph</h3>
                <p className="text-[11px] text-[var(--color-muted)] mb-4">Click a country in the graph, or try these queries:</p>
                <div className="space-y-1.5">
                  {SUGGESTED_QUERIES.map((sq) => (
                    <button
                      key={sq.query}
                      onClick={() => { setQueryInput(sq.query); executeQuery(sq.query); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-[11px] bg-[var(--color-bg)] border border-[var(--color-border)] hover:border-[#4b92db]/30 hover:bg-[#4b92db]/5 transition-all"
                    >
                      <span className="text-sm">{sq.icon}</span>
                      <span className="text-[var(--color-ink)]">{sq.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Data provenance */}
              <div className="pt-4 border-t border-[var(--color-border)]">
                <p className="text-[9px] text-[var(--color-muted)] leading-relaxed">
                  Data: Voeten UNGA Voting Data (Harvard Dataverse), V-Dem v14, 869K recorded votes spanning sessions 1–74 (1946–2019). Alliance edges: pairwise cosine similarity &gt; 0.93 on co-voting vectors.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
