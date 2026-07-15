/**
 * Hand-coded 16x16 pixel sprites for every mech type, rendered to offscreen
 * canvases at load. Grid chars: `.` transparent, B body, D dark (outline),
 * A accent (panels), G glow (visor/core — dims on frame 2), S steel greeble.
 * Sprites face right; the renderer flips for left-facing units.
 */

export type SpriteKey =
  | "vanguard"
  | "skirmisher"
  | "juggernaut"
  | "stalker"
  | "striker"
  | "bruiser";

interface SpritePalette {
  B: string;
  D: string;
  A: string;
  G: string;
  S: string;
}

const PALETTES: Record<SpriteKey, SpritePalette> = {
  vanguard: { B: "#38bdf8", D: "#134f6e", A: "#a5e3ff", G: "#f0faff", S: "#33414f" },
  skirmisher: { B: "#4ade80", D: "#14532d", A: "#bbf7d0", G: "#f0fdf4", S: "#33414f" },
  juggernaut: { B: "#a78bfa", D: "#3f3175", A: "#ddd6fe", G: "#f5f3ff", S: "#33414f" },
  stalker: { B: "#f87171", D: "#7f1d1d", A: "#fecaca", G: "#fff1f2", S: "#3a3234" },
  striker: { B: "#fb7185", D: "#881337", A: "#fecdd3", G: "#fff1f2", S: "#3a3234" },
  bruiser: { B: "#b91c1c", D: "#450a0a", A: "#f87171", G: "#ffe4e6", S: "#3a3234" },
};

// prettier-ignore
const GRIDS: Record<SpriteKey, string[]> = {
  // Balanced humanoid — squared torso, right-arm cannon.
  vanguard: [
    "................",
    ".....DDDDD......",
    ".....DAGAD......",
    ".....DBBBD......",
    "..DDDDBBBDDDD...",
    "..DBBDBBBDBBDDD.",
    "..DBBDBGBDBSSSD.",
    "..DBBDBBBDBBDDD.",
    "..DDDDBBBDDDD...",
    ".....DBBBD......",
    ".....DBABD......",
    "....DDD.DDD.....",
    "....DBD.DBD.....",
    "....DBD.DBD.....",
    "...DDBD.DBDD....",
    "...DDDD.DDDD....",
  ],
  // Light scout — slim frame, antenna, long thin legs.
  skirmisher: [
    "......D.........",
    "......D.........",
    ".....DDDD.......",
    ".....DAGD.......",
    ".....DBBD.......",
    "...DDDBBDDDD....",
    "...DBDBGBDSSD...",
    "...DBDBBBDDD....",
    "...DDDBBDD......",
    ".....DBBD.......",
    ".....DABD.......",
    "....DD.DD.......",
    "....DB.DBD......",
    "...DB...DB......",
    "...DB...DB......",
    "..DDD...DDD.....",
  ],
  // Heavy walker — wide dome, twin shoulder guns, thick legs.
  juggernaut: [
    "....D......D....",
    "....DS.....DS...",
    "..DDDDDDDDDDDD..",
    ".DBBBBBAABBBBBD.",
    ".DBBBAGGGGABBBD.",
    ".DBBBBBBBBBBBBD.",
    ".DDBBBBBBBBBBDD.",
    ".DBBDBBBBBBDBBD.",
    ".DBBDBBGGBBDBBD.",
    ".DBBDBBBBBBDBBD.",
    ".DDDDBBBBBBDDDD.",
    "....DBBBBBBD....",
    "...DDBD..DBDD...",
    "...DBBD..DBBD...",
    "...DBBD..DBBD...",
    "..DDDDD..DDDDD..",
  ],
  // Quad spider — low slung pod, splayed legs, single eye.
  stalker: [
    "................",
    "................",
    "................",
    "......DDDDD.....",
    ".....DBBBBBD....",
    "....DBBGGBBBD...",
    "...DBBBBBBBBBD..",
    "..DDBABBBBABDD..",
    ".DD.DBBBBBBD.DD.",
    ".D.DDBDDDDBDD.D.",
    ".D.DB.D..D.BD.D.",
    ".DDB..D..D..BDD.",
    ".DB...D..D...BD.",
    ".DB..DD..DD..BD.",
    ".D...D....D...D.",
    ".DD..D....D..DD.",
  ],
  // Glass-cannon sniper — tall tripod, very long rifle.
  striker: [
    "................",
    "......DDD.......",
    ".....DAGAD......",
    ".....DBBBD......",
    "....DDBBBDD.....",
    "....DBDBDBDDDDDD",
    "....DBDGDBSSSSGD",
    "....DBDBDBDDDDDD",
    "....DDDBDDD.....",
    "......DBD.......",
    ".....DDBDD......",
    "....DB.D.BD.....",
    "...DB..D..BD....",
    "...DB..D..BD....",
    "..DB...D...BD...",
    "..DD..DDD..DD...",
  ],
  // Massive brawler — slab torso, huge fists, tiny head.
  bruiser: [
    "................",
    "......DDDD......",
    "......DGGD......",
    ".DDDDDDBBDDDDDD.",
    ".DBBBBBBBBBBBBD.",
    ".DBADBBBBBBDABD.",
    ".DBBDBBGGBBDBBD.",
    ".DBBDBBBBBBDBBD.",
    ".DBBDBBBBBBDBBD.",
    ".DBBDBABBABDBBD.",
    ".DDDDBBBBBBDDDD.",
    ".DBBD.DBBD.DBBD.",
    ".DBBDDDBBDDDBBD.",
    ".DDDDDBDDBDDDDD.",
    "....DBBD.DBBD...",
    "....DDDD.DDDD...",
  ],
};

const SIZE = 16;
const cache = new Map<string, HTMLCanvasElement>();

function renderFrame(key: SpriteKey, dimGlow: boolean): HTMLCanvasElement {
  const grid = GRIDS[key];
  const pal = PALETTES[key];
  const cv = document.createElement("canvas");
  cv.width = SIZE;
  cv.height = SIZE;
  const c = cv.getContext("2d")!;
  grid.forEach((row, y) => {
    if (row.length !== SIZE) {
      throw new Error(`sprite ${key} row ${y} is ${row.length} chars, want ${SIZE}`);
    }
    for (let x = 0; x < SIZE; x++) {
      const ch = row[x] as keyof SpritePalette | ".";
      if (ch === ".") continue;
      let color = pal[ch];
      if (ch === "G" && dimGlow) color = pal.A;
      c.fillStyle = color;
      c.fillRect(x, y, 1, 1);
    }
  });
  return cv;
}

/** Frame 0 = glow lit, frame 1 = glow dimmed (idle blink). */
export function getSprite(key: SpriteKey, frame: number): HTMLCanvasElement {
  const id = `${key}:${frame % 2}`;
  let cv = cache.get(id);
  if (!cv) {
    cv = renderFrame(key, frame % 2 === 1);
    cache.set(id, cv);
  }
  return cv;
}

/** Scaled-up PNG data URL for DOM previews (deploy slots, mission intros). */
export function spriteDataURL(key: SpriteKey, scale: number): string {
  const src = getSprite(key, 0);
  const cv = document.createElement("canvas");
  cv.width = SIZE * scale;
  cv.height = SIZE * scale;
  const c = cv.getContext("2d")!;
  c.imageSmoothingEnabled = false;
  c.drawImage(src, 0, 0, cv.width, cv.height);
  return cv.toDataURL();
}
