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
  | "pit"
  | "water";
export type Impair = "none" | "full" | "move";

export interface Vec {
  x: number;
  y: number;
}

export interface Weapon {
  name: string;
  damage: number;
  range: number;
  heat: number;
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

/** A committed enemy plan, revealed during the player's turn. */
export interface Intent {
  movePos: Vec;
  attackPos: Vec | null;
  damage: number;
}

export interface Unit {
  id: number;
  team: Team;
  name: string;
  archetype: ArchetypeId | null;
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

const ENEMY_GUN: Weapon = { name: "Scattergun", damage: 2, range: 2, heat: 0 };
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
  mission = 0;
  salvage = 0;
  cores = 0;
  /** Salvage awarded for the most recently cleared mission. */
  lastSalvageEarned = 0;
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
    ENEMY_SPAWNS.forEach((sp, i) => {
      this.units.push({
        id: this.nextId++,
        team: "enemy",
        name: `Stalker ${i + 1}`,
        archetype: null,
        hp: 5,
        maxHp: 5,
        pos: { ...sp },
        moveRange: 3,
        heat: 0,
        maxHeat: 6,
        weapons: [{ ...ENEMY_GUN }],
        selectedWeapon: 0,
        hasMoved: false,
        hasFired: false,
        nextTurnImpair: "none",
        impaired: "none",
        intent: null,
      });
    });
    this.startPlayerTurn(true);
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
  hasLineOfFire(a: Vec, b: Vec): boolean {
    if (this.terrainAt(b) === "pit" && manhattan(a, b) > 1) return false;
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
    for (let step = 1; step <= u.moveRange; step++) {
      const next: Vec[] = [];
      for (const p of frontier) {
        const pk = p.y * GRID + p.x;
        const pInfo = map.get(pk)!;
        for (const n of this.neighbors(p)) {
          if (n.x < 0 || n.y < 0 || n.x >= GRID || n.y >= GRID) continue;
          const t = this.terrainAt(n);
          if (t === "wreckage") continue;
          if (this.livingAt(n)) continue;
          const nk = n.y * GRID + n.x;
          const nFires = pInfo.fires + (t === "fire" ? 1 : 0);
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

    const fireCrossed: Vec[] = [];
    for (let i = 0; i < path.length - 1; i++) {
      if (this.terrainAt(path[i]) === "fire") {
        u.heat = u.maxHeat;
        this.applyDamage(u, FIRE_DAMAGE);
        fireCrossed.push(path[i]);
      }
    }

    const dt = this.terrainAt(dest);
    if (dt === "pit") u.nextTurnImpair = "full";
    else if (dt === "water") u.nextTurnImpair = "move";

    if (fireCrossed.length) this.checkEnd();
    return fireCrossed;
  }

  canFireWeaponAt(u: Unit, i: number, target: Unit): boolean {
    if (this.phase !== "player" || u.team !== "player" || u.hasFired)
      return false;
    if (u.hp <= 0 || target.team !== "enemy" || target.hp <= 0) return false;
    // A mech down in a pit cannot fire — it must climb out first.
    if (this.terrainAt(u.pos) === "pit") return false;
    const w = u.weapons[i];
    if (!w) return false;
    if (manhattan(u.pos, target.pos) > w.range) return false;
    return this.hasLineOfFire(u.pos, target.pos);
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
      if (u.hp <= 0 || this.terrainAt(u.pos) !== "fire") continue;
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
    e.pos = { x: dest.x, y: dest.y };
  }

  /** Enemy fires at its telegraphed tile, hitting whatever player is there. */
  enemyExecuteAttack(
    e: Unit,
  ): { pos: Vec; damage: number; victim: Unit | null } | null {
    if (!e.intent || !e.intent.attackPos || e.hp <= 0) return null;
    const pos = e.intent.attackPos;
    const victim =
      this.units.find(
        (u) => u.team === "player" && u.hp > 0 && eq(u.pos, pos),
      ) ?? null;
    const dmg = this.damageAfterCover(e.intent.damage, pos);
    if (victim) {
      this.applyDamage(victim, dmg);
      this.checkEnd();
    }
    return { pos, damage: dmg, victim };
  }

  endEnemyPhase(): void {
    if (this.phase !== "enemy") return;
    this.startPlayerTurn(false);
  }

  /** Resolve a mission outcome: award salvage on a win, or end the run. */
  private checkEnd(): void {
    if (this.phase !== "player" && this.phase !== "enemy") return;
    if (this.enemies().length === 0) {
      this.lastSalvageEarned = MISSION_BASE_SALVAGE + this.players().length;
      this.salvage += this.lastSalvageEarned;
      this.phase =
        this.mission >= MISSIONS_PER_RUN ? "runComplete" : "salvage";
    } else if (this.players().length === 0) {
      this.phase = "runFailed";
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
  }

  private startPlayerTurn(first: boolean): void {
    this.recentHazardHits = [];
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
      } else if (t === "fire") {
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
    this.planEnemies();
    if (this.phase !== "runFailed" && this.phase !== "runComplete") {
      this.phase = "player";
    }
    const active =
      this.players().find((u) => !u.hasMoved || !u.hasFired) ??
      this.players()[0];
    this.selectedId = active ? active.id : null;
  }

  private planEnemies(): void {
    for (const e of this.enemies()) e.intent = this.planOne(e);
  }

  /**
   * Plan one enemy: target the nearest player mech and either move into
   * weapon range with a clear shot, or advance toward it. Enemies avoid
   * ending on fire, pit, or water tiles.
   */
  private planOne(e: Unit): Intent {
    const gun = e.weapons[0];
    const targets = this.players();
    if (targets.length === 0) {
      return { movePos: { ...e.pos }, attackPos: null, damage: gun.damage };
    }

    let tgt = targets[0];
    for (const p of targets) {
      if (manhattan(e.pos, p.pos) < manhattan(e.pos, tgt.pos)) tgt = p;
    }

    const options: Vec[] = [];
    for (const k of this.moveMap(e).keys()) {
      const p = { x: k % GRID, y: Math.floor(k / GRID) };
      const t = this.terrainAt(p);
      if (t === "fire" || t === "pit" || t === "water") continue;
      options.push(p);
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

    const strikeFrom = options.filter(
      (d) =>
        manhattan(d, tgt.pos) <= gun.range && this.hasLineOfFire(d, tgt.pos),
    );

    if (strikeFrom.length > 0) {
      strikeFrom.sort(byCloseness);
      return {
        movePos: strikeFrom[0],
        attackPos: { x: tgt.pos.x, y: tgt.pos.y },
        damage: gun.damage,
      };
    }

    options.sort(byCloseness);
    return {
      movePos: options[0] ?? { ...e.pos },
      attackPos: null,
      damage: gun.damage,
    };
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
