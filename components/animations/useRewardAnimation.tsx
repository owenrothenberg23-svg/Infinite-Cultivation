// components/animations/useRewardAnimation.tsx
"use client";

import { useState } from "react";
import AnimationModal from "./AnimationModal";
import type { AnimationKey } from "./animationRegistry";

type ShowOptions = {
  title?: string;
  subtitle?: string;
};

export function useRewardAnimation() {
  const [visible, setVisible] = useState(false);
  const [animationKey, setAnimationKey] = useState<AnimationKey | null>(null);
  const [title, setTitle] = useState<string | undefined>();
  const [subtitle, setSubtitle] = useState<string | undefined>();

  const showRewardAnimation = (key: AnimationKey, options?: ShowOptions) => {
    setAnimationKey(key);
    setTitle(options?.title);
    setSubtitle(options?.subtitle);
    setVisible(true);
  };

  const RewardAnimationModal = visible && animationKey ? (
    <AnimationModal
      animationKey={animationKey}
      title={title}
      subtitle={subtitle}
      onClose={() => setVisible(false)}
    />
  ) : null;

  return {
    showRewardAnimation,
    RewardAnimationModal,
  };
}
