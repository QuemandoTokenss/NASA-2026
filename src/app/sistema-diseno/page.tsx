import type { Metadata } from "next";
import { DesignSystemView } from "@/components/design/DesignSystemView";

export const metadata: Metadata = { title: "Sistema de diseño" };

export default function Page() {
  return <DesignSystemView />;
}
