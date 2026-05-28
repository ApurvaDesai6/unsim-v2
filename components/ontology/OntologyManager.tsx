"use client";

import { useState, useCallback } from "react";

export interface CustomNode {
  id: string;
  type: "country" | "bloc" | "treaty";
  label: string;
  attributes: Record<string, number | string>;
}

export interface CustomEdge {
  id: string;
  source: string;
  target: string;
  type: "ALLIES_WITH" | "RIVALS_WITH" | "MEMBER_OF" | "SIGNED";
  weight: number;
  label?: string;
}

export interface OntologyOverrides {
  nodes: CustomNode[];
  edges: CustomEdge[];
  modifiedAttributes: Record<string, Record<string, number>>; // nodeId → { attrName → newValue }
}

interface OntologyManagerProps {
  overrides: OntologyOverrides;
  onChange: (overrides: OntologyOverrides) => void;
  existingCountries: { iso3: string; name: string }[];
  existingBlocs: { id: string; name: string }[];
}

type TabId = "modify" | "add-edge" | "add-node";

export default function OntologyManager({
  overrides,
  onChange,
  existingCountries,
  existingBlocs,
}: OntologyManagerProps) {
  const [activeTab, setActiveTab] = useState<TabId>("modify");
  const [expanded, setExpanded] = useState(true);

  // Edge creation state
  const [newEdgeSource, setNewEdgeSource] = useState("");
  const [newEdgeTarget, setNewEdgeTarget] = useState("");
  const [newEdgeType, setNewEdgeType] = useState<CustomEdge["type"]>("ALLIES_WITH");
  const [newEdgeWeight, setNewEdgeWeight] = useState(0.9);

  // Attribute modification state
  const [modifyCountry, setModifyCountry] = useState("");
  const [modifyAttr, setModifyAttr] = useState("idealPoint");
  const [modifyValue, setModifyValue] = useState(0);

  // Node creation state
  const [newNodeType, setNewNodeType] = useState<"country" | "bloc">("country");
  const [newNodeLabel, setNewNodeLabel] = useState("");
  const [newNodeRegion, setNewNodeRegion] = useState("APG");
  const [newNodeIdealPoint, setNewNodeIdealPoint] = useState(0);

  const addEdge = useCallback(() => {
    if (!newEdgeSource || !newEdgeTarget || newEdgeSource === newEdgeTarget) return;
    const edge: CustomEdge = {
      id: `custom-edge-${Date.now()}`,
      source: newEdgeSource,
      target: newEdgeTarget,
      type: newEdgeType,
      weight: newEdgeWeight,
      label: `${newEdgeType} (${newEdgeWeight.toFixed(2)})`,
    };
    onChange({ ...overrides, edges: [...overrides.edges, edge] });
    setNewEdgeSource("");
    setNewEdgeTarget("");
  }, [newEdgeSource, newEdgeTarget, newEdgeType, newEdgeWeight, overrides, onChange]);

  const modifyAttribute = useCallback(() => {
    if (!modifyCountry) return;
    const key = `country:${modifyCountry}`;
    const existing = overrides.modifiedAttributes[key] || {};
    onChange({
      ...overrides,
      modifiedAttributes: {
        ...overrides.modifiedAttributes,
        [key]: { ...existing, [modifyAttr]: modifyValue },
      },
    });
  }, [modifyCountry, modifyAttr, modifyValue, overrides, onChange]);

  const addNode = useCallback(() => {
    if (!newNodeLabel) return;
    const id = `custom-${newNodeType}-${newNodeLabel.toLowerCase().replace(/\s+/g, "-")}`;
    const node: CustomNode = {
      id,
      type: newNodeType,
      label: newNodeLabel,
      attributes: newNodeType === "country"
        ? { region: newNodeRegion, idealPoint: newNodeIdealPoint, democracyIndex: 0.5 }
        : { cohesionScore: 0.5 },
    };
    onChange({ ...overrides, nodes: [...overrides.nodes, node] });
    setNewNodeLabel("");
  }, [newNodeType, newNodeLabel, newNodeRegion, newNodeIdealPoint, overrides, onChange]);

  const removeEdge = (id: string) => {
    onChange({ ...overrides, edges: overrides.edges.filter((e) => e.id !== id) });
  };

  const removeNode = (id: string) => {
    onChange({
      ...overrides,
      nodes: overrides.nodes.filter((n) => n.id !== id),
      edges: overrides.edges.filter((e) => e.source !== id && e.target !== id),
    });
  };

  const clearModification = (nodeId: string, attr: string) => {
    const updated = { ...overrides.modifiedAttributes };
    if (updated[nodeId]) {
      delete updated[nodeId][attr];
      if (Object.keys(updated[nodeId]).length === 0) delete updated[nodeId];
    }
    onChange({ ...overrides, modifiedAttributes: updated });
  };

  const totalOverrides =
    overrides.nodes.length + overrides.edges.length + Object.keys(overrides.modifiedAttributes).length;

  return (
    <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-[#c9a94e]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
          </svg>
          <span className="text-sm font-medium text-white">Ontology Manager</span>
          {totalOverrides > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#c9a94e]/20 text-[#c9a94e] border border-[#c9a94e]/30">
              {totalOverrides} override{totalOverrides > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <span className="text-gray-500 text-xs">{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded && (
        <div className="border-t border-white/10 px-4 py-3 space-y-4">
          <p className="text-[11px] text-gray-400 leading-relaxed">
            Modify the knowledge graph to test hypothetical scenarios. Add alliances, change country
            positions, or create custom entities. Changes affect simulation predictions in real-time.
          </p>

          {/* Tabs */}
          <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
            {([
              { id: "modify" as const, label: "Modify" },
              { id: "add-edge" as const, label: "Add Relationship" },
              { id: "add-node" as const, label: "Add Entity" },
            ]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 text-[11px] py-1.5 rounded-md transition-colors ${
                  activeTab === tab.id
                    ? "bg-[#4b92db]/20 text-[#4b92db] font-medium"
                    : "text-gray-400 hover:text-gray-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Modify tab */}
          {activeTab === "modify" && (
            <div className="space-y-3">
              <select
                value={modifyCountry}
                onChange={(e) => setModifyCountry(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="">Select country...</option>
                {existingCountries.map((c) => (
                  <option key={c.iso3} value={c.iso3}>{c.name}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={modifyAttr}
                  onChange={(e) => setModifyAttr(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                >
                  <option value="idealPoint">Ideal Point</option>
                  <option value="democracyIndex">Democracy Index</option>
                  <option value="sovereignty">Sovereignty</option>
                  <option value="humanRights">Human Rights</option>
                  <option value="development">Development</option>
                  <option value="environment">Environment</option>
                </select>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={-1}
                    max={1}
                    step={0.05}
                    value={modifyValue}
                    onChange={(e) => setModifyValue(parseFloat(e.target.value))}
                    className="flex-1 accent-[#4b92db]"
                  />
                  <span className="text-xs text-gray-400 w-8">{modifyValue.toFixed(2)}</span>
                </div>
              </div>
              <button
                onClick={modifyAttribute}
                disabled={!modifyCountry}
                className="w-full bg-[#4b92db]/20 text-[#4b92db] text-xs py-2 rounded-lg hover:bg-[#4b92db]/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Apply Modification
              </button>
            </div>
          )}

          {/* Add edge tab */}
          {activeTab === "add-edge" && (
            <div className="space-y-3">
              <select
                value={newEdgeSource}
                onChange={(e) => setNewEdgeSource(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="">Source country...</option>
                {existingCountries.map((c) => (
                  <option key={c.iso3} value={c.iso3}>{c.name}</option>
                ))}
              </select>
              <select
                value={newEdgeType}
                onChange={(e) => setNewEdgeType(e.target.value as CustomEdge["type"])}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="ALLIES_WITH">Allies With</option>
                <option value="RIVALS_WITH">Rivals With</option>
                <option value="MEMBER_OF">Member Of</option>
              </select>
              <select
                value={newEdgeTarget}
                onChange={(e) => setNewEdgeTarget(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="">Target...</option>
                {newEdgeType === "MEMBER_OF"
                  ? existingBlocs.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)
                  : existingCountries.map((c) => <option key={c.iso3} value={c.iso3}>{c.name}</option>)
                }
              </select>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Strength:</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={newEdgeWeight}
                  onChange={(e) => setNewEdgeWeight(parseFloat(e.target.value))}
                  className="flex-1 accent-[#4b92db]"
                />
                <span className="text-xs text-gray-400 w-8">{newEdgeWeight.toFixed(2)}</span>
              </div>
              <button
                onClick={addEdge}
                disabled={!newEdgeSource || !newEdgeTarget}
                className="w-full bg-[#4b92db]/20 text-[#4b92db] text-xs py-2 rounded-lg hover:bg-[#4b92db]/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Add Relationship
              </button>
            </div>
          )}

          {/* Add node tab */}
          {activeTab === "add-node" && (
            <div className="space-y-3">
              <select
                value={newNodeType}
                onChange={(e) => setNewNodeType(e.target.value as "country" | "bloc")}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="country">Country / Entity</option>
                <option value="bloc">Voting Bloc</option>
              </select>
              <input
                type="text"
                value={newNodeLabel}
                onChange={(e) => setNewNodeLabel(e.target.value)}
                placeholder={newNodeType === "country" ? "Entity name (e.g., Taiwan)" : "Bloc name (e.g., BRICS+)"}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600"
              />
              {newNodeType === "country" && (
                <>
                  <select
                    value={newNodeRegion}
                    onChange={(e) => setNewNodeRegion(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="APG">Asia-Pacific</option>
                    <option value="WEOG">Western European & Others</option>
                    <option value="EEG">Eastern European</option>
                    <option value="AFRICAN">African</option>
                    <option value="GRULAC">Latin American & Caribbean</option>
                  </select>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 whitespace-nowrap">Ideal Point:</span>
                    <input
                      type="range"
                      min={-1}
                      max={1}
                      step={0.05}
                      value={newNodeIdealPoint}
                      onChange={(e) => setNewNodeIdealPoint(parseFloat(e.target.value))}
                      className="flex-1 accent-[#4b92db]"
                    />
                    <span className="text-xs text-gray-400 w-8">{newNodeIdealPoint.toFixed(2)}</span>
                  </div>
                </>
              )}
              <button
                onClick={addNode}
                disabled={!newNodeLabel}
                className="w-full bg-[#4b92db]/20 text-[#4b92db] text-xs py-2 rounded-lg hover:bg-[#4b92db]/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Add to Graph
              </button>
            </div>
          )}

          {/* Active overrides */}
          {totalOverrides > 0 && (
            <div className="border-t border-white/10 pt-3 space-y-2">
              <h4 className="text-[10px] uppercase tracking-wider text-gray-400">Active Overrides</h4>

              {overrides.nodes.map((node) => (
                <div key={node.id} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                  <span className="text-xs text-white">
                    <span className="text-[#c9a94e]">+</span> {node.label} ({node.type})
                  </span>
                  <button onClick={() => removeNode(node.id)} className="text-red-400 text-xs hover:text-red-300">&times;</button>
                </div>
              ))}

              {overrides.edges.map((edge) => (
                <div key={edge.id} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                  <span className="text-xs text-white">
                    <span className="text-[#4b92db]">↔</span> {edge.source} → {edge.target} ({edge.type})
                  </span>
                  <button onClick={() => removeEdge(edge.id)} className="text-red-400 text-xs hover:text-red-300">&times;</button>
                </div>
              ))}

              {Object.entries(overrides.modifiedAttributes).map(([nodeId, attrs]) =>
                Object.entries(attrs).map(([attr, val]) => (
                  <div key={`${nodeId}-${attr}`} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                    <span className="text-xs text-white">
                      <span className="text-yellow-400">✎</span> {nodeId.replace("country:", "")}.{attr} = {(val as number).toFixed(2)}
                    </span>
                    <button onClick={() => clearModification(nodeId, attr)} className="text-red-400 text-xs hover:text-red-300">&times;</button>
                  </div>
                ))
              )}

              <button
                onClick={() => onChange({ nodes: [], edges: [], modifiedAttributes: {} })}
                className="w-full text-xs text-red-400/70 hover:text-red-400 py-1.5 transition-colors"
              >
                Clear all overrides
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
