/**
 * Ingest World Bank Governance Indicators (WGI) into country profiles and Neo4j.
 *
 * Six indicators (all on [-2.5, +2.5] scale):
 * - VA: Voice and Accountability
 * - PS: Political Stability and Absence of Violence
 * - GE: Government Effectiveness
 * - RQ: Regulatory Quality
 * - RL: Rule of Law
 * - CC: Control of Corruption
 *
 * Source: World Bank API (free, no key needed)
 * URL: https://api.worldbank.org/v2/country/all/indicator/{code}?format=json&date=2022&per_page=300
 *
 * Usage: npx tsx scripts/ingest-world-bank-wgi.ts
 */

import { readFileSync, writeFileSync } from "fs";
import path from "path";

const DATA_DIR = path.join(__dirname, "../data");

const WGI_INDICATORS = [
  { code: "VA.EST", name: "voiceAccountability", label: "Voice & Accountability" },
  { code: "PS.EST", name: "politicalStability", label: "Political Stability" },
  { code: "GE.EST", name: "govEffectiveness", label: "Government Effectiveness" },
  { code: "RQ.EST", name: "regulatoryQuality", label: "Regulatory Quality" },
  { code: "RL.EST", name: "ruleOfLaw", label: "Rule of Law" },
  { code: "CC.EST", name: "controlCorruption", label: "Control of Corruption" },
];

// ISO2 → ISO3 mapping for World Bank data (WB uses ISO2 codes)
const ISO2_TO_ISO3: Record<string, string> = {
  AF: "AFG", AL: "ALB", DZ: "DZA", AD: "AND", AO: "AGO", AG: "ATG", AR: "ARG", AM: "ARM",
  AU: "AUS", AT: "AUT", AZ: "AZE", BS: "BHS", BH: "BHR", BD: "BGD", BB: "BRB", BY: "BLR",
  BE: "BEL", BZ: "BLZ", BJ: "BEN", BT: "BTN", BO: "BOL", BA: "BIH", BW: "BWA", BR: "BRA",
  BN: "BRN", BG: "BGR", BF: "BFA", BI: "BDI", CV: "CPV", KH: "KHM", CM: "CMR", CA: "CAN",
  CF: "CAF", TD: "TCD", CL: "CHL", CN: "CHN", CO: "COL", KM: "COM", CG: "COG", CD: "COD",
  CR: "CRI", CI: "CIV", HR: "HRV", CU: "CUB", CY: "CYP", CZ: "CZE", KP: "PRK", DK: "DNK",
  DJ: "DJI", DM: "DMA", DO: "DOM", EC: "ECU", EG: "EGY", SV: "SLV", GQ: "GNQ", ER: "ERI",
  EE: "EST", SZ: "SWZ", ET: "ETH", FJ: "FJI", FI: "FIN", FR: "FRA", GA: "GAB", GM: "GMB",
  GE: "GEO", DE: "DEU", GH: "GHA", GR: "GRC", GD: "GRD", GT: "GTM", GN: "GIN", GW: "GNB",
  GY: "GUY", HT: "HTI", HN: "HND", HU: "HUN", IS: "ISL", IN: "IND", ID: "IDN", IR: "IRN",
  IQ: "IRQ", IE: "IRL", IL: "ISR", IT: "ITA", JM: "JAM", JP: "JPN", JO: "JOR", KZ: "KAZ",
  KE: "KEN", KI: "KIR", KW: "KWT", KG: "KGZ", LA: "LAO", LV: "LVA", LB: "LBN", LS: "LSO",
  LR: "LBR", LY: "LBY", LI: "LIE", LT: "LTU", LU: "LUX", MG: "MDG", MW: "MWI", MY: "MYS",
  MV: "MDV", ML: "MLI", MT: "MLT", MH: "MHL", MR: "MRT", MU: "MUS", MX: "MEX", FM: "FSM",
  MD: "MDA", MC: "MCO", MN: "MNG", ME: "MNE", MA: "MAR", MZ: "MOZ", MM: "MMR", NA: "NAM",
  NR: "NRU", NP: "NPL", NL: "NLD", NZ: "NZL", NI: "NIC", NE: "NER", NG: "NGA", MK: "MKD",
  NO: "NOR", OM: "OMN", PK: "PAK", PW: "PLW", PA: "PAN", PG: "PNG", PY: "PRY", PE: "PER",
  PH: "PHL", PL: "POL", PT: "PRT", QA: "QAT", KR: "KOR", RO: "ROU", RU: "RUS", RW: "RWA",
  KN: "KNA", LC: "LCA", VC: "VCT", WS: "WSM", SM: "SMR", ST: "STP", SA: "SAU", SN: "SEN",
  RS: "SRB", SC: "SYC", SL: "SLE", SG: "SGP", SK: "SVK", SI: "SVN", SB: "SLB", SO: "SOM",
  ZA: "ZAF", SS: "SSD", ES: "ESP", LK: "LKA", SD: "SDN", SR: "SUR", SE: "SWE", CH: "CHE",
  SY: "SYR", TJ: "TJK", TZ: "TZA", TH: "THA", TL: "TLS", TG: "TGO", TO: "TON", TT: "TTO",
  TN: "TUN", TR: "TUR", TM: "TKM", TV: "TUV", UG: "UGA", UA: "UKR", AE: "ARE", GB: "GBR",
  US: "USA", UY: "URY", UZ: "UZB", VU: "VUT", VE: "VEN", VN: "VNM", YE: "YEM", ZM: "ZMB",
  ZW: "ZWE",
};

async function fetchIndicator(code: string): Promise<Map<string, number>> {
  const url = `https://api.worldbank.org/v2/country/all/indicator/${code}?format=json&date=2022&per_page=300`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${code}: ${res.status}`);

  const data = await res.json();
  const values = new Map<string, number>();

  if (!data[1]) return values;

  for (const entry of data[1]) {
    if (entry.value === null) continue;
    const iso2 = entry.countryiso3code || entry.country?.id;
    // World Bank uses ISO3 in countryiso3code
    const iso3 = entry.countryiso3code;
    if (iso3 && iso3.length === 3) {
      values.set(iso3, entry.value);
    }
  }

  return values;
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  World Bank Governance Indicators Ingestion");
  console.log("═══════════════════════════════════════════════════════════\n");

  const allIndicators = new Map<string, Map<string, number>>();

  for (const indicator of WGI_INDICATORS) {
    process.stdout.write(`  Fetching ${indicator.label}...`);
    try {
      const values = await fetchIndicator(indicator.code);
      allIndicators.set(indicator.name, values);
      console.log(` ✓ (${values.size} countries)`);
    } catch (e) {
      console.log(` ✗ (${e instanceof Error ? e.message : "failed"})`);
    }
  }

  // Update country profiles
  console.log("\n  Updating country profiles...");
  const profiles = JSON.parse(readFileSync(path.join(DATA_DIR, "country-profiles.json"), "utf-8"));

  let updated = 0;
  for (const profile of profiles) {
    const iso3 = profile.iso3;
    let hasData = false;

    if (!profile.governance) profile.governance = {};

    for (const [indicatorName, values] of allIndicators) {
      const value = values.get(iso3);
      if (value !== undefined) {
        profile.governance[indicatorName] = parseFloat(value.toFixed(3));
        hasData = true;
      }
    }

    if (hasData) updated++;
  }

  writeFileSync(path.join(DATA_DIR, "country-profiles.json"), JSON.stringify(profiles, null, 2));
  console.log(`  ✓ ${updated}/193 countries enriched with governance data`);

  // Also write a standalone governance dataset
  const govData: Record<string, Record<string, number>> = {};
  for (const profile of profiles) {
    if (profile.governance && Object.keys(profile.governance).length > 0) {
      govData[profile.iso3] = profile.governance;
    }
  }
  writeFileSync(path.join(DATA_DIR, "governance-indicators.json"), JSON.stringify(govData, null, 2));
  console.log(`  ✓ Written governance-indicators.json (${Object.keys(govData).length} countries)`);

  // Print sample
  console.log("\n  Sample (top governance vs bottom):");
  const sorted = profiles
    .filter((p: { governance?: { govEffectiveness?: number } }) => p.governance?.govEffectiveness !== undefined)
    .sort((a: { governance: { govEffectiveness: number } }, b: { governance: { govEffectiveness: number } }) => b.governance.govEffectiveness - a.governance.govEffectiveness);

  for (const p of sorted.slice(0, 3)) {
    console.log(`    ${p.name}: GE=${p.governance.govEffectiveness.toFixed(2)} RL=${p.governance.ruleOfLaw?.toFixed(2)} CC=${p.governance.controlCorruption?.toFixed(2)}`);
  }
  console.log("    ...");
  for (const p of sorted.slice(-3)) {
    console.log(`    ${p.name}: GE=${p.governance.govEffectiveness.toFixed(2)} RL=${p.governance.ruleOfLaw?.toFixed(2)} CC=${p.governance.controlCorruption?.toFixed(2)}`);
  }

  console.log("\n═══════════════════════════════════════════════════════════\n");
}

main().catch(console.error);
