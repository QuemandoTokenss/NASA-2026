import type { Metadata } from "next";
import { Phase2Screen } from "@/components/phase2/Phase2Screen";
import { TIMELINE_SPEC } from "@/components/phase2/specs";

export const metadata: Metadata = { title: "Timeline" };

export default function Page() {
  return <Phase2Screen spec={TIMELINE_SPEC} />;
}
