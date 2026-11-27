import type { Metadata, Viewport } from "next";
import "@fontsource/lilita-one/latin-400.css";
import "@fontsource-variable/nunito/wght.css";
import { MotionProvider } from "@/components/ui/MotionProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dominação Chocolatosa",
  description: "Topa ou Arrisca? Jogo presencial de equipes.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1d0e0c",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
