export const GRID = 12;
export const COOLING = 3;
export const FIRE_DAMAGE = 1;

export const MISSIONS_PER_RUN = 3;
export const CORE_DROP_CHANCE = 0.5;
export const MISSION_BASE_SALVAGE = 2;
export const REPAIR_HP = 2;
export const REPAIR_COST = 1;
export const RECOVER_SALVAGE = 5;
export const RECOVER_CORES = 1;
export const REINFORCE_SALVAGE = 4;
export const REINFORCE_HP = 2;
export const REARM_SALVAGE = 3;
export const REARM_CORES = 3;

export type Team = "player" | "enemy";
export type Phase =
  | "deploy"
  | "player"
  | "enemy"
  | "salvage"
  | "runComplete"
  | "runFailed";
export type ArchetypeId = "vanguard" | "skirmisher" | "juggernaut";
export type TerrainKind =
  | "open"
  | "wreckage"
  | "cover"
  | "fire"
  | "greenfire"
  | "pit"
  | "water";

/** Hellfire's green flame burns exactly like regular fire. */
export function isFire(t: TerrainKind): boolean {
  return t === "fire" || t === "greenfire";
}
export type Impair = "none" | "full" | "move";

export interface Vec {
  x: number;
  y: number;
}

/**
 * Area a weapon threatens around its aim tile:
 * single = aim tile only; line2 = aim tile + the tile behind it (away from
 * the shooter); cross = aim tile + its 4 orthogonal neighbors.
 */
export type WeaponShape = "single" | "line2" | "cross";

export interface Weapon {
  name: string;
  damage: number;
  range: number;
  heat: number;
  /** Tiles to push the target along the attack vector after damage. */
  knockback?: number;
  /** Threatened area (defaults to "single"). */
  shape?: WeaponShape;
  /** Lobbed shot: ignores wreckage when tracing line of fire. */
  arcing?: boolean;
  /** Terrain left behind on open blast tiles after impact. */
  groundFire?: TerrainKind;
}

export interface Archetype {
  id: ArchetypeId;
  name: string;
  maxHp: number;
  moveRange: number;
  heatCap: number;
  blurb: string;
  weapons: Weapon[];
}

export const ARCHETYPES: Record<ArchetypeId, Archetype> = {
  vanguard: {
    id: "vanguard",
    name: "Vanguard",
    maxHp: 6,
    moveRange: 3,
    heatCap: 6,
    blurb: "Balanced line mech",
    weapons: [
      { name: "Autocannon", damage: 1, range: 3, heat: 2 },
      { name: "Siege Laser", damage: 4, range: 2, heat: 5 },
    ],
  },
  skirmisher: {
    id: "skirmisher",
    name: "Skirmisher",
    maxHp: 4,
    moveRange: 4,
    heatCap: 6,
    blurb: "Fast, fragile flanker",
    weapons: [
      { name: "Light SMG", damage: 2, range: 3, heat: 3 },
      { name: "Blade", damage: 3, range: 1, heat: 1 },
    ],
  },
  juggernaut: {
    id: "juggernaut",
    name: "Juggernaut",
    maxHp: 9,
    moveRange: 2,
    heatCap: 8,
    blurb: "Slow, heavy armor",
    weapons: [
      { name: "Heavy Cannon", damage: 4, range: 3, heat: 5 },
      { name: "Shotgun", damage: 3, range: 1, heat: 3 },
    ],
  },
};

export const ARCHETYPE_ORDER: ArchetypeId[] = [
  "vanguard",
  "skirmisher",
  "juggernaut",
];

/** Weapons buyable via Rearm in the Salvage Bay. */
export const WEAPON_CATALOG: Weapon[] = [
  { name: "Railgun", damage: 2, range: 5, heat: 2 },
  { name: "Plasma Mortar", damage: 5, range: 3, heat: 6 },
  { name: "Chainblade", damage: 5, range: 1, heat: 2 },
  { name: "Burst Laser", damage: 3, range: 3, heat: 4 },
];

export type EnemyKind = "stalker" | "striker" | "bruiser" | "barrager";

export interface EnemyArchetype {
  id: EnemyKind;
  name: string;
  hp: number;
  moveRange: number;
  heatCap: number;
  weapon: Weapon;
}

export const ENEMY_ARCHETYPES: Record<EnemyKind, EnemyArchetype> = {
  stalker: {
    id: "stalker",
    name: "Stalker",
    hp: 5,
    moveRange: 3,
    heatCap: 6,
    weapon: { name: "Scattergun", damage: 2, range: 2, heat: 0, shape: "line2" },
  },
  striker: {
    id: "striker",
    name: "Striker",
    hp: 2,
    moveRange: 3,
    heatCap: 4,
    weapon: { name: "Railgun", damage: 3, range: 5, heat: 0 },
  },
  bruiser: {
    id: "bruiser",
    name: "Bruiser",
    hp: 11,
    moveRange: 2,
    heatCap: 8,
    weapon: { name: "Hammer", damage: 3, range: 1, heat: 0, knockback: 1 },
  },
  barrager: {
    id: "barrager",
    name: "Barrager",
    hp: 3,
    moveRange: 2,
    heatCap: 6,
    weapon: {
      name: "Hellfire Missiles",
      damage: 1,
      range: 6,
      heat: 0,
      shape: "cross",
      arcing: true,
      groundFire: "greenfire",
    },
  },
};

/** A reinforcement wave: on `turn`, spawn markers appear; units arrive next turn. */
export interface WaveDef {
  turn: number;
  spawns: EnemyKind[];
}

/** A telegraphed incoming reinforcement. Blockable by standing on the tile. */
export interface PendingSpawn {
  pos: Vec;
  turnsUntil: number;
  kind: EnemyKind;
}

export type ObjectiveKind = "killAll" | "extract" | "hold" | "survive";

export type ObjectiveDef =
  | { kind: "killAll" }
  | { kind: "extract" }
  | { kind: "hold"; turns: number }
  | { kind: "survive"; turns: number };

/** Runtime objective state for the current mission. */
export interface ObjectiveState {
  kind: ObjectiveKind;
  /** extract: the cache tile while grounded; hold: the position to defend. */
  tile: Vec | null;
  /** hold: turns of occupation needed; survive: turns to outlast. */
  turnsRequired: number;
  /** hold: turns of occupation banked so far. */
  progress: number;
  /** extract: unit currently hauling the cache (slowed, can't fire). */
  carrierId: number | null;
}

export type StructureKind = "beacon";

/** A static, non-dodging emplacement enemies can attack. */
export interface Structure {
  id: number;
  kind: StructureKind;
  name: string;
  hp: number;
  maxHp: number;
  pos: Vec;
}

export interface MissionDef {
  enemies: EnemyKind[];
  waves: WaveDef[];
  /** Endless pressure: a wave every N turns (used by survive missions). */
  recurringWave?: { every: number; spawns: EnemyKind[] };
  /** Emplacements to defend; destruction of a beacon fails the run. */
  structures?: { kind: StructureKind; hp: number }[];
  objective: ObjectiveDef;
}

/** The 3-mission run (index = mission - 1). */
export const MISSION_DEFS: MissionDef[] = [
  {
    enemies: ["stalker", "stalker", "stalker"],
    waves: [],
    objective: { kind: "killAll" },
  },
  {
    enemies: ["stalker", "stalker", "striker"],
    waves: [{ turn: 3, spawns: ["stalker"] }],
    objective: { kind: "extract" },
  },
  {
    enemies: ["stalker", "stalker", "bruiser"],
    waves: [
      { turn: 2, spawns: ["stalker"] },
      { turn: 4, spawns: ["barrager"] },
    ],
    recurringWave: { every: 4, spawns: ["stalker"] },
    structures: [{ kind: "beacon", hp: 10 }],
    objective: { kind: "survive", turns: 9 },
  },
];

function missionDef(mission: number): MissionDef {
  return MISSION_DEFS[mission - 1] ?? MISSION_DEFS[0];
}

/** A committed enemy plan, revealed during the player's turn. */
export interface Intent {
  movePos: Vec;
  /** Aim tile (null = no attack this turn). */
  attackPos: Vec | null;
  /** Every tile the attack threatens, including the aim tile. */
  attackTiles: Vec[];
  damage: number;
  /** Tile the victim will be pushed to (only set for knockback weapons). */
  knockbackPos: Vec | null;
}

function inBounds(p: Vec): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < GRID && p.y < GRID;
}

/** Tiles threatened by a shot fired from `from` aimed at `aim`. */
export function aoeTiles(from: Vec, aim: Vec, shape: WeaponShape): Vec[] {
  const tiles: Vec[] = [{ ...aim }];
  if (shape === "line2") {
    const dx = aim.x - from.x;
    const dy = aim.y - from.y;
    const step =
      Math.abs(dx) >= Math.abs(dy)
        ? { x: Math.sign(dx), y: 0 }
        : { x: 0, y: Math.sign(dy) };
    tiles.push({ x: aim.x + step.x, y: aim.y + step.y });
  } else if (shape === "cross") {
    tiles.push(
      { x: aim.x + 1, y: aim.y },
      { x: aim.x - 1, y: aim.y },
      { x: aim.x, y: aim.y + 1 },
      { x: aim.x, y: aim.y - 1 },
    );
  }
  return tiles.filter(inBounds);
}

export interface Unit {
  id: number;
  team: Team;
  name: string;
  archetype: ArchetypeId | null;
  enemyKind: EnemyKind | null;
  hp: number;
  maxHp: number;
  pos: Vec;
  moveRange: number;
  heat: number;
  maxHeat: number;
  weapons: Weapon[];
  selectedWeapon: number;
  hasMoved: boolean;
  hasFired: boolean;
  /** Impairment that will apply on this unit's next turn (set on entering pit/water). */
  nextTurnImpair: Impair;
  /** Impairment active this turn. */
  impaired: Impair;
  intent: Intent | null;
}

export interface HazardHit {
  id: number;
  pos: Vec;
  damage: number;
}

export function manhattan(a: Vec, b: Vec): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function eq(a: Vec, b: Vec): boolean {
  return a.x === b.x && a.y === b.y;
}

const PLAYER_SPAWNS: Vec[] = [
  { x: 2, y: 9 },
  { x: 6, y: 10 },
  { x: 10, y: 9 },
];
const ENEMY_SPAWNS: Vec[] = [
  { x: 2, y: 2 },
  { x: 6, y: 1 },
  { x: 10, y: 2 },
];

// '.' open  '#' wreckage  'c' cover  'f' fire  'p' pit  'w' water. Spawns kept open.
const LAYOUTS: string[][] = [
  [
    "............",
    "..#......#..",
    "....c..c....",
    ".##......##.",
    "...#.ff.#...",
    ".....pp.....",
    ".....pp.....",
    "...#.ff.#...",
    ".##......##.",
    "...#c..c#...",
    "............",
    "w..........w",
  ],
  [
    "............",
    "....#..#....",
    ".....cc.....",
    "...#....#...",
    "www..ww..www",
    "...f....f...",
    "..#..pp..#..",
    "www..ww..www",
    "...#....#...",
    ".....cc.....",
    "....#..#....",
    "............",
  ],
  [
    "..#......#..",
    ".....#.#....",
    "...c....c...",
    ".#...ff...#.",
    "...#....#...",
    "..p..cc..p..",
    "....w..w....",
    "...#....#...",
    ".#...pp...#.",
    "...c....c...",
    ".....#.#....",
    "..#......#..",
  ],
];

function parseLayout(rows: string[]): TerrainKind[][] {
  return rows.map((row) =>
    [...row].map((ch): TerrainKind => {
      switch (ch) {
        case "#":
          return "wreckage";
        case "c":
          return "cover";
        case "f":
          return "fire";
        case "p":
          return "pit";
        case "w":
          return "water";
        default:
          return "open";
      }
    }),
  );
}

interface MoveNode {
  steps: number;
  parent: number;
  fires: number;
}

const SAVE_VERSION = 1;

/**
 * Everything mutable about a run, as plain data. Player units live in
 * `lance` (including dead ones); `unitOrder` rebuilds the units array from
 * lance members and `foes` so object identity survives a round-trip.
 */
interface GameState {
  lance: Unit[];
  foes: Unit[];
  unitOrder: number[];
  terrain: TerrainKind[][];
  phase: Phase;
  selectedId: number | null;
  recentHazardHits: HazardHit[];
  wreckMarks: Vec[];
  turn: number;
  pendingSpawns: PendingSpawn[];
  recentSpawns: Vec[];
  recentSpawnBlocks: HazardHit[];
  objective: ObjectiveState;
  objectiveComplete: boolean;
  criticalLoss: boolean;
  failReason: string | null;
  structures: Structure[];
  exfilTiles: Vec[];
  mission: number;
  salvage: number;
  cores: number;
  lastSalvageEarned: number;
  nextId: number;
}

export class Game {
  units: Unit[] = [];
  /** The player's 3 mechs — persist across the whole run (HP and upgrades carry). */
  lance: Unit[] = [];
  terrain: TerrainKind[][] = [];
  phase: Phase = "deploy";
  selectedId: number | null = null;
  /** Fire ticks applied at the start of the most recent player turn. */
  recentHazardHits: HazardHit[] = [];
  /** Tiles where a mech was destroyed this mission (visual debris). */
  wreckMarks: Vec[] = [];
  /** Player-turn counter within the current mission (1-based). */
  turn = 0;
  /** Telegraphed reinforcements that have not arrived yet. */
  pendingSpawns: PendingSpawn[] = [];
  /** Tiles where reinforcements arrived at the start of this player turn. */
  recentSpawns: Vec[] = [];
  /** Damage dealt to units blocking a spawn tile this turn. */
  recentSpawnBlocks: HazardHit[] = [];
  /** The current mission's objective. */
  objective: ObjectiveState = {
    kind: "killAll",
    tile: null,
    turnsRequired: 0,
    progress: 0,
    carrierId: null,
  };
  /** Set when the objective is achieved (checked by checkEnd). */
  private objectiveComplete = false;
  /** Emplacements on the field this mission. */
  structures: Structure[] = [];
  /** extract: tiles the carrier must reach to win. */
  exfilTiles: Vec[] = [];
  /** Why the run failed, when a specific event caused it. */
  failReason: string | null = null;
  /** Set when a must-defend structure is destroyed. */
  private criticalLoss = false;
  mission = 0;
  salvage = 0;
  cores = 0;
  /** Salvage awarded for the most recently cleared mission. */
  lastSalvageEarned = 0;
  /** True once the player has moved or fired this turn (enables undo). */
  turnDirty = false;
  /** State as of the start of the current player turn (undo target). */
  private turnStart: GameState | null = null;
  private nextId = 1;

  /** Start a new run: build the lance and deploy into mission 1. */
  deploy(lanceArchetypes: ArchetypeId[]): void {
    this.nextId = 1;
    this.mission = 0;
    this.salvage = 0;
    this.cores = 0;
    this.lastSalvageEarned = 0;
    this.lance = lanceArchetypes.map((aid, i) => {
      const a = ARCHETYPES[aid];
      return {
        id: this.nextId++,
        team: "player" as Team,
        name: a.name,
        archetype: aid,
        enemyKind: null,
        hp: a.maxHp,
        maxHp: a.maxHp,
        pos: { ...PLAYER_SPAWNS[i] },
        moveRange: a.moveRange,
        heat: 0,
        maxHeat: a.heatCap,
        weapons: a.weapons.map((w) => ({ ...w })),
        selectedWeapon: 0,
        hasMoved: false,
        hasFired: false,
        nextTurnImpair: "none" as Impair,
        impaired: "none" as Impair,
        intent: null,
      };
    });
    this.startMission();
  }

  /** Build the next mission's battlefield from the surviving lance. */
  private startMission(): void {
    this.mission += 1;
    this.recentHazardHits = [];
    this.wreckMarks = [];
    this.terrain = parseLayout(
      LAYOUTS[Math.floor(Math.random() * LAYOUTS.length)],
    );

    this.units = [];
    this.lance.forEach((u, i) => {
      if (u.hp <= 0) return;
      u.pos = { ...PLAYER_SPAWNS[i] };
      u.heat = 0;
      u.hasMoved = false;
      u.hasFired = false;
      u.nextTurnImpair = "none";
      u.impaired = "none";
      u.intent = null;
      u.selectedWeapon = 0;
      this.units.push(u);
    });
    const def = missionDef(this.mission);
    def.enemies.forEach((kind, i) => {
      this.spawnEnemy(kind, ENEMY_SPAWNS[i] ?? ENEMY_SPAWNS[0]);
    });
    this.turn = 0;
    this.pendingSpawns = [];
    this.recentSpawns = [];
    this.recentSpawnBlocks = [];
    this.objectiveComplete = false;
    this.criticalLoss = false;
    this.failReason = null;
    this.structures = [];
    this.exfilTiles = [];
    for (const s of def.structures ?? []) {
      this.structures.push({
        id: this.nextId++,
        kind: s.kind,
        name: "Lift Beacon",
        hp: s.hp,
        maxHp: s.hp,
        // Keep the beacon out of the enemy-side 40% of the board so the
        // lance can realistically reach it before the first wave does.
        pos: this.pickObjectiveTile(6, 9),
      });
    }
    this.objective = this.buildObjective(def.objective);
    this.startPlayerTurn(true);
  }

  private spawnEnemy(kind: EnemyKind, pos: Vec): Unit {
    const a = ENEMY_ARCHETYPES[kind];
    const n = this.units.filter((u) => u.enemyKind === kind).length + 1;
    const u: Unit = {
      id: this.nextId++,
      team: "enemy",
      name: `${a.name} ${n}`,
      archetype: null,
      enemyKind: kind,
      hp: a.hp,
      maxHp: a.hp,
      pos: { ...pos },
      moveRange: a.moveRange,
      heat: 0,
      maxHeat: a.heatCap,
      weapons: [{ ...a.weapon }],
      selectedWeapon: 0,
      hasMoved: false,
      hasFired: false,
      nextTurnImpair: "none",
      impaired: "none",
      intent: null,
    };
    this.units.push(u);
    return u;
  }

  /**
   * Resolve telegraphed spawns at the start of a player turn. A unit standing
   * on a spawn tile blocks it: the arrival is delayed and the blocker takes
   * 1 damage per turn spent blocking.
   */
  private resolveSpawns(): void {
    const remaining: PendingSpawn[] = [];
    for (const s of this.pendingSpawns) {
      if (s.turnsUntil > 1) {
        remaining.push({ ...s, turnsUntil: s.turnsUntil - 1 });
        continue;
      }
      const blocker = this.livingAt(s.pos);
      if (blocker) {
        this.applyDamage(blocker, 1);
        this.recentSpawnBlocks.push({
          id: blocker.id,
          pos: { ...s.pos },
          damage: 1,
        });
        remaining.push(s);
      } else {
        this.spawnEnemy(s.kind, s.pos);
        this.recentSpawns.push({ ...s.pos });
      }
    }
    this.pendingSpawns = remaining;
  }

  /** Materialize the mission's objective, picking marker tiles on this map. */
  private buildObjective(def: ObjectiveDef): ObjectiveState {
    if (def.kind === "extract") {
      this.exfilTiles = this.pickExfilTiles();
      return {
        kind: "extract",
        tile: this.pickObjectiveTile(1, 3),
        turnsRequired: 0,
        progress: 0,
        carrierId: null,
      };
    }
    if (def.kind === "hold") {
      return {
        kind: "hold",
        tile: this.pickObjectiveTile(4, 7),
        turnsRequired: def.turns,
        progress: 0,
        carrierId: null,
      };
    }
    if (def.kind === "survive") {
      return {
        kind: "survive",
        tile: null,
        turnsRequired: def.turns,
        progress: 0,
        carrierId: null,
      };
    }
    return {
      kind: "killAll",
      tile: null,
      turnsRequired: 0,
      progress: 0,
      carrierId: null,
    };
  }

  /** Random clear tile with y in [yMin, yMax], biased toward the middle columns. */
  private pickObjectiveTile(yMin: number, yMax: number): Vec {
    const cands: Vec[] = [];
    for (let y = yMin; y <= yMax; y++) {
      for (let x = 2; x <= GRID - 3; x++) {
        const p = { x, y };
        if (this.terrainAt(p) !== "open") continue;
        if (this.livingAt(p)) continue;
        if (this.structureAt(p)) continue;
        cands.push(p);
      }
    }
    if (cands.length === 0) return { x: Math.floor(GRID / 2), y: yMin };
    return cands[Math.floor(Math.random() * cands.length)];
  }

  /** Three open tiles on the player's board edge where the carrier can exfil. */
  private pickExfilTiles(): Vec[] {
    const y = GRID - 1;
    // find the run of open tiles closest to the board center
    let best: Vec[] = [];
    let run: Vec[] = [];
    for (let x = 0; x < GRID; x++) {
      const p = { x, y };
      if (this.terrainAt(p) === "open" && !this.structureAt(p)) {
        run.push(p);
      } else {
        if (run.length > best.length) best = run;
        run = [];
      }
    }
    if (run.length > best.length) best = run;
    if (best.length <= 3) return best;
    const mid = Math.floor(best.length / 2);
    return best.slice(Math.max(0, mid - 1), mid + 2);
  }

  /**
   * Cache pickup and delivery. Stepping onto the grounded cache makes this
   * mech the carrier (and trips the alarm); a carrier reaching an exfil tile
   * completes the mission.
   */
  private touchObjective(u: Unit): void {
    if (this.objectiveComplete) return;
    const o = this.objective;
    if (o.kind !== "extract" || u.team !== "player" || u.hp <= 0) return;
    if (o.carrierId === null && o.tile && eq(u.pos, o.tile)) {
      o.carrierId = u.id;
      o.tile = null;
      this.triggerAlarm();
    } else if (
      o.carrierId === u.id &&
      this.exfilTiles.some((t) => eq(t, u.pos))
    ) {
      this.objectiveComplete = true;
    }
  }

  /** Grabbing the cache calls in an immediate response drop. */
  private triggerAlarm(): void {
    for (const kind of ["stalker", "striker"] as EnemyKind[]) {
      const pos = this.pickSpawnTile();
      if (pos) this.pendingSpawns.push({ pos, kind, turnsUntil: 1 });
    }
  }

  /** Queue up spawn markers for waves scheduled to telegraph this turn. */
  private enqueueWaves(): void {
    const def = missionDef(this.mission);
    for (const w of def.waves) {
      if (w.turn !== this.turn) continue;
      for (const kind of w.spawns) {
        const pos = this.pickSpawnTile();
        if (pos) this.pendingSpawns.push({ pos, kind, turnsUntil: 1 });
      }
    }
    const rec = def.recurringWave;
    if (rec && this.turn > 1 && this.turn % rec.every === 0) {
      for (const kind of rec.spawns) {
        const pos = this.pickSpawnTile();
        if (pos) this.pendingSpawns.push({ pos, kind, turnsUntil: 1 });
      }
    }
  }

  /** Free tile on the enemy edge of the map for a reinforcement to arrive. */
  private pickSpawnTile(): Vec | null {
    for (const y of [0, 1]) {
      const cands: Vec[] = [];
      for (let x = 0; x < GRID; x++) {
        const p = { x, y };
        const t = this.terrainAt(p);
        if (t !== "open" && t !== "cover") continue;
        if (this.livingAt(p)) continue;
        if (this.structureAt(p)) continue;
        if (this.pendingSpawns.some((s) => eq(s.pos, p))) continue;
        cands.push(p);
      }
      if (cands.length > 0) {
        return cands[Math.floor(Math.random() * cands.length)];
      }
    }
    return null;
  }

  /** Advance from the Salvage Bay into the next mission. */
  nextMission(): void {
    if (this.phase !== "salvage") return;
    this.startMission();
  }

  openDeploy(): void {
    this.phase = "deploy";
    this.units = [];
    this.lance = [];
    this.selectedId = null;
    this.mission = 0;
    this.salvage = 0;
    this.cores = 0;
    this.wreckMarks = [];
    this.structures = [];
    this.exfilTiles = [];
    this.pendingSpawns = [];
    this.failReason = null;
  }

  terrainAt(p: Vec): TerrainKind {
    const row = this.terrain[p.y];
    return row && row[p.x] ? row[p.x] : "open";
  }

  players(): Unit[] {
    return this.units.filter((u) => u.team === "player" && u.hp > 0);
  }

  enemies(): Unit[] {
    return this.units.filter((u) => u.team === "enemy" && u.hp > 0);
  }

  get selected(): Unit | null {
    const u = this.units.find((x) => x.id === this.selectedId);
    return u && u.hp > 0 ? u : null;
  }

  livingAt(pos: Vec): Unit | undefined {
    return this.units.find((u) => u.hp > 0 && eq(u.pos, pos));
  }

  structureAt(pos: Vec): Structure | undefined {
    return this.structures.find((s) => s.hp > 0 && eq(s.pos, pos));
  }

  /** Carriers haul the cache one tile slower. */
  effectiveMove(u: Unit): number {
    const hauling = this.objective.carrierId === u.id;
    return Math.max(1, u.moveRange - (hauling ? 1 : 0));
  }

  selectUnit(id: number): void {
    const u = this.units.find((x) => x.id === id);
    if (u && u.team === "player" && u.hp > 0) this.selectedId = id;
  }

  selectWeapon(u: Unit, i: number): void {
    if (i >= 0 && i < u.weapons.length) u.selectedWeapon = i;
  }

  allPlayersActed(): boolean {
    return this.players().every((u) => u.hasMoved && u.hasFired);
  }

  /**
   * Whether a clear straight line of fire exists. Wreckage blocks it, and a
   * mech down in a pit is shielded from any attacker that is not adjacent.
   */
  hasLineOfFire(a: Vec, b: Vec, arcing = false): boolean {
    if (this.terrainAt(b) === "pit" && manhattan(a, b) > 1) return false;
    if (arcing) return true; // lobbed shots clear wreckage
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const steps = Math.max(Math.abs(dx), Math.abs(dy)) * 6;
    if (steps === 0) return true;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const tx = Math.round(a.x + dx * t);
      const ty = Math.round(a.y + dy * t);
      if ((tx === a.x && ty === a.y) || (tx === b.x && ty === b.y)) continue;
      if (this.terrainAt({ x: tx, y: ty }) === "wreckage") return false;
    }
    return true;
  }

  /** Cover on the target tile soaks 1 damage. */
  damageAfterCover(base: number, tile: Vec): number {
    return this.terrainAt(tile) === "cover" ? Math.max(0, base - 1) : base;
  }

  private neighbors(p: Vec): Vec[] {
    return [
      { x: p.x + 1, y: p.y },
      { x: p.x - 1, y: p.y },
      { x: p.x, y: p.y + 1 },
      { x: p.x, y: p.y - 1 },
    ];
  }

  /**
   * BFS movement map. Wreckage and units block; pit/water can be entered but
   * not crossed; paths prefer routes through fewer fire tiles.
   */
  private moveMap(u: Unit): Map<number, MoveNode> {
    const map = new Map<number, MoveNode>();
    const startK = u.pos.y * GRID + u.pos.x;
    map.set(startK, { steps: 0, parent: -1, fires: 0 });
    let frontier: Vec[] = [u.pos];
    for (let step = 1; step <= this.effectiveMove(u); step++) {
      const next: Vec[] = [];
      for (const p of frontier) {
        const pk = p.y * GRID + p.x;
        const pInfo = map.get(pk)!;
        for (const n of this.neighbors(p)) {
          if (n.x < 0 || n.y < 0 || n.x >= GRID || n.y >= GRID) continue;
          const t = this.terrainAt(n);
          if (t === "wreckage") continue;
          if (this.livingAt(n)) continue;
          if (this.structureAt(n)) continue;
          const nk = n.y * GRID + n.x;
          const nFires = pInfo.fires + (isFire(t) ? 1 : 0);
          const existing = map.get(nk);
          if (existing) {
            if (existing.steps === step && nFires < existing.fires) {
              existing.parent = pk;
              existing.fires = nFires;
            }
            continue;
          }
          map.set(nk, { steps: step, parent: pk, fires: nFires });
          if (t !== "pit" && t !== "water") next.push(n);
        }
      }
      frontier = next;
    }
    return map;
  }

  /** Tiles a player unit may move to this turn. */
  moveTiles(u: Unit): Vec[] {
    if (this.phase !== "player" || u.team !== "player" || u.hasMoved) return [];
    const out: Vec[] = [];
    for (const [k, node] of this.moveMap(u)) {
      if (node.steps >= 1) out.push({ x: k % GRID, y: Math.floor(k / GRID) });
    }
    return out;
  }

  /**
   * Move a unit to a tile. Returns the fire tiles crossed in transit (each
   * deals 1 damage and maxes heat), or null if the move is invalid.
   */
  moveUnit(u: Unit, dest: Vec): Vec[] | null {
    if (this.phase !== "player" || u.team !== "player" || u.hasMoved) {
      return null;
    }
    const map = this.moveMap(u);
    const destK = dest.y * GRID + dest.x;
    const node = map.get(destK);
    if (!node || node.steps < 1) return null;

    const path: Vec[] = [];
    let k = destK;
    const startK = u.pos.y * GRID + u.pos.x;
    while (k !== -1 && k !== startK) {
      path.push({ x: k % GRID, y: Math.floor(k / GRID) });
      const ni = map.get(k);
      k = ni ? ni.parent : -1;
    }
    path.reverse();

    u.pos = { x: dest.x, y: dest.y };
    u.hasMoved = true;
    this.turnDirty = true;

    const fireCrossed: Vec[] = [];
    for (let i = 0; i < path.length - 1; i++) {
      if (isFire(this.terrainAt(path[i]))) {
        u.heat = u.maxHeat;
        this.applyDamage(u, FIRE_DAMAGE);
        fireCrossed.push(path[i]);
      }
    }

    const dt = this.terrainAt(dest);
    if (dt === "pit") u.nextTurnImpair = "full";
    else if (dt === "water") u.nextTurnImpair = "move";

    this.touchObjective(u);
    if (fireCrossed.length || this.objectiveComplete) this.checkEnd();
    return fireCrossed;
  }

  canFireWeaponAt(u: Unit, i: number, target: Unit): boolean {
    if (this.phase !== "player" || u.team !== "player" || u.hasFired)
      return false;
    if (u.hp <= 0 || target.team !== "enemy" || target.hp <= 0) return false;
    // A mech down in a pit cannot fire — it must climb out first.
    if (this.terrainAt(u.pos) === "pit") return false;
    // The cache carrier's hands are full.
    if (this.objective.carrierId === u.id) return false;
    const w = u.weapons[i];
    if (!w) return false;
    if (manhattan(u.pos, target.pos) > w.range) return false;
    return this.hasLineOfFire(u.pos, target.pos, w.arcing ?? false);
  }

  /** True if the unit's selected weapon can hit any enemy right now. */
  canFire(u: Unit): boolean {
    return this.enemies().some((e) =>
      this.canFireWeaponAt(u, u.selectedWeapon, e),
    );
  }

  /**
   * Fire the selected weapon. Heat past the cap is dealt as self-damage to
   * the firing unit. A destroyed enemy may drop a Core.
   */
  fireAt(
    u: Unit,
    target: Unit,
  ): { damage: number; heat: number; selfDamage: number; coreDropped: boolean } | null {
    if (!this.canFireWeaponAt(u, u.selectedWeapon, target)) return null;
    const w = u.weapons[u.selectedWeapon];
    const dmg = this.damageAfterCover(w.damage, target.pos);
    this.applyDamage(target, dmg);

    let coreDropped = false;
    if (target.team === "enemy" && target.hp === 0) {
      if (Math.random() < CORE_DROP_CHANCE) {
        this.cores += 1;
        coreDropped = true;
      }
    }

    const overflow = Math.max(0, u.heat + w.heat - u.maxHeat);
    u.heat = Math.min(u.maxHeat, u.heat + w.heat);
    if (overflow > 0) this.applyDamage(u, overflow);

    u.hasFired = true;
    this.turnDirty = true;
    this.checkEnd();
    return { damage: dmg, heat: w.heat, selfDamage: overflow, coreDropped };
  }

  endTurn(): void {
    if (this.phase === "player") this.phase = "enemy";
  }

  /** Fire damage at the end of the player turn. Call at end of player turn. */
  endTurnHazards(): HazardHit[] {
    const hits: HazardHit[] = [];
    for (const u of this.units) {
      if (u.hp <= 0 || !isFire(this.terrainAt(u.pos))) continue;
      u.heat = u.maxHeat;
      this.applyDamage(u, FIRE_DAMAGE);
      hits.push({ id: u.id, pos: { ...u.pos }, damage: FIRE_DAMAGE });
    }
    if (hits.length) this.checkEnd();
    return hits;
  }

  /** Enemy walks toward its planned tile, unless that tile is blocked. */
  enemyExecuteMove(e: Unit): void {
    if (!e.intent || e.hp <= 0) return;
    const dest = e.intent.movePos;
    if (eq(dest, e.pos)) return;
    const occ = this.livingAt(dest);
    if (occ && occ.id !== e.id) return;
    if (this.structureAt(dest)) return;
    e.pos = { x: dest.x, y: dest.y };
  }

  /**
   * Enemy fires at its telegraphed tiles. Every unit standing in the
   * threatened area is hit — including other enemies (AoE friendly fire).
   * Knockback applies only to the unit on the aim tile.
   */
  enemyExecuteAttack(
    e: Unit,
  ): {
    aim: Vec;
    tiles: Vec[];
    hits: {
      id: number;
      pos: Vec;
      damage: number;
      killed: boolean;
      knockTo: Vec | null;
    }[];
    groundFire: Vec[];
  } | null {
    if (!e.intent || !e.intent.attackPos || e.hp <= 0) return null;
    const aim = e.intent.attackPos;
    const tiles =
      e.intent.attackTiles.length > 0 ? e.intent.attackTiles : [aim];
    const hits: {
      id: number;
      pos: Vec;
      damage: number;
      killed: boolean;
      knockTo: Vec | null;
    }[] = [];

    for (const pos of tiles) {
      const victim = this.units.find(
        (u) => u.id !== e.id && u.hp > 0 && eq(u.pos, pos),
      );
      if (!victim) {
        const s = this.structureAt(pos);
        if (s) {
          // Structures are fireproof — incendiary payloads can't hurt them.
          const dmg = e.weapons[0]?.groundFire
            ? 0
            : this.damageAfterCover(e.intent.damage, pos);
          const killed = this.applyStructureDamage(s, dmg);
          hits.push({
            id: s.id,
            pos: { ...pos },
            damage: dmg,
            killed,
            knockTo: null,
          });
        }
        continue;
      }
      const dmg = this.damageAfterCover(e.intent.damage, pos);
      this.applyDamage(victim, dmg);
      let knockTo: Vec | null = null;
      if (victim.hp > 0 && eq(pos, aim) && e.intent.knockbackPos) {
        const kp = e.intent.knockbackPos;
        const blocked =
          !inBounds(kp) ||
          this.terrainAt(kp) === "wreckage" ||
          !!this.livingAt(kp);
        if (!blocked) {
          victim.pos = { x: kp.x, y: kp.y };
          knockTo = { x: kp.x, y: kp.y };
          const t = this.terrainAt(kp);
          if (isFire(t)) {
            victim.heat = victim.maxHeat;
            this.applyDamage(victim, FIRE_DAMAGE);
          } else if (t === "pit") {
            victim.nextTurnImpair = "full";
          } else if (t === "water") {
            victim.heat = 0;
            victim.nextTurnImpair = "move";
          }
          // Being punched onto the extract cache still counts.
          this.touchObjective(victim);
        }
      }
      hits.push({
        id: victim.id,
        pos: { ...pos },
        damage: dmg,
        killed: victim.hp === 0,
        knockTo,
      });
    }

    // Incendiary payloads torch the open ground they land on.
    const groundFire: Vec[] = [];
    const gf = e.weapons[0]?.groundFire;
    if (gf) {
      for (const pos of tiles) {
        if (this.terrainAt(pos) !== "open") continue;
        if (this.structureAt(pos)) continue; // no flames under the beacon
        const row = this.terrain[pos.y];
        if (!row) continue;
        row[pos.x] = gf;
        groundFire.push({ ...pos });
      }
    }

    if (hits.length > 0) this.checkEnd();
    return {
      aim: { ...aim },
      tiles: tiles.map((t) => ({ ...t })),
      hits,
      groundFire,
    };
  }

  endEnemyPhase(): void {
    if (this.phase !== "enemy") return;
    this.startPlayerTurn(false);
  }

  /** Resolve a mission outcome: award salvage on a win, or end the run. */
  private checkEnd(): void {
    if (this.phase !== "player" && this.phase !== "enemy") return;
    if (this.criticalLoss) {
      this.phase = "runFailed";
      return;
    }
    if (this.players().length === 0) {
      this.failReason = "The lance is down.";
      this.phase = "runFailed";
      return;
    }
    // Clearing the board only wins kill-all missions. Extract and survive
    // objectives must be completed on their own terms.
    const boardCleared =
      this.objective.kind === "killAll" &&
      this.enemies().length === 0 &&
      this.pendingSpawns.length === 0 &&
      !missionDef(this.mission).recurringWave;
    if (this.objectiveComplete || boardCleared) {
      this.lastSalvageEarned = MISSION_BASE_SALVAGE + this.players().length;
      this.salvage += this.lastSalvageEarned;
      this.phase =
        this.mission >= MISSIONS_PER_RUN ? "runComplete" : "salvage";
    }
  }

  /** Apply damage to a unit; if it transitions to 0 HP, its tile becomes fire. */
  private applyDamage(u: Unit, dmg: number): boolean {
    if (dmg <= 0 || u.hp <= 0) return false;
    u.hp = Math.max(0, u.hp - dmg);
    if (u.hp === 0) {
      this.onUnitDestroyed(u);
      return true;
    }
    return false;
  }

  /** A destroyed mech leaves a burning wreck — the tile becomes fire. */
  private onUnitDestroyed(u: Unit): void {
    const row = this.terrain[u.pos.y];
    if (row) row[u.pos.x] = "fire";
    this.wreckMarks.push({ x: u.pos.x, y: u.pos.y });
    // A dead carrier drops the cache where it fell.
    if (this.objective.carrierId === u.id) {
      this.objective.carrierId = null;
      this.objective.tile = { x: u.pos.x, y: u.pos.y };
    }
  }

  private applyStructureDamage(s: Structure, dmg: number): boolean {
    if (dmg <= 0 || s.hp <= 0) return false;
    s.hp = Math.max(0, s.hp - dmg);
    if (s.hp === 0) {
      const row = this.terrain[s.pos.y];
      if (row) row[s.pos.x] = "fire";
      this.wreckMarks.push({ x: s.pos.x, y: s.pos.y });
      if (s.kind === "beacon") {
        this.criticalLoss = true;
        this.failReason = "The lift beacon was destroyed.";
      }
      return true;
    }
    return false;
  }

  /** Hold/survive objectives advance at the start of each player turn. */
  private tickObjective(): void {
    const o = this.objective;
    if (o.kind === "hold" && o.tile) {
      const occ = this.livingAt(o.tile);
      if (occ && occ.team === "player") {
        o.progress += 1;
        if (o.progress >= o.turnsRequired) this.objectiveComplete = true;
      }
    } else if (o.kind === "survive") {
      if (this.turn > o.turnsRequired) this.objectiveComplete = true;
    }
  }

  private startPlayerTurn(first: boolean): void {
    this.phase = "player";
    this.turn += 1;
    this.recentHazardHits = [];
    this.recentSpawns = [];
    this.recentSpawnBlocks = [];
    this.resolveSpawns();
    this.enqueueWaves();
    this.tickObjective();
    for (const u of this.units) {
      if (u.team !== "player" || u.hp <= 0) continue;
      u.impaired = u.nextTurnImpair;
      u.nextTurnImpair = "none";
      u.hasMoved = u.impaired === "full" || u.impaired === "move";
      u.hasFired = u.impaired === "full";
      if (!first) u.heat = Math.max(0, u.heat - COOLING);
      const t = this.terrainAt(u.pos);
      if (t === "water") {
        u.heat = 0;
      } else if (isFire(t)) {
        u.heat = u.maxHeat;
        this.applyDamage(u, FIRE_DAMAGE);
        this.recentHazardHits.push({
          id: u.id,
          pos: { ...u.pos },
          damage: FIRE_DAMAGE,
        });
      }
    }
    this.checkEnd();
    if (this.phase === "player") this.planEnemies();
    const active =
      this.players().find((u) => !u.hasMoved || !u.hasFired) ??
      this.players()[0];
    this.selectedId = active ? active.id : null;
    this.turnDirty = false;
    this.turnStart = this.phase === "player" ? this.capture() : null;
  }

  /**
   * Plan every enemy in a coordinated pass: track each player's projected HP
   * after committed attacks so subsequent enemies pile onto wounded targets
   * (focus fire) and don't waste shots on someone already planned to die.
   */
  private planEnemies(): void {
    const projectedHp = new Map<number, number>();
    for (const p of this.players()) projectedHp.set(p.id, p.hp);
    for (const s of this.structures) {
      if (s.hp > 0) projectedHp.set(s.id, s.hp);
    }

    // Clear first so planOne can tell freshly-planned peers (non-null
    // intent) from peers still carrying last turn's stale plan.
    for (const e of this.enemies()) e.intent = null;

    for (const e of this.enemies()) {
      e.intent = this.planOne(e, projectedHp);
      if (e.intent.attackPos) {
        for (const tile of e.intent.attackTiles) {
          const target =
            this.players().find((p) => eq(p.pos, tile)) ??
            this.structureAt(tile);
          if (!target) continue;
          const dmg = this.damageAfterCover(e.intent.damage, tile);
          const remaining = (projectedHp.get(target.id) ?? target.hp) - dmg;
          projectedHp.set(target.id, Math.max(0, remaining));
        }
      }
    }
  }

  /**
   * Plan one enemy. Considers every possible (target, strike-position) pair
   * and picks the one whose target has the lowest projected HP. Tiebreaks by
   * moving the shortest distance. If no shot is viable, advances toward the
   * weakest player. Enemies avoid ending on fire, pit, or water tiles.
   */
  private planOne(e: Unit, projectedHp: Map<number, number>): Intent {
    const gun = e.weapons[0];
    const shape: WeaponShape = gun.shape ?? "single";
    const arcing = gun.arcing ?? false;
    // Structures can't dodge, so they're always-valid targets; the carrier
    // is the priority target on extract missions.
    const carrierId = this.objective.carrierId;
    interface TargetRef {
      id: number;
      pos: Vec;
      hp: number;
      isStructure: boolean;
    }
    const targets: TargetRef[] = [
      ...this.players().map((p) => ({
        id: p.id,
        pos: p.pos,
        hp: p.hp,
        isStructure: false,
      })),
      ...this.structures
        .filter((s) => s.hp > 0)
        .map((s) => ({ id: s.id, pos: s.pos, hp: s.hp, isStructure: true })),
    ];
    if (targets.length === 0) {
      return {
        movePos: { ...e.pos },
        attackPos: null,
        attackTiles: [],
        damage: gun.damage,
        knockbackPos: null,
      };
    }

    const options: Vec[] = [];
    for (const k of this.moveMap(e).keys()) {
      const p = { x: k % GRID, y: Math.floor(k / GRID) };
      const t = this.terrainAt(p);
      if (isFire(t) || t === "pit" || t === "water") continue;
      options.push(p);
    }

    // Where peers will be: freshly-planned ones at their committed movePos,
    // not-yet-planned ones at their current tile.
    const peerTiles = this.enemies()
      .filter((o) => o.id !== e.id)
      .map((o) => (o.intent ? o.intent.movePos : o.pos));

    type Shot = {
      target: TargetRef;
      from: Vec;
      tiles: Vec[];
      priority: number;
    };
    const shots: Shot[] = [];
    for (const target of targets) {
      const proj = projectedHp.get(target.id) ?? target.hp;
      if (proj <= 0) continue;
      // Incendiary weapons can't hurt fireproof structures — don't aim at them.
      if (target.isStructure && gun.groundFire) continue;
      for (const from of options) {
        if (manhattan(from, target.pos) > gun.range) continue;
        if (!this.hasLineOfFire(from, target.pos, arcing)) continue;
        const tiles = aoeTiles(from, target.pos, shape);
        let priority = proj * 100 + manhattan(from, e.pos);
        if (target.id === carrierId) priority -= 250;
        // Prefer spreads that clip extra targets; avoid clipping allies.
        for (const t of tiles) {
          if (eq(t, target.pos)) continue;
          if (targets.some((p) => eq(p.pos, t))) priority -= 50;
          if (peerTiles.some((p) => eq(p, t))) priority += 100000;
        }
        shots.push({ target, from, tiles, priority });
      }
    }

    if (shots.length > 0) {
      shots.sort((a, b) => a.priority - b.priority);
      const best = shots[0];
      const knockbackPos =
        gun.knockback && !best.target.isStructure
          ? this.knockbackDest(best.from, best.target.pos, gun.knockback)
          : null;
      return {
        movePos: best.from,
        attackPos: { x: best.target.pos.x, y: best.target.pos.y },
        attackTiles: best.tiles,
        damage: gun.damage,
        knockbackPos,
      };
    }

    let tgt = targets[0];
    for (const p of targets) {
      const tp = projectedHp.get(tgt.id) ?? tgt.hp;
      const pp = projectedHp.get(p.id) ?? p.hp;
      const pBonus = p.id === carrierId ? -3 : 0;
      const tBonus = tgt.id === carrierId ? -3 : 0;
      if (pp + pBonus < tp + tBonus) tgt = p;
      else if (
        pp + pBonus === tp + tBonus &&
        manhattan(e.pos, p.pos) < manhattan(e.pos, tgt.pos)
      )
        tgt = p;
    }

    const byCloseness = (a: Vec, b: Vec): number => {
      const da = manhattan(a, tgt.pos);
      const db = manhattan(b, tgt.pos);
      if (da !== db) return da - db;
      const ma = manhattan(a, e.pos);
      const mb = manhattan(b, e.pos);
      if (ma !== mb) return ma - mb;
      return a.y - b.y || a.x - b.x;
    };

    options.sort(byCloseness);
    return {
      movePos: options[0] ?? { ...e.pos },
      attackPos: null,
      attackTiles: [],
      damage: gun.damage,
      knockbackPos: null,
    };
  }

  /**
   * Compute where a knockback would land. Returns null if the push would go
   * out of bounds, into wreckage, or onto an occupied tile (no push).
   */
  private knockbackDest(from: Vec, target: Vec, dist: number): Vec | null {
    const dx = Math.sign(target.x - from.x);
    const dy = Math.sign(target.y - from.y);
    if (dx === 0 && dy === 0) return null;
    let cx = target.x;
    let cy = target.y;
    for (let i = 0; i < dist; i++) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) return null;
      if (this.terrainAt({ x: nx, y: ny }) === "wreckage") return null;
      if (this.livingAt({ x: nx, y: ny })) return null;
      if (this.structureAt({ x: nx, y: ny })) return null;
      cx = nx;
      cy = ny;
    }
    return { x: cx, y: cy };
  }

  // --- Snapshots: turn undo + run persistence ---

  private capture(): GameState {
    return structuredClone({
      lance: this.lance,
      foes: this.units.filter((u) => u.team !== "player"),
      unitOrder: this.units.map((u) => u.id),
      terrain: this.terrain,
      phase: this.phase,
      selectedId: this.selectedId,
      recentHazardHits: this.recentHazardHits,
      wreckMarks: this.wreckMarks,
      turn: this.turn,
      pendingSpawns: this.pendingSpawns,
      recentSpawns: this.recentSpawns,
      recentSpawnBlocks: this.recentSpawnBlocks,
      objective: this.objective,
      objectiveComplete: this.objectiveComplete,
      criticalLoss: this.criticalLoss,
      failReason: this.failReason,
      structures: this.structures,
      exfilTiles: this.exfilTiles,
      mission: this.mission,
      salvage: this.salvage,
      cores: this.cores,
      lastSalvageEarned: this.lastSalvageEarned,
      nextId: this.nextId,
    });
  }

  private applyState(s: GameState): void {
    const c = structuredClone(s);
    this.lance = c.lance;
    const byId = new Map<number, Unit>();
    for (const u of c.lance) byId.set(u.id, u);
    for (const u of c.foes) byId.set(u.id, u);
    this.units = c.unitOrder
      .map((id) => byId.get(id))
      .filter((u): u is Unit => !!u);
    this.terrain = c.terrain;
    this.phase = c.phase;
    this.selectedId = c.selectedId;
    this.recentHazardHits = c.recentHazardHits;
    this.wreckMarks = c.wreckMarks;
    this.turn = c.turn;
    this.pendingSpawns = c.pendingSpawns;
    this.recentSpawns = c.recentSpawns;
    this.recentSpawnBlocks = c.recentSpawnBlocks;
    this.objective = c.objective;
    this.objectiveComplete = c.objectiveComplete;
    this.criticalLoss = c.criticalLoss;
    this.failReason = c.failReason;
    this.structures = c.structures;
    this.exfilTiles = c.exfilTiles;
    this.mission = c.mission;
    this.salvage = c.salvage;
    this.cores = c.cores;
    this.lastSalvageEarned = c.lastSalvageEarned;
    this.nextId = c.nextId;
    this.turnDirty = false;
  }

  /** Rewind to the start of the current player turn (ITB-style reset). */
  undoTurn(): boolean {
    if (this.phase !== "player" || !this.turnStart) return false;
    this.applyState(this.turnStart);
    return true;
  }

  /** Serialize the run for persistence. */
  serialize(): string {
    return JSON.stringify({ v: SAVE_VERSION, state: this.capture() });
  }

  /** Restore a serialized run. Returns false on any mismatch or bad data. */
  load(json: string): boolean {
    try {
      const parsed = JSON.parse(json) as { v: number; state: GameState };
      if (parsed.v !== SAVE_VERSION || !parsed.state) return false;
      const phase = parsed.state.phase;
      if (phase !== "player" && phase !== "salvage") return false;
      this.applyState(parsed.state);
      this.turnStart = phase === "player" ? structuredClone(parsed.state) : null;
      return true;
    } catch {
      return false;
    }
  }

  /** Cheat: instantly complete the current mission. */
  cheatSkipMission(): boolean {
    if (this.phase !== "player") return false;
    this.objectiveComplete = true;
    this.checkEnd();
    return true;
  }

  // --- Salvage Bay ---

  canRepair(u: Unit): boolean {
    return (
      this.phase === "salvage" &&
      u.hp > 0 &&
      u.hp < u.maxHp &&
      this.salvage >= REPAIR_COST
    );
  }

  repair(u: Unit): void {
    if (!this.canRepair(u)) return;
    this.salvage -= REPAIR_COST;
    u.hp = Math.min(u.maxHp, u.hp + REPAIR_HP);
  }

  canRecover(u: Unit): boolean {
    return (
      this.phase === "salvage" &&
      u.hp <= 0 &&
      this.salvage >= RECOVER_SALVAGE &&
      this.cores >= RECOVER_CORES
    );
  }

  recover(u: Unit): void {
    if (!this.canRecover(u)) return;
    this.salvage -= RECOVER_SALVAGE;
    this.cores -= RECOVER_CORES;
    u.hp = Math.max(1, Math.floor(u.maxHp / 2));
  }

  canReinforce(u: Unit): boolean {
    return (
      this.phase === "salvage" && u.hp > 0 && this.salvage >= REINFORCE_SALVAGE
    );
  }

  reinforce(u: Unit): void {
    if (!this.canReinforce(u)) return;
    this.salvage -= REINFORCE_SALVAGE;
    u.maxHp += REINFORCE_HP;
    u.hp += REINFORCE_HP;
  }

  canRearm(u: Unit): boolean {
    return (
      this.phase === "salvage" &&
      u.hp > 0 &&
      this.salvage >= REARM_SALVAGE &&
      this.cores >= REARM_CORES
    );
  }

  rearm(u: Unit, slot: number, catalogIndex: number): void {
    if (!this.canRearm(u)) return;
    if (slot < 0 || slot >= u.weapons.length) return;
    const w = WEAPON_CATALOG[catalogIndex];
    if (!w) return;
    this.salvage -= REARM_SALVAGE;
    this.cores -= REARM_CORES;
    u.weapons[slot] = { ...w };
  }
}
