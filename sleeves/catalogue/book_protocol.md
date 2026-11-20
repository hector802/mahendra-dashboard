# Book sleeves: pre-registered protocol

Source: Z. Kakushadze & J.A. Serur, *151 Trading Strategies* (2018), SSRN 3247865.
Registered: 2026-11-20, before any of these strategies was backtested in this repo.

These five sleeves sit alongside the agent-designed sleeves (equity, macro, vol,
crypto) and are **not** a modification of them. They form the `book` group with
its own portfolio, so we can compare "strategies an agent invented" with
"strategies taken as written from a published catalogue".

## Rules for implementers

1. Implement each strategy as the book describes it, in the section given.
   Read the section (PDF page = book page + 1).
2. **Default parameters = the book's typical value.** Where the book gives a
   range, the default is the value stated below; the grid is only the values
   listed below. Do not add variants.
3. Where the book leaves a choice open (e.g. "top decile" in a 9-ETF universe),
   use the choice written below. Anything not covered here: pick the most
   literal reading, write `NOT FROM BOOK:` in the rationale, and report it.
4. Do not change any parameter, filter or universe after seeing a result.
   Running the sandbox to find bugs is fine; tuning is not. If a strategy
   loses money, it stays as specified.
5. Signals use only data up to each close; the engine trades at the next close
   and applies vol targeting and costs. Never use full-sample statistics.
6. Rationale field: one line, starting with the book section, e.g.
   `151 §4.1.1: ...`. `author="book-151"`.

## b_etf · 151 · ETF rotation (book ch. 4)

Universe: SPY EFA EEM IWM, sector SPDRs (XLB XLE XLF XLI XLK XLP XLU XLV XLY), TLT IEF LQD HYG GLD DBC VNQ.
Sector set = the 9 sector SPDRs. "Top decile" of 9 sectors -> top 3 (book fn. 147 logic: small universes use a third).

| Name | Section | Rule | Default | Grid |
|---|---|---|---|---|
| sector_momentum_rotation | 4.1 | Long-only, equal weight top 3 sectors by T-month cumulative return (eq. 361), rebalance every holding period | T=12m, hold=1m | T∈{6,12}m, hold∈{1,3}m |
| sector_momentum_ma_filter | 4.1.1 | As 4.1 but buy a top-3 sector only if P > MA(T') (eq. 362); otherwise that slot is cash | T=12m, T'=200d | T'∈{100,200}d |
| dual_momentum_sector | 4.1.2 | Top-3 sectors if SPY > MA(T'), else 100% TLT (eq. 363) | T=12m, T'=200d | T'∈{100,200}d |
| etf_ibs_reversion | 4.4 | IBS=(C−L)/(H−L) from prior day (eq. 370) on all universe ETFs; dollar-neutral: long bottom 2, short top 2, equal weight, daily | — | none |
| multi_asset_trend | 4.6 | Universe SPY EFA EEM IWM TLT IEF LQD HYG GLD DBC VNQ; keep ETFs with R^cum(T)>0 and P>MA(T'); weights ∝ R^cum/σ² (eq. 373), σ = 252d vol, cap w≤0.30, renormalise; monthly | T=12m, T'=200d | T∈{6,12}m |

IBS uses `engine.data.get_hilo(ticker)` reindexed to the price index passed in.

## b_tech · 151 · Technical rules (book ch. 3, applied to ETFs)

Universe: SPY QQQ IWM DIA EFA EEM + the 9 sector SPDRs. Single-instrument rules run on each of
SPY QQQ IWM DIA EFA EEM, equal weight across the six, long/short as the book states.

| Name | Section | Default | Grid |
|---|---|---|---|
| single_moving_average | 3.11 | book's typical MA length (use 200d if a range) | the book's stated range endpoints + midpoint, ≤3 |
| two_moving_averages | 3.12 | book's typical short/long pair | ≤3 pairs from the book |
| three_moving_averages | 3.13 | book's typical triple | ≤2 triples from the book |
| support_resistance | 3.14 | as book (pivot-point rule) | none |
| channel | 3.15 | book's typical channel length | ≤3 |
| price_momentum_etf | 3.1 | cross-sectional on the 9 sectors + 6 indexes: T=12m formation skipping last 1m, long top third / short bottom third, monthly | T∈{6,12}m |
| low_vol_anomaly_etf | 3.4 | same 15 ETFs: long lowest-vol third, short highest-vol third, σ over 252d, monthly | none |
| residual_momentum_etf | 3.7 | residual of each sector ETF vs SPY (rolling 36m monthly regression), rank by 12-1m residual return, long top 3 / short bottom 3 | none |

## b_macro · 151 · FX & rates (book ch. 5, 8)

FX: spot from EURUSD=X GBPUSD=X AUDUSD=X (USD per unit) and JPY=X CAD=X CHF=X (units per USD; invert to
USD per unit). Tradables for carry/momentum: currency trusts FXE FXB FXA FXY FXC FXF (USD per unit, total
return includes deposit interest), with BIL as the USD cash leg.

Interest-rate data (FRED) is not reachable here. **Carry proxy (NOT FROM BOOK, data workaround):**
foreign short rate r_f ≈ annualised 126-day log return of the currency trust minus log return of its spot
rate; r_d ≈ annualised 126-day log return of BIL. Forward discount D ≈ r_f − r_d (eq. 443).

| Name | Section | Rule | Default | Grid |
|---|---|---|---|---|
| fx_ma_hp_filter | 8.1 | HP-filter each spot series **one-sided** (filter re-estimated on data up to t only; the two-sided filter looks ahead), λ=100·n² with n=12 on month-end data, then MA(T1)>MA(T2) buy else sell, trade via the trusts | T1=3m, T2=12m | (T1,T2)∈{(3,12),(1,6)}m |
| fx_hml_carry | 8.2.1 | Long top half by D, short bottom half, equal weight, monthly (fn. 147: halves for a small universe) | — | none |
| dollar_carry | 8.3 | Long all six trusts equally if mean D > 0, short all if < 0, monthly | — | none |
| fx_momentum_carry_combo | 8.4 | Combine fx_ma_hp_filter and fx_hml_carry with min-variance weights eq. 451–452 from trailing 252d returns of each | — | none |
| curve_steepener_flattener | 5.13 | Duration-neutral TLT vs SHY: steepener (long SHY, short TLT duration-matched) when the 63d change of (TLT/SHY) momentum is negative, flattener otherwise. Duration ratio fixed at 17.0/1.9. NOT FROM BOOK: the timing signal (book describes the trade, not when) | lookback 63d | {63,126}d |
| barbell_vs_bullet | 5.2–5.3 | Long barbell (SHY+TLT, duration-matched to IEF) vs short bullet IEF when the barbell's 126d return exceeds the bullet's, else flat. NOT FROM BOOK: timing | 126d | none |

## b_vol · 151 · Volatility (book ch. 6.5, 7)

| Name | Section | Rule | Default | Grid |
|---|---|---|---|---|
| index_vol_targeting | 6.5 | w_SPY = σ*/σ capped at L=1.5 (fn. 121), rest BIL; σ = 21d realised; rebalance only when abs(Δw)/w > κ | σ*=15%, κ=0.10 | κ∈{0.05,0.10,0.20} |
| vix_basis_proxy | 7.2 | UX1 not available: proxy basis B=VIX3M−VIX, daily roll D=B/42. Rule eq. 431 with thresholds ±0.10/±0.05: D>0.10 open short vol (long SVXY), close when D<0.05; D<−0.10 open long vol (VIXY), close when D>−0.05. NOT FROM BOOK: proxy instruments | thresholds as book | none |
| vol_carry_two_etns | 7.3 | Short VIXY, long VIXM with hedge ratio h=ρσ_X/σ_Z (fn. 131) from trailing 126d regression; rebalance monthly | 126d | {63,126}d |
| vol_risk_premium | 7.4 | At each month start, spread = VIX − realised vol of SPY since start of previous month (%). If spread>0 hold SVXY for the month, else BIL. NOT FROM BOOK: SVXY stands in for selling straddles | — | none |

## b_crypto · 151 · Crypto (book ch. 18, plus ch. 3 rules)

Universe BTC ETH LTC XRP (long/flat only; shorting crypto is costly).

| Name | Section | Rule | Default | Grid |
|---|---|---|---|---|
| btc_single_ma | 3.11 | Long BTC when P > MA(T), else flat | book typical (200d if range) | ≤3 from book |
| crypto_two_ma | 3.12 | Each coin long when MA(short) > MA(long), equal weight among longs | book typical pair | ≤3 |
| crypto_ann | 18.2 | As book: inputs and architecture as described in §18.2, predict next-day BTC direction; **walk-forward**: refit yearly on all data before the year, never on future data; long if P(up)>0.5 else flat. Use scikit-learn MLPClassifier with a fixed random seed | as book | none |

(§18.3 sentiment needs text data we don't have; excluded.)

## Excluded from the book sleeves

Options (ch. 2, 7.5, 7.6), bond-level, CDS, structured, convertibles, tax arbitrage, distressed, real
estate direct, cash, HFT/arbitrage (6.2, 6.4, 8.5), and §17.2/17.6, which are not legitimate strategies.
