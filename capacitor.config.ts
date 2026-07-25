import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "co.godsempire.pos",
  appName: "God's Empire POS",
  server: {
    url: "http://10.0.2.2:3000",
    cleartext: true,
  },
};

export default config;
