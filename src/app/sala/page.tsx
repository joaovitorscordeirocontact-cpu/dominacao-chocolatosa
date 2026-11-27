import type { Metadata } from "next";
import { PlayerPage } from "./PlayerPage";

export const metadata: Metadata = { title: "Minha sala · Dominação Chocolatosa" };

export default function Page() {
  return <PlayerPage />;
}
