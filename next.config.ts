import type { NextConfig } from "next";

/**
 * Publicação estática (GitHub Pages): sem servidor Node no ar. Tudo que é
 * compartilhado entre os aparelhos fica no Supabase.
 *
 * NEXT_PUBLIC_BASE_PATH: subpasta do site, como "/dominacao-chocolatosa".
 * Vazio em desenvolvimento e em domínios na raiz.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath: basePath || undefined,
  // Cada rota vira uma pasta com index.html: recarregar e abrir link direto funcionam.
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  // Impede o `next dev` de criar um AGENTS.md no repositório.
  agentRules: false,
  // Permite testar no celular pela rede local durante o desenvolvimento.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
};

export default nextConfig;
