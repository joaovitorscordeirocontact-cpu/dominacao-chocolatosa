import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Impede o `next dev` de criar um AGENTS.md no repositório.
  agentRules: false,
  // Permite testar no celular pela rede local durante o desenvolvimento.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
};

export default nextConfig;
