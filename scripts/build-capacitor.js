#!/usr/bin/env node
/**
 * `next build` with output:"export" (see next.config.ts) cannot coexist
 * with:
 *   - src/middleware.ts (static export doesn't support middleware at all)
 *   - src/app/api/** (route handlers are dynamic; they're also not meant
 *     to be part of the bundled app anyway — the app calls them remotely
 *     via the API bridge, see src/lib/offline/apiBridge.ts)
 *
 * Both stay exactly as they are for the normal `npm run build` (Vercel/
 * web) — this script only moves them aside for the duration of the
 * Capacitor export build, then restores them, including on failure.
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const middlewarePath = path.join(root, "src", "middleware.ts");
const middlewareTmp = path.join(root, "src", "middleware.ts.export-build-tmp");
const apiPath = path.join(root, "src", "app", "api");
const apiTmp = path.join(root, "src", "app", "__api_export_build_tmp__");
const outDir = path.join(root, "out");

function moveAside() {
  if (fs.existsSync(middlewarePath)) fs.renameSync(middlewarePath, middlewareTmp);
  if (fs.existsSync(apiPath)) fs.renameSync(apiPath, apiTmp);
}

function restore() {
  if (fs.existsSync(middlewareTmp)) fs.renameSync(middlewareTmp, middlewarePath);
  if (fs.existsSync(apiTmp)) fs.renameSync(apiTmp, apiPath);
}

let failed = false;
try {
  // Force a clean export every time. Next.js normally clears `out/`
  // itself, but this build already relies on temporarily moving files
  // around (see moveAside/restore above) rather than trusting defaults,
  // and a stale `out/` — left over from an interrupted build, or from
  // before middleware/api exclusion was added — is exactly the kind of
  // thing that can end up partially copied into the Android app by
  // `npx cap sync android` alongside the new build's files.
  if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true, force: true });

  moveAside();
  execSync("next build --webpack", {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, BUILD_TARGET: "capacitor" },
  });
} catch (err) {
  failed = true;
  console.error("Capacitor export build failed:", err.message);
} finally {
  restore();
}

if (failed) process.exit(1);

console.log(
  "\nExport build complete. Output is in ./out — this needs to be verified " +
  "against an actual Capacitor Android project (npx cap sync android), " +
  "which has not been done from this environment."
);
