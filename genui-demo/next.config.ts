import type { NextConfig } from "next";
import path from "node:path";

const openUIDevtoolsEnabled = process.env.OPENUI_DEVTOOLS === "true";
const openUIDevtoolsNoop = "./src/lib/openui-devtools-noop.tsx";
const openUIDevtoolsNoopPath = path.resolve(process.cwd(), "src/lib/openui-devtools-noop.tsx");

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
    ...(openUIDevtoolsEnabled
      ? {}
      : {
          resolveAlias: {
            "@openuidev/devtools": openUIDevtoolsNoop,
          },
        }),
  },
  experimental: {
    turbopackMinify: false,
  },
  webpack: (config) => {
    if (!openUIDevtoolsEnabled) {
      config.resolve.alias["@openuidev/devtools"] = openUIDevtoolsNoopPath;
    }

    return config;
  },
};

export default nextConfig;
