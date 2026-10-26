/**
 * download-sheets.ts — dumps the Bombarbia metadata spreadsheet as JSON.
 * Fetch a Google Spreadsheet by ID and output JSON in the form:
 *   { sheetName: [{ id, ...fields }, ...], ... }
 *
 * Auth: uses Application Default Credentials via google-auth-library.
 *   Run `gcloud auth application-default login` (Bombarbia: `npm run gcloud:login`) before using.
 *
 * Usage:
 *   bun ../proton/ops/download-sheets.ts <spreadsheetId> [outputFile]
 *
 * No npm script wraps it: the app reads no sheet-synced JSON any more, so a dump is a manual
 * step whose destination you name — a scratch file to diff against, not a file the app loads.
 *
 * Output modes:
 *   - No outputFile: writes JSON to stdout
 *   - outputFile without {sheet}: writes all sheets to a single JSON file
 *   - outputFile with {sheet}: writes each sheet to a separate file
 */

import { writeFileSync } from "node:fs";
import { GoogleAuth } from "google-auth-library";
import { stringFormat, stringify } from "ultimus";

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

/**
 * Sheets whose rows are now hand-authored TypeScript (`packages/bbb-rc/forms/`). Downloading one
 * over its source file would lose the edits git holds, so it is skipped even while the sheet lives.
 */
const HAND_AUTHORED = new Set(["forms"]);

// ── Auth ─────────────────────────────────────────────────────────────────────

async function createAuthClient() {
  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return auth.getClient();
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiGet(url: string, client: Awaited<ReturnType<typeof createAuthClient>>): Promise<any> {
  const headers = await client.getRequestHeaders();
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sheets API error ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Sheet parsing ─────────────────────────────────────────────────────────────

type Row = Record<string, string>;

function parseSheetValues(values: string[][]): Row[] {
  if (!values || values.length < 2) return [];

  const [headerRow, ...dataRows] = values;
  const headers = headerRow.map((h) => String(h ?? "").trim());

  return dataRows
    .map((row) => {
      const obj: Row = {};
      for (let i = 0; i < headers.length; i++) {
        const key = headers[i];
        if (key) obj[key] = String(row[i] ?? "").trim();
      }
      return obj;
    })
    .filter((row) => Object.values(row).some(Boolean)); // skip fully empty rows
}

// ── Main ──────────────────────────────────────────────────────────────────────

/** Fetch one sheet; write it to its own file when `outputFile` names `{sheet}`, else collect it into `result`. */
async function downloadSheet(
  spreadsheetId: string,
  name: string,
  client: Awaited<ReturnType<typeof createAuthClient>>,
  outputFile: string,
  result: Record<string, Row[]>
): Promise<void> {
  const encoded = encodeURIComponent(name);
  const data = await apiGet(`${SHEETS_API}/${spreadsheetId}/values/${encoded}`, client);
  const values: string[][] = data.values ?? [];
  const parsed = parseSheetValues(values);

  const headers = Object.keys(parsed[0]);
  let validated: any = parsed;
  if (outputFile.includes("{sheet}")) {
    const outFile = stringFormat(outputFile, { sheet: name });
    if (headers.includes("bundle")) {
      // If there's a "bundle" column, split into multiple files by group
      validated = validated.reduce(
        (acc, { id, key, bundle, ...row }) => {
          bundle = bundle || "other";
          if (!acc[bundle]) acc[bundle] = [];
          acc[bundle].push({ id: key || id || `p${acc[bundle].length + 1}`, ...row });
          return acc;
        },
        {} as Record<string, Row[]>
      );
    }

    writeFileSync(outFile, stringify(validated), "utf8");

    console.log(`\nWritten to ${outFile}`);
  } else {
    result[name] = validated;
    console.log(`  ${name}: ${result[name].length} rows`);
  }
}

async function main() {
  const [, , spreadsheetId, outputFile] = process.argv;

  if (!spreadsheetId) {
    console.error("Usage: bun download-sheets.ts <spreadsheetId> [outputFile]");
    process.exit(1);
  }

  console.log(`Fetching spreadsheet: ${spreadsheetId}`);
  const client = await createAuthClient();

  // 1. Get spreadsheet metadata to list all sheet names
  const meta = await apiGet(`${SHEETS_API}/${spreadsheetId}?fields=sheets.properties`, client);
  const allNames: string[] = meta.sheets.map((s: any) => s.properties.title).filter((s) => !s.startsWith("_"));
  const sheetNames = allNames.filter((s) => !HAND_AUTHORED.has(s));
  console.log(`Sheets found: ${allNames.join(", ")}`);
  const skipped = allNames.filter((s) => HAND_AUTHORED.has(s));
  if (skipped.length) console.log(`Skipped (hand-authored): ${skipped.join(", ")}`);

  // 2. Fetch each sheet's values in parallel
  const result: Record<string, Row[]> = {};
  await Promise.all(sheetNames.map((name) => downloadSheet(spreadsheetId, name, client, outputFile, result)));

  // 3. Output
  if (outputFile) {
    if (!outputFile.includes("{sheet}")) {
      writeFileSync(outputFile, stringify(result), "utf8");
      console.log(`\nWritten to ${outputFile}`);
    }
  } else {
    process.stdout.write(`${stringify(result)}\n`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
