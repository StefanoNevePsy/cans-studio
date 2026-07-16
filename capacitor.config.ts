import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "it.cansstudio.app",
  appName: "CANS Studio",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;
