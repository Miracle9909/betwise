# 📕 BetWise RULEBOOK v1.0 — Bộ Quy Tắc Chuẩn Hóa

> **Mục tiêu:** Hệ thống hóa TẤT CẢ yếu tố phân tích để đạt tỉ lệ thắng tối đa.
> **Engine:** Multi-Factor v7.3, Poisson, Monte Carlo N=2000, Adaptive Half-Kelly
> **Ngày tạo:** 17/04/2026 | **Version:** 1.0 | **Cập nhật:** Hàng ngày sau mỗi session

---

## MỤC LỤC

1. [Pre-Match Analysis Framework](#1-pre-match-analysis-framework)
2. [Thuật Toán Phân Tích Tự Động](#2-thuật-toán-phân-tích-tự-động)
3. [Bo3 Decision Engine](#3-bo3-decision-engine)
4. [Bo5 Decision Engine](#4-bo5-decision-engine)
5. [Bankroll Management](#5-bankroll-management)
6. [Daily Workflow](#6-daily-workflow)
7. [Learning Loop & Rule Calibration](#7-learning-loop--rule-calibration)
8. [Appendix: League Lines](#appendix-league-lines)

---

## 1. Pre-Match Analysis Framework

> **RULE #0:** Mỗi trận phải qua TẤT CẢ 8 bước phân tích. Thiếu ≥2 bước → **SKIP**.

### 1.1 Bước Phân Tích (8 yếu tố)

| # | Yếu Tố | Cách Đánh Giá | Trọng Số | Nguồn |
|---|--------|---------------|----------|-------|
| 1 | **Elo Rating** | Chênh lệch Elo 2 đội (base 1400) | 35% | `esports.js` Elo formula |
| 2 | **H2H Record** | Lịch sử đối đầu 5+ trận gần nhất | 15% (scale by sample) | OpenDota/gol.gg |
| 3 | **Recent Form** | 5 trận gần nhất, weighted (gần=trọng số cao) | 20% | API auto |
| 4 | **Side Advantage** | Blue WR ~52% LoL / Radiant WR ~53% Dota | 5% | Global stats |
| 5 | **Region Strength** | KR 1.08 / CN 1.06 / EU 1.02 / CIS 1.02 / SEA 0.98 / NA 0.96 / SA 0.94 | 5% | `esports.js` |
| 6 | **Consistency (CV)** | CV kills/towers/time < 0.30 = consistent | 5% | `esports.js` |
| 7 | **Draft/Meta** | Comfort picks, meta fit, patch changes | 10% | Manual/Liquipedia |
| 8 | **Motivation/Stakes** | Elimination? Qualification? Meaningless? | 5% | Tournament stage |

### 1.2 Pre-Match Checklist

```
□ Elo diff: ____  (>150 = clear mismatch → bet confident)
□ H2H: __W __L / __games  (>60% WR = trend)
□ Form A: __ / Form B: __  (3+ streak = hot/cold)
□ Side: Blue/Red hoặc Radiant/Dire?
□ Region: Inter-region? Intra-region?
□ CV A: __  / CV B: __  (<0.30 = predictable)
□ Draft: Có comfort ban? Meta shift? Patch mới?
□ Stakes: Regular season? Playoff? Elimination?
→ Thiếu ≥2 mục → SKIP trận này
```

---

## 2. Thuật Toán Phân Tích Tự Động

### 2.1 Elo Win Probability
```
P(A wins) = 1 / (1 + 10^((Elo_B - Elo_A) / 400))

Elo diff → Win %:
  0    → 50%
  50   → 57%
  100  → 64%
  150  → 70%
  200  → 76%
  300  → 85%
```

### 2.2 Form Score (Recency-Weighted)
```
Weights: [W1=1, W2=2, W3=3, W4=4, W5=5]  (gần nhất = cao nhất)
FormScore = Σ(result[i] × W[i]) / Σ(W[i])

Ví dụ: [W, L, W, W, W] = (1×1 + 0×2 + 1×3 + 1×4 + 1×5) / 15 = 0.87
```

### 2.3 Poisson Over Probability
```
P(Over line) = 1 - Σ(k=0 to floor(line)) [e^(-λ) × λ^k / k!]
λ = expected value (từ MC simulation)

Ví dụ: λ_kills = 26, line = 27.5
→ P(Over) = 43% → UNDER pick
```

### 2.4 Monte Carlo Simulation (N=2000)
```
Cho mỗi sim:
  1. Random win/loss dựa trên P(A wins)
  2. Generate kills ~ Normal(avgK_A + avgK_B, sqrt(sdK_A² + sdK_B²))
  3. Generate towers ~ Normal(avgT_A + avgT_B, sqrt(sdT_A² + sdT_B²))
  4. Generate duration ~ Normal((avgD_A + avgD_B)/2, sqrt((sdD_A² + sdD_B²)/2))
  5. Winner team: kills ×1.04, towers ×1.06 (winner bonus)

P(Over kills line) = count(sim_kills > line) / N
```

### 2.5 Multi-Gate Validation
```
GATE 1: Consistency   → CV < 0.30 cho cả 2 đội
GATE 2: Elo Gap       → |Elo_A - Elo_B| ≥ 150
GATE 3: Multi-Signal  → ≥2 bet types cùng hướng (over/under)
GATE 4: Anti-Tilt     → Chưa thua 3 liên tiếp

→ Qua 4/4 gate = ⭐⭐⭐⭐⭐ (max confidence)
→ Qua 3/4 gate = ⭐⭐⭐⭐
→ Qua 2/4 gate = ⭐⭐⭐ (minimum để bet)
→ Dưới 2 gate = SKIP
```

### 2.6 Kelly Criterion (Adaptive Half-Kelly)
```
f* = (p × odds - 1) / (odds - 1)  (Full Kelly)
bet_size = f* / 2                   (Half Kelly → safer)
bet_size = min(bet_size, 3% bankroll)  (Cap per game)

Ví dụ: P = 0.65, Odds = 1.85
f* = (0.65 × 1.85 - 1) / (1.85 - 1) = 0.238
bet = 0.238 / 2 = 11.9% → cap at 3% → 3% bankroll
```

---

## 3. Bo3 Decision Engine

### 3.1 Game 1 → Game 2 Rules (LoL)

| ID | Kịch Bản G1 | Kill | Time | Tower | Dragon | Size | Lý Do |
|----|-------------|------|------|-------|--------|------|-------|
| L01 | **FAV thắng STOMP** (diff>10, <25m) | UNDER ↓ | UNDER ↓ | OVER ↑ | UNDER | 1.5u | Fav dominant → close nhanh G2 |
| L02 | **FAV thắng SÁT NÚT** (<5 diff, >30m) | GIỮ G1 | GIỮ G1 | GIỮ G1 | GIỮ G1 | 1u | Meta cân, trend rõ ràng |
| L03 | **UNDERDOG thắng** (upset) | OVER ↑ | UNDER ↓ | OVER ↑ | OVER ↑ | 1.5u | Fav sẽ all-in aggressive G2 |
| L04 | **G1 kills >> line** (+7.5 over) | OVER ↑ | UNDER ↓ | — | OVER ↑ | 1u | Bloodbath meta xác nhận |
| L05 | **G1 kills << line** (-7.5 under) | UNDER ↓ | OVER ↑ | UNDER ↓ | UNDER | 1u | Clean/objective meta |
| L06 | **G1 time >> line** (+7m over) | OVER ↑ | OVER ↑ | OVER ↑ | OVER ↑ | 1u | Late scaling meta |
| L07 | **G1 time << line** (-7m under) | UNDER ↓ | UNDER ↓ | — | UNDER | 1u | Snowball/early game meta |

### 3.2 Game 2 → Game 3 Rules (LoL, Decisive)

| ID | Kịch Bản | Kill | Time | Dragon | Size | Lý Do |
|----|----------|------|------|--------|------|-------|
| L08 | **1-1, cả 2 game bloody** | OVER ↑↑ | OVER ↑ | OVER ↑ | 1.5u | Decisive = tất tay, nhiều fight |
| L09 | **1-1, cả 2 game clean** | UNDER ↓ | UNDER ↓ | UNDER | 1u | Disciplined teams, controlled |
| L10 | **1-1, mixed (G1≠G2)** | AVG G1+G2 | AVG | — | 0.75u | Unclear trend → giảm size |
| L11 | **Comeback** (thua G1, thắng G2) | OVER ↑ | OVER ↑ | OVER ↑ | 1.5u | Momentum swing → intense |
| L12 | **Draft đổi hẳn** (team swap style) | ĐỔI hướng | ĐỔI hướng | — | 0.75u | Meta game thay đổi |

### 3.3 Game 1 → Game 2 Rules (Dota 2)

| ID | Kịch Bản G1 | Kill | Time | Tower | Size | Lý Do |
|----|-------------|------|------|-------|------|-------|
| D01 | **FAV thắng, kills > 60** | OVER ↑ | UNDER ↓ | OVER ↑ | 0.75u | Dota bloodbath meta |
| D02 | **FAV thắng, kills < 40** | UNDER ↓ | UNDER ↓ | UNDER | 0.5u | Clean dominant game |
| D03 | **UNDERDOG thắng** | OVER ↑↑ | UNDER ↓ | OVER ↑ | 0.75u | Fav revenge G2 |
| D04 | **G1 > 50m** | OVER ↑ | OVER ↑ | OVER ↑ | 0.5u | Late game meta |
| D05 | **G1 < 30m** | UNDER ↓ | UNDER ↓ | — | 0.75u | Stomp meta |

### 3.4 Special Rules (Triggers)

#### LoL Special Rules

| ID | Rule | Trigger | Action | Lý Do |
|----|------|---------|--------|-------|
| S01 | **Dragon Soul** | G đã có team 4+ dragons | G+1: Dragon UNDER | Đối thủ contest sớm hơn |
| S02 | **Baron Throw** | G bị throw tại Baron fight | G+1: Time OVER | Teams cẩn thận Baron fight |
| S03 | **Draft Squeeze** | Đội thua bị ban ≥3 comfort picks | G+1: Time OVER | Chơi tướng lạ → chậm |
| S04 | **Blue Side** | Đội thua chọn Blue side | G+1: Kill UNDER nhẹ | Blue control hơn (52% WR) |
| S05 | **Roster Sub** | Thay player giữa series | **SKIP** game đó | Không đủ data |
| S06 | **Comfort Champion** | Star player lấy signature pick | Kill direction theo star | Comfort = aggressive/passive |
| S07 | **Scaling Comp** | ≥3 late-game champs picked | Time OVER | Late game comp = dài hơn |
| S08 | **Early Comp** | ≥3 early-game champs picked | Time UNDER | Snowball comp = nhanh hơn |
| S09 | **Poke Comp** | Team draft poke heavy | Kill UNDER | Poke = ít all-in fights |
| S10 | **Teamfight Comp** | Team draft teamfight heavy | Kill OVER, Dragon OVER | Teamfight = nhiều 5v5 |

#### Dota 2 Special Rules

| ID | Rule | Trigger | Action | Lý Do |
|----|------|---------|--------|-------|
| S11 | **Radiant Advantage** | Đội thua chọn Radiant | Kill UNDER nhẹ | Radiant 53% WR |
| S12 | **Buyback Game** | G có >3 buybacks late | G+1: Kill OVER | Teams fight riskier |
| S13 | **Mega Creeps** | G đánh đến Mega Creeps | G+1: Time OVER | Both teams respect hơn |
| S14 | **Cheese Draft** | Thắng bằng Brood/Huskar/Meepo | G+1: ĐỔI meta | Cheese bị ban → khác game |
| S15 | **Roshan Timing** | Team lấy Aegis trước 20m | G+1: Time UNDER | Early Rosh = snowball intent |
| S16 | **Techies/Tinker** | Picked in game | Time OVER | Anti-push heroes = kéo dài |

---

## 4. Bo5 Decision Engine

### 4.1 Phase 1: Trinh Sát (G1-G2)
```
Size: 0.5u mỗi game
Kèo: Theo pre-match analysis (Section 1)
Mục tiêu: THU THẬP DATA, không chase profit
```

### 4.2 Phase 2: Quyết Định (G3+)

| Score | Phase | Kill | Time | Size | Lý Do |
|-------|-------|------|------|------|-------|
| **2-0** | Push | OVER ↑ | UNDER ↓ | 0.75u | Desperate fights + fast close |
| **1-1** | Pivotal | AVG G1+G2 | GIỮ | 0.5u | Cân bằng, cẩn thận |
| **0-2** | **STOP** | — | — | 0.25u max | Cut loss |
| **2-1 → G4** | Advantage | UNDER ↓ | UNDER ↓ | 0.75u | Leading team close out |
| **1-2 → G4** | Conserve | OVER ↑ | OVER ↑ | 0.5u | Trailing team fights harder |
| **2-2 → G5** | 🎶 ALL-IN | OVER ↑↑ | OVER ↑↑ | 0.75u | Elimination = max intensity |

---

## 5. Bankroll Management

### 5.1 Core Rules

| Rule | Limit | Lý Do |
|------|-------|-------|
| Max daily exposure | 15% bankroll | Giới hạn rủi ro ngày |
| Max per-series | 8% | Đa dạng hóa |
| Max per-game | 3% | Không all-in 1 game |
| Stop-loss | Thua 3 liên tiếp → DỪNG ngày | Anti-tilt |
| Take-profit | +10% → giảm size 50% | Lock profit |
| Min bankroll | 50u | Đủ để survive variance |

### 5.2 Size Scaling

| Confidence | Gate Score | Size |
|------------|-----------|------|
| ⭐⭐⭐⭐⭐ (4/4 gates) | Max | 2-3% |
| ⭐⭐⭐⭐ (3/4 gates) | High | 1.5-2% |
| ⭐⭐⭐ (2/4 gates) | Medium | 1% |
| ⭐⭐ (<2 gates) | Low | **SKIP** |

### 5.3 Series Size Strategy

| Format | G1 | G2 (win) | G2 (loss) | G3 |
|--------|----|---------|-----------|----|
| **Bo3** | 1u scout | 1.5u push | 0.75u careful | 1u decisive |
| **Bo5** | 0.5u scout × 2 | Theo Phase 2 | Theo Phase 2 | 0.5-0.75u |

---

## 6. Daily Workflow

### 6.1 Pre-Market (Trước 12:00)
```
1. Kiểm tra lịch thi đấu (Liquipedia + GosuGamers + Dotabuff)
2. Chạy Pre-Match Analysis (8 yếu tố) cho MỖI trận
3. Tạo file daily-plans/YYYY-MM-DD.md
4. Xác định trận ưu tiên (T1 > T2 > T3)
5. Ghi kèo cơ sở cho Game 1 mỗi series
```

### 6.2 Live Session (Trong trận)
```
Sau mỗi game trong series:
1. Ghi actual stats: kills, towers, dragons, time
2. Tra bảng Rule (Section 3/4) → xác định kèo game tiếp
3. Check Special Rules (S01-S16) → có trigger nào?
4. Tính size mới theo bankroll rules
5. ĐẶT kèo game tiếp → ghi vào tracking table
```

### 6.3 Post-Market (Cuối ngày)
```
1. Cập nhật kết quả TẤT CẢ kèo
2. Ghi W/L + P&L cho từng rule
3. Tính Daily WR% + P&L
4. Ghi "Lessons Learned" → phát hiện pattern mới
5. Update Google Sheets + NotebookLM
6. Commit + push to GitHub
```

---

## 7. Learning Loop & Rule Calibration

### 7.1 Rule Tracking Format

| Ngày | Rule ID | Applied | Kèo | Result | W/L | Notes |
|------|---------|---------|-----|--------|-----|-------|
| 17/04 | L01 | DK vs T1 G2 | Kill UNDER | 22 (<27.5) | ✅ | Stomp G1, clean G2 |
| 17/04 | S07 | JDG vs NiP G1 | Time OVER | 35m (>31m) | ✅ | Scaling comp confirmed |

### 7.2 Calibration Schedule

| Period | Action | Criteria |
|--------|--------|----------|
| **Daily** | Log rule results | Every bet tracked |
| **Weekly** (7 days) | WR% per rule | Sample size ≥5 |
| **Bi-weekly** (14 days) | Adjust rules | Data-driven changes |
| **Monthly** | Major recalibration | Full backtest |

### 7.3 Rule Adjustment Protocol

```
Rule WR < 40% (after 10+ samples) → ĐẢO NGƯỢC rule hoặc LOẠI BỎ
Rule WR 40-50% → GIẢM SIZE 50% + theo dõi thêm 1 tuần
Rule WR 50-60% → GIỮ NGUYÊN, neutral
Rule WR 60-70% → TĂNG SIZE 25%
Rule WR > 70% → TĂNG SIZE 50% + đánh dấu "Gold Rule" ⭐
```

### 7.4 New Rule Discovery

```
Khi phát hiện pattern mới:
1. Ghi nhận observation (VD: "T1 luôn UNDER kills khi chơi Blue side")
2. Theo dõi 5 lần → nếu ≥4/5 đúng → Tạo rule mới
3. Gán ID (VD: S17), ghi vào rulebook
4. Bắt đầu tracking chính thức
```

### 7.5 Win Rate Progression Target

```
Week 1-2: 50-55% → Baseline, thu thập data
Week 3-4: 55-60% → Loại rules yếu, strengthen rules mạnh
Month 2:  60-70% → Optimal zone, consistent profit
Month 3+: 70-80% → Approaching mastery
Target:   80-90% → Realistic maximum (variance sẽ luôn tồn tại)
```

> ⚠️ **100% WR là lý tưởng, không khả thi.** Esports có inherent variance (cheese drafts, individual pop-off, technical issues). Target thực tế: **70-80% WR + positive P&L nhờ Kelly sizing.**

---

## Appendix: League-Specific Lines

### LoL Kill Lines

| League | Kill Line | Avg Kills (data) | Lý Do |
|--------|-----------|-------------------|-------|
| LCK | 27.5 | ~25 | KR macro-heavy, ít fight |
| LPL | 29.5 | ~30+ | CN aggressive, nhiều fight |
| LEC | 28.5 | ~28 | EU balanced |
| LCS | 28.5 | ~27 | NA balanced |
| VCS | 29.5 | ~30 | VN aggressive |
| PCS | 28.5 | ~28 | Pacific mixed |
| Default | 28.5 | ~28 | Fallback |

### LoL Time Lines

| League | Time Line | Avg Time (data) | Lý Do |
|--------|-----------|------------------|-------|
| LCK | 33m | ~33-35m | KR dài, late scaling |
| LPL | 31m | ~28-31m | CN nhanh, early fight |
| LEC | 32m | ~31-33m | EU balanced |
| VCS | 31m | ~29-31m | VN nhanh |
| Default | 32m | ~31m | Fallback |

### Dota 2 Kill Lines (by league)

| League | Kill Line | Avg Kills (data) |
|--------|-----------|-------------------|
| Ultras | 75.5 | ~76.7 |
| EPL | 58.5 | ~60.1 |
| Destiny | 55.5 | ~57.0 |
| CCT | 50.5 | ~51.0 |
| DreamLeague | 48.5 | ~48.8 |
| Trinity | 40.5 | ~39.2 |
| Default | 57.5 | ~58.2 |

### Dota 2 Time Lines (by league)

| League | Time Line | Avg Time (data) |
|--------|-----------|------------------|
| EPL | 42m | ~44.1m |
| DreamLeague | 40m | ~42.6m |
| Ultras | 36m | ~37.2m |
| Space League | 28.5m | ~28.6m |
| Trinity | 27.5m | ~27.2m |
| Default | 33m | ~33m |

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 17/04/2026 | Initial release — 8-factor pre-match, Bo3/Bo5 engine, 16 special rules, learning loop |

---

*BetWise Rulebook v1.0 — Generated by AI, calibrated by data, improved by experience.*
