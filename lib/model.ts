// Token Radar's model, radar-2: one snapshot of the protocol universe in, one ranked board out.
//
// The board covers ALL 758 protocols in the snapshot: the 342 that record no token, ranked by an
// implied value the model states, and the 416 whose token already trades, ranked by the market's own
// value and kept apart from the pre-token ranking. The watchlist (40 protocols) is the floor, never
// the ceiling: every one of them is on the board, and the early radar adds the pre-token protocols
// below the floor.
//
// Implied value follows only from the snapshot's own figures (TVL, seven-day growth, age since
// listed_at, and category, which is a snapshot figure). No protocol name is ever special-cased.
//
//   base         = tvl_usd x BASE_MULTIPLE
//   growth       = clamp(change_7d, -60, 120) per cent
//   growthMult   = 1 + (growth / 100) x GROWTH_WEIGHT
//   maturity     = 0.6 + min(age_days, 1095) / 1095 x 0.4   (age unknown: 365 days)
//   categoryMult = 0.01 when the protocol cannot launch a token of its own, else 1.00
//   implied      = max(1, round(base x growthMult x maturity x categoryMult))
//
// The category cut is the whole point of this model. The biggest pre-token protocols by TVL are
// centralised exchanges, bridges and wrapped or staked products (Bybit $13.8B, Bitfinex $12.6B,
// Robinhood $12.2B, WBTC $7.9B, Binance staked ETH $7.4B). They will never issue a token: an exchange
// is a company, a bridge moves somebody else's asset, a wrapped product is a receipt for a token that
// already trades. Ranking by TVL alone puts them on top, so the model cuts their multiple to 1% — a
// probability-weighted value for a launch that will almost certainly never happen — and the real DeFi
// protocols on the watchlist rise to the top instead. A versioned pool (a name ending in V2, v2 or
// 2.0) is cut the same way: it is a release of a protocol whose token already trades.
//
// A live-token protocol's implied value is not a model at all: it is the market cap the snapshot
// records, or, when no market cap is recorded, a conservative tenth of its TVL. Live rows are never
// mixed into the pre-token rank: the dashboard shows them in their own section with a TOKEN LIVE
// badge, and the board marks them token_status 'live'.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  base_multiple: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  /** The multiple a protocol that cannot launch a token gets: a 99% cut. */
  category_cut: number;
  /** The categories that cannot launch a token of their own. */
  cut_categories: string[];
  /** The TVL fraction used for a live-token protocol with no market cap recorded. */
  live_tvl_fraction: number;
}

export const MODEL: ModelConstants = {
  base_multiple: 0.25,
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  category_cut: 0.01,
  cut_categories: ['CEX', 'Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC'],
  live_tvl_fraction: 0.1,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-2';

/** How many live-token protocols the dashboard's Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** How many pre-token rows the dashboard shows: the top rows by implied value. The full board in
 * board.json carries all 342; the page is a view of it, and the watchlist (highest pre-token rank
 * 75) is far inside the top 300. */
export const DASHBOARD_ROWS = 300;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** The model breakdown one pre-token row carries, so the dashboard can show its own inputs. */
export interface PreTokenModel {
  kind: 'model';
  base_multiple: number;
  growth_pct: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  category_multiplier: number;
  category_cut: boolean;
  age_days: number | null;
}

/** A live-token row's value is the market's own, not a model's. */
export type LiveModel = { kind: 'mcap'; mcap_usd: number } | { kind: 'tvl-estimate'; fraction: number };

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token' | 'live';
  age_days: number | null;
  implied_value_usd: number;
  model: PreTokenModel | LiveModel;
  farm_steps: string[];
}

/**
 * One pre-token row as the dashboard reads it: a compact array, not an object, so 342 rows fit the
 * dossier's text cap. [slug, name, category index, chain indexes (first 3), tvl, 7d change, age
 * in days, implied value]. Growth, maturity and category multipliers are recomputed in the page
 * from these figures and the model constants, so the page and the board show the same arithmetic.
 */
export type CompactRow = [string, string, number, number[], number, number | null, number | null, number];

/** One live-token row for the dashboard: [slug, name, symbol, category index, chain indexes (first 3), tvl, mcap, 7d change, implied value]. */
export type CompactLive = [string, string, string | null, number, number[], number, number | null, number | null, number];

/** Everything the dashboard needs: the board in compact form, plus the dictionaries it indexes into. */
export interface RadarData {
  as_of: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  pre_size: number;
  live_size: number;
  cats: string[];
  chains: string[];
  wlb: string;
  rows: CompactRow[];
  live: CompactLive[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether the protocol's category is one that will not launch a token of its own. */
export function isCutCategory(p: SnapshotProtocol, model: ModelConstants): boolean {
  return (p.category !== null && model.cut_categories.includes(p.category)) || VERSIONED.test(p.name);
}

/** The category multiplier: 0.01 for a protocol that cannot launch a token, 1.00 otherwise. */
export function categoryMultiplier(p: SnapshotProtocol, model: ModelConstants): number {
  return isCutCategory(p, model) ? model.category_cut : 1;
}

/** The three multipliers and the implied value one pre-token protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
): { implied: number; growthPct: number; growthMult: number; maturityMult: number; categoryMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const categoryMult = categoryMultiplier(protocol, model);
  const base = protocol.tvl_usd * model.base_multiple;
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult * categoryMult));
  return { implied, growthPct, growthMult, maturityMult, categoryMult, age };
}

/** A live-token protocol's value: its market cap, or a conservative tenth of its TVL when none is recorded. */
export function liveValue(protocol: SnapshotProtocol, model: ModelConstants): { implied: number; model: LiveModel } {
  if (protocol.mcap_usd !== null && protocol.mcap_usd > 0) {
    return { implied: Math.round(protocol.mcap_usd), model: { kind: 'mcap', mcap_usd: Math.round(protocol.mcap_usd) } };
  }
  return { implied: Math.max(1, Math.round(protocol.tvl_usd * model.live_tvl_fraction)), model: { kind: 'tvl-estimate', fraction: model.live_tvl_fraction } };
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** What one transaction on a chain usually costs, in whole US dollars, for the farm plan's cost lines. */
const GAS_USD: Record<string, number> = {
  Ethereum: 5, Arbitrum: 0.3, Base: 0.2, Optimism: 0.3, Solana: 0.01, Binance: 0.2, Avalanche: 0.3,
  Polygon: 0.1, 'zkSync Era': 0.3, Linea: 0.3, Scroll: 0.3, Sui: 0.01, Aptos: 0.01, Tron: 0.5,
  Fantom: 0.1, Mantle: 0.1, Blast: 0.2, Mode: 0.1, Fraxtal: 0.1, Sonic: 0.1, Berachain: 0.2,
  'Hyperliquid L1': 0.01, 'Bittensor EVM': 0.1, Unichain: 0.1, Ink: 0.1, Katana: 0.1, Sei: 0.05,
  'World Chain': 0.1, Abstract: 0.1, Soneium: 0.1, Gravity: 0.1, 'X Layer': 0.1, Cronos: 0.1,
};

/** One transaction's gas on a chain, in dollars. */
function gasFor(chain: string): number {
  return GAS_USD[chain] ?? 1;
}

/** A gas figure as the farm plan writes it: "$5" or "$0.30". */
function gasStr(gas: number): string {
  return gas >= 1 ? `$${gas}` : `$${gas.toFixed(2)}`;
}

/**
 * The category's two actions, in the words a farmer can follow: the main position and the second
 * action that proves the account is used more than once. Derived from the protocol's own category,
 * never from a hand-written list of names.
 */
function actionsFor(p: SnapshotProtocol, capital: number, chain: string): { main: string; second: string } {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  const half = Math.round(capital * 0.5);
  const quarter = Math.round(capital * 0.25);
  const third = Math.round(capital * 0.3);
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) {
    return {
      main: `Supply $${capital} of USDC to ${name} on ${chain} and keep the supply open so the position earns interest.`,
      second: `Borrow $${Math.round(capital * 0.4)} of USDC against the supply and repay it within a week.`,
    };
  }
  if (c.includes('dex')) {
    return {
      main: `Provide $${capital} of liquidity to ${name}'s main USDC pair on ${chain} and keep the position in range.`,
      second: `Swap $${quarter} through ${name} on ${chain} once a week, alternating the direction.`,
    };
  }
  if (c.includes('yield') || c.includes('leveraged farm') || c.includes('farm')) {
    return {
      main: `Deposit $${capital} of USDC into ${name}'s highest-yield vault on ${chain} and leave it compounding.`,
      second: `Claim the vault's yield once a week and redeposit it.`,
    };
  }
  if (c.includes('bridge')) {
    return {
      main: `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in an app on that chain.`,
      second: `Bridge $${half} back a week later, then bridge again.`,
    };
  }
  if (c.includes('staking') || c.includes('restak')) {
    return {
      main: `Stake $${capital} of ${chain}'s staking asset through ${name} and keep the receipt token in the wallet.`,
      second: `Use the receipt token once in a ${chain} app, such as a lending market.`,
    };
  }
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options') || c.includes('synthetic')) {
    return {
      main: `Deposit $${capital} of USDC as margin on ${name} and open one small hedged position on ${chain}.`,
      second: `Close the position after a few days and open another, keeping each trade under $${half} of notional.`,
    };
  }
  if (c.includes('prediction')) {
    return {
      main: `Fund the account with $${capital} and place one market position on ${name}, sized under $${half}.`,
      second: `Settle one position a week and open another.`,
    };
  }
  if (c.includes('curator') || c.includes('allocator')) {
    return {
      main: `Deposit $${capital} into a ${name} vault on ${chain} and keep the vault shares in the wallet.`,
      second: `Move $${half} into a second ${name} vault on ${chain} after two weeks.`,
    };
  }
  if (c.includes('stable')) {
    return {
      main: `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold it in the wallet.`,
      second: `Use $${half} of the stable asset in a ${chain} lending market once, then return it to the wallet.`,
    };
  }
  if (c.includes('rwa')) {
    return {
      main: `Mint $${capital} of the protocol's yield-bearing asset on ${chain} and hold it for the full period.`,
      second: `Let the yield accrue for 30 days, then claim or compound it once.`,
    };
  }
  if (c.includes('insurance')) {
    return {
      main: `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active for the full term.`,
      second: `Top up the cover by $${third} after a month if the policy allows it.`,
    };
  }
  if (c.includes('payment') || c.includes('card')) {
    return {
      main: `Top up $${capital} on ${name} and spend $${half} through its card or payment rail on ${chain}.`,
      second: `Make one card payment a week, at least $${Math.round(capital * 0.2)} each.`,
    };
  }
  if (c.includes('chain')) {
    return {
      main: `Bridge $${capital} of USDC to ${chain} and use it in two of the chain's own apps.`,
      second: `Stake $${half} of the chain's native asset through a validator or the chain's staking app.`,
    };
  }
  if (c.includes('cex')) {
    return {
      main: `Deposit $${capital} of USDC to ${name} and place one spot trade under $${half}.`,
      second: `Keep $${half} on the exchange for two weeks, then withdraw half of it to the wallet.`,
    };
  }
  return {
    main: `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`,
    second: `Make one more qualifying action a week, such as a deposit, a swap or a vote.`,
  };
}

/**
 * A pre-token protocol's farm plan: eight steps, each an action with a cost and a time. The plan is
 * derived from the protocol's own record (category, chains, TVL, age), never from a hand-written
 * list of names. The first chain sets the gas and the bridge step; the category sets the actions.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = gasFor(chain);
  const act = actionsFor(p, capital, chain);
  const fund: FarmStep =
    chain === 'Ethereum'
      ? {
          text: `Fund the wallet with $${capital} of USDC on Ethereum, ready to deploy into ${p.name}.`,
          cost: `about ${gasStr(gas)} of gas`,
          time: '5 minutes',
        }
      : {
          text: `Bridge $${capital} of USDC from Ethereum to ${chain} with the official bridge or a trusted bridge, ready to deploy into ${p.name}.`,
          cost: 'about $5 to $10 of gas for the bridge',
          time: '10 to 30 minutes',
        };
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    fund,
    { text: act.main, cost: `$${capital} of capital and about ${gasStr(gas)} of gas`, time: '15 minutes to set up' },
    { text: act.second, cost: `about ${gasStr(gas)} of gas a time`, time: '10 minutes a week' },
    {
      text: `Repeat one qualifying action each week, such as a deposit, a borrow, a swap or a vote, so the account shows steady activity.`,
      cost: `about ${gasStr(gas)} of gas a week`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/**
 * A live-token protocol's plan: five steps for a token that already trades — buy it, put it to
 * work, vote with it, compound it, and set an exit rule. No airdrop is farmed here.
 */
export function liveSteps(p: SnapshotProtocol): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const gas = gasFor(chain);
  const token = p.symbol ? `$${p.symbol}` : 'the token';
  return [
    {
      text: `Buy $${capital} of ${token} on a decentralised exchange on ${chain}, at the market price, and move it to a wallet you control.`,
      cost: `$${capital} of capital and about ${gasStr(gas)} of gas`,
      time: '10 minutes',
    },
    {
      text: `Stake or provide liquidity with $${Math.round(capital * 0.5)} of ${token} through ${p.name} on ${chain} to earn fees or yield.`,
      cost: `about ${gasStr(gas)} of gas`,
      time: '15 minutes',
    },
    {
      text: `Vote on one governance proposal with the position, or delegate the voting power, so the stake is active.`,
      cost: `about ${gasStr(gas)} of gas`,
      time: '10 minutes',
    },
    {
      text: `Check the position once a week and compound or claim the yield, keeping the position size under $${capital * 2}.`,
      cost: `about ${gasStr(gas)} of gas a week`,
      time: '10 minutes a week',
    },
    {
      text: `Set an exit rule before the position grows: take profit above $${capital * 2} of value and never add funds you cannot afford to lose.`,
      cost: 'nothing but the rule',
      time: '5 minutes',
    },
  ];
}

/** The board: every protocol in the snapshot, ranked by implied value, strongest first, ranks 1..N. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const scored: BoardRow[] = snapshot.protocols.map((p) => {
    const age = ageDays(snapshot.as_of, p.listed_at);
    if (isPreToken(p)) {
      const { implied, growthPct, growthMult, maturityMult, categoryMult } = impliedValue(p, snapshot.as_of, model);
      return {
        rank: 0,
        slug: p.slug,
        name: p.name,
        category: p.category,
        chains: p.chains,
        tvl_usd: p.tvl_usd,
        change_7d: p.change_7d,
        mcap_usd: p.mcap_usd,
        listed_at: p.listed_at,
        gecko_id: p.gecko_id,
        symbol: p.symbol,
        token_status: 'pre-token',
        age_days: age,
        implied_value_usd: implied,
        model: {
          kind: 'model',
          base_multiple: model.base_multiple,
          growth_pct: round4(growthPct),
          growth_multiplier: round4(growthMult),
          maturity_multiplier: round4(maturityMult),
          category_multiplier: categoryMult,
          category_cut: categoryMult < 1,
          age_days: age,
        },
        farm_steps: farmSteps(p, age).map(stepText),
      };
    }
    const { implied, model: liveModel } = liveValue(p, model);
    return {
      rank: 0,
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      mcap_usd: p.mcap_usd,
      listed_at: p.listed_at,
      gecko_id: p.gecko_id,
      symbol: p.symbol,
      token_status: 'live',
      age_days: age,
      implied_value_usd: implied,
      model: liveModel,
      farm_steps: liveSteps(p).map(stepText),
    };
  });
  // Rank 1 is the board's most valuable protocol; the implied value never rises as rank ascends.
  scored.sort((a, b) => b.implied_value_usd - a.implied_value_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  scored.forEach((r, i) => {
    r.rank = i + 1;
  });
  return scored;
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  if (board.length < 100) return `the board holds ${board.length} rows, under the 100-row floor`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.trim().length < 20 || s.trim().length > 600) return `${r.slug} has a farm step of ${s.trim().length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** Everything the dashboard renders, from the snapshot: the compact board, dictionaries and counts. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const pre = board.filter((r) => r.token_status === 'pre-token');
  const liveAll = board.filter((r) => r.token_status === 'live');
  const liveTop = [...liveAll].sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd).slice(0, LIVE_ROWS);

  // Dictionaries: the categories and chains the compact rows index into.
  const cats: string[] = [];
  const catIdx = new Map<string, number>();
  const chains: string[] = [];
  const chainIdx = new Map<string, number>();
  const catOf = (c: string | null): number => {
    const key = c ?? 'Other';
    let i = catIdx.get(key);
    if (i === undefined) {
      i = cats.length;
      cats.push(key);
      catIdx.set(key, i);
    }
    return i;
  };
  const chainsOf = (cs: string[]): number[] => {
    const out: number[] = [];
    for (const c of cs.slice(0, 2)) {
      let i = chainIdx.get(c);
      if (i === undefined) {
        i = chains.length;
        chains.push(c);
        chainIdx.set(c, i);
      }
      out.push(i);
    }
    return out;
  };

  const shown = pre.slice(0, DASHBOARD_ROWS);
  const rows: CompactRow[] = shown.map((r) => [
    r.slug,
    r.name,
    catOf(r.category),
    chainsOf(r.chains),
    r.tvl_usd,
    r.change_7d,
    r.age_days,
    r.implied_value_usd,
  ]);
  const live: CompactLive[] = liveTop.map((r) => [
    r.slug,
    r.name,
    r.symbol,
    catOf(r.category),
    chainsOf(r.chains),
    r.tvl_usd,
    r.mcap_usd,
    r.change_7d,
    r.implied_value_usd,
  ]);

  const radar: RadarData = {
    as_of: snapshot.as_of,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    pre_size: pre.length,
    live_size: liveAll.length,
    cats,
    chains,
    wlb: shown.map((r) => (snapshot.watchlist.includes(r.slug) ? '1' : '0')).join(''),
    rows,
    live,
  };
  return { board, radar };
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
