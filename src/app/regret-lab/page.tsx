import type { Metadata } from "next";
import { RegretLabView } from "@/components/regret/RegretLabView";

export const metadata: Metadata = { title: "Regret Lab" };

export default function Page() {
  return <RegretLabView />;
}
