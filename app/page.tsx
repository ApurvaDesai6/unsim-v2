"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { COMMITTEES } from "@/engines/committees";
import type { Committee } from "@/types";

const COMMITTEE_LIST = Object.values(COMMITTEES);

interface HistoricalResolution {
  rcid: number;
  session: number;
  date: string;
  unres: string;
  title: string;
  description: string;
  topic: string;
  actualVote: { yes: number; no: number; abstain: number };
  passed: boolean;
  totalVoters: number;
}

const PRESETS = [
  {
    id: "climate-treaty",
    title: "Global Climate Accountability Treaty",
    description: "Binding emissions targets with financial penalties for non-compliance",
    committee: "GA_PLENARY" as Committee,
  },
  {
    id: "ai-governance",
    title: "International AI Governance Framework",
    description: "Establishing a UN body to regulate frontier AI development",
    committee: "GA_PLENARY" as Committee,
  },
  {
    id: "nuclear-ban",
    title: "Universal Nuclear Disarmament Resolution",
    description: "Complete elimination of nuclear weapons with verification regime",
    committee: "FIRST_COMMITTEE" as Committee,
  },
  {
    id: "sc-reform",
    title: "Security Council Expansion",
    description: "Adding 6 permanent members with modified veto rights",
    committee: "GA_PLENARY" as Committee,
  },
  {
    id: "cyber-norms",
    title: "Binding Cyber Warfare Norms",
    description: "Prohibiting state-sponsored cyberattacks on civilian infrastructure",
    committee: "SECURITY_COUNCIL" as Committee,
  },
  {
    id: "water-rights",
    title: "Universal Right to Clean Water",
    description: "Declaring clean water access a binding human right with enforcement mechanisms",
    committee: "THIRD_COMMITTEE" as Committee,
  },
];

const TOPIC_COLORS: Record<string, string> = {
  "Human rights": "bg-purple-500/10 text-purple-400 border-purple-500/20",
  "Economic development": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "Arms control and disarmament": "bg-red-500/10 text-red-400 border-red-500/20",
  "Colonialism": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  "Nuclear weapons and nuclear material": "bg-orange-500/10 text-orange-400 border-orange-500/20",
  "Palestinian conflict": "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

export default function LandingPage() {
  const router = useRouter();
  const [policyIdea, setPolicyIdea] = useState("");
  const [committee, setCommittee] = useState<Committee>("GA_PLENARY");
  const [mode, setMode] = useState<"presets" | "write" | "historical">("historical");
  const [resolutions, setResolutions] = useState<HistoricalResolution[]>([]);
  const [topicFilter, setTopicFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadResolutions() {
      try {
        const res = await fetch("/api/resolutions/featured");
        if (res.ok) {
          const data = await res.json();
          setResolutions(data);
        }
      } catch (e) {
        console.error("Failed to load resolutions:", e);
      } finally {
        setLoading(false);
      }
    }
    loadResolutions();
  }, []);

  const filteredResolutions = topicFilter
    ? resolutions.filter((r) => r.topic === topicFilter)
    : resolutions;

  const topics = [...new Set(resolutions.map((r) => r.topic))];

  const canSubmit = mode === "write" ? policyIdea.trim().length >= 20 : true;

  function handleSubmit(preset?: (typeof PRESETS)[0]) {
    const params = new URLSearchParams();
    if (preset) {
      params.set("preset", preset.id);
      params.set("committee", preset.committee);
    } else {
      params.set("policy", policyIdea);
      params.set("committee", committee);
    }
    router.push(`/simulate/new?${params.toString()}`);
  }

  function handleHistoricalSimulate(res: HistoricalResolution) {
    router.push(`/simulate/historical?rcid=${res.rcid}`);
  }

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative min-h-[70vh] flex flex-col items-center justify-center px-6">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background: "radial-gradient(ellipse at 50% 30%, var(--color-un-blue) 0%, transparent 60%)",
          }}
          aria-hidden
        />

        <div className="relative z-10 max-w-3xl w-full text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--color-border)] bg-white/60 backdrop-blur-sm text-xs font-medium text-[var(--color-muted)]">
            <span className="w-2 h-2 rounded-full bg-[var(--color-vote-yes)] animate-pulse-soft" />
            Powered by Real UNGA Voting Data
          </div>

          <h1
            className="text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.05]"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Simulate the
            <br />
            <span className="text-[var(--color-un-blue)]">United Nations</span>
          </h1>

          <p className="text-lg md:text-xl text-[var(--color-muted)] max-w-2xl mx-auto leading-relaxed">
            Test policies against a knowledge graph built from 75 years of voting records.
            Compare predictions to actual outcomes. Explore diplomatic relationships interactively.
          </p>

          <div className="flex justify-center gap-8 text-sm text-[var(--color-muted)]">
            <div>
              <span className="text-2xl font-semibold text-[var(--color-ink)] block">193</span>
              Countries
            </div>
            <div>
              <span className="text-2xl font-semibold text-[var(--color-ink)] block">303K+</span>
              Vote Records
            </div>
            <div>
              <span className="text-2xl font-semibold text-[var(--color-ink)] block">245</span>
              Historical Resolutions
            </div>
          </div>

          {/* Nav links */}
          <div className="flex justify-center gap-4 pt-4">
            <a
              href="/explore"
              className="px-5 py-2.5 rounded-lg border border-[var(--color-border)] text-sm font-medium text-[var(--color-ink)] hover:border-[var(--color-un-blue)] hover:text-[var(--color-un-blue)] transition-colors"
            >
              Explore Knowledge Graph
            </a>
            <a
              href="/sandbox"
              className="px-5 py-2.5 rounded-lg border border-[var(--color-border)] text-sm font-medium text-[var(--color-ink)] hover:border-[var(--color-un-blue)] hover:text-[var(--color-un-blue)] transition-colors"
            >
              What-If Sandbox
            </a>
            <a
              href="/methodology"
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors"
            >
              Methodology
            </a>
          </div>
        </div>
      </section>

      {/* Simulation Setup Section */}
      <section className="relative z-10 border-t border-[var(--color-border)] bg-white">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="text-[13px] font-medium text-[var(--color-muted)] tracking-tight mb-2">
            01 · Begin simulation
          </div>
          <h2
            className="text-3xl md:text-4xl font-semibold tracking-tight leading-[1.1] mb-8"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Choose your scenario
          </h2>

          {/* Mode Toggle */}
          <div className="flex gap-1 p-1 bg-[var(--color-bg)] rounded-lg w-fit mb-8">
            <button
              onClick={() => setMode("historical")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === "historical"
                  ? "bg-white text-[var(--color-ink)] shadow-sm"
                  : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              }`}
            >
              Historical Resolutions
            </button>
            <button
              onClick={() => setMode("presets")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === "presets"
                  ? "bg-white text-[var(--color-ink)] shadow-sm"
                  : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              }`}
            >
              Hypothetical Scenarios
            </button>
            <button
              onClick={() => setMode("write")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === "write"
                  ? "bg-white text-[var(--color-ink)] shadow-sm"
                  : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              }`}
            >
              Write Your Own
            </button>
          </div>

          {/* Historical Resolutions */}
          {mode === "historical" && (
            <div className="space-y-6">
              <p className="text-sm text-[var(--color-muted)]">
                Simulate these real UNGA resolutions and compare the knowledge graph&apos;s prediction against the actual historical vote.
              </p>

              {/* Topic filters */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setTopicFilter(null)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    !topicFilter
                      ? "border-[var(--color-un-blue)] bg-[var(--color-un-blue)]/10 text-[var(--color-un-blue)]"
                      : "border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-un-blue)]"
                  }`}
                >
                  All ({resolutions.length})
                </button>
                {topics.map((topic) => (
                  <button
                    key={topic}
                    onClick={() => setTopicFilter(topic)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      topicFilter === topic
                        ? "border-[var(--color-un-blue)] bg-[var(--color-un-blue)]/10 text-[var(--color-un-blue)]"
                        : "border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-un-blue)]"
                    }`}
                  >
                    {topic} ({resolutions.filter((r) => r.topic === topic).length})
                  </button>
                ))}
              </div>

              {/* Resolution grid */}
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-[var(--color-un-blue)] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredResolutions.slice(0, 30).map((res) => (
                    <button
                      key={res.rcid}
                      onClick={() => handleHistoricalSimulate(res)}
                      className="group text-left p-4 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-un-blue)] hover:shadow-md transition-all bg-white"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${TOPIC_COLORS[res.topic] || "bg-gray-100 text-gray-600"}`}>
                            {res.topic}
                          </span>
                          <span className="text-[10px] text-[var(--color-muted)]">
                            {res.date.substring(0, 4)}
                          </span>
                        </div>
                        <h3 className="text-sm font-medium text-[var(--color-ink)] group-hover:text-[var(--color-un-blue)] transition-colors line-clamp-2">
                          {res.title}
                        </h3>
                        <p className="text-[11px] text-[var(--color-muted)] line-clamp-2">
                          {res.description}
                        </p>

                        {/* Actual vote bar */}
                        <div className="pt-2 space-y-1">
                          <div className="flex h-1.5 rounded-full overflow-hidden bg-[var(--color-bg)]">
                            <div
                              className="bg-[var(--color-vote-yes)]"
                              style={{ width: `${(res.actualVote.yes / res.totalVoters) * 100}%` }}
                            />
                            <div
                              className="bg-[var(--color-vote-no)]"
                              style={{ width: `${(res.actualVote.no / res.totalVoters) * 100}%` }}
                            />
                            <div
                              className="bg-[var(--color-vote-abstain)]"
                              style={{ width: `${(res.actualVote.abstain / res.totalVoters) * 100}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-[var(--color-vote-yes)]">
                              {res.actualVote.yes}Y
                            </span>
                            <span className={res.passed ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                              {res.passed ? "Passed" : "Failed"}
                            </span>
                            <span className="text-[var(--color-vote-no)]">
                              {res.actualVote.no}N
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {filteredResolutions.length > 30 && (
                <p className="text-center text-xs text-[var(--color-muted)]">
                  Showing 30 of {filteredResolutions.length} resolutions
                </p>
              )}
            </div>
          )}

          {/* Presets */}
          {mode === "presets" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleSubmit(preset)}
                  className="group text-left p-5 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-un-blue)] hover:shadow-md transition-all bg-white"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium text-[var(--color-ink)] group-hover:text-[var(--color-un-blue)] transition-colors">
                        {preset.title}
                      </h3>
                      <p className="text-sm text-[var(--color-muted)] mt-1">
                        {preset.description}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs px-2 py-0.5 rounded bg-[var(--color-bg)] text-[var(--color-muted)] font-medium">
                      {COMMITTEES[preset.committee].shortName}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Write your own */}
          {mode === "write" && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <label htmlFor="policy-idea" className="block text-sm font-medium text-[var(--color-ink)] mb-2">
                  Your policy idea
                </label>
                <textarea
                  id="policy-idea"
                  value={policyIdea}
                  onChange={(e) => setPolicyIdea(e.target.value)}
                  placeholder="A binding international treaty establishing liability frameworks for autonomous AI systems that cause cross-border harm..."
                  className="w-full h-36 px-4 py-3 rounded-xl border border-[var(--color-border)] bg-white text-[var(--color-ink)] placeholder:text-[var(--color-muted)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--color-un-blue)]/30 focus:border-[var(--color-un-blue)] resize-none text-[15px] leading-relaxed"
                />
              </div>
              <div>
                <label htmlFor="committee-select" className="block text-sm font-medium text-[var(--color-ink)] mb-2">
                  UN Committee
                </label>
                <select
                  id="committee-select"
                  value={committee}
                  onChange={(e) => setCommittee(e.target.value as Committee)}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-white text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-un-blue)]/30 focus:border-[var(--color-un-blue)] text-[15px]"
                >
                  {COMMITTEE_LIST.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.description.slice(0, 60)}...
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => handleSubmit()}
                disabled={!canSubmit}
                className="w-full py-3.5 rounded-xl bg-[var(--color-un-blue)] text-white font-medium hover:bg-[var(--color-un-blue-dark)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-[15px]"
              >
                Generate Resolution & Simulate
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Capabilities Section */}
      <section className="border-t border-[var(--color-border)] bg-[var(--color-bg)]">
        <div className="max-w-4xl mx-auto px-6 py-20">
          <div className="text-[13px] font-medium text-[var(--color-muted)] tracking-tight mb-2">
            02 · How it works
          </div>
          <h2
            className="text-3xl md:text-4xl font-semibold tracking-tight leading-[1.1] mb-12"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            From policy idea to vote
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Knowledge Graph",
                desc: "303K+ vote edges, 193 country nodes, temporal alliance data, and bloc dynamics — all queryable in real-time.",
              },
              {
                step: "02",
                title: "Position Prediction",
                desc: "Topic voting history (35%) + alliance signals (20%) + policy dimensions (20%) + ideal points (15%) + bloc pressure (10%).",
              },
              {
                step: "03",
                title: "Compare & Explore",
                desc: "See predicted vs actual outcomes side-by-side. Modify the graph with the Ontology Manager to test hypotheticals.",
              },
            ].map((item) => (
              <div key={item.step} className="space-y-3">
                <span className="text-xs font-semibold text-[var(--color-un-blue)]">{item.step}</span>
                <h3 className="text-lg font-medium">{item.title}</h3>
                <p className="text-sm text-[var(--color-muted)] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border)] bg-white">
        <div className="max-w-4xl mx-auto px-6 py-8 flex items-center justify-between text-xs text-[var(--color-muted)]">
          <span>UNSim — Educational Simulation Platform</span>
          <div className="flex items-center gap-4">
            <a href="/explore" className="hover:text-[var(--color-ink)]">Knowledge Graph</a>
            <a href="/sandbox" className="hover:text-[var(--color-ink)]">What-If Sandbox</a>
            <a href="/methodology" className="hover:text-[var(--color-ink)]">Methodology</a>
            <span>Data: Voeten UNGA Votes, V-Dem v14</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
