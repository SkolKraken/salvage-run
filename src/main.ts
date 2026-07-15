import "./style.css";
import {
  Game,
  GRID,
  FIRE_DAMAGE,
  ARCHETYPES,
  ARCHETYPE_ORDER,
  WEAPON_CATALOG,
  MISSIONS_PER_RUN,
  MISSION_DEFS,
  ENEMY_ARCHETYPES,
  REPAIR_HP,
  REPAIR_COST,
  RECOVER_SALVAGE,
  RECOVER_CORES,
  REINFORCE_HP,
  REINFORCE_SALVAGE,
  REARM_SALVAGE,
  REARM_CORES,
  eq,
  manhattan,
  type ArchetypeId,
  type EnemyKind,
  type Vec,
  type Unit,
} from "./game";
import { getSprite, spriteDataURL, type SpriteKey } from "./sprites";
import { ensureAudio, audioMuted, toggleMute } from "./audio";

const TILE = 64;
const SIZE = GRID * TILE;
const FLASH = 0.4;
const WIND_UP = 0.15;
const DYING_TIME = 0.7;

type Palette = { body: string; dark: string; accent: string };
const PAL: Record<ArchetypeId | EnemyKind, Palette> = {
  vanguard: { body: "#38bdf8", dark: "#1c5f80", accent: "#e0f2fe" },
  skirmisher: { body: "#4ade80", dark: "#1f6b3e", accent: "#dcfce7" },
  juggernaut: { body: "#a78bfa", dark: "#4c3f7a", accent: "#ede9fe" },
  stalker: { body: "#f87171", dark: "#8f3838", accent: "#fee2e2" },
  striker: { body: "#fb7185", dark: "#9f1239", accent: "#fecdd3" },
  bruiser: { body: "#b91c1c", dark: "#5a0e0e", accent: "#fecaca" },
  barrager: { body: "#ea580c", dark: "#7c2d12", accent: "#fed7aa" },
};

// --- DOM ---
const canvas = document.getElementById("board") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const banner = document.getElementById("turn-banner") as HTMLDivElement;
const hint = document.getElementById("hint") as HTMLParagraphElement;
const btnEnd = document.getElementById("btn-end") as HTMLButtonElement;
const btnRestart = document.getElementById("btn-restart") as HTMLButtonElement;
const overlay = document.getElementById("overlay") as HTMLDivElement;
const overlayText = document.getElementById("overlay-text") as HTMLDivElement;
const overlaySub = document.getElementById("overlay-sub") as HTMLDivElement;
const overlayRestart = document.getElementById("overlay-restart") as HTMLButtonElement;
const deployEl = document.getElementById("deploy") as HTMLDivElement;
const deploySlots = document.getElementById("deploy-slots") as HTMLDivElement;
const deployGo = document.getElementById("deploy-go") as HTMLButtonElement;
const rosterPlayer = document.getElementById("roster-player") as HTMLDivElement;
const rosterEnemy = document.getElementById("roster-enemy") as HTMLDivElement;
const weaponsEl = document.getElementById("weapons") as HTMLDivElement;
const salvageEl = document.getElementById("salvage") as HTMLDivElement;
const baySub = document.getElementById("bay-sub") as HTMLDivElement;
const baySalvage = document.getElementById("bay-salvage") as HTMLElement;
const bayCores = document.getElementById("bay-cores") as HTMLElement;
const bayMechs = document.getElementById("bay-mechs") as HTMLDivElement;
const bayRearm = document.getElementById("bay-rearm") as HTMLDivElement;
const bayDeploy = document.getElementById("bay-deploy") as HTMLButtonElement;
const introEl = document.getElementById("mission-intro") as HTMLDivElement;
const introKicker = document.getElementById("intro-kicker") as HTMLDivElement;
const introTitle = document.getElementById("intro-title") as HTMLDivElement;
const introFlavor = document.getElementById("intro-flavor") as HTMLDivElement;
const introObjective = document.getElementById("intro-objective") as HTMLDivElement;
const introEnemies = document.getElementById("intro-enemies") as HTMLDivElement;
const introWaves = document.getElementById("intro-waves") as HTMLDivElement;
const introGo = document.getElementById("intro-go") as HTMLButtonElement;
const btnMute = document.getElementById("btn-mute") as HTMLButtonElement;
const cheatV = document.getElementById("cheat-v") as HTMLSpanElement;
const cheatInput = document.getElementById("cheat-input") as HTMLInputElement;

// --- HiDPI ---
const dpr = window.devicePixelRatio || 1;
canvas.width = SIZE * dpr;
canvas.height = SIZE * dpr;
canvas.style.width = `${SIZE}px`;
canvas.style.height = `${SIZE}px`;
ctx.scale(dpr, dpr);
document.documentElement.style.setProperty("--board", `${SIZE}px`);

// --- State ---
const game = new Game();
(window as unknown as { __game: Game }).__game = game;
let busy = false;
let time = 0;
let hover: Vec | null = null;
let shake = 0;
const lance: ArchetypeId[] = ["vanguard", "skirmisher", "juggernaut"];
let rearmCtx: { unitId: number; slot: number } | null = null;
let pendingBayFlash: { salvage: boolean; cores: boolean; mechId: number | null } | null = null;

interface Floater {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}
const floaters: Floater[] = [];

interface RState {
  vx: number;
  vy: number;
  flash: number;
  windUp: number;
}
const rstate = new Map<number, RState>();

interface Projectile {
  kind: "beam" | "tracer" | "slash";
  from: Vec;
  to: Vec;
  color: string;
  life: number;
  maxLife: number;
  onLand: () => void;
  done: boolean;
}
const projectiles: Projectile[] = [];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  maxLife: number;
  size: number;
}
const particles: Particle[] = [];

interface DyingRecord {
  id: number;
  life: number;
  maxLife: number;
}
const dying: DyingRecord[] = [];

function palFor(u: Unit): Palette {
  if (u.team === "enemy") return PAL[u.enemyKind ?? "stalker"];
  return PAL[u.archetype!];
}

function center(x: number, y: number): { x: number; y: number } {
  return { x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 };
}

function spawnFloater(t: Vec, text: string, color: string): void {
  floaters.push({ x: t.x, y: t.y, text, color, life: 1 });
}

function syncRenderState(): void {
  const ids = new Set(game.units.map((u) => u.id));
  for (const id of [...rstate.keys()]) if (!ids.has(id)) rstate.delete(id);
  for (const u of game.units) {
    if (!rstate.has(u.id)) {
      rstate.set(u.id, { vx: u.pos.x, vy: u.pos.y, flash: 0, windUp: 0 });
    }
  }
}

function flashUnit(id: number): void {
  const r = rstate.get(id);
  if (r) r.flash = FLASH;
}

function nearestFoe(u: Unit): Unit | null {
  const foes = u.team === "player" ? game.enemies() : game.players();
  let best: Unit | null = null;
  let bd = Infinity;
  for (const f of foes) {
    const d = manhattan(u.pos, f.pos);
    if (d < bd) {
      bd = d;
      best = f;
    }
  }
  return best;
}

/** Mark a unit as dying so it keeps drawing (fading) through the projectile + explosion. */
function noteDying(id: number): void {
  if (!dying.some((d) => d.id === id)) {
    dying.push({ id, life: DYING_TIME, maxLife: DYING_TIME });
  }
}

function spawnExplosion(pos: Vec): void {
  const cx = pos.x * TILE + TILE / 2;
  const cy = pos.y * TILE + TILE / 2;
  shake += 7;
  const colors = ["#fb923c", "#f97316", "#fbbf24", "#ef4444", "#facc15"];
  const N = 16;
  for (let i = 0; i < N; i++) {
    const ang = (Math.PI * 2 * i) / N + (Math.random() - 0.5) * 0.5;
    const speed = 80 + Math.random() * 70;
    particles.push({
      x: cx + (Math.random() - 0.5) * 5,
      y: cy + (Math.random() - 0.5) * 5,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed - 40,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 0.5 + Math.random() * 0.2,
      maxLife: 0.7,
      size: 2 + Math.random() * 2.2,
    });
  }
  // bright center flash
  for (let i = 0; i < 6; i++) {
    particles.push({
      x: cx,
      y: cy,
      vx: 0,
      vy: 0,
      color: "#fff7ed",
      life: 0.15 + i * 0.01,
      maxLife: 0.2,
      size: 14 - i * 2,
    });
  }
}

/** Small impact puff on a threatened tile (lighter than a death explosion). */
function spawnImpact(pos: Vec): void {
  const cx = pos.x * TILE + TILE / 2;
  const cy = pos.y * TILE + TILE / 2;
  for (let i = 0; i < 5; i++) {
    const ang = Math.random() * Math.PI * 2;
    const speed = 30 + Math.random() * 40;
    particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed - 15,
      color: i % 2 === 0 ? "#fca5a5" : "#f97316",
      life: 0.25 + Math.random() * 0.15,
      maxLife: 0.4,
      size: 1.5 + Math.random() * 1.5,
    });
  }
}

function flashElement(el: Element | null): void {
  if (!el) return;
  el.classList.remove("flash");
  void (el as HTMLElement).offsetWidth;
  el.classList.add("flash");
  window.setTimeout(() => el.classList.remove("flash"), 600);
}

// --- Deploy picker ---
const slotEls: HTMLButtonElement[] = [];
lance.forEach((_, i) => {
  const btn = document.createElement("button");
  btn.className = "deploy-slot";
  btn.addEventListener("click", () => {
    const cur = ARCHETYPE_ORDER.indexOf(lance[i]);
    lance[i] = ARCHETYPE_ORDER[(cur + 1) % ARCHETYPE_ORDER.length];
    renderDeploySlots();
  });
  deploySlots.appendChild(btn);
  slotEls.push(btn);
});

function renderDeploySlots(): void {
  lance.forEach((aid, i) => {
    const a = ARCHETYPES[aid];
    const pal = PAL[aid];
    slotEls[i].style.borderLeftColor = pal.body;
    slotEls[i].innerHTML =
      `<img class="slot-sprite" src="${spriteDataURL(aid, 3)}" alt="">` +
      `<div class="slot-info">` +
      `<div class="slot-name">Slot ${i + 1}: ${a.name}</div>` +
      `<div class="slot-blurb">${a.blurb}</div>` +
      `<div class="slot-stats">HP ${a.maxHp} &middot; MOVE ${a.moveRange} &middot; ` +
      `HEAT ${a.heatCap} &middot; ${a.weapons.map((w) => w.name).join(", ")}</div>` +
      `</div>`;
  });
}

// --- Mission intros ---
const MISSION_INTROS = [
  {
    title: "SCRAPFALL",
    flavor:
      "The crash basin is crawling with scavenger frames. Sweep it clean and stake the claim.",
  },
  {
    title: "CACHE GRAB",
    flavor:
      "Recon flagged an intact core cache dug into the wreck line upfield. It will be guarded.",
  },
  {
    title: "DUST-OFF",
    flavor:
      "The salvage barge needs time to spool its lift engines. Hold the field until it screams in.",
  },
];

function objectiveBrief(): string {
  const o = game.objective;
  switch (o.kind) {
    case "extract":
      return "Grab the CACHE and haul it to the green EXFIL zone. The carrier is slowed and can't fire — and grabbing it trips an alarm.";
    case "hold":
      return `Hold the marked position for ${o.turnsRequired} turns.`;
    case "survive":
      return `Protect the LIFT BEACON for ${o.turnsRequired} turns. If it falls, the run is over.`;
    default:
      return "Destroy every hostile.";
  }
}

function showMissionIntro(): void {
  busy = true;
  const idx = game.mission - 1;
  const intro = MISSION_INTROS[idx] ?? MISSION_INTROS[0];
  const def = MISSION_DEFS[idx] ?? MISSION_DEFS[0];
  introKicker.textContent = `MISSION ${game.mission} OF ${MISSIONS_PER_RUN}`;
  introTitle.textContent = intro.title;
  introFlavor.textContent = intro.flavor;
  introObjective.textContent = objectiveBrief();

  const counts = new Map<EnemyKind, number>();
  for (const k of def.enemies) counts.set(k, (counts.get(k) ?? 0) + 1);
  introEnemies.replaceChildren();
  for (const [kind, n] of counts) {
    const card = document.createElement("div");
    card.className = "intro-enemy";
    const img = document.createElement("img");
    img.src = spriteDataURL(kind, 3);
    img.alt = "";
    const label = document.createElement("span");
    label.textContent = `${n}× ${ENEMY_ARCHETYPES[kind].name.toUpperCase()}`;
    card.append(img, label);
    introEnemies.appendChild(card);
  }

  const hasWaves = def.waves.length > 0 || !!def.recurringWave;
  introWaves.classList.toggle("hidden", !hasWaves);

  introEl.classList.remove("hidden");
  refreshUI();
}

introGo.addEventListener("click", () => {
  introEl.classList.add("hidden");
  busy = false;
  refreshUI();
});

function doDeploy(): void {
  game.deploy([...lance]);
  rstate.clear();
  floaters.length = 0;
  projectiles.length = 0;
  particles.length = 0;
  dying.length = 0;
  shake = 0;
  syncRenderState();
  deployEl.classList.add("hidden");
  showMissionIntro();
}

// --- Weapon buttons (in-battle) ---
const weaponBtns: HTMLButtonElement[] = [];
for (let i = 0; i < 2; i++) {
  const btn = document.createElement("button");
  btn.className = "weapon-btn";
  btn.addEventListener("click", () => {
    const u = game.selected;
    if (busy || game.phase !== "player" || !u || u.hasFired) return;
    game.selectWeapon(u, i);
    refreshUI();
  });
  weaponsEl.appendChild(btn);
  weaponBtns.push(btn);
}

// --- Actions ---
function handleClick(t: Vec): void {
  if (busy || game.phase !== "player") return;
  const u = game.livingAt(t);
  const sel = game.selected;
  if (u && u.team === "player") {
    if (u.id !== game.selectedId) {
      game.selectUnit(u.id);
      refreshUI();
    }
    return;
  }
  if (u && u.team === "enemy") {
    if (sel && game.canFireWeaponAt(sel, sel.selectedWeapon, u)) doFire(sel, u);
    return;
  }
  if (sel) {
    const wasCarrier = game.objective.carrierId;
    const spawnsBefore = game.pendingSpawns.length;
    const crossed = game.moveUnit(sel, t);
    if (crossed) {
      for (const f of crossed) spawnFloater(f, `-${FIRE_DAMAGE}`, "#fb923c");
      if (crossed.length) {
        flashUnit(sel.id);
        shake += crossed.length * 2;
      }
      if (game.objective.carrierId !== wasCarrier && game.objective.carrierId !== null) {
        spawnFloater(sel.pos, "CACHE SECURED", "#fbbf24");
        for (const s of game.pendingSpawns.slice(spawnsBefore)) {
          spawnFloater(s.pos, "ALARM TRIPPED", "#f87171");
        }
        shake += 3;
      }
      if (sel.hp === 0) {
        noteDying(sel.id);
        spawnExplosion(sel.pos);
      }
      refreshUI();
      if (game.phase !== "player") {
        busy = true;
        window.setTimeout(settleBattle, 700);
      }
    }
  }
}

function projectileKindFor(w: { name: string; range: number }): Projectile["kind"] {
  if (w.range === 1) return "slash";
  if (/laser|plasma|beam|railgun/i.test(w.name)) return "beam";
  return "tracer";
}

function doFire(u: Unit, target: Unit): void {
  const res = game.fireAt(u, target);
  if (!res) return;
  const w = u.weapons[u.selectedWeapon];
  const kind = projectileKindFor(w);
  const color = palFor(u).body;

  const targetId = target.id;
  const targetPos = { ...target.pos };
  const targetKilled = target.hp === 0;
  const damage = res.damage;
  const selfDamage = res.selfDamage;
  const firerKilled = selfDamage > 0 && u.hp === 0;
  const firerId = u.id;
  const firerPos = { ...u.pos };
  const heat = res.heat;
  const coreDropped = res.coreDropped;
  const phaseAfter = game.phase;

  if (targetKilled) noteDying(targetId);
  if (firerKilled) noteDying(firerId);
  if (phaseAfter !== "player") busy = true;

  projectiles.push({
    kind,
    from: { ...u.pos },
    to: targetPos,
    color,
    life: 0.22,
    maxLife: 0.22,
    done: false,
    onLand: () => {
      spawnFloater(
        targetPos,
        damage > 0 ? `-${damage}` : "BLOCKED",
        damage > 0 ? "#fca5a5" : "#94a3b8",
      );
      flashUnit(targetId);
      shake += Math.max(2, damage * 1.5);
      if (coreDropped) spawnFloater(targetPos, "+CORE", "#c4b5fd");
      if (targetKilled) spawnExplosion(targetPos);
      if (selfDamage > 0) {
        spawnFloater(firerPos, `-${selfDamage}`, "#f87171");
        flashUnit(firerId);
        shake += Math.max(2, selfDamage * 1.5);
        if (firerKilled) spawnExplosion(firerPos);
      } else if (heat > 0) {
        spawnFloater(firerPos, `+${heat} heat`, "#fbbf24");
      }
      refreshUI();
      if (phaseAfter !== "player") window.setTimeout(settleBattle, 550);
    },
  });
  refreshUI();
}

function endTurnFlow(): void {
  if (busy || game.phase !== "player") return;
  busy = true;

  for (const h of game.endTurnHazards()) {
    spawnFloater(h.pos, `-${h.damage}`, "#fb923c");
    flashUnit(h.id);
    shake += 2;
    const u = game.units.find((x) => x.id === h.id);
    if (u && u.hp === 0) {
      noteDying(h.id);
      spawnExplosion(h.pos);
    }
  }
  refreshUI();
  if (game.phase !== "player") {
    window.setTimeout(settleBattle, 750);
    return;
  }

  game.endTurn();
  refreshUI();

  const queue = game.enemies();
  let i = 0;
  const step = (): void => {
    if (i >= queue.length) {
      finishEnemyPhase();
      return;
    }
    const e = queue[i++];
    if (e.hp <= 0) {
      step();
      return;
    }
    game.enemyExecuteMove(e);
    refreshUI();
    window.setTimeout(() => {
      // wind-up
      const er = rstate.get(e.id);
      if (er) er.windUp = WIND_UP;
      window.setTimeout(() => {
        const res = game.enemyExecuteAttack(e);
        if (!res) {
          window.setTimeout(step, 220);
          return;
        }
        const aim = { ...res.aim };
        const tiles = res.tiles;
        const hits = res.hits;
        for (const h of hits) if (h.killed) noteDying(h.id);
        projectiles.push({
          kind: projectileKindFor(e.weapons[0]),
          from: { ...e.pos },
          to: aim,
          color: palFor(e).body,
          life: 0.2,
          maxLife: 0.2,
          done: false,
          onLand: () => {
            for (const t of tiles) spawnImpact(t);
            if (hits.length > 0) {
              for (const h of hits) {
                spawnFloater(
                  h.pos,
                  h.damage > 0 ? `-${h.damage}` : "BLOCKED",
                  h.damage > 0 ? "#fca5a5" : "#94a3b8",
                );
                flashUnit(h.id);
                shake += Math.max(2, h.damage * 1.5);
                if (h.knockTo) {
                  const r = rstate.get(h.id);
                  if (r) {
                    r.vx = h.knockTo.x;
                    r.vy = h.knockTo.y;
                  }
                  spawnFloater(h.knockTo, "PUSHED", "#fcd34d");
                  shake += 3;
                }
                if (h.killed) spawnExplosion(h.knockTo ?? h.pos);
              }
            } else {
              spawnFloater(aim, "MISS", "#94a3b8");
            }
            refreshUI();
            if (game.phase === "runFailed") {
              window.setTimeout(settleBattle, 500);
            } else {
              window.setTimeout(step, 220);
            }
          },
        });
      }, WIND_UP * 1000);
    }, 380);
  };
  window.setTimeout(step, 320);
}

function finishEnemyPhase(): void {
  const before = new Map(game.players().map((u) => [u.id, u.heat]));
  game.endEnemyPhase();
  syncRenderState();
  for (const p of game.recentSpawns) {
    spawnImpact(p);
    spawnFloater(p, "REINFORCED", "#f87171");
    shake += 3;
  }
  for (const b of game.recentSpawnBlocks) {
    spawnFloater(b.pos, `-${b.damage} BLOCKING`, "#fcd34d");
    flashUnit(b.id);
    const u = game.units.find((x) => x.id === b.id);
    if (u && u.hp === 0) {
      noteDying(b.id);
      spawnExplosion(b.pos);
    }
  }
  for (const h of game.recentHazardHits) {
    spawnFloater(h.pos, `-${h.damage}`, "#fb923c");
    flashUnit(h.id);
    shake += 2;
    const u = game.units.find((x) => x.id === h.id);
    if (u && u.hp === 0) {
      noteDying(h.id);
      spawnExplosion(h.pos);
    }
  }
  for (const [id, h] of before) {
    const u = game.units.find((x) => x.id === id);
    if (u && u.hp > 0 && u.heat < h) {
      spawnFloater(u.pos, `-${h - u.heat} heat`, "#7dd3fc");
    }
  }
  refreshUI();
  if (settleBattle()) return;
  busy = false;
  refreshUI();
}

function settleBattle(): boolean {
  if (game.phase === "salvage") {
    busy = true;
    openSalvageBay();
    refreshUI();
    return true;
  }
  if (game.phase === "runComplete" || game.phase === "runFailed") {
    busy = true;
    showEndOverlay();
    refreshUI();
    return true;
  }
  return false;
}

function restart(): void {
  game.openDeploy();
  floaters.length = 0;
  projectiles.length = 0;
  particles.length = 0;
  dying.length = 0;
  shake = 0;
  rstate.clear();
  rearmCtx = null;
  pendingBayFlash = null;
  busy = false;
  overlay.classList.add("hidden");
  salvageEl.classList.add("hidden");
  introEl.classList.add("hidden");
  deployEl.classList.remove("hidden");
  renderDeploySlots();
  refreshUI();
}

function showEndOverlay(): void {
  const win = game.phase === "runComplete";
  overlayText.textContent = win ? "RUN COMPLETE" : "RUN FAILED";
  overlayText.className = "overlay-text " + (win ? "win" : "lose");
  overlaySub.textContent = win
    ? `All ${MISSIONS_PER_RUN} missions cleared.`
    : `${game.failReason ?? "The lance is down."} Mission ${game.mission} of ${MISSIONS_PER_RUN}.`;
  overlay.classList.remove("hidden");
}

// --- Salvage Bay ---
function openSalvageBay(): void {
  rearmCtx = null;
  pendingBayFlash = null;
  renderSalvageBay();
  salvageEl.classList.remove("hidden");
}

function makeBayMech(u: Unit): HTMLElement {
  const el = document.createElement("div");
  el.className = "bay-mech";
  el.dataset.mechId = String(u.id);
  const pal = PAL[u.archetype!];
  el.style.borderLeftColor = pal.body;
  const down = u.hp <= 0;
  if (down) el.classList.add("down");

  let wpns = `<div class="bay-wpns">`;
  u.weapons.forEach((w, slot) => {
    wpns +=
      `<button class="bay-wpn-slot" data-slot="${slot}">${w.name}` +
      `<br><small>${w.damage} dmg &middot; rng ${w.range} &middot; +${w.heat} heat</small></button>`;
  });
  wpns += `</div>`;

  let actions = `<div class="bay-actions">`;
  if (down) {
    actions +=
      `<button class="bay-btn" data-act="recover">Recover &middot; ${RECOVER_SALVAGE}S + ${RECOVER_CORES}C</button>`;
  } else {
    actions +=
      `<button class="bay-btn" data-act="repair">Repair +${REPAIR_HP} &middot; ${REPAIR_COST}S</button>` +
      `<button class="bay-btn" data-act="reinforce">Reinforce +${REINFORCE_HP} max &middot; ${REINFORCE_SALVAGE}S</button>`;
  }
  actions += `</div>`;

  el.innerHTML =
    `<div class="bay-mech-head"><span>${u.name}</span>` +
    `<span class="bay-mech-hp">${down ? "DESTROYED" : `${u.hp} / ${u.maxHp} HP`}</span></div>` +
    `<div class="bar"><div class="bar-fill" style="width:${down ? 0 : (u.hp / u.maxHp) * 100}%;background:${pal.body}"></div></div>` +
    wpns +
    actions;

  el.querySelectorAll<HTMLButtonElement>(".bay-wpn-slot").forEach((btn) => {
    btn.disabled = down;
    btn.addEventListener("click", () => {
      rearmCtx = { unitId: u.id, slot: Number(btn.dataset.slot) };
      renderSalvageBay();
    });
  });
  el.querySelectorAll<HTMLButtonElement>("[data-act]").forEach((btn) => {
    const act = btn.dataset.act;
    if (act === "repair") btn.disabled = !game.canRepair(u);
    else if (act === "recover") btn.disabled = !game.canRecover(u);
    else if (act === "reinforce") btn.disabled = !game.canReinforce(u);
    btn.addEventListener("click", () => {
      const sBefore = game.salvage;
      const cBefore = game.cores;
      if (act === "repair") game.repair(u);
      else if (act === "recover") game.recover(u);
      else if (act === "reinforce") game.reinforce(u);
      pendingBayFlash = {
        salvage: game.salvage < sBefore,
        cores: game.cores < cBefore,
        mechId: u.id,
      };
      renderSalvageBay();
    });
  });
  return el;
}

function renderRearmPanel(): void {
  const u = game.lance.find((x) => x.id === rearmCtx!.unitId);
  if (!u || u.hp <= 0) {
    rearmCtx = null;
    bayRearm.classList.add("hidden");
    return;
  }
  const slot = rearmCtx!.slot;
  let html =
    `<div class="bay-rearm-title">REARM ${u.name} — replace ${u.weapons[slot].name} ` +
    `(${REARM_CORES} Cores + ${REARM_SALVAGE} Salvage)</div>`;
  WEAPON_CATALOG.forEach((w, ci) => {
    html +=
      `<button class="cat-weapon" data-cat="${ci}">` +
      `<b>${w.name}</b> — ${w.damage} dmg &middot; range ${w.range} &middot; +${w.heat} heat</button>`;
  });
  html += `<button class="bay-btn" data-cat="cancel">Cancel</button>`;
  bayRearm.innerHTML = html;

  bayRearm.querySelectorAll<HTMLButtonElement>("[data-cat]").forEach((btn) => {
    const v = btn.dataset.cat!;
    if (v === "cancel") {
      btn.addEventListener("click", () => {
        rearmCtx = null;
        renderSalvageBay();
      });
    } else {
      btn.disabled = !game.canRearm(u);
      btn.addEventListener("click", () => {
        const sBefore = game.salvage;
        const cBefore = game.cores;
        game.rearm(u, slot, Number(v));
        pendingBayFlash = {
          salvage: game.salvage < sBefore,
          cores: game.cores < cBefore,
          mechId: u.id,
        };
        rearmCtx = null;
        renderSalvageBay();
      });
    }
  });
}

function renderSalvageBay(): void {
  baySalvage.textContent = String(game.salvage);
  bayCores.textContent = String(game.cores);
  baySub.textContent =
    `Mission ${game.mission} cleared · +${game.lastSalvageEarned} salvage earned`;
  bayDeploy.textContent = `Deploy to Mission ${game.mission + 1}`;

  bayMechs.replaceChildren();
  for (const u of game.lance) bayMechs.appendChild(makeBayMech(u));

  if (rearmCtx) {
    renderRearmPanel();
    bayRearm.classList.remove("hidden");
  } else {
    bayRearm.classList.add("hidden");
  }

  if (pendingBayFlash) {
    if (pendingBayFlash.salvage) flashElement(baySalvage);
    if (pendingBayFlash.cores) flashElement(bayCores);
    if (pendingBayFlash.mechId !== null) {
      flashElement(
        bayMechs.querySelector(`.bay-mech[data-mech-id="${pendingBayFlash.mechId}"]`),
      );
    }
    pendingBayFlash = null;
  }
}

// --- UI ---
function objectiveLabel(): string {
  const o = game.objective;
  if (o.kind === "extract")
    return o.carrierId !== null ? " · EXFIL THE CARRIER" : " · RECOVER THE CACHE";
  if (o.kind === "hold")
    return ` · HOLD ${o.progress}/${o.turnsRequired}`;
  if (o.kind === "survive")
    return ` · SURVIVE ${Math.min(game.turn, o.turnsRequired)}/${o.turnsRequired}`;
  return "";
}

function hintText(): string {
  switch (game.phase) {
    case "deploy":
      return "Configure your lance, then deploy.";
    case "enemy":
      return "Hostiles are executing their telegraphed moves…";
    case "salvage":
      return "Salvage Bay — patch up the lance, then deploy.";
    case "runComplete":
      return "Run complete — the lance holds the field.";
    case "runFailed":
      return "The lance is down. Run failed.";
    case "player": {
      if (game.allPlayersActed())
        return "Every mech has acted — end your turn.";
      const u = game.selected;
      if (!u) return "Select a mech.";
      if (game.terrainAt(u.pos) === "pit")
        return u.impaired === "full"
          ? `${u.name} is pit-stuck — it loses this turn.`
          : `${u.name} is in a pit — it can't fire. Move it out to attack.`;
      if (u.impaired === "move")
        return `${u.name} is mired in water — it can fire but not move.`;
      if (game.terrainAt(u.pos) === "fire")
        return `${u.name} is in fire — move clear or it keeps burning.`;
      if (game.objective.carrierId === u.id)
        return `${u.name} is hauling the cache — slowed, can't fire. Reach the green EXFIL zone.`;
      if (game.pendingSpawns.length > 0)
        return "Reinforcements inbound — stand on a drop zone to block it (1 dmg/turn).";
      if (u.hasMoved && u.hasFired)
        return `${u.name} has acted — select another mech (Tab).`;
      if (game.canFire(u))
        return `Click a hostile to fire ${u.name}'s ${u.weapons[u.selectedWeapon].name}.`;
      if (!u.hasMoved) return `Move ${u.name}, or pick a weapon and target.`;
      return `${u.name} has no clear shot — end turn or switch mech.`;
    }
  }
}

function makeChip(u: Unit, pickable: boolean): HTMLElement {
  const el = document.createElement(pickable ? "button" : "div");
  el.className = "chip";
  const pal = palFor(u);
  el.style.borderLeftColor = pal.body;
  if (u.hp <= 0) el.classList.add("down");
  if (pickable) {
    el.classList.add("pickable");
    if (u.id === game.selectedId) el.classList.add("selected");
    (el as HTMLButtonElement).addEventListener("click", () => {
      if (busy || game.phase !== "player" || u.hp <= 0) return;
      game.selectUnit(u.id);
      refreshUI();
    });
  }

  let status = "";
  let statusCls = "";
  if (u.team === "enemy") {
    status = u.hp <= 0 ? "DOWN" : `${u.hp}/${u.maxHp}`;
  } else if (u.hp <= 0) {
    status = "DESTROYED";
  } else if (game.terrainAt(u.pos) === "pit") {
    status = "IN PIT";
    statusCls = "partial";
  } else if (u.impaired === "move" && !u.hasFired) {
    status = "MIRED";
    statusCls = "partial";
  } else if (u.hasMoved && u.hasFired) {
    status = "DONE";
  } else if (u.hasMoved) {
    status = "MOVED";
    statusCls = "partial";
  } else if (u.hasFired) {
    status = "FIRED";
    statusCls = "partial";
  } else {
    status = "READY";
    statusCls = "ready";
  }

  let html =
    `<div class="chip-top"><span class="chip-name">${u.name}</span>` +
    `<span class="chip-status ${statusCls}">${status}</span></div>` +
    `<div class="bar"><div class="bar-fill" style="width:${(u.hp / u.maxHp) * 100}%;background:${pal.body}"></div></div>`;

  if (u.team === "player") {
    let segs = "";
    for (let i = 0; i < u.maxHeat; i++) {
      const cls =
        "heat-seg" +
        (i >= u.maxHeat - 2 ? " hot" : "") +
        (i < u.heat ? " filled" : "");
      segs += `<div class="${cls}"></div>`;
    }
    html += `<div class="heat-mini">${segs}</div>`;
  }
  el.innerHTML = html;
  return el;
}

function refreshUI(): void {
  rosterPlayer.replaceChildren();
  rosterEnemy.replaceChildren();
  for (const u of game.units) {
    if (u.team === "player") rosterPlayer.appendChild(makeChip(u, true));
    else rosterEnemy.appendChild(makeChip(u, false));
  }

  const sel = game.selected;
  weaponBtns.forEach((btn, i) => {
    if (!sel || game.phase !== "player") {
      btn.style.display = "none";
      return;
    }
    btn.style.display = "";
    const w = sel.weapons[i];
    let status = "READY";
    let statusCls = "ready";
    if (sel.hasFired) {
      status = "SPENT";
      statusCls = "range";
    } else if (game.terrainAt(sel.pos) === "pit") {
      status = "IN PIT";
      statusCls = "range";
    } else if (sel.heat >= sel.maxHeat) {
      status = "THERMAL WARNING";
      statusCls = "redline";
    } else if (
      !game
        .enemies()
        .some(
          (e) =>
            manhattan(sel.pos, e.pos) <= w.range &&
            game.hasLineOfFire(sel.pos, e.pos),
        )
    ) {
      status = "NO SHOT";
      statusCls = "range";
    }
    btn.classList.toggle("selected", i === sel.selectedWeapon);
    btn.disabled =
      sel.hasFired ||
      game.phase !== "player" ||
      game.terrainAt(sel.pos) === "pit";
    btn.innerHTML =
      `<div class="wpn-top"><span><span class="wpn-key">${i + 1}</span>` +
      `<span class="wpn-name">${w.name}</span></span>` +
      `<span class="wpn-status ${statusCls}">${status}</span></div>` +
      `<div class="wpn-stats">${w.damage} DMG &middot; RNG ${w.range} &middot; +${w.heat} HEAT</div>`;
  });

  if (game.phase === "deploy") {
    banner.textContent = "LANCE BAY";
    banner.className = "banner player";
  } else if (game.phase === "enemy") {
    banner.textContent = `MISSION ${game.mission} · ENEMY TURN`;
    banner.className = "banner enemy";
  } else if (game.phase === "salvage") {
    banner.textContent = "SALVAGE BAY";
    banner.className = "banner player";
  } else if (game.phase === "runFailed") {
    banner.textContent = "RUN FAILED";
    banner.className = "banner enemy";
  } else if (game.phase === "runComplete") {
    banner.textContent = "RUN COMPLETE";
    banner.className = "banner player";
  } else {
    banner.textContent =
      `MISSION ${game.mission} OF ${MISSIONS_PER_RUN} · YOUR TURN` +
      objectiveLabel();
    banner.className = "banner player";
  }

  hint.textContent = hintText();
  btnEnd.disabled = busy || game.phase !== "player";
}

// --- Rendering ---
function drawBoard(): void {
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? "#141b24" : "#10161d";
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    }
  }
  ctx.strokeStyle = "#1d2630";
  ctx.lineWidth = 1;
  for (let i = 0; i <= GRID; i++) {
    ctx.beginPath();
    ctx.moveTo(i * TILE, 0);
    ctx.lineTo(i * TILE, SIZE);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * TILE);
    ctx.lineTo(SIZE, i * TILE);
    ctx.stroke();
  }
}

function drawWreckage(px: number, py: number): void {
  ctx.fillStyle = "#171c25";
  ctx.fillRect(px, py, TILE, TILE);
  ctx.fillStyle = "#2b3340";
  ctx.beginPath();
  ctx.moveTo(px + 8, py + TILE - 8);
  ctx.lineTo(px + 23, py + 20);
  ctx.lineTo(px + 38, py + TILE - 8);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(px + 28, py + TILE - 8);
  ctx.lineTo(px + 45, py + 27);
  ctx.lineTo(px + TILE - 6, py + TILE - 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#3a4655";
  ctx.fillRect(px + 15, py + 30, 11, 11);
  ctx.strokeStyle = "#3a4655";
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
}

function drawCover(px: number, py: number): void {
  ctx.fillStyle = "rgba(82,116,148,0.06)";
  ctx.fillRect(px, py, TILE, TILE);
  ctx.fillStyle = "#2c3645";
  ctx.fillRect(px + 12, py + 28, 5, 22);
  ctx.fillRect(px + TILE - 17, py + 28, 5, 22);
  ctx.fillStyle = "#3c4a5c";
  ctx.beginPath();
  ctx.roundRect(px + 10, py + 34, TILE - 20, 15, 3);
  ctx.fill();
  ctx.fillStyle = "#56697f";
  ctx.beginPath();
  ctx.roundRect(px + 10, py + 30, TILE - 20, 6, 3);
  ctx.fill();
}

function drawFire(px: number, py: number, gx: number, gy: number): void {
  const seed = gx * 1.3 + gy * 0.7;
  const pulse = 0.5 + 0.5 * Math.sin(time * 6 + seed);
  ctx.fillStyle = `rgba(234,88,12,${0.14 + 0.12 * pulse})`;
  ctx.fillRect(px, py, TILE, TILE);
  const base = py + TILE - 11;
  for (let i = 0; i < 3; i++) {
    const fx = px + 16 + i * 16;
    const h = 17 + 9 * Math.sin(time * 7 + i * 2.1 + seed);
    ctx.fillStyle = `rgba(249,115,22,${0.55 + 0.3 * pulse})`;
    ctx.beginPath();
    ctx.moveTo(fx - 8, base);
    ctx.lineTo(fx, base - h);
    ctx.lineTo(fx + 8, base);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgba(250,204,21,${0.5 + 0.3 * pulse})`;
    ctx.beginPath();
    ctx.moveTo(fx - 4, base);
    ctx.lineTo(fx, base - h * 0.55);
    ctx.lineTo(fx + 4, base);
    ctx.closePath();
    ctx.fill();
  }
}

function drawPit(px: number, py: number): void {
  ctx.fillStyle = "#0c0f15";
  ctx.fillRect(px, py, TILE, TILE);
  const cx = px + TILE / 2;
  const cy = py + TILE / 2;
  ctx.fillStyle = "#1b2330";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 3, 23, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#04060a";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 4, 16, 12, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawWater(px: number, py: number, gx: number, gy: number): void {
  ctx.fillStyle = "rgba(37,99,150,0.4)";
  ctx.fillRect(px, py, TILE, TILE);
  ctx.strokeStyle = "rgba(125,200,235,0.5)";
  ctx.lineWidth = 1.5;
  const seed = gx + gy;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    const yy = py + 18 + i * 15;
    for (let xx = px + 6; xx <= px + TILE - 6; xx += 4) {
      const wy = yy + Math.sin(xx * 0.25 + time * 2 + i + seed) * 2.5;
      if (xx === px + 6) ctx.moveTo(xx, wy);
      else ctx.lineTo(xx, wy);
    }
    ctx.stroke();
  }
}

function drawWreckMarks(): void {
  for (const m of game.wreckMarks) {
    const cx = m.x * TILE + TILE / 2;
    const cy = m.y * TILE + TILE / 2;
    ctx.fillStyle = "#15110e";
    ctx.beginPath();
    ctx.ellipse(cx, cy + 10, 18, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0a0805";
    ctx.beginPath();
    ctx.moveTo(cx - 14, cy + 11);
    ctx.lineTo(cx - 6, cy + 2);
    ctx.lineTo(cx + 1, cy + 6);
    ctx.lineTo(cx + 8, cy + 1);
    ctx.lineTo(cx + 14, cy + 8);
    ctx.lineTo(cx + 12, cy + 12);
    ctx.closePath();
    ctx.fill();
  }
}

function drawTerrain(): void {
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const kind = game.terrainAt({ x, y });
      if (kind === "open") continue;
      const px = x * TILE;
      const py = y * TILE;
      if (kind === "wreckage") drawWreckage(px, py);
      else if (kind === "cover") drawCover(px, py);
      else if (kind === "fire") drawFire(px, py, x, y);
      else if (kind === "pit") drawPit(px, py);
      else if (kind === "water") drawWater(px, py, x, y);
    }
  }
}

function drawSelectionRing(): void {
  const u = game.selected;
  if (!u) return;
  const r = rstate.get(u.id);
  if (!r) return;
  const pulse = 0.55 + 0.45 * Math.sin(time * 4);
  ctx.strokeStyle = `rgba(226,232,240,${0.45 + 0.4 * pulse})`;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(r.vx * TILE + 3, r.vy * TILE + 3, TILE - 6, TILE - 6);
}

function drawMoveTiles(): void {
  const u = game.selected;
  if (!u) return;
  for (const t of game.moveTiles(u)) {
    const kind = game.terrainAt(t);
    let fill = "rgba(56,189,248,0.13)";
    let line = "rgba(56,189,248,0.35)";
    if (kind === "fire" || kind === "pit") {
      fill = "rgba(234,88,12,0.22)";
      line = "rgba(249,115,22,0.6)";
    } else if (kind === "water") {
      fill = "rgba(56,140,200,0.22)";
      line = "rgba(96,170,220,0.55)";
    }
    ctx.fillStyle = fill;
    ctx.fillRect(t.x * TILE, t.y * TILE, TILE, TILE);
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    ctx.strokeRect(t.x * TILE + 1.5, t.y * TILE + 1.5, TILE - 3, TILE - 3);
  }
}

function drawTelegraphGround(e: Unit): void {
  const it = e.intent;
  if (!it) return;
  if (!eq(it.movePos, e.pos)) {
    const from = center(e.pos.x, e.pos.y);
    const to = center(it.movePos.x, it.movePos.y);
    const pulse = 0.5 + 0.5 * Math.sin(time * 4);
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = `rgba(248,113,113,${0.25 + 0.2 * pulse})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.setLineDash([]);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const px = -uy;
    const py = ux;
    const size = 9;
    ctx.strokeStyle = `rgba(248,113,113,${0.55 + 0.35 * pulse})`;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(to.x - ux * size + px * size, to.y - uy * size + py * size);
    ctx.lineTo(to.x, to.y);
    ctx.lineTo(to.x - ux * size - px * size, to.y - uy * size - py * size);
    ctx.stroke();
  }
  if (!it.attackPos) return;
  const a = center(it.attackPos.x, it.attackPos.y);
  const threat = it.attackTiles.length > 0 ? it.attackTiles : [it.attackPos];
  for (const t of threat) {
    ctx.fillStyle = "rgba(248,113,113,0.14)";
    ctx.fillRect(t.x * TILE, t.y * TILE, TILE, TILE);
    if (!eq(t, it.attackPos)) {
      // secondary AoE tile: corner ticks so it reads as "in the blast"
      const pulse = 0.35 + 0.25 * Math.sin(time * 5);
      ctx.strokeStyle = `rgba(248,113,113,${pulse})`;
      ctx.lineWidth = 2;
      const x = t.x * TILE;
      const y = t.y * TILE;
      const s = 10;
      ctx.beginPath();
      ctx.moveTo(x + 3, y + 3 + s); ctx.lineTo(x + 3, y + 3); ctx.lineTo(x + 3 + s, y + 3);
      ctx.moveTo(x + TILE - 3 - s, y + 3); ctx.lineTo(x + TILE - 3, y + 3); ctx.lineTo(x + TILE - 3, y + 3 + s);
      ctx.moveTo(x + 3, y + TILE - 3 - s); ctx.lineTo(x + 3, y + TILE - 3); ctx.lineTo(x + 3 + s, y + TILE - 3);
      ctx.moveTo(x + TILE - 3 - s, y + TILE - 3); ctx.lineTo(x + TILE - 3, y + TILE - 3); ctx.lineTo(x + TILE - 3, y + TILE - 3 - s);
      ctx.stroke();
    }
  }
  if (it.knockbackPos) {
    const kPulse = 0.5 + 0.5 * Math.sin(time * 5);
    ctx.fillStyle = `rgba(252,211,77,${0.12 + 0.1 * kPulse})`;
    ctx.fillRect(
      it.knockbackPos.x * TILE,
      it.knockbackPos.y * TILE,
      TILE,
      TILE,
    );
    const kFrom = a;
    const kTo = center(it.knockbackPos.x, it.knockbackPos.y);
    const kdx = kTo.x - kFrom.x;
    const kdy = kTo.y - kFrom.y;
    const klen = Math.hypot(kdx, kdy) || 1;
    const kux = kdx / klen;
    const kuy = kdy / klen;
    const kpx = -kuy;
    const kpy = kux;
    const ksize = 8;
    ctx.strokeStyle = `rgba(252,211,77,${0.55 + 0.35 * kPulse})`;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(kFrom.x, kFrom.y);
    ctx.lineTo(kTo.x, kTo.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(
      kTo.x - kux * ksize + kpx * ksize,
      kTo.y - kuy * ksize + kpy * ksize,
    );
    ctx.lineTo(kTo.x, kTo.y);
    ctx.lineTo(
      kTo.x - kux * ksize - kpx * ksize,
      kTo.y - kuy * ksize - kpy * ksize,
    );
    ctx.stroke();
  }
  const from = center(it.movePos.x, it.movePos.y);
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = "rgba(248,113,113,0.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(a.x, a.y);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawTelegraphMarker(e: Unit): void {
  const it = e.intent;
  if (!it || !it.attackPos) return;
  const a = center(it.attackPos.x, it.attackPos.y);
  const pulse = 0.6 + 0.4 * Math.sin(time * 5);
  ctx.strokeStyle = `rgba(248,113,113,${pulse})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(a.x, a.y, 16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(a.x - 23, a.y);
  ctx.lineTo(a.x - 9, a.y);
  ctx.moveTo(a.x + 9, a.y);
  ctx.lineTo(a.x + 23, a.y);
  ctx.moveTo(a.x, a.y - 23);
  ctx.lineTo(a.x, a.y - 9);
  ctx.moveTo(a.x, a.y + 9);
  ctx.lineTo(a.x, a.y + 23);
  ctx.stroke();
  const dmg = game.damageAfterCover(it.damage, it.attackPos);
  ctx.fillStyle = "#fca5a5";
  ctx.font = 'bold 11px "Segoe UI", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText(`${dmg}`, a.x, it.attackPos.y * TILE + TILE - 6);
}

/** The exfil strip on the player's edge (extract missions). */
function drawExfilZone(): void {
  if (game.objective.kind !== "extract" || game.exfilTiles.length === 0) return;
  if (game.phase !== "player" && game.phase !== "enemy") return;
  const pulse = 0.5 + 0.5 * Math.sin(time * 3);
  for (const t of game.exfilTiles) {
    ctx.fillStyle = `rgba(74,222,128,${0.08 + 0.08 * pulse})`;
    ctx.fillRect(t.x * TILE, t.y * TILE, TILE, TILE);
    ctx.strokeStyle = `rgba(74,222,128,${0.4 + 0.35 * pulse})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(t.x * TILE + 2, t.y * TILE + 2, TILE - 4, TILE - 4);
    ctx.setLineDash([]);
  }
  const mid = game.exfilTiles[Math.floor(game.exfilTiles.length / 2)];
  ctx.fillStyle = "#4ade80";
  ctx.font = 'bold 8px "Segoe UI", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("EXFIL", mid.x * TILE + TILE / 2, mid.y * TILE + TILE - 5);
}

/** Emplacements (the lift beacon) with HP pips. */
function drawStructures(): void {
  for (const s of game.structures) {
    if (s.hp <= 0) continue;
    const c = center(s.pos.x, s.pos.y);
    const pulse = 0.5 + 0.5 * Math.sin(time * 2.2);
    ctx.strokeStyle = `rgba(251,191,36,${0.15 + 0.2 * pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(c.x, c.y + 4, 22 + pulse * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + 20, 17, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.translate(c.x, c.y);
    ctx.imageSmoothingEnabled = false;
    const frame = Math.floor(time * 2.2) % 2;
    ctx.drawImage(getSprite("beacon", frame), -24, -26, 48, 48);
    ctx.restore();
    const pipW = 4;
    const gap = 1;
    const total = s.maxHp * pipW + (s.maxHp - 1) * gap;
    let x = c.x - total / 2;
    for (let i = 0; i < s.maxHp; i++) {
      ctx.fillStyle = i < s.hp ? "#fbbf24" : "#2d3744";
      ctx.fillRect(x, c.y - 32, pipW, 3);
      x += pipW + gap;
    }
  }
}

/** Amber marker on the extract cache / hold position. */
function drawObjectiveMarker(): void {
  drawExfilZone();
  const o = game.objective;
  if (!o.tile) return;
  if (game.phase !== "player" && game.phase !== "enemy") return;
  const c = center(o.tile.x, o.tile.y);
  const pulse = 0.5 + 0.5 * Math.sin(time * 3);
  ctx.fillStyle = `rgba(251,191,36,${0.08 + 0.07 * pulse})`;
  ctx.fillRect(o.tile.x * TILE, o.tile.y * TILE, TILE, TILE);
  ctx.strokeStyle = `rgba(251,191,36,${0.5 + 0.4 * pulse})`;
  ctx.lineWidth = 2;
  if (o.kind === "extract") {
    // cache crate: diamond with a core glint
    const r = 12 + pulse * 2;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y - r);
    ctx.lineTo(c.x + r, c.y);
    ctx.lineTo(c.x, c.y + r);
    ctx.lineTo(c.x - r, c.y);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = `rgba(251,191,36,${0.5 + 0.4 * pulse})`;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fbbf24";
    ctx.font = 'bold 8px "Segoe UI", sans-serif';
    ctx.textAlign = "center";
    ctx.fillText("CACHE", c.x, o.tile.y * TILE + TILE - 5);
  } else if (o.kind === "hold") {
    ctx.beginPath();
    ctx.arc(c.x, c.y, 14 + pulse * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#fbbf24";
    ctx.font = 'bold 8px "Segoe UI", sans-serif';
    ctx.textAlign = "center";
    ctx.fillText(
      `HOLD ${game.objective.progress}/${game.objective.turnsRequired}`,
      c.x,
      o.tile.y * TILE + TILE - 5,
    );
  }
}

/** Pulsing drop-zone diamonds where reinforcements will arrive. */
function drawPendingSpawns(): void {
  for (const s of game.pendingSpawns) {
    const c = center(s.pos.x, s.pos.y);
    const pulse = 0.5 + 0.5 * Math.sin(time * 4);
    const r = 16 + pulse * 3;
    ctx.fillStyle = `rgba(248,113,113,${0.06 + 0.06 * pulse})`;
    ctx.fillRect(s.pos.x * TILE, s.pos.y * TILE, TILE, TILE);
    ctx.strokeStyle = `rgba(248,113,113,${0.45 + 0.4 * pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y - r);
    ctx.lineTo(c.x + r, c.y);
    ctx.lineTo(c.x, c.y + r);
    ctx.lineTo(c.x - r, c.y);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = `rgba(254,202,202,${0.75 + 0.25 * pulse})`;
    ctx.font = 'bold 12px "Segoe UI", sans-serif';
    ctx.textAlign = "center";
    ctx.fillText(String(s.turnsUntil), c.x, c.y + 4);
    ctx.fillStyle = "#fca5a5";
    ctx.font = 'bold 8px "Segoe UI", sans-serif';
    ctx.fillText("DROP ZONE", c.x, s.pos.y * TILE + TILE - 5);
  }
}

function drawFireTargets(): void {
  const u = game.selected;
  if (!u || u.hasFired) return;
  const pulse = 0.55 + 0.45 * Math.sin(time * 5);
  for (const e of game.enemies()) {
    if (!game.canFireWeaponAt(u, u.selectedWeapon, e)) continue;
    ctx.strokeStyle = `rgba(251,191,36,${pulse})`;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(e.pos.x * TILE + 3, e.pos.y * TILE + 3, TILE - 6, TILE - 6);
    ctx.fillStyle = `rgba(251,191,36,${pulse})`;
    ctx.font = 'bold 10px "Segoe UI", sans-serif';
    ctx.textAlign = "center";
    ctx.fillText("TARGET", e.pos.x * TILE + TILE / 2, e.pos.y * TILE + TILE - 6);
  }
}

function drawHover(): void {
  if (!hover) return;
  ctx.strokeStyle = "rgba(201,212,224,0.4)";
  ctx.lineWidth = 2;
  ctx.strokeRect(hover.x * TILE + 1, hover.y * TILE + 1, TILE - 2, TILE - 2);
}

function drawFlashes(): void {
  for (const u of game.units) {
    if (u.hp <= 0) continue;
    const r = rstate.get(u.id);
    if (!r || r.flash <= 0) continue;
    ctx.fillStyle = `rgba(255,255,255,${(r.flash / FLASH) * 0.4})`;
    ctx.fillRect(r.vx * TILE, r.vy * TILE, TILE, TILE);
  }
}

function drawHeatShimmer(u: Unit, cx: number, cy: number): void {
  if (u.team !== "player" || u.heat < u.maxHeat - 1) return;
  const intensity = u.heat >= u.maxHeat ? 1 : 0.6;
  const pulse = 0.4 + 0.5 * Math.sin(time * 7 + u.id);
  ctx.fillStyle = `rgba(249,115,22,${pulse * 0.45 * intensity})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 4, 24, 24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(254,215,170,${pulse * 0.3 * intensity})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 4, 16, 16, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Sprite lookup key for a unit (player archetype or enemy kind). */
function spriteFor(u: Unit): SpriteKey {
  if (u.team === "player") return (u.archetype ?? "vanguard") as SpriteKey;
  return (u.enemyKind ?? "stalker") as SpriteKey;
}

function drawMech(
  cx: number,
  cy: number,
  key: SpriteKey,
  facing: number,
  alpha: number,
  frame: number,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;

  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 20, 17, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(cx, cy);
  ctx.scale(facing, 1);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(getSprite(key, frame), -24, -26, 48, 48);

  ctx.restore();
}

function drawHpPips(cx: number, cy: number, u: Unit, color: string): void {
  const pipW = 5;
  const gap = 1;
  const total = u.maxHp * pipW + (u.maxHp - 1) * gap;
  let x = cx - total / 2;
  const y = cy - 32;
  for (let i = 0; i < u.maxHp; i++) {
    ctx.fillStyle = i < u.hp ? color : "#2d3744";
    ctx.fillRect(x, y, pipW, 3);
    x += pipW + gap;
  }
}

function drawUnits(): void {
  const drawable = game.units.filter((u) => {
    if (u.hp > 0) return true;
    return dying.some((d) => d.id === u.id);
  });
  drawable.sort((a, b) => {
    const ra = rstate.get(a.id);
    const rb = rstate.get(b.id);
    return (ra ? ra.vy : a.pos.y) - (rb ? rb.vy : b.pos.y);
  });
  for (const u of drawable) {
    const r = rstate.get(u.id);
    if (!r) continue;
    const alive = u.hp > 0;
    const dyingRec = dying.find((d) => d.id === u.id);
    const acted =
      u.team === "player" &&
      ((u.hasMoved && u.hasFired) || u.impaired === "full");

    let alpha = 1;
    if (!alive && dyingRec) alpha = Math.max(0, dyingRec.life / dyingRec.maxLife);
    else if (acted) alpha = 0.5;

    const bob = alive ? Math.sin(time * 1.8 + u.id * 0.7) * 1.2 : 0;
    const wuK = r.windUp > 0 ? r.windUp / WIND_UP : 0;
    const target = nearestFoe(u);
    const facing = target && target.pos.x < u.pos.x ? -1 : 1;
    const back = wuK * -facing * 4;
    const scale = 1 - wuK * 0.1;

    const cx = r.vx * TILE + TILE / 2 + back;
    const cy = r.vy * TILE + TILE / 2 + bob;

    if (alive) drawHeatShimmer(u, cx, cy);

    const frame = Math.floor(time * 2.2 + u.id * 0.9) % 2;
    if (scale !== 1) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.translate(-cx, -cy);
      drawMech(cx, cy, spriteFor(u), facing, alpha, frame);
      ctx.restore();
    } else {
      drawMech(cx, cy, spriteFor(u), facing, alpha, frame);
    }

    if (alive) drawHpPips(cx, cy, u, palFor(u).body);

    // Cache-carrier marker: bobbing amber diamond overhead.
    if (alive && game.objective.carrierId === u.id) {
      const dy = Math.sin(time * 4) * 2;
      const top = cy - 40 + dy;
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.moveTo(cx, top - 5);
      ctx.lineTo(cx + 4, top);
      ctx.lineTo(cx, top + 5);
      ctx.lineTo(cx - 4, top);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawProjectiles(): void {
  for (const p of projectiles) {
    const t = 1 - p.life / p.maxLife;
    const fx = p.from.x * TILE + TILE / 2;
    const fy = p.from.y * TILE + TILE / 2;
    const tx = p.to.x * TILE + TILE / 2;
    const ty = p.to.y * TILE + TILE / 2;
    if (p.kind === "beam") {
      const alpha = Math.min(1, (p.life / p.maxLife) * 2);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 4;
      ctx.globalAlpha = alpha * 0.6;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (p.kind === "tracer") {
      const headX = fx + (tx - fx) * t;
      const headY = fy + (ty - fy) * t;
      const tailT = Math.max(0, t - 0.35);
      const tailX = fx + (tx - fx) * tailT;
      const tailY = fy + (ty - fy) * tailT;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(headX, headY);
      ctx.stroke();
      ctx.fillStyle = "#fff7ed";
      ctx.beginPath();
      ctx.arc(headX, headY, 2.6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // slash — flash at the target tile during projectile life
      const a = 1 - Math.abs(t - 0.5) * 2;
      ctx.globalAlpha = Math.max(0, a);
      const angle = Math.atan2(ty - fy, tx - fx);
      const slashLen = TILE * 0.55;
      const ox = -Math.sin(angle) * (slashLen / 2);
      const oy = Math.cos(angle) * (slashLen / 2);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(tx - ox, ty - oy);
      ctx.lineTo(tx + ox, ty + oy);
      ctx.stroke();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(tx - ox, ty - oy);
      ctx.lineTo(tx + ox, ty + oy);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}

function drawParticles(): void {
  for (const p of particles) {
    const a = Math.min(1, (p.life / p.maxLife) * 1.4);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function drawFloaters(): void {
  ctx.textAlign = "center";
  for (const f of floaters) {
    const age = 1 - f.life;
    let scale = 1;
    if (age < 0.12) scale = (age / 0.12) * 1.25;
    else if (age < 0.22) scale = 1.25 - ((age - 0.12) / 0.1) * 0.25;
    ctx.globalAlpha = Math.min(1, f.life * 1.5);
    ctx.fillStyle = f.color;
    const size = Math.max(6, Math.round(18 * scale));
    ctx.font = `bold ${size}px "Segoe UI", sans-serif`;
    const c = center(f.x, f.y);
    ctx.fillText(f.text, c.x, c.y - 28 - (1 - f.life) * 30);
  }
  ctx.globalAlpha = 1;
}

function render(): void {
  ctx.save();
  const s = shake > 0 ? Math.min(shake, 12) : 0;
  const sx = s ? (Math.random() - 0.5) * s : 0;
  const sy = s ? (Math.random() - 0.5) * s : 0;
  ctx.translate(sx, sy);
  ctx.clearRect(-24, -24, SIZE + 48, SIZE + 48);
  drawBoard();
  drawWreckMarks();
  drawTerrain();
  drawObjectiveMarker();
  if (game.phase === "player") {
    drawSelectionRing();
    drawMoveTiles();
    for (const e of game.enemies()) drawTelegraphGround(e);
    drawPendingSpawns();
    drawFireTargets();
    drawHover();
  }
  drawFlashes();
  drawStructures();
  drawUnits();
  if (game.phase === "player") {
    for (const e of game.enemies()) drawTelegraphMarker(e);
  }
  drawProjectiles();
  drawParticles();
  drawFloaters();
  ctx.restore();
}

// --- Loop ---
function ease(cur: number, target: number, dt: number): number {
  const d = target - cur;
  if (Math.abs(d) < 0.002) return target;
  return cur + d * Math.min(1, dt * 13);
}

function update(dt: number): void {
  time += dt;
  for (const u of game.units) {
    const r = rstate.get(u.id);
    if (!r) continue;
    r.vx = ease(r.vx, u.pos.x, dt);
    r.vy = ease(r.vy, u.pos.y, dt);
    r.flash = Math.max(0, r.flash - dt);
    r.windUp = Math.max(0, r.windUp - dt);
  }
  for (let i = floaters.length - 1; i >= 0; i--) {
    floaters[i].life -= dt * 0.8;
    if (floaters[i].life <= 0) floaters.splice(i, 1);
  }
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.life -= dt;
    if (p.life <= 0 && !p.done) {
      p.done = true;
      p.onLand();
      projectiles.splice(i, 1);
    }
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 220 * dt;
    p.vx *= Math.pow(0.5, dt);
    if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = dying.length - 1; i >= 0; i--) {
    dying[i].life -= dt;
    if (dying[i].life <= 0) dying.splice(i, 1);
  }
  shake = Math.max(0, shake - dt * 28);
}

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

// --- Input ---
function tileFromEvent(e: MouseEvent): Vec | null {
  const r = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - r.left) / (r.width / GRID));
  const y = Math.floor((e.clientY - r.top) / (r.height / GRID));
  if (x < 0 || y < 0 || x >= GRID || y >= GRID) return null;
  return { x, y };
}

canvas.addEventListener("mousemove", (e) => {
  hover = game.phase === "player" && !busy ? tileFromEvent(e) : null;
});
canvas.addEventListener("mouseleave", () => {
  hover = null;
});
canvas.addEventListener("click", (e) => {
  const t = tileFromEvent(e);
  if (t) handleClick(t);
});
// --- Cheat codes ---
const CHEATS: Record<string, () => boolean> = {
  TYNEXT: () => {
    if (busy || !game.cheatSkipMission()) return false;
    spawnFloater(
      { x: Math.floor(GRID / 2), y: Math.floor(GRID / 2) },
      "MISSION SKIPPED",
      "#4ade80",
    );
    refreshUI();
    if (game.phase !== "player") {
      busy = true;
      window.setTimeout(settleBattle, 600);
    }
    return true;
  },
};

function closeCheatInput(): void {
  cheatInput.classList.add("hidden");
  cheatInput.classList.remove("ok", "bad");
  cheatInput.value = "";
  cheatInput.blur();
}

cheatV.addEventListener("click", () => {
  if (cheatInput.classList.contains("hidden")) {
    cheatInput.classList.remove("hidden");
    cheatInput.value = "";
    cheatInput.focus();
  } else {
    closeCheatInput();
  }
});

cheatInput.addEventListener("keydown", (e) => {
  e.stopPropagation();
  if (e.key === "Escape") {
    closeCheatInput();
    return;
  }
  if (e.key !== "Enter") return;
  const code = cheatInput.value.trim().toUpperCase();
  const run = CHEATS[code];
  cheatInput.classList.remove("ok", "bad");
  if (run && run()) {
    cheatInput.classList.add("ok");
    window.setTimeout(closeCheatInput, 450);
  } else {
    cheatInput.classList.add("bad");
    cheatInput.select();
    window.setTimeout(() => cheatInput.classList.remove("bad"), 500);
  }
});

window.addEventListener("keydown", (e) => {
  if (document.activeElement === cheatInput) return;
  if (busy || game.phase !== "player") return;
  const sel = game.selected;
  if ((e.key === "1" || e.key === "2") && sel) {
    if (!sel.hasFired) {
      game.selectWeapon(sel, e.key === "1" ? 0 : 1);
      refreshUI();
    }
  } else if (e.key === "Tab") {
    e.preventDefault();
    const ps = game.players();
    if (ps.length) {
      const idx = ps.findIndex((u) => u.id === game.selectedId);
      game.selectUnit(ps[(idx + 1) % ps.length].id);
      refreshUI();
    }
  }
});
deployGo.addEventListener("click", doDeploy);
btnEnd.addEventListener("click", endTurnFlow);
btnRestart.addEventListener("click", restart);
overlayRestart.addEventListener("click", restart);
bayDeploy.addEventListener("click", () => {
  if (game.phase !== "salvage") return;
  game.nextMission();
  rstate.clear();
  floaters.length = 0;
  projectiles.length = 0;
  particles.length = 0;
  dying.length = 0;
  shake = 0;
  syncRenderState();
  salvageEl.classList.add("hidden");
  showMissionIntro();
});

// --- Audio ---
window.addEventListener("pointerdown", ensureAudio);
window.addEventListener("keydown", ensureAudio);
btnMute.classList.toggle("off", audioMuted());
btnMute.addEventListener("click", () => {
  btnMute.classList.toggle("off", toggleMute());
});

renderDeploySlots();
refreshUI();
requestAnimationFrame(frame);
