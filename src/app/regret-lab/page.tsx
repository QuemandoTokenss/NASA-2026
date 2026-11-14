import type { Metadata } from "next";
import { Phase2Screen } from "@/components/phase2/Phase2Screen";
import { REGRET_SPEC } from "@/components/phase2/specs";

export const metadata: Metadata = { title: "Regret Lab" };

export default function Page() {
  return <Phase2Screen spec={REGRET_SPEC} />;
}
