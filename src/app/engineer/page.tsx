import type { Metadata } from "next";
import { EngineerView } from "@/components/engineer/EngineerView";

export const metadata: Metadata = { title: "Engineer" };

export default function Page() {
  return <EngineerView />;
}
