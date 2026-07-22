export type PositionCategory = "GK" | "DEF" | "MID" | "FWD";

export const PLAYER_POSITIONS = [
  { bit: 1, code: "GK", label: "Goalkeeper", category: "GK" },
  { bit: 2, code: "LB", label: "Left-back", category: "DEF" },
  { bit: 4, code: "CB", label: "Centre-back", category: "DEF" },
  { bit: 8, code: "RB", label: "Right-back", category: "DEF" },
  { bit: 16, code: "DML", label: "Defensive midfielder left", category: "DEF" },
  { bit: 32, code: "DMC", label: "Defensive midfielder centre", category: "DEF" },
  { bit: 64, code: "DMR", label: "Defensive midfielder right", category: "DEF" },
  { bit: 128, code: "LM", label: "Left midfielder", category: "MID" },
  { bit: 256, code: "CM", label: "Centre midfielder", category: "MID" },
  { bit: 512, code: "RM", label: "Right midfielder", category: "MID" },
  { bit: 1024, code: "AML", label: "Attacking midfielder left", category: "MID" },
  { bit: 2048, code: "AMC", label: "Attacking midfielder centre", category: "MID" },
  { bit: 4096, code: "AMR", label: "Attacking midfielder right", category: "MID" },
  { bit: 8192, code: "FL", label: "Forward left", category: "FWD" },
  { bit: 16384, code: "FC", label: "Forward centre", category: "FWD" },
  { bit: 32768, code: "FR", label: "Forward right", category: "FWD" },
] as const satisfies ReadonlyArray<{ bit: number; code: string; label: string; category: PositionCategory }>;

export function positionsForMask(mask: number | null) {
  if (!mask || mask < 1) return [];
  return PLAYER_POSITIONS.filter((position) => (mask & position.bit) === position.bit);
}

export function positionSummary(mask: number | null) {
  const positions = positionsForMask(mask);
  return positions.length ? positions.map((position) => position.code).join(" / ") : "N/A";
}

export function positionCategories(mask: number | null) {
  return [...new Set(positionsForMask(mask).map((position) => position.category))];
}

export function primaryPositionCategory(mask: number | null): PositionCategory | null {
  return positionsForMask(mask)[0]?.category || null;
}
