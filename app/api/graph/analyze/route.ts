import { NextRequest, NextResponse } from "next/server";
import { getGraph, getAlliances, getRivalries, getIssuePositions } from "@/lib/knowledge-graph";

/**
 * Graph Analysis API — computes structural insights from the knowledge graph.
 *
 * Actions:
 * - communities: Louvain community detection (discover emergent voting blocs)
 * - path: Shortest diplomatic path between two countries
 * - centrality: Most connected/influential countries
 * - anomalies: Countries that defy their bloc or region
 * - query: Natural-language-style structured queries
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  try {
    const g = getGraph();

    if (action === "communities") {
      // Compute communities using voting similarity structure
      const communities = new Map<string, string[]>();
      const countryNodes: string[] = [];

      g.forEachNode((node, attrs) => {
        if (attrs.type === "country") countryNodes.push(node);
      });

      // Simple community detection via connected components on strong alliances
      const visited = new Set<string>();
      let communityId = 0;

      for (const node of countryNodes) {
        if (visited.has(node)) continue;

        const community: string[] = [];
        const queue = [node];
        visited.add(node);

        while (queue.length > 0) {
          const current = queue.shift()!;
          community.push(current);

          g.forEachEdge(current, (_, attrs, source, target) => {
            if (attrs.type !== "ALLIES_WITH") return;
            if ((attrs.strength as number) < 0.95) return;
            const neighbor = source === current ? target : source;
            if (neighbor.includes(":")) return;
            if (visited.has(neighbor)) return;
            visited.add(neighbor);
            queue.push(neighbor);
          });
        }

        if (community.length >= 3) {
          const names = community.map((iso) => {
            const a = g.getNodeAttributes(iso) as { name: string; region: string };
            return { iso3: iso, name: a.name, region: a.region };
          });
          communities.set(`community-${communityId}`, community);
          communityId++;
        }
      }

      // Build labeled communities with characterization
      const result = [...communities.entries()].map(([id, members]) => {
        const regions = new Map<string, number>();
        let avgIdealPoint = 0;

        for (const iso of members) {
          const attrs = g.getNodeAttributes(iso) as { region: string; idealPoint: number; name: string };
          regions.set(attrs.region, (regions.get(attrs.region) || 0) + 1);
          avgIdealPoint += attrs.idealPoint;
        }
        avgIdealPoint /= members.length;

        const dominantRegion = [...regions.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "Mixed";
        const alignment = avgIdealPoint < -0.3 ? "Western-aligned" : avgIdealPoint > 0.3 ? "Global South-aligned" : "Centrist";

        return {
          id,
          size: members.length,
          dominantRegion,
          alignment,
          avgIdealPoint: parseFloat(avgIdealPoint.toFixed(3)),
          members: members.slice(0, 20).map((iso) => {
            const a = g.getNodeAttributes(iso) as { name: string; region: string };
            return { iso3: iso, name: a.name, region: a.region };
          }),
          totalMembers: members.length,
        };
      }).sort((a, b) => b.size - a.size);

      return NextResponse.json({ communities: result, totalCommunities: result.length });
    }

    if (action === "path") {
      const from = searchParams.get("from")?.toUpperCase();
      const to = searchParams.get("to")?.toUpperCase();
      if (!from || !to) return NextResponse.json({ error: "from and to params required" }, { status: 400 });
      if (!g.hasNode(from) || !g.hasNode(to)) return NextResponse.json({ error: "Country not found" }, { status: 404 });

      // BFS shortest path through alliance edges
      const visited = new Set<string>();
      const parent = new Map<string, { node: string; edgeType: string; weight: number }>();
      const queue: string[] = [from];
      visited.add(from);

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (current === to) break;

        g.forEachEdge(current, (_, attrs, source, target) => {
          if (attrs.type !== "ALLIES_WITH" && attrs.type !== "RIVALS_WITH") return;
          const neighbor = source === current ? target : source;
          if (neighbor.includes(":") || visited.has(neighbor)) return;
          visited.add(neighbor);
          parent.set(neighbor, {
            node: current,
            edgeType: attrs.type as string,
            weight: (attrs.strength as number) || (attrs.intensity as number) || 0,
          });
          queue.push(neighbor);
        });
      }

      if (!parent.has(to) && from !== to) {
        return NextResponse.json({ path: null, message: "No path found between these countries" });
      }

      // Reconstruct path
      const path: { iso3: string; name: string; region: string }[] = [];
      const edges: { from: string; to: string; type: string; weight: number }[] = [];
      let current = to;

      while (current !== from) {
        const attrs = g.getNodeAttributes(current) as { name: string; region: string };
        path.unshift({ iso3: current, name: attrs.name, region: attrs.region });
        const p = parent.get(current)!;
        edges.unshift({ from: p.node, to: current, type: p.edgeType, weight: p.weight });
        current = p.node;
      }
      const fromAttrs = g.getNodeAttributes(from) as { name: string; region: string };
      path.unshift({ iso3: from, name: fromAttrs.name, region: fromAttrs.region });

      return NextResponse.json({
        path,
        edges,
        hops: path.length - 1,
        interpretation: path.length <= 2
          ? `${fromAttrs.name} and ${(g.getNodeAttributes(to) as { name: string }).name} are directly connected.`
          : `${fromAttrs.name} reaches ${(g.getNodeAttributes(to) as { name: string }).name} through ${path.length - 2} intermediary${path.length > 3 ? "ies" : ""}: ${path.slice(1, -1).map((p) => p.name).join(" → ")}.`,
      });
    }

    if (action === "centrality") {
      // Degree centrality — most connected countries
      const centrality: { iso3: string; name: string; region: string; allianceCount: number; rivalryCount: number; totalDegree: number; idealPoint: number }[] = [];

      g.forEachNode((node, attrs) => {
        if (attrs.type !== "country") return;
        let allianceCount = 0;
        let rivalryCount = 0;
        g.forEachEdge(node, (_, edgeAttrs) => {
          if (edgeAttrs.type === "ALLIES_WITH") allianceCount++;
          else if (edgeAttrs.type === "RIVALS_WITH") rivalryCount++;
        });
        centrality.push({
          iso3: node,
          name: attrs.name as string,
          region: attrs.region as string,
          allianceCount,
          rivalryCount,
          totalDegree: allianceCount + rivalryCount,
          idealPoint: attrs.idealPoint as number,
        });
      });

      centrality.sort((a, b) => b.totalDegree - a.totalDegree);

      return NextResponse.json({
        mostConnected: centrality.slice(0, 20),
        mostAllied: [...centrality].sort((a, b) => b.allianceCount - a.allianceCount).slice(0, 10),
        mostRivaled: [...centrality].sort((a, b) => b.rivalryCount - a.rivalryCount).slice(0, 10),
        bridgeCountries: centrality.filter((c) => c.allianceCount > 5 && c.rivalryCount > 3 && Math.abs(c.idealPoint) < 0.3).slice(0, 10),
      });
    }

    if (action === "anomalies") {
      // Find countries whose voting behavior differs from their region's average
      const regionAvg = new Map<string, { sum: number; count: number }>();
      g.forEachNode((_, attrs) => {
        if (attrs.type !== "country") return;
        const region = attrs.region as string;
        const ip = attrs.idealPoint as number;
        const existing = regionAvg.get(region) || { sum: 0, count: 0 };
        existing.sum += ip;
        existing.count++;
        regionAvg.set(region, existing);
      });

      const anomalies: { iso3: string; name: string; region: string; idealPoint: number; regionAvg: number; deviation: number; interpretation: string }[] = [];

      g.forEachNode((node, attrs) => {
        if (attrs.type !== "country") return;
        const region = attrs.region as string;
        const ip = attrs.idealPoint as number;
        const avg = regionAvg.get(region);
        if (!avg) return;
        const regionMean = avg.sum / avg.count;
        const deviation = ip - regionMean;

        if (Math.abs(deviation) > 0.4) {
          anomalies.push({
            iso3: node,
            name: attrs.name as string,
            region,
            idealPoint: ip,
            regionAvg: parseFloat(regionMean.toFixed(3)),
            deviation: parseFloat(deviation.toFixed(3)),
            interpretation: deviation > 0
              ? `${attrs.name} votes significantly more with the Global South than its ${region} peers`
              : `${attrs.name} votes significantly more with the West than its ${region} peers`,
          });
        }
      });

      anomalies.sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));

      return NextResponse.json({ anomalies: anomalies.slice(0, 20) });
    }

    if (action === "query") {
      // Structured query: find countries matching criteria
      const region = searchParams.get("region");
      const minIdealPoint = parseFloat(searchParams.get("minIdealPoint") || "-2");
      const maxIdealPoint = parseFloat(searchParams.get("maxIdealPoint") || "2");
      const bloc = searchParams.get("bloc");
      const alliedWith = searchParams.get("alliedWith")?.toUpperCase();

      const results: { iso3: string; name: string; region: string; idealPoint: number }[] = [];

      g.forEachNode((node, attrs) => {
        if (attrs.type !== "country") return;
        const ip = attrs.idealPoint as number;
        if (ip < minIdealPoint || ip > maxIdealPoint) return;
        if (region && attrs.region !== region) return;

        if (alliedWith) {
          const allies = getAlliances(node);
          if (!allies.some((a) => a.iso3 === alliedWith)) return;
        }

        results.push({
          iso3: node,
          name: attrs.name as string,
          region: attrs.region as string,
          idealPoint: ip,
        });
      });

      return NextResponse.json({ results: results.slice(0, 50), total: results.length });
    }

    return NextResponse.json({
      actions: ["communities", "path", "centrality", "anomalies", "query"],
      description: "Graph structural analysis — communities, paths, centrality, anomalies",
    });
  } catch (e) {
    console.error("Graph analysis error:", e);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
