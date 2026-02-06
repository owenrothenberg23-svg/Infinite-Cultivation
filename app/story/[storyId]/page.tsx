import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function StoryPage({
  params,
}: {
  params: Promise<{ storyId: string }>;
}) {
  const { storyId } = await params;

  if (!storyId) {
    redirect("/new");
  }

  redirect(`/read/${storyId}`)

}
