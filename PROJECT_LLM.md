# 📖 Project LLM — BetWise Context File

> **Mục đích:** File này được đọc TRƯỚC KHI bắt đầu bất kỳ task nào liên quan BetWise.
> **Cập nhật lần cuối:** 2026-04-17
>
> 📱 **Truy cập online:**
> - **NotebookLM:** https://notebooklm.google.com/notebook/d098885d-848a-4ca8-b971-ef6caf0afe39
> - **Google Sheets:** https://docs.google.com/spreadsheets/d/12vnzXQmkc63urecdI7Kexb9_uYlO8D7cJkgLEwrCdSY/edit

---

## 1. Quick Reference — Calibrated Lines

### Bookmaker Lines (Production)

| Game | Kill | Tower | Time | Dragon |
|------|------|-------|------|--------|
| **Dota 2** | 60.5 | 12.5 | 40m | — |
| **LoL** | 28.5 (default) | 11.5 | 31-33m | 4.5 |

### LoL Kill Lines Theo League

| League | Kill Line | Time Line | Ghi chú |
|--------|----------|-----------|---------|
| LCK (Hàn) | 27.5 | 33m | strategic, ít kills |
| LPL (Trung) | 29.5 | 31m | aggressive, nhiều kills |
| LEC (EU) | 28.5 | 32m | balanced |
| LCS (NA) | 28.5 | 32m | balanced |
| VCS (VN) | 29.5 | 31m | aggressive |

---

## 2. Timezone — LUÔN DÙNG GMT+7

- **Giờ Việt Nam = GMT+7**  
- Khi fetch API → convert UTC → GMT+7
- GosuGamers countdown = tính từ UTC → + 7h = giờ VN
- OpenDota `start_time` = Unix timestamp UTC

---

## 3. Data Sources — LoL Match Results (Kills/Towers/Dragons/Time)

> ⚠️ **Root Cause of 0-0-0 Results:** LoL Esports API (lolesports.com) returns empty `kills`, `towers`, `dragons` fields for most matches. API bị 403 thường xuyên. Cần dùng nguồn khác.

### 🟢 Sources CÓ đầy đủ stats (kills, towers, dragons, barons, time, gold)

| # | Source | URL Pattern | Coverage | API? | Ghi chú |
|---|--------|-------------|----------|------|---------|
| 1 | **gol.gg** | `gol.gg/game/stats/{gameId}/page-game/` | **ALL leagues** (LCK, LPL, LEC, LCS, VCS...) | ❌ Scrape/Browser | **BEST SOURCE** — public, không login, đầy đủ nhất |
| 2 | **lpl.qq.com** | `lpl.qq.com/es/stats.shtml?bmid={bmid}` | **LPL only** | ❌ Browser | Official LPL — kills, towers, dragons, gold per game |
| 3 | **TJStats API** | `open.tjstats.com/match-auth-app/open/v1/compound/matchDetail?matchId={id}` | **LPL only** | ✅ API | Đã có proxy `/api/lol-stats`. Auth key: `7935be4c...` |
| 4 | **Leaguepedia Cargo** | `lol.fandom.com/api.php?action=cargoquery&tables=ScoreboardGames` | ALL leagues | ⚠️ Bị Cloudflare 403 | Fields: Team1Kills, Team2Kills, Team1Towers, Team2Towers, Team1Dragons, Team2Dragons, Gamelength |
| 5 | **Scoregg** | `scoregg.com/match/{id}` | LPL, LCK | ❌ Login-gated | Summary only — cần login xem detail |

### 🟡 Sources CHỈ CÓ schedule (không có stats chi tiết)

| Source | URL | Dùng cho |
|--------|-----|----------|
| GosuGamers Dota2 | gosugamers.net/dota2/matches | Schedule + countdown |
| GosuGamers LoL | gosugamers.net/lol/matches | Schedule + countdown |
| LoL Esports | lolesports.com/schedule | Schedule, bị 403 thường xuyên |
| Dotabuff Esports | dotabuff.com/esports | Dota2 schedule + odds |

### 🔵 Sources Dota 2 Results

| Source | URL | Stats |
|--------|-----|-------|
| **OpenDota API** | `api.opendota.com/api/proMatches` | Match ID, radiant_score, dire_score, duration, league |
| **OpenDota Match** | `api.opendota.com/api/matches/{id}` | Full: kills, towers, wards, gold, XP, player stats |
| **STRATZ** | `stratz.com/matches/{id}` | Browser — kills, towers, gold, networth graphs |

### Chiến lược lấy dữ liệu kết quả

```
LCK/LEC/LCS/VCS → gol.gg (scrape bằng browser hoặc Vercel API proxy)
LPL → TJStats API (đã có) + lpl.qq.com (backup)
Dota 2 → OpenDota API (đã có)
Tất cả → Leaguepedia Cargo (khi Cloudflare cho qua)
```

---

## 4. Pre-Match Checklist (BẮT BUỘC)

```
□ H2H: 5+ trận gần nhất giữa 2 đội?
□ Form: Streak/phong độ từng đội?
□ Side: Win rate Radiant/Dire hoặc Blue/Red?
□ Style: Đánh nhanh/chậm/cân bằng?
□ Meta: Patch/roster/meta thay đổi?
→ Thiếu bất kỳ mục nào → SKIP
```

---

## 5. Series Strategy Quick Ref

### Bo2 (Dota2 League)
- G1: 60% bankroll series → G2: adjust ±50% theo result

### Bo3 (LoL LCK/LPL)
- G1 (30%) → Win: G2 (40%) → Win: DONE / Loss: G3 (30%)
- G1 (30%) → Loss: G2 (20-30%) → Win: G3 (30%) / Loss: **STOP**

### Bo5 (Playoffs)
- G1-G2 (20% each) → scout phase
- 2-0: push 25% G3 / 1-1: 20% G3 / 0-2: STOP hoặc 10% underdog
- G5 Silver Scrapes: 25%, TÀI kills + time + Dragon Soul YES

---

## 6. Bankroll Rules

| Rule | Limit |
|------|-------|
| Max daily | 15% bankroll |
| Per-series | 8% |
| Per-game | 3% |
| Stop-loss | Thua 3 liên tiếp → DỪNG |
| Take-profit | +10% → giảm size 50% |

---

## 7. Team Databases

### Top Dota 2 Teams (Elo)
Team Spirit (1750), Team Falcons (1730), Gaimin Gladiators (1720), Tundra (1710), BetBoom (1700), 1w Team (1690), Xtreme Gaming (1680), Liquid (1670), NaVi (1660), Mouz (1650)

### Top LoL Teams (Elo)  
T1 (1750), Gen.G (1730), HLE (1720), DK (1710), BLG (1700), JDG (1690), WBG (1680), Fnatic (1670), Top Esports (1660), KT (1630)

---

## 8. Upcoming T1 Dota 2 Tournaments

| Giải | Ngày | Format | Teams |
|------|------|--------|-------|
| **PGL Wallachia S8** | 18-26/04/2026 | Swiss Bo3 → DE Bo3 (GF Bo5) | Spirit, Falcons, GG, Tundra, BetBoom, XG, Liquid, NaVi, Mouz, Aurora, VG, HEROIC, VP, PARI, Yandex, SA Rejects |

> ⚠️ LUÔN check giải T1 Dota 2 đang diễn ra trước khi lập plan. Nguồn: web search "dota 2 tier 1 tournament today"

---

## 9. Nguồn Check Lịch (Ưu tiên)

| # | Nguồn | URL | Ghi chú |
|---|-------|-----|---------|
| 1 | **Liquipedia** | liquipedia.net/dota2/Main_Page | **Chính xác nhất** — dùng browser nếu bị Cloudflare 403 |
| 2 | **Dotabuff Esports** | dotabuff.com/esports | Có cả odds + countdown, cần browser |
| 3 | GosuGamers LoL | gosugamers.net/lol/matches | Tốt cho LoL countdown |
| 4 | GosuGamers Dota2 | gosugamers.net/dota2/matches | Có thể THIẾU giải lớn |
| 5 | Web Search | "dota 2 tier 1 tournament today" | **BẮT BUỘC** cross-check T1 |
| 6 | LoL Esports | lolesports.com/schedule | Official nhưng render thiếu |

---

## 10. 📅 Daily Workflow (BẮT BUỘC mỗi ngày)

### Quy Trình Hàng Ngày
```
1. ĐỌC file PROJECT_LLM.md trước
2. Check kết quả ngày trước → cập nhật results vào file MD ngày trước
3. Rút bài học → ghi vào section "Lessons" của ngày mới
4. Fetch lịch thi đấu từ:
   - GosuGamers LoL: gosugamers.net/lol/matches
   - GosuGamers Dota2: gosugamers.net/dota2/matches
   - Web search: "dota 2 tier 1 tournament today" (BẮT BUỘC)
5. Tạo file: daily-plans/YYYY-MM-DD.md
6. Export DOCX: node daily-plans/export-docx.js YYYY-MM-DD
7. Cuối ngày: cập nhật kết quả + P&L
```

### Folder Structure
```
betwise/daily-plans/
├── export-docx.js         # MD → DOCX converter
├── 2026-04-17.md           # Day 1 plan + results
├── 2026-04-17.docx         # DOCX export
├── 2026-04-18.md           # Day 2 ...
└── ...
```

### Cumulative Tracking (cập nhật mỗi ngày)

| Ngày | W | L | WR% | P&L (u) | Cumul P&L | Bài học chính |
|------|---|---|-----|---------|-----------|--------------|
| 17/04 | — | — | — | — | — | Day 1 bắt đầu |

### Mục tiêu
- **Ngắn hạn:** WR > 60% → tăng dần
- **Trung hạn:** WR > 70% ổn định
- **Dài hạn:** Tiệm cận 80%+ bằng data-driven decisions
- **Phương pháp:** Mỗi ngày review, rút bài học, adjust lines/strategy

---

## 11. Lịch Sử Cập Nhật

| Ngày | Thay đổi |
|------|----------|
| 2026-04-17 | Tạo file, daily workflow, PGL Wallachia S8, folder structure |
| — | — |

---

*File này nằm trong thư mục betwise. LUÔN đọc file này trước khi phân tích trận.*
