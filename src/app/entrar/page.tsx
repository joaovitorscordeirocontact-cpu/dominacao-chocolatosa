import type { Metadata } from "next";
import { JoinPage } from "./JoinPage";

export const metadata: Metadata = { title: "Entrar na sala · Dominação Chocolatosa" };

export default function Page() {
  return <JoinPage />;
}
