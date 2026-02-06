"use client";

import { useState } from "react";
import AnimationModal from "@/components/animations/AnimationModal";
import { AnimationKey } from "@/components/animations/animationRegistry";

export default function AnimationTestPage() {
  const [key, setKey] = useState<AnimationKey | null>(null);
  const [show, setShow] = useState(false);

  const open = (k: AnimationKey) => {
    setKey(k);
    setShow(true);
  };

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">🎬 Animation Test Page</h1>

      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => open("title-wealth")}
          className="rounded bg-emerald-500 px-4 py-2 text-white"
        >
          Test Wealth Title Animation
        </button>

        <button
          onClick={() => open("title-storyteller")}
          className="rounded bg-indigo-500 px-4 py-2 text-white"
        >
          Test Storyteller Title Animation
        </button>

        <button
          onClick={() => open("title-awakened")}
          className="rounded bg-slate-500 px-4 py-2 text-white"
        >
          Test Awakened Soul Animation
        </button>

        <button
          onClick={() => open("title-primeval")}
          className="rounded bg-red-600 px-4 py-2 text-white"
        >
          Test Primeval Dao Being Animation
        </button>

        <button
          onClick={() => open("spirit-pile")}
          className="rounded bg-yellow-500 px-4 py-2 text-black"
        >
          Test Spirit Stone: Pile
        </button>

        <button
          onClick={() => open("spirit-bag")}
          className="rounded bg-yellow-600 px-4 py-2 text-black"
        >
          Test Spirit Stone: Bag
        </button>

        <button
          onClick={() => open("spirit-ring")}
          className="rounded bg-yellow-700 px-4 py-2 text-black"
        >
          Test Spirit Stone: Ring
        </button>
      </div>

      {show && key && (
        <AnimationModal
          animationKey={key}
          title="Preview Animation"
          subtitle="This modal shows the Lottie animation"
          onClose={() => setShow(false)}
        />
      )}
    </div>
  );
}
