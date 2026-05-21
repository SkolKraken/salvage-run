# Salvage Run

A turn-based mech tactics game in the browser. Telegraphed enemies, heat-as-resource, deterministic combat, and a 3-mission roguelite loop with carried damage between missions.

**Play it: [salvage-run.vlachtalk.com](https://salvage-run.vlachtalk.com)**

## Run locally

```bash
npm install
npm run dev
```

Open the printed URL (default `http://localhost:5180`).

## Stack

- Vite + TypeScript
- HTML5 Canvas 2D (no engine)
- Logic / rendering split: `src/game.ts` is pure rules, `src/main.ts` handles all visuals and input.

## Design highlights

- **Telegraphed enemies** — every enemy commits to a visible plan each turn. Perfect information, no RNG in combat.
- **Heat overflow** — firing past a mech's heat cap deals the overflow as self-damage. A mech can overheat itself to death.
- **Six terrain types** — open, wreckage, cover, fire, pit, water. Pits shield occupants from ranged fire (except from adjacent attackers) and prevent the occupant from firing.
- **Death spawns fire** — every destroyed mech leaves a burning wreck behind. The battlefield gets more hazardous as the fight goes on.
- **Salvage Bay** — between missions: Repair, Recover, Reinforce, Rearm.

## License

MIT
