import type { Metadata } from "next";
import { Phase2Screen } from "@/components/phase2/Phase2Screen";
import { COMPARADOR_SPEC } from "@/components/phase2/specs";

export const metadata: Metadata = { title: "Comparador A vs B" };

export default function Page() {
  return <Phase2Screen spec={COMPARADOR_SPEC} />;
}
