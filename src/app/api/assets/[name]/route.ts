import { serveFile } from "@/lib/files";

export async function GET(request: Request, { params }: { params: Promise<{ name: string }> }) {
  return serveFile("assets", (await params).name, request);
}
