import { serveFile } from "@/lib/files";

export async function GET(request: Request, { params }: { params: Promise<{ name: string }> }) {
  return serveFile("uploads", (await params).name, request);
}
