"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import VoteComparison from "@/components/viz/VoteComparison";
import Hemicycle from "@/components/viz/Hemicycle";
import type { CountryVote } from "@/types";

interface HistoricalResult {
  resolution: {
    rcid: number;
    title: string;
    description: string;
    date: string;
    session: number;
    unres: string;
    topic: string;
  };
  predicted: {
    totals: { yes: number; no: number; abstain: number };
    passed: boolean;
    countryVotes: CountryVote[];
  };
  actual: {
    totals: { yes: number; no: number; abstain: number };
    passed: boolean;
    totalVoters: number;
  };
}

const TOPIC_COLORS: Record<string, string> = {
  "Human rights": "text-purple-400",
  "Economic development": "text-emerald-400",
  "Arms control and disarmament": "text-red-400",
  "Colonialism": "text-amber-400",
  "Nuclear weapons and nuclear material": "text-orange-400",
  "Palestinian conflict": "text-blue-400",
};

function HistoricalView() {
  const searchParams = useSearchParams();
  const rcid = searchParams.get("rcid");

  const [result, setResult] = useState<HistoricalResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"comparison" | "predicted" | "details">("comparison");

  useEffect(() => {
    if (!rcid) {
      setError("No resolution specified");
      setLoading(false);
      return;
    }

    async function simulate() {
      try {
        const res = await fetch("/api/simulate/historical", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rcid: parseInt(rcid!) }),
        });
        if (!res.ok) throw new Error("Simulation failed");
        const data = await res.json();
        setResult(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to simulate");
      } finally {
        setLoading(false);
      }
    }

    simulate();
  }, [rcid]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0f1a]">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-2 border-[#4b92db] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-400">Running knowledge graph simulation...</p>
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0f1a]">
        <div className="text-center space-y-4">
          <p className="text-red-400">{error || "No results"}</p>
          <a href="/" className="text-sm text-[#4b92db] hover:underline">Back to home</a>
        </div>
      </div>
    );
  }

  const selectedVote = selectedCountry
    ? result.predicted.countryVotes.find((v) => v.iso3 === selectedCountry)
    : null;

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/30 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/" className="text-sm text-gray-400 hover:text-white">&larr; Home</a>
            <div className="h-4 w-px bg-white/20" />
            <div>
              <h1 className="text-sm font-medium text-white line-clamp-1">{result.resolution.title}</h1>
              <p className="text-[11px] text-gray-400">
                {result.resolution.unres} · {result.resolution.date} · Session {result.resolution.session}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs ${TOPIC_COLORS[result.resolution.topic] || "text-gray-400"}`}>
              {result.resolution.topic}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400">
              Historical Comparison
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Vote Comparison */}
        <div className="mb-8">
          <VoteComparison
            predicted={result.predicted.totals}
            actual={result.actual.totals}
            predictedPassed={result.predicted.passed}
            actualPassed={result.actual.passed}
            title="Knowledge Graph Prediction vs Actual Outcome"
          />
        </div>

        {/* View toggle */}
        <div className="flex gap-1 p-1 bg-white/5 rounded-lg w-fit mb-6">
          {(["comparison", "predicted", "details"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-4 py-2 rounded-md text-xs font-medium transition-colors ${
                viewMode === mode
                  ? "bg-[#4b92db]/20 text-[#4b92db]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {mode === "comparison" ? "Hemicycle" : mode === "predicted" ? "Country List" : "Factor Analysis"}
            </button>
          ))}
        </div>

        {/* Hemicycle view */}
        {viewMode === "comparison" && (
          <div className="bg-white/5 rounded-xl border border-white/10 p-6">
            <p className="text-xs text-gray-400 mb-4">
              Knowledge graph prediction — click a seat to see detailed factors
            </p>
            <Hemicycle
              votes={result.predicted.countryVotes}
              revealedCount={result.predicted.countryVotes.length}
              onCountryClick={setSelectedCountry}
            />
          </div>
        )}

        {/* Country list view */}
        {viewMode === "predicted" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Yes voters */}
            <div className="bg-white/5 rounded-xl border border-white/10 p-4">
              <h3 className="text-sm font-medium text-green-400 mb-3">
                Yes ({result.predicted.totals.yes})
              </h3>
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {result.predicted.countryVotes
                  .filter((v) => v.vote === "Yes")
                  .sort((a, b) => b.confidence - a.confidence)
                  .map((v) => (
                    <button
                      key={v.iso3}
                      onClick={() => setSelectedCountry(v.iso3)}
                      className="w-full flex items-center justify-between text-xs px-2 py-1.5 rounded hover:bg-white/5"
                    >
                      <span className="text-gray-300">{v.name}</span>
                      <span className="text-green-400/70">{(v.confidence * 100).toFixed(0)}%</span>
                    </button>
                  ))}
              </div>
            </div>

            {/* No voters */}
            <div className="bg-white/5 rounded-xl border border-white/10 p-4">
              <h3 className="text-sm font-medium text-red-400 mb-3">
                No ({result.predicted.totals.no})
              </h3>
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {result.predicted.countryVotes
                  .filter((v) => v.vote === "No")
                  .sort((a, b) => b.confidence - a.confidence)
                  .map((v) => (
                    <button
                      key={v.iso3}
                      onClick={() => setSelectedCountry(v.iso3)}
                      className="w-full flex items-center justify-between text-xs px-2 py-1.5 rounded hover:bg-white/5"
                    >
                      <span className="text-gray-300">{v.name}</span>
                      <span className="text-red-400/70">{(v.confidence * 100).toFixed(0)}%</span>
                    </button>
                  ))}
              </div>
            </div>

            {/* Abstain */}
            <div className="bg-white/5 rounded-xl border border-white/10 p-4">
              <h3 className="text-sm font-medium text-yellow-400 mb-3">
                Abstain ({result.predicted.totals.abstain})
              </h3>
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {result.predicted.countryVotes
                  .filter((v) => v.vote === "Abstain")
                  .sort((a, b) => b.confidence - a.confidence)
                  .map((v) => (
                    <button
                      key={v.iso3}
                      onClick={() => setSelectedCountry(v.iso3)}
                      className="w-full flex items-center justify-between text-xs px-2 py-1.5 rounded hover:bg-white/5"
                    >
                      <span className="text-gray-300">{v.name}</span>
                      <span className="text-yellow-400/70">{(v.confidence * 100).toFixed(0)}%</span>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Factor analysis view */}
        {viewMode === "details" && (
          <div className="bg-white/5 rounded-xl border border-white/10 p-6 space-y-4">
            <h3 className="text-sm font-medium text-white">Resolution Details</h3>
            <p className="text-xs text-gray-400 leading-relaxed">{result.resolution.description}</p>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Model Accuracy</p>
                <p className="text-lg font-semibold">
                  {result.predicted.passed === result.actual.passed ? (
                    <span className="text-green-400">Outcome Correct</span>
                  ) : (
                    <span className="text-red-400">Outcome Wrong</span>
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Yes% error: {Math.abs(
                    (result.predicted.totals.yes / 193) -
                    (result.actual.totals.yes / result.actual.totalVoters)
                  ).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Data Sources</p>
                <ul className="text-xs text-gray-400 space-y-1">
                  <li>• Voeten UNGA Voting Data (sessions 55–74)</li>
                  <li>• Vote Similarity Matrix (181 countries)</li>
                  <li>• Bloc Coordination (7 blocs)</li>
                  <li>• Policy Dimension Alignment (6 dimensions)</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Selected country detail */}
        {selectedVote && (
          <div className="mt-6 bg-white/5 rounded-xl border border-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-white">{selectedVote.name} — Prediction Factors</h3>
              <button
                onClick={() => setSelectedCountry(null)}
                className="text-gray-400 hover:text-white text-lg"
              >
                &times;
              </button>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <span className={`text-sm font-medium ${
                selectedVote.vote === "Yes" ? "text-green-400" :
                selectedVote.vote === "No" ? "text-red-400" : "text-yellow-400"
              }`}>
                Predicted: {selectedVote.vote}
              </span>
              <span className="text-xs text-gray-500">
                Confidence: {(selectedVote.confidence * 100).toFixed(0)}%
              </span>
            </div>
            <div className="space-y-3">
              {selectedVote.factors.map((factor) => (
                <div key={factor.name} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-300">{factor.name} ({(factor.weight * 100).toFixed(0)}%)</span>
                    <span className={`text-xs font-mono ${factor.score > 0 ? "text-green-400" : factor.score < 0 ? "text-red-400" : "text-gray-400"}`}>
                      {factor.score > 0 ? "+" : ""}{factor.score.toFixed(3)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${factor.score > 0 ? "bg-green-500/60" : "bg-red-500/60"}`}
                      style={{ width: `${Math.abs(factor.score) * 50 + 50}%`, marginLeft: factor.score < 0 ? `${50 - Math.abs(factor.score) * 50}%` : "50%" }}
                    />
                  </div>
                  <p className="text-[10px] text-gray-500">{factor.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HistoricalSimulationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#0a0f1a]">
          <div className="w-10 h-10 border-2 border-[#4b92db] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <HistoricalView />
    </Suspense>
  );
}
