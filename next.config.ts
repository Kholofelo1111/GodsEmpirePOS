import type { NextConfig } from "next";

// The default `next build` (used by `npm run build`, and by Vercel) is
// completely unchanged — this only takes effect when BUILD_TARGET is
// explicitly set to "capacitor" by the new capacitor build script (see
// package.json's "build:capacitor"), so the existing web deployment
// keeps working exactly as before.
const nextConfig: NextConfig = {
  ...(process.env.BUILD_TARGET === "capacitor" ? { output: "export" } : {}),
};

export default nextConfig;
