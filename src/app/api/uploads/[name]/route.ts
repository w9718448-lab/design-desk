import fs from "node:fs";
import { dataPath } from "@/lib/store";

const types: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };

export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!/^IMG-[a-f0-9]+\.(png|jpe?g|webp)$/.test(name)) return new Response("Not found", { status: 404 });
  try {
    const body = fs.readFileSync(dataPath("uploads", name));
    return new Response(body, { headers: { "Content-Type": types[name.split(".").pop()!], "Cache-Control": "private, max-age=31536000, immutable" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
