"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import OntologyManager from "@/components/ontology/OntologyManager";
import type { OntologyOverrides } from "@/components/ontology/OntologyManager";
import TemporalDrift from "@/components/viz/TemporalDrift";

const AllianceGraph = dynamic(() => import("@/components/viz/AllianceGraph"), { ssr: false });

interface CountryDetail {
  country: {
    name: string;
    iso3: string;
    region: string;
    idealPoint: number;
    democracyIndex: number;
    governmentType: string;
  };
  allies: { iso3: string; name: string; similarity: number }[];
  rivals: { iso3: string; name: string; similarity: number }[];
  blocs: string[];
  votingPatterns: { topic: string; yesRate: number; noRate: number; abstainRate: number; sampleSize: number }[];
  temporalTrends: Record<string, { decade: string; yesRate: number; noRate: number; abstainRate: number; sampleSize: number }[]>;
}

const REGIONS = ["WEOG", "EEG", "AFRICAN", "APG", "GRULAC"];
const REGION_LABELS: Record<string, string> = {
  WEOG: "Western European & Others",
  EEG: "Eastern European",
  AFRICAN: "African",
  APG: "Asia-Pacific",
  GRULAC: "Latin American & Caribbean",
};

const EXISTING_BLOCS = [
  { id: "G77", name: "G77 + China" },
  { id: "NAM", name: "Non-Aligned Movement" },
  { id: "EU", name: "European Union" },
  { id: "AG", name: "African Group" },
  { id: "AOSIS", name: "Small Island States" },
  { id: "Arab", name: "Arab Group" },
  { id: "CARICOM", name: "Caribbean Community" },
];

export default function ExplorePage() {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [countryDetail, setCountryDetail] = useState<CountryDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeRegions, setActiveRegions] = useState<string[]>(REGIONS);
  const [minSimilarity, setMinSimilarity] = useState(0.9);
  const [countries, setCountries] = useState<{ iso3: string; name: string }[]>([]);
  const [ontologyOverrides, setOntologyOverrides] = useState<OntologyOverrides>({
    nodes: [], edges: [], modifiedAttributes: {},
  });
  const [activePanel, setActivePanel] = useState<"graph" | "temporal">("graph");

  // Load country list on mount
  useEffect(() => {
    async function loadCountries() {
      try {
        const res = await fetch("/api/graph/alliance-network");
        if (res.ok) {
          const data = await res.json();
          const countryNodes = data.nodes
            .filter((n: { nodeType: string }) => n.nodeType === "country")
            .map((n: { id: string; label: string }) => ({ iso3: n.id, name: n.label }))
            .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));
          setCountries(countryNodes);
        }
      } catch (e) {
        console.error("Failed to load countries:", e);
      }
    }
    loadCountries();
  }, []);

  useEffect(() => {
    if (!selectedCountry) {
      setCountryDetail(null);
      return;
    }

    async function loadDetail() {
      setLoadingDetail(true);
      try {
        const res = await fetch(`/api/graph/country/${selectedCountry}`);
        if (res.ok) {
          const data = await res.json();
          setCountryDetail(data);
        }
      } catch (e) {
        console.error("Failed to load country detail:", e);
      } finally {
        setLoadingDetail(false);
      }
    }
    loadDetail();
  }, [selectedCountry]);

  const toggleRegion = useCallback((region: string) => {
    setActiveRegions((prev) =>
      prev.includes(region)
        ? prev.filter((r) => r !== region)
        : [...prev, region],
    );
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/30 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/" className="text-sm text-gray-400 hover:text-white transition-colors">
              &larr; Home
            </a>
            <div className="h-4 w-px bg-white/20" />
            <h1 className="text-lg font-semibold" style={{ fontFamily: "var(--font-serif, Georgia)" }}>
              Knowledge Graph Explorer
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">
              193 countries · 303K+ vote records · 6 topics
            </span>
            <span className="text-xs px-2.5 py-1 rounded-full border border-[#4b92db]/30 bg-[#4b92db]/10 text-[#4b92db]">
              {activeRegions.length === 5 ? "All Regions" : `${activeRegions.length} Regions`}
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left panel — Controls + Ontology */}
          <div className="lg:col-span-1 space-y-4">
            {/* Region filter */}
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <h3 className="text-xs uppercase tracking-wider text-gray-400 mb-3">Filter by Region</h3>
              <div className="space-y-2">
                {REGIONS.map((region) => (
                  <label key={region} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={activeRegions.includes(region)}
                      onChange={() => toggleRegion(region)}
                      className="rounded border-white/30 bg-white/10 text-[#4b92db] focus:ring-[#4b92db]"
                    />
                    <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                      {REGION_LABELS[region]}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Similarity threshold */}
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <h3 className="text-xs uppercase tracking-wider text-gray-400 mb-3">Alliance Threshold</h3>
              <input
                type="range"
                min={0.8}
                max={0.99}
                step={0.01}
                value={minSimilarity}
                onChange={(e) => setMinSimilarity(parseFloat(e.target.value))}
                className="w-full accent-[#4b92db]"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Broad</span>
                <span className="text-[#4b92db]">{minSimilarity.toFixed(2)}</span>
                <span>Tight</span>
              </div>
            </div>

            {/* Ontology Manager */}
            <OntologyManager
              overrides={ontologyOverrides}
              onChange={setOntologyOverrides}
              existingCountries={countries}
              existingBlocs={EXISTING_BLOCS}
            />
          </div>

          {/* Main content area */}
          <div className="lg:col-span-3 space-y-6">
            {/* Graph visualization */}
            <div className="rounded-xl overflow-hidden border border-white/10" style={{ height: 520 }}>
              <AllianceGraph
                onCountrySelect={setSelectedCountry}
                selectedCountry={selectedCountry}
                filter={{ regions: activeRegions, minSimilarity }}
              />
            </div>

            {/* Country detail panel */}
            {selectedCountry && (
              <div className="bg-white/5 rounded-xl border border-white/10 p-6">
                {loadingDetail ? (
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-[#4b92db] border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-gray-400">Loading country data from knowledge graph...</span>
                  </div>
                ) : countryDetail ? (
                  <div className="space-y-6">
                    {/* Country header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-xl font-semibold">{countryDetail.country.name}</h2>
                        <p className="text-sm text-gray-400 mt-1">
                          {REGION_LABELS[countryDetail.country.region]} · {countryDetail.country.governmentType} · Democracy: {countryDetail.country.democracyIndex.toFixed(2)}
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedCountry(null)}
                        className="text-gray-500 hover:text-white text-xl leading-none"
                      >
                        &times;
                      </button>
                    </div>

                    {/* Ideal point spectrum */}
                    <div>
                      <p className="text-xs text-gray-400 mb-2">Ideological Position (Voeten Ideal Point: {countryDetail.country.idealPoint.toFixed(2)})</p>
                      <div className="relative h-3 bg-gradient-to-r from-blue-600 via-gray-500 to-red-600 rounded-full">
                        <div
                          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full border-2 border-[#4b92db] shadow-lg"
                          style={{ left: `${((countryDetail.country.idealPoint + 1) / 2) * 100}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                        <span>Western-aligned (-1)</span>
                        <span>Global South-aligned (+1)</span>
                      </div>
                    </div>

                    {/* Tab toggle for graph vs temporal */}
                    <div className="flex gap-1 p-0.5 bg-white/5 rounded-lg w-fit">
                      <button
                        onClick={() => setActivePanel("graph")}
                        className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
                          activePanel === "graph" ? "bg-[#4b92db]/20 text-[#4b92db]" : "text-gray-400 hover:text-gray-300"
                        }`}
                      >
                        Allies & Patterns
                      </button>
                      <button
                        onClick={() => setActivePanel("temporal")}
                        className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
                          activePanel === "temporal" ? "bg-[#4b92db]/20 text-[#4b92db]" : "text-gray-400 hover:text-gray-300"
                        }`}
                      >
                        Temporal Drift
                      </button>
                    </div>

                    {activePanel === "graph" && (
                      <>
                        {/* Allies & Rivals */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <h4 className="text-xs uppercase tracking-wider text-gray-400 mb-2">Closest Allies (by vote similarity)</h4>
                            <div className="space-y-1">
                              {countryDetail.allies.slice(0, 5).map((ally) => (
                                <div
                                  key={ally.iso3}
                                  className="flex items-center justify-between text-sm cursor-pointer hover:bg-white/5 rounded px-2 py-1"
                                  onClick={() => setSelectedCountry(ally.iso3)}
                                >
                                  <span className="text-gray-300">{ally.name}</span>
                                  <span className="text-xs text-green-400">{(ally.similarity * 100).toFixed(0)}%</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <h4 className="text-xs uppercase tracking-wider text-gray-400 mb-2">Most Opposed (by vote divergence)</h4>
                            <div className="space-y-1">
                              {countryDetail.rivals.slice(0, 5).map((rival) => (
                                <div
                                  key={rival.iso3}
                                  className="flex items-center justify-between text-sm cursor-pointer hover:bg-white/5 rounded px-2 py-1"
                                  onClick={() => setSelectedCountry(rival.iso3)}
                                >
                                  <span className="text-gray-300">{rival.name}</span>
                                  <span className="text-xs text-red-400">{(rival.similarity * 100).toFixed(0)}%</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Voting patterns by topic */}
                        <div>
                          <h4 className="text-xs uppercase tracking-wider text-gray-400 mb-3">Voting Patterns by Topic (Sessions 55–74)</h4>
                          <div className="space-y-2">
                            {countryDetail.votingPatterns.map((pattern) => (
                              <div key={pattern.topic} className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-300">{pattern.topic}</span>
                                  <span className="text-[10px] text-gray-500">n={pattern.sampleSize}</span>
                                </div>
                                <div className="flex h-2 rounded-full overflow-hidden bg-white/5">
                                  <div className="bg-green-500" style={{ width: `${pattern.yesRate * 100}%` }} />
                                  <div className="bg-red-500" style={{ width: `${pattern.noRate * 100}%` }} />
                                  <div className="bg-yellow-500" style={{ width: `${pattern.abstainRate * 100}%` }} />
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-500">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />Yes</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />No</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" />Abstain</span>
                          </div>
                        </div>

                        {/* Bloc memberships */}
                        {countryDetail.blocs.length > 0 && (
                          <div>
                            <h4 className="text-xs uppercase tracking-wider text-gray-400 mb-2">Bloc Memberships</h4>
                            <div className="flex flex-wrap gap-2">
                              {countryDetail.blocs.map((bloc) => (
                                <span
                                  key={bloc}
                                  className="text-xs px-2.5 py-1 rounded-full bg-[#4b92db]/10 border border-[#4b92db]/30 text-[#4b92db]"
                                >
                                  {bloc}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {activePanel === "temporal" && countryDetail.temporalTrends && (
                      <TemporalDrift
                        data={countryDetail.temporalTrends}
                        countryName={countryDetail.country.name}
                      />
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">Country not found in knowledge graph.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
