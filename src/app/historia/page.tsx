import type { Metadata } from "next";
import { StoryView } from "@/components/story/StoryView";

export const metadata: Metadata = { title: "Historia · modo presentación" };

export default function Page() {
  return <StoryView />;
}
