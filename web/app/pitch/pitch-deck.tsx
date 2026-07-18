"use client";

/**
 * Keyboard-driven pitch deck controller: ← → (or space) to navigate,
 * Home/End to jump. Live stats fetched once from the reputation API with a
 * snapshot fallback, so the deck works offline on stage.
 */
import { useCallback, useEffect, useState } from "react";
import { CLOSE_SLIDES } from "./pitch-slides-close";
import { STORY_SLIDES } from "./pitch-slides-story";
import { FALLBACK_STATS, fetchPitchStats, type PitchStats } from "./pitch-stats";

const SLIDES = [...STORY_SLIDES, ...CLOSE_SLIDES];

export function PitchDeck() {
  const [index, setIndex] = useState(0);
  const [stats, setStats] = useState<PitchStats>(FALLBACK_STATS);

  useEffect(() => {
    fetchPitchStats().then(setStats).catch(() => {});
  }, []);

  const go = useCallback((delta: number) => {
    setIndex((i) => Math.min(SLIDES.length - 1, Math.max(0, i + delta)));
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") go(1);
      else if (e.key === "ArrowLeft" || e.key === "PageUp") go(-1);
      else if (e.key === "Home") setIndex(0);
      else if (e.key === "End") setIndex(SLIDES.length - 1);
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const slide = SLIDES[index];

  return (
    <div className="pitch-root">
      <div className="pitch-progress">
        <div style={{ width: `${((index + 1) / SLIDES.length) * 100}%` }} />
      </div>

      <main className="pitch-stage">
        {/* keying by slide id restarts the entrance animation on each advance */}
        <div className="pitch-slide" key={slide.id}>
          {slide.render(stats)}
        </div>
      </main>

      <footer className="pitch-bar">
        <span className="brand">
          <span className="tick">✓</span> verity · final-round pitch
        </span>
        <span className="spacer" />
        <span className="pitch-keys">
          <kbd>←</kbd>
          <kbd>→</kbd>
          <span>navigate</span>
        </span>
        <button className="pitch-nav-btn" onClick={() => go(-1)} disabled={index === 0} aria-label="Previous slide">
          ‹
        </button>
        <span className="pitch-count">
          {index + 1} / {SLIDES.length}
        </span>
        <button
          className="pitch-nav-btn"
          onClick={() => go(1)}
          disabled={index === SLIDES.length - 1}
          aria-label="Next slide"
        >
          ›
        </button>
      </footer>
    </div>
  );
}
