import type { Metadata } from "next";
import { StoryView } from "@/components/story/StoryView";

export const metadata: Metadata = { title: "Historia · Story" };

export default function Page() {
  return <StoryView />;
}
