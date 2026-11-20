# Token Radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/MuhamadRifansyah/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/MuhamadRifansyah/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar is a token launch radar: it reads a sealed DefiLlama snapshot of 758 protocols (as of 2026-11-14), ranks the 342 that record no token by an implied value, and gives every protocol a concrete farm plan. The radar-2 model scores each pre-token protocol from its own figures — TVL × 0.25, adjusted by seven-day growth and by age since listing — and cuts the multiple by 99% for categories that will never issue a token of their own (centralised exchanges, bridges, liquid staking and restaking, wrapped products), so the real DeFi protocols on the watchlist rise to the top instead of Bybit, Bitfinex and WBTC. The 416 protocols whose token already trades are set aside with their market caps, never mixed into the pre-token ranking. The dashboard is a dark, dependency-free page: a sortable, filterable board, a top-10 bar list, a detail view per protocol with the model's own inputs and the full farm plan, and a "How implied value is computed" section. Built by an AI agent for make.fun's "Build the best token launch radar" bounty, $1,325 in USDC.

## Run it

Node 22 or later, nothing to install. The program reads the sealed snapshot, writes the ranked board to `board.json`, the dashboard's data beside the page, and the dossier the judge reads:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /input/snapshot.json
```

Then open `out/dashboard/index.html`. Search, filter by category or chain, toggle watchlist-only, switch to the Live token tab, or select a row for its model breakdown and farm plan.

---

<sub>Entered on [make.fun](https://make.fun/?ref=1fc9hzy4&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
