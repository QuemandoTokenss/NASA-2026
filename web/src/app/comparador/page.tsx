import type { Metadata } from "next";
import { ComparadorView } from "@/components/comparador/ComparadorView";

export const metadata: Metadata = { title: "Comparador A vs B" };

export default function Page() {
  return <ComparadorView />;
}
