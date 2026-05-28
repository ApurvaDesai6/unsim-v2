import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import path from "path";

let cache: unknown[] | null = null;

export async function GET() {
  if (cache) return NextResponse.json(cache);

  try {
    const filePath = path.join(process.cwd(), "data", "resolution-featured.json");
    cache = JSON.parse(readFileSync(filePath, "utf-8"));
    return NextResponse.json(cache);
  } catch (e) {
    console.error("Failed to load featured resolutions:", e);
    return NextResponse.json([], { status: 500 });
  }
}
