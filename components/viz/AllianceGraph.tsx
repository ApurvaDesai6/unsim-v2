"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

interface GraphNode {
  id: string;
  label: string;
  region: string;
  idealPoint: number;
  size: number;
  blocs?: string[];
  x?: number;
  y?: number;
}

interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  type?: string;
}

interface AllianceGraphProps {
  onCountrySelect?: (iso3: string) => void;
  selectedCountry?: string | null;
  highlightBloc?: string | null;
  filter?: {
    regions?: string[];
    minSimilarity?: number;
  };
}

const REGION_COLORS: Record<string, string> = {
  WEOG: "#4a90d9",
  EEG: "#7b68ee",
  AFRICAN: "#e67e22",
  APG: "#27ae60",
  GRULAC: "#e74c3c",
};

const REGION_LABELS: Record<string, string> = {
  WEOG: "Western European & Others",
  EEG: "Eastern European",
  AFRICAN: "African",
  APG: "Asia-Pacific",
  GRULAC: "Latin American & Caribbean",
};

export default function AllianceGraph({
  onCountrySelect,
  selectedCountry,
  highlightBloc,
  filter,
}: AllianceGraphProps) {
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; links: GraphEdge[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const graphRef = useRef<unknown>(null);

  useEffect(() => {
    async function loadGraph() {
      try {
        const res = await fetch("/api/graph/alliance-network");
        const data = await res.json();
        setGraphData({
          nodes: data.nodes,
          links: data.edges.map((e: GraphEdge) => ({ ...e, source: e.source, target: e.target })),
        });
      } catch (e) {
        console.error("Failed to load alliance graph:", e);
      } finally {
        setLoading(false);
      }
    }
    loadGraph();
  }, []);

  const filteredData = useMemo(() => {
    if (!graphData) return null;

    let nodes = graphData.nodes;
    let links = graphData.links;

    if (filter?.regions?.length) {
      const regionSet = new Set(filter.regions);
      nodes = nodes.filter((n) => regionSet.has(n.region));
      const nodeIds = new Set(nodes.map((n) => n.id));
      links = links.filter((l) => {
        const src = typeof l.source === "string" ? l.source : (l.source as unknown as GraphNode).id;
        const tgt = typeof l.target === "string" ? l.target : (l.target as unknown as GraphNode).id;
        return nodeIds.has(src) && nodeIds.has(tgt);
      });
    }

    if (filter?.minSimilarity) {
      links = links.filter((l) => l.weight >= filter.minSimilarity!);
    }

    return { nodes, links };
  }, [graphData, filter]);

  const nodeColor = useCallback(
    (node: GraphNode) => {
      if (selectedCountry && node.id === selectedCountry) return "#ffd700";
      if (hoveredNode === node.id) return "#ffffff";
      return REGION_COLORS[node.region] || "#999";
    },
    [selectedCountry, hoveredNode],
  );

  const linkColor = useCallback(
    (link: GraphEdge) => {
      const src = typeof link.source === "string" ? link.source : (link.source as unknown as GraphNode).id;
      const tgt = typeof link.target === "string" ? link.target : (link.target as unknown as GraphNode).id;

      if (selectedCountry && (src === selectedCountry || tgt === selectedCountry)) {
        return "rgba(255, 215, 0, 0.6)";
      }
      return `rgba(255, 255, 255, ${Math.max(0.03, (link.weight - 0.85) * 3)})`;
    },
    [selectedCountry],
  );

  const linkWidth = useCallback(
    (link: GraphEdge) => {
      const src = typeof link.source === "string" ? link.source : (link.source as unknown as GraphNode).id;
      const tgt = typeof link.target === "string" ? link.target : (link.target as unknown as GraphNode).id;

      if (selectedCountry && (src === selectedCountry || tgt === selectedCountry)) return 2;
      return 0.3;
    },
    [selectedCountry],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] bg-[#0a0f1a] rounded-xl">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-[#4b92db] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-400">Loading alliance network...</p>
        </div>
      </div>
    );
  }

  if (!filteredData) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] bg-[#0a0f1a] rounded-xl">
        <p className="text-sm text-gray-400">Failed to load graph data</p>
      </div>
    );
  }

  return (
    <div className="relative bg-[#0a0f1a] rounded-xl overflow-hidden">
      {/* Legend */}
      <div className="absolute top-4 left-4 z-10 bg-black/70 backdrop-blur-sm rounded-lg p-3 space-y-1.5">
        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-2">
          Regional Groups
        </p>
        {Object.entries(REGION_COLORS).map(([region, color]) => (
          <div key={region} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[11px] text-gray-300">{REGION_LABELS[region]}</span>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="absolute top-4 right-4 z-10 bg-black/70 backdrop-blur-sm rounded-lg px-3 py-2">
        <p className="text-[10px] text-gray-400">
          {filteredData.nodes.length} countries · {filteredData.links.length} alliances
        </p>
      </div>

      {/* Hovered country tooltip */}
      {hoveredNode && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-black/80 backdrop-blur-sm rounded-lg px-4 py-2">
          <p className="text-sm text-white font-medium">
            {filteredData.nodes.find((n) => n.id === hoveredNode)?.label}
          </p>
          <p className="text-[11px] text-gray-400">
            {REGION_LABELS[filteredData.nodes.find((n) => n.id === hoveredNode)?.region || ""]}
          </p>
        </div>
      )}

      <ForceGraph2D
        ref={graphRef as never}
        graphData={filteredData}
        nodeId="id"
        nodeLabel="label"
        nodeColor={nodeColor as never}
        nodeRelSize={4}
        nodeVal={(node: unknown) => Math.max(2, (node as GraphNode).size || 3)}
        linkColor={linkColor as never}
        linkWidth={linkWidth as never}
        linkDirectionalParticles={0}
        backgroundColor="#0a0f1a"
        width={undefined}
        height={500}
        onNodeClick={(node: unknown) => {
          const n = node as GraphNode;
          onCountrySelect?.(n.id);
        }}
        onNodeHover={(node: unknown) => {
          setHoveredNode(node ? (node as GraphNode).id : null);
        }}
        cooldownTicks={100}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
      />
    </div>
  );
}
