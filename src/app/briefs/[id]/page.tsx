import { notFound, redirect } from "next/navigation";
import { currentStep, readStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function BriefIndex({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const brief = readStore().briefs.find((item) => item.id === id);
  if (!brief) notFound();
  redirect(`/briefs/${id}/${currentStep(brief)}`);
}
