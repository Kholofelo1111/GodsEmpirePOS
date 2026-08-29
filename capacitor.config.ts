import type { CapacitorConfig } from "@capacitor/cli";

// Loads the app bundle locally (webDir, produced by `npm run
// build:capacitor`) instead of the previous remote server.url — this is
// the change that makes a zero-connectivity cold start possible at all.
// The app then reaches the backend over the network via the API bridge
// (src/lib/offline/apiBridge.ts) instead of via same-origin requests.
//
// NOT VERIFIED: this has not been run through `npx cap sync android` or
// an actual Android build in this environment. In particular, confirm
// the resulting WebView origin matches CAPACITOR_APP_ORIGIN used by
// src/middleware.ts's CORS check (see that file's comment) — Capacitor's
// documented default for androidScheme: "https" is "https://localhost",
// which is what both sides currently assume, but this is exactly the
// kind of detail that needs confirming against a real build.
const config: CapacitorConfig = {
  appId: "co.godsempire.pos",
  appName: "God's Empire POS",
  webDir: "out",
};

export default config;
