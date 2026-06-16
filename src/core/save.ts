// localStorage meta-progression. Only best-stats persist between runs; an
// in-progress run is not resumable (matches the arcade feel).

const KEY = "sizzle_rush_3d_save";

export interface MetaSave {
  bestDay: number;
  bestCoins: number;
  bestCombo: number;
  bestRep: number;
  bestStars: number;
  runs: number;
  muted: boolean;
  quality: "high" | "low";
  tutorialDone: boolean;
}

const DEFAULT: MetaSave = {
  bestDay: 0,
  bestCoins: 0,
  bestCombo: 0,
  bestRep: 0,
  bestStars: 0,
  runs: 0,
  muted: false,
  quality: "high",
  tutorialDone: false,
};

export function loadMeta(): MetaSave {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw) as Partial<MetaSave>;
    return { ...DEFAULT, ...parsed };
  } catch {
    return { ...DEFAULT };
  }
}

export function saveMeta(meta: MetaSave): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(meta));
  } catch {
    /* storage disabled — ignore */
  }
}
