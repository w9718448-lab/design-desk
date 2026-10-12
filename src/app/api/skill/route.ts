import { readStore } from "@/lib/store";
import { rulesToSkill } from "@/lib/skill";

export const dynamic = "force-dynamic";

export async function GET() {
  return new Response(rulesToSkill(readStore().rules), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": "attachment; filename=SKILL.md",
    },
  });
}
