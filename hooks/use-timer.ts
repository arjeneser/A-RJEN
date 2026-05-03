"use client";
import { useEffect, useRef, useState } from "react";
import { useActiveSession } from "@/store/flight-store";

/**
 * Drives the focus timer. Calls `onComplete` when the session ends.
 * Returns the live elapsed ms, remaining ms, and progress 0-1.
 */
export function useTimer(onComplete: () => void) {
  const {
    session,
    getElapsedMs,
    getProgress,
    pauseSession,
    resumeSession,
    completeSession,
  } = useActiveSession();

  const [tick, setTick] = useState(0); // force re-render every second
  const completedRef = useRef(false);

  useEffect(() => {
    if (!session || session.status === "completed" || session.status === "abandoned")
      return;

    const interval = setInterval(() => {
      if (session.status === "paused") {
        // Even when paused, auto-complete if time has expired
        const elapsed = getElapsedMs();
        if (elapsed >= session.durationMs && !completedRef.current) {
          completedRef.current = true;
          completeSession();
          clearInterval(interval);
          onComplete();
        }
        return;
      }

      const elapsed = getElapsedMs();
      if (elapsed >= session.durationMs && !completedRef.current) {
        completedRef.current = true;
        completeSession();
        clearInterval(interval);
        onComplete();
        return;
      }

      setTick((t) => t + 1);
    }, 500); // 500ms for smooth updates

    return () => clearInterval(interval);
  }, [session, getElapsedMs, completeSession, onComplete]);

  if (!session) {
    return {
      elapsedMs: 0,
      remainingMs: 0,
      progress: 0,
      isPaused: false,
      isCompleted: false,
      pause: () => {},
      resume: () => {},
    };
  }

  const elapsedMs = getElapsedMs();
  const remainingMs = Math.max(0, session.durationMs - elapsedMs);
  const progress = getProgress();

  return {
    elapsedMs,
    remainingMs,
    progress,
    isPaused: session.status === "paused",
    isCompleted: session.status === "completed",
    pause: pauseSession,
    resume: resumeSession,
  };
}
