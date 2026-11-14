import type { Metadata } from "next";
import { EvidenceView } from "@/components/evidence/EvidenceView";

export const metadata: Metadata = { title: "Evidencia" };

export default function Page() {
  return <EvidenceView />;
}
