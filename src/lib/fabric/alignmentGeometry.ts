export interface SnapCandidate {
  value: number;
  guide: number;
}

export function findNearestSnap(value: number, candidates: SnapCandidate[], threshold: number) {
  let nearest: { delta: number; guide: number } | null = null;
  for (const candidate of candidates) {
    const delta = candidate.value - value;
    if (Math.abs(delta) > threshold) continue;
    if (!nearest || Math.abs(delta) < Math.abs(nearest.delta)) nearest = { delta, guide: candidate.guide };
  }
  return nearest;
}
