import type { Metadata } from "next";
import { ExploreView } from "@/components/explore/ExploreView";

export const metadata: Metadata = { title: "Explorar" };

export default function Page() {
  return <ExploreView />;
}
