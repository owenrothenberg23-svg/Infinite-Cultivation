// components/animations/AnimationModal.tsx
"use client";

import { useEffect, useState } from "react";
import Lottie from "lottie-react";
import { AnimationKey, animationFiles } from "./animationRegistry";

type AnimationModalProps = {
  animationKey: AnimationKey;
  title?: string;
  subtitle?: string;
  onClose?: () => void;
};

const AnimationModal = ({
  animationKey,
  title,
  subtitle,
  onClose,
}: AnimationModalProps) => {
  const [animationData, setAnimationData] = useState<any | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAnimation() {
      try {
        const path = animationFiles[animationKey];
        const res = await fetch(path);

        if (!res.ok) {
          console.error(
            "Failed to load animation JSON (HTTP error):",
            path,
            res.status
          );
          return;
        }

        const text = await res.text();

        if (!text.trim()) {
          console.warn("Animation JSON file is empty:", path);
          return;
        }

        let json: any;
        try {
          json = JSON.parse(text);
        } catch (parseErr) {
          console.error("Invalid animation JSON format:", path, parseErr);
          return;
        }

        if (!cancelled) {
          setAnimationData(json);
        }
      } catch (err) {
        console.error("Error loading animation JSON", err);
      }
    }

    loadAnimation();

    return () => {
      cancelled = true;
    };
  }, [animationKey]);

  // If we couldn't load a valid animation, don't render the modal at all
  if (!animationData) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="relative w-full max-w-sm px-4">
        <div className="rounded-2xl bg-gray-900/90 border border-indigo-500/70 shadow-2xl px-4 pt-4 pb-6">
          <Lottie
            animationData={animationData}
            loop={false}
            autoplay
            style={{ width: "100%", height: 220 }}
          />

          {title && (
            <h2 className="mt-2 text-center text-xl font-bold text-white">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="mt-1 text-center text-sm text-gray-300">
              {subtitle}
            </p>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="mt-4 inline-flex w-full justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnimationModal;
