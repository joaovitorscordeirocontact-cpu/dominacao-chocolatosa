import type { Metadata } from "next";
import { ModeratorPage } from "./ModeratorPage";

export const metadata: Metadata = { title: "Moderação · Dominação Chocolatosa" };

export default function Page() {
  return <ModeratorPage />;
}
