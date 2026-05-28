"use client";

import { useState, useEffect, useCallback } from "react";
import OntologyManager from "@/components/ontology/OntologyManager";
import type { OntologyOverrides } from "@/components/ontology/OntologyManager";
import VoteComparison from "@/components/viz/VoteComparison";

interface Resolution {
  rcid: number;
  title: string;
  topic: string;
  date: string;
  actualVote: { yes: number; no: number; abstain: number };
  passed: boolean;
  totalVoters: number;
}

interface WhatIfResult {
  resolution: { rcid: number; title: string; topic: string };
  baseline: { totals: { yes: number; no: number; abstain: number }; passed: boolean };
  modified: { totals: { yes: number; no: number; abstain: number }; passed: boolean; countryVotes: { iso3: string; name: string; vote: string; confidence: number; factors: { name: string; score: number; weight: number }[] }[] };
  actual: { totals: { yes: number; no: number; abstain: number }; passed: boolean };
  diffs: { iso3: string; name: string; basePrediction: string; modifiedPrediction: string }[];
  overridesApplied: { attributeChanges: number; edgesAdded: number; nodesAdded: number } | null;
}

const TOPIC_COLORS: Record<string, string> = {
  "Human rights": "border-purple-500/30 text-purple-400",
  "Economic development": "border-emerald-500/30 text-emerald-400",
  "Arms control and disarmament": "border-red-500/30 text-red-400",
  "Colonialism": "border-amber-500/30 text-amber-400",
  "Nuclear weapons and nuclear material": "border-orange-500/30 text-orange-400",
  "Palestinian conflict": "border-blue-500/30 text-blue-400",
};

export default function SandboxPage() {
  const [resolutions, setResolutions] = useState<Resolution[]>([]);
  const [selectedRcid, setSelectedRcid] = useState<number | null>(null);
  const [countries, setCountries] = useState<{ iso3: string; name: string }[]>([]);
  const [overrides, setOverrides] = useState<OntologyOverrides>({ nodes: [], edges: [], modifiedAttributes: {} });
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [topicFilter, setTopicFilter] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const [resRes, graphRes] = await Promise.all([
        fetch("/api/resolutions/featured"),
        fetch("/api/graph/alliance-network"),
      ]);
      if (resRes.ok) setResolutions(await resRes.json());
      if (graphRes.ok) {
        const g = await graphRes.json();
        setCountries(
          g.nodes
            .filter((n: { nodeType: string }) => n.nodeType === "country")
            .map((n: { id: string; label: string }) => ({ iso3: n.id, name: n.label }))
            .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name))
        );
      }
    }
    load();
  }, []);

  const runSimulation = useCallback(async () => {
    if (!selectedRcid) return;
    setSimulating(true);
    try {
      const res = await fetch("/api/simulate/what-if", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rcid: selectedRcid, overrides }),
      });
      if (res.ok) setResult(await res.json());
    } catch (e) {
      console.error("What-if simulation failed:", e);
    } finally {
      setSimulating(false);
    }
  }, [selectedRcid, overrides]);

  // Auto-simulate when resolution or overrides change
  useEffect(() => {
    if (selectedRcid) runSimulation();
  }, [selectedRcid, overrides, runSimulation]);

  const filteredResolutions = topicFilter
    ? resolutions.filter((r) => r.topic === topicFilter)
    : resolutions;

  const topics = [...new Set(resolutions.map((r) => r.topic))];
  const existingBlocs = [
    { id: "G77", name: "G77 + China" }, { id: "NAM", name: "Non-Aligned Movement" },
    { id: "EU", name: "European Union" }, { id: "AG", name: "African Group" },
    { id: "AOSIS", name: "Small Island States" }, { id: "Arab", name: "Arab Group" },
    { id: "CARICOM", name: "Caribbean Community" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white">
      <header className="border-b border-white/10 bg-black/30 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/" className="text-sm text-gray-400 hover:text-white">&larr; Home</a>
            <div className="h-4 w-px bg-white/20" />
            <h1 className="text-lg font-semibold" style={{ fontFamily: "var(--font-serif, Georgia)" }}>
              What-If Sandbox
            </h1>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full border border-[#c9a94e]/30 bg-[#c9a94e]/10 text-[#c9a94e]">
            Experimental
          </span>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <p className="text-sm text-gray-400 mb-6 max-w-2xl">
          Select a historical resolution, modify the knowledge graph (add alliances, change country positions),
          and see how the vote prediction shifts in real-time. Compare baseline, modified, and actual outcomes.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Resolution selector + Ontology */}
          <div className="lg:col-span-1 space-y-4">
            {/* Resolution selector */}
            <div className="bg-white/5 rounded-xl border border-white/10 p-4 space-y-3">
              <h3 className="text-xs uppercase tracking-wider text-gray-400">Select Resolution</h3>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setTopicFilter(null)}
                  className={`text-[10px] px-2 py-1 rounded-full border ${!topicFilter ? "border-[#4b92db] text-[#4b92db]" : "border-white/10 text-gray-500"}`}
                >
                  All
                </button>
                {topics.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTopicFilter(t)}
                    className={`text-[10px] px-2 py-1 rounded-full border ${topicFilter === t ? "border-[#4b92db] text-[#4b92db]" : "border-white/10 text-gray-500"}`}
                  >
                    {t.split(" ").slice(0, 2).join(" ")}
                  </button>
                ))}
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1.5">
                {filteredResolutions.map((r) => (
                  <button
                    key={r.rcid}
                    onClick={() => setSelectedRcid(r.rcid)}
                    className={`w-full text-left p-2.5 rounded-lg border transition-all text-xs ${
                      selectedRcid === r.rcid
                        ? "border-[#4b92db] bg-[#4b92db]/10"
                        : "border-white/5 hover:border-white/20 bg-white/[0.02]"
                    }`}
                  >
                    <p className="text-gray-200 line-clamp-1 font-medium">{r.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border ${TOPIC_COLORS[r.topic] || "border-gray-500 text-gray-400"}`}>
                        {r.topic}
                      </span>
                      <span className="text-[9px] text-gray-600">{r.date.slice(0, 4)}</span>
                      <span className="text-[9px] text-gray-600">{r.actualVote.yes}Y/{r.actualVote.no}N</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Ontology Manager */}
            <OntologyManager
              overrides={overrides}
              onChange={setOverrides}
              existingCountries={countries}
              existingBlocs={existingBlocs}
            />
          </div>

          {/* Right: Results */}
          <div className="lg:col-span-2 space-y-6">
            {!selectedRcid && (
              <div className="flex items-center justify-center h-64 bg-white/[0.02] rounded-xl border border-white/10">
                <p className="text-sm text-gray-500">Select a resolution to begin simulation</p>
              </div>
            )}

            {simulating && (
              <div className="flex items-center justify-center h-32">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-[#4b92db] border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-gray-400">Running what-if simulation...</span>
                </div>
              </div>
            )}

            {result && !simulating && (
              <>
                {/* Three-way comparison */}
                <div className="bg-white/5 rounded-xl border border-white/10 p-5 space-y-4">
                  <h3 className="text-sm font-medium">{result.resolution.title}</h3>

                  <div className="grid grid-cols-3 gap-4">
                    {/* Baseline */}
                    <div className="space-y-2">
                      <p className="text-[10px] uppercase tracking-wider text-gray-400">KG Baseline</p>
                      <VoteBar totals={result.baseline.totals} total={193} />
                      <p className={`text-xs font-medium ${result.baseline.passed ? "text-green-400" : "text-red-400"}`}>
                        {result.baseline.passed ? "Passes" : "Fails"}
                      </p>
                    </div>

                    {/* Modified */}
                    <div className="space-y-2">
                      <p className="text-[10px] uppercase tracking-wider text-[#c9a94e]">
                        With Overrides
                        {result.overridesApplied && (
                          <span className="ml-1 text-gray-500">
                            ({result.overridesApplied.attributeChanges + result.overridesApplied.edgesAdded + result.overridesApplied.nodesAdded} changes)
                          </span>
                        )}
                      </p>
                      <VoteBar totals={result.modified.totals} total={193} />
                      <p className={`text-xs font-medium ${result.modified.passed ? "text-green-400" : "text-red-400"}`}>
                        {result.modified.passed ? "Passes" : "Fails"}
                      </p>
                    </div>

                    {/* Actual */}
                    <div className="space-y-2">
                      <p className="text-[10px] uppercase tracking-wider text-gray-400">Actual (Historical)</p>
                      <VoteBar totals={result.actual.totals} total={result.actual.totals.yes + result.actual.totals.no + result.actual.totals.abstain} />
                      <p className={`text-xs font-medium ${result.actual.passed ? "text-green-400" : "text-red-400"}`}>
                        {result.actual.passed ? "Passed" : "Failed"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Vote shifts from overrides */}
                {result.diffs.length > 0 && (
                  <div className="bg-white/5 rounded-xl border border-white/10 p-5 space-y-3">
                    <h4 className="text-xs uppercase tracking-wider text-[#c9a94e]">
                      Countries that shifted ({result.diffs.length})
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {result.diffs.map((d) => (
                        <div key={d.iso3} className="flex items-center gap-2 text-xs bg-white/[0.03] rounded-lg px-3 py-2">
                          <span className="text-gray-300">{d.name}</span>
                          <span className="text-gray-600">→</span>
                          <span className={
                            d.modifiedPrediction === "Yes" ? "text-green-400" :
                            d.modifiedPrediction === "No" ? "text-red-400" : "text-yellow-400"
                          }>
                            {d.modifiedPrediction}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.diffs.length === 0 && result.overridesApplied && (result.overridesApplied.attributeChanges + result.overridesApplied.edgesAdded > 0) && (
                  <div className="bg-white/5 rounded-xl border border-white/10 p-4">
                    <p className="text-xs text-gray-400">
                      No countries shifted their predicted vote with these overrides.
                      Try larger modifications or target countries near the decision boundary.
                    </p>
                  </div>
                )}

                {/* Full vote list */}
                <details className="bg-white/5 rounded-xl border border-white/10">
                  <summary className="px-5 py-3 cursor-pointer text-xs text-gray-400 hover:text-gray-300">
                    Show all 193 country predictions
                  </summary>
                  <div className="px-5 pb-4 grid grid-cols-2 md:grid-cols-4 gap-1 max-h-72 overflow-y-auto">
                    {result.modified.countryVotes
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((v) => (
                        <div key={v.iso3} className="flex items-center justify-between text-[11px] px-2 py-1">
                          <span className="text-gray-400 truncate">{v.name}</span>
                          <span className={
                            v.vote === "Yes" ? "text-green-400" :
                            v.vote === "No" ? "text-red-400" : "text-yellow-400"
                          }>
                            {v.vote}
                          </span>
                        </div>
                      ))}
                  </div>
                </details>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function VoteBar({ totals, total }: { totals: { yes: number; no: number; abstain: number }; total: number }) {
  return (
    <div className="space-y-1">
      <div className="flex h-3 rounded-full overflow-hidden bg-white/5">
        <div className="bg-green-500/70 transition-all" style={{ width: `${(totals.yes / total) * 100}%` }} />
        <div className="bg-red-500/70 transition-all" style={{ width: `${(totals.no / total) * 100}%` }} />
        <div className="bg-yellow-500/50 transition-all" style={{ width: `${(totals.abstain / total) * 100}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-gray-500">
        <span>{totals.yes}Y</span>
        <span>{totals.no}N</span>
        <span>{totals.abstain}A</span>
      </div>
    </div>
  );
}
