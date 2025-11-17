import { supabaseServer } from "@/lib/supabase";
import Link from "next/link";

export default async function Home() {
  // get all stories from Supabase
  const { data: stories, error } = await supabaseServer
    .from("stories")
    .select("id, title, updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    console.log("error loading stories:", error);
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-gray-200 p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center">
          Your Stories
        </h1>

        <div className="space-y-4">
          {stories && stories.length > 0 ? (
            stories.map((story: any) => (
              <Link
                key={story.id}
                href={`/read/${story.id}`}
                className="block rounded-lg border border-gray-700 bg-[#1a1a1a] p-4 hover:bg-[#222] transition"
              >
                <div className="text-xl font-semibold">
                  {story.title || "Untitled Story"}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Last updated:{" "}
                  {new Date(story.updated_at).toLocaleString()}
                </div>
              </Link>
            ))
          ) : (
            <p className="text-gray-400 text-center">
              No stories yet. Use /api/create-story to make one.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
