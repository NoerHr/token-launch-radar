# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/NoerHr/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/NoerHr/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Launch Radar (model radar-2) ranks pre-token protocols by implied launch value. It reads the sealed DefiLlama snapshot, covers all 40 watchlist protocols, adds 160 early pre-token protocols below the $50M watchlist floor, and separates 24 live-token protocols at their market caps. Implied value is one transparent function of the snapshot's own figures — a TVL tier multiple (0.20 at $1B+, 0.28 from $200M, 0.36 from $50M, 0.48 below), seven-day TVL growth clamped to -50%..+100% at weight 0.60, maturity from how long the protocol has run with no token on record, and a breadth bonus for TVL spread across chains. Every board row carries a seven-step farm plan whose actions come from the protocol's category, whose gas comes from its first chain, whose capital comes from its TVL and whose hold comes from its age. The dashboard is a static, offline page: a sortable, filterable board (search, category, chain, momentum, watchlist-only), a detail view per protocol with the model broken down line by line, a live-token view, and a model sandbox that re-ranks the page without touching board.json.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /input/snapshot.json
```

Node 22.18 or later, standard library only — nothing to install. Outside the grader's container, pass any local copy of the snapshot with `--input <snapshot.json|directory>`; outputs (`board.json`, `data.js`, `dashboard/`, `screenshots/`, `dossier.json`) land in `out/` (or `/output` by default).

---

<sub>Entered on [make.fun](https://make.fun/?ref=gentle-panda-86&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
