import { MindMap } from "@/components/mind-map";
import { modelStatus } from "@/lib/ai";
import type { Brief, Store } from "@/lib/types";

export async function IdeasStep({ brief }: { store: Store; brief: Brief }) {
  const status = await modelStatus();
  return <MindMap briefId={brief.id} initial={brief.mindmap} aiReady={status.qwen || status.deepseek} />;
}
