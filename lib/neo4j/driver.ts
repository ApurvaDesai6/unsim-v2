/**
 * Neo4j AuraDB Connection — singleton pattern for Vercel serverless.
 *
 * The driver instance persists across warm invocations in the same Lambda container.
 * Connection pool is kept small (5) to avoid exhausting AuraDB's 25-connection limit.
 *
 * Setup:
 * 1. Create a free AuraDB instance at https://console.neo4j.io
 * 2. Set environment variables:
 *    - NEO4J_URI: neo4j+s://xxxxx.databases.neo4j.io
 *    - NEO4J_USER: neo4j
 *    - NEO4J_PASSWORD: (from AuraDB console)
 */

import neo4j, { type Driver, type Session, type Record as Neo4jRecord } from "neo4j-driver";

let driver: Driver | null = null;

export function getDriver(): Driver {
  if (!driver) {
    const uri = process.env.NEO4J_URI;
    const user = process.env.NEO4J_USER || "neo4j";
    const password = process.env.NEO4J_PASSWORD;

    if (!uri || !password) {
      throw new Error("NEO4J_URI and NEO4J_PASSWORD environment variables required");
    }

    driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
      maxConnectionPoolSize: 5,
      connectionAcquisitionTimeout: 10000,
      maxConnectionLifetime: 60000,
      connectionTimeout: 5000,
    });
  }
  return driver;
}

export function isNeo4jConfigured(): boolean {
  return !!(process.env.NEO4J_URI && process.env.NEO4J_PASSWORD);
}

export async function runQuery<T = Record<string, unknown>>(
  cypher: string,
  params: Record<string, unknown> = {},
): Promise<T[]> {
  const d = getDriver();
  const { records } = await d.executeQuery(cypher, params, { database: process.env.NEO4J_DATABASE || "neo4j" });
  return records.map((r: Neo4jRecord) => r.toObject() as T);
}

export async function runWrite(
  cypher: string,
  params: Record<string, unknown> = {},
): Promise<{ nodesCreated: number; relationshipsCreated: number }> {
  const d = getDriver();
  const result = await d.executeQuery(cypher, params, { database: process.env.NEO4J_DATABASE || "neo4j" });
  const counters = result.summary.counters.updates();
  return {
    nodesCreated: counters.nodesCreated,
    relationshipsCreated: counters.relationshipsCreated,
  };
}

export async function healthCheck(): Promise<{ connected: boolean; serverVersion?: string; error?: string }> {
  try {
    const d = getDriver();
    const info = await d.getServerInfo();
    return { connected: true, serverVersion: info.protocolVersion?.toString() };
  } catch (e) {
    return { connected: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
