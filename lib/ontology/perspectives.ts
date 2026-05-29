/**
 * Perspectives — Neo4j Bloom-inspired scoped views of the knowledge graph.
 *
 * Each perspective defines:
 * - Which node types are visible
 * - Which edge types are shown
 * - How nodes are styled (color, size mapping)
 * - What properties are surfaced in tooltips/panels
 * - Default filters and layout hints
 *
 * Users switch perspectives to explore different aspects of the same graph.
 */

export interface Perspective {
  id: string;
  name: string;
  description: string;
  icon: string;
  nodeTypes: string[];
  edgeTypes: string[];
  nodeStyle: {
    colorBy: string;
    sizeBy: string;
    labelBy: string;
  };
  defaultFilters: {
    minEdgeWeight?: number;
    maxNodes?: number;
    regions?: string[];
  };
  layout: "force" | "radial" | "hierarchical" | "geographic";
  insights: string[];
}

export const PERSPECTIVES: Perspective[] = [
  {
    id: "alliance-map",
    name: "Alliance Map",
    description: "Who votes with whom? Explore co-voting alliances and rivalries between all 193 nations.",
    icon: "🤝",
    nodeTypes: ["country"],
    edgeTypes: ["ALLIES_WITH", "RIVALS_WITH"],
    nodeStyle: {
      colorBy: "region",
      sizeBy: "population",
      labelBy: "iso3",
    },
    defaultFilters: {
      minEdgeWeight: 0.93,
      maxNodes: 193,
    },
    layout: "force",
    insights: [
      "The graph naturally clusters into 2 macro-blocs: Western (WEOG+EU) and Global South (G77+NAM)",
      "P5 members (USA, UK, France, Russia, China) are structurally central — most countries are 2 hops from a P5 member",
      "Island states (Pacific, Caribbean) cluster tightly with their respective patrons",
    ],
  },
  {
    id: "bloc-dynamics",
    name: "Bloc Dynamics",
    description: "How do voting blocs coordinate? See cohesion scores, internal splits, and cross-bloc bridges.",
    icon: "🏛",
    nodeTypes: ["country", "bloc"],
    edgeTypes: ["MEMBER_OF", "ALLIES_WITH"],
    nodeStyle: {
      colorBy: "bloc",
      sizeBy: "cohesionScore",
      labelBy: "name",
    },
    defaultFilters: {
      minEdgeWeight: 0.90,
    },
    layout: "radial",
    insights: [
      "EU has 82% cohesion — the tightest voting bloc. G77 has 55% — united in principle, divided on specifics.",
      "NAM (120 members, 40% cohesion) splits reliably on human rights resolutions targeting specific countries",
      "AOSIS (Small Island States, 75% cohesion) are the most unified bloc on climate resolutions",
    ],
  },
  {
    id: "issue-landscape",
    name: "Issue Landscape",
    description: "How does voting behavior differ across the 6 major issue areas? Find countries that defy their bloc on specific topics.",
    icon: "📊",
    nodeTypes: ["country", "topic"],
    edgeTypes: ["POSITION_ON"],
    nodeStyle: {
      colorBy: "stance",
      sizeBy: "sampleSize",
      labelBy: "name",
    },
    defaultFilters: {},
    layout: "radial",
    insights: [
      "Palestinian conflict is the most polarized issue: 90%+ of Global South votes Yes, US+Israel+Palau vote No",
      "Economic development is most consensual: 85%+ Yes across all regions except WEOG (60%)",
      "Human rights is the most complex: splits WITHIN regions depending on whether resolutions name specific countries",
    ],
  },
  {
    id: "influence-web",
    name: "Influence Web",
    description: "Beyond formal alliances: security pacts, aid dependencies, trade leverage, and institutional pressure that shape votes.",
    icon: "🕸",
    nodeTypes: ["country", "influence-entity"],
    edgeTypes: ["INFLUENCED_BY", "ALLIES_WITH"],
    nodeStyle: {
      colorBy: "influence-type",
      sizeBy: "influence-strength",
      labelBy: "name",
    },
    defaultFilters: {
      maxNodes: 80,
    },
    layout: "force",
    insights: [
      "US aid recipients vote with the US 12% more on human rights resolutions than non-recipients",
      "China's BRI partners show 8% higher Yes-rate on sovereignty resolutions compared to non-BRI states",
      "NATO membership correlates with 0.7+ voting similarity on security resolutions",
    ],
  },
  {
    id: "temporal-drift",
    name: "Temporal Drift",
    description: "How have countries moved over time? Track ideological shifts, realignments, and emerging alliances across decades.",
    icon: "⏳",
    nodeTypes: ["country", "era"],
    edgeTypes: ["ALLIES_WITH"],
    nodeStyle: {
      colorBy: "idealPoint",
      sizeBy: "drift-magnitude",
      labelBy: "name",
    },
    defaultFilters: {
      maxNodes: 50,
    },
    layout: "force",
    insights: [
      "Eastern European countries drifted 0.4 points toward Western alignment after EU accession (2004-2010)",
      "Turkey shifted 0.3 points toward Global South since 2010 (Erdogan era)",
      "Brazil oscillated: leftward under Lula (2003-2010), rightward under Bolsonaro (2019-2022), back left since",
    ],
  },
];

/**
 * Get a perspective by ID.
 */
export function getPerspective(id: string): Perspective | undefined {
  return PERSPECTIVES.find((p) => p.id === id);
}

/**
 * Get all available perspectives.
 */
export function getAllPerspectives(): Perspective[] {
  return PERSPECTIVES;
}
