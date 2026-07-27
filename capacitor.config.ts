import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "co.godsempire.pos",
  appName: "God's Empire POS",
  server: {
    url: "https://gods-empire-pos.vercel.app",
    cleartext: true,
  },
};

export default config;
