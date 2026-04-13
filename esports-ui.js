/**
 * BetWise Esports UI Controller v4.0 — Real Data + Date Navigation
 */
(function () {
    'use strict';

    let esState = EsportsAnalyzer.loadState();
    let currentMatches = [];
    let isAutoRunning = false;
    let autoRunAbort = false;
    let dataSource = 'loading';

    // ===== INIT =====
    async function initEsports() {
        if (!esState.viewingDate) esState.viewingDate = EsportsAnalyzer.todayStr();
        renderDateNav();
        await loadDate(esState.viewingDate);
    }

    async function loadDate(dateStr) {
        esState.viewingDate = dateStr;
        EsportsAnalyzer.saveState(esState);

        renderDateNav();
        const container = document.getElementById('esMatchList');
        if (container) container.innerHTML = '<div class="es-loading"><div class="es-spinner"></div>Đang tải trận đấu...</div>';

        // Check cache first
        if (esState.matchCache && esState.matchCache[dateStr] && esState.matchCache[dateStr].length > 0) {
            currentMatches = esState.matchCache[dateStr];
            dataSource = currentMatches.some(m => m.isReal) ? 'live' : 'simulator';
            renderAll();
            // Re-fetch in background if viewing today
            if (dateStr === EsportsAnalyzer.todayStr()) {
                refreshMatches(dateStr, false);
            }
            return;
        }

        await refreshMatches(dateStr, true);
    }

    async function refreshMatches(dateStr, showLoading) {
        try {
            const matches = await EsportsAnalyzer.loadMatchesForDate(dateStr);
            if (matches.length > 0) {
                currentMatches = matches;
                dataSource = matches.some(m => m.isReal) ? 'live' : 'simulator';
                if (!esState.matchCache) esState.matchCache = {};
                esState.matchCache[dateStr] = matches;
                EsportsAnalyzer.saveState(esState);
                renderAll();
                if (showLoading) {
                    const realCount = matches.filter(m => m.isReal).length;
                    window.showToast?.(`✅ ${matches.length} trận (${realCount} thực) — ${EsportsAnalyzer.formatDate(dateStr)}`, 'success');
                }
            } else {
                currentMatches = [];
                dataSource = 'empty';
                renderAll();
            }
        } catch (e) {
            console.error('[Esports] Load failed:', e);
            currentMatches = [];
            dataSource = 'error';
            renderAll();
        }
    }

    function renderAll() {
        renderCapital();
        renderDataSource();
        renderMatchList();
        renderTimeline();
        renderStats();
        renderWeekly();
        renderAutoButton();
    }

    // ===== DATE NAVIGATOR =====
    function renderDateNav() {
        const el = document.getElementById('esDateNav');
        if (!el) return;
        const today = EsportsAnalyzer.todayStr();
        const viewing = esState.viewingDate || today;
        const isToday = viewing === today;

        const d = new Date(viewing + 'T12:00:00');
        const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
        const monthNames = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
        const dayName = dayNames[d.getDay()];
        const label = isToday ? `HÔM NAY — ${dayName} ${d.getDate()}/${monthNames[d.getMonth()]}` : `${dayName} ${d.getDate()}/${monthNames[d.getMonth()]}/${d.getFullYear()}`;

        el.innerHTML = `
            <button class="es-nav-btn" onclick="navigateDate(-1)" title="Ngày trước">◀</button>
            <div class="es-nav-date ${isToday ? 'today' : ''}">
                <span class="es-nav-label">${label}</span>
                ${!isToday ? '<button class="es-nav-today" onclick="navigateToToday()">Hôm nay</button>' : ''}
            </div>
            <button class="es-nav-btn" onclick="navigateDate(1)" title="Ngày sau" ${isToday ? 'disabled' : ''}>▶</button>
        `;
    }

    window.navigateDate = async function (offset) {
        const newDate = EsportsAnalyzer.shiftDate(esState.viewingDate, offset);
        const today = EsportsAnalyzer.todayStr();
        if (newDate > today) return;
        await loadDate(newDate);
    };
    window.navigateToToday = async function () {
        await loadDate(EsportsAnalyzer.todayStr());
    };

    // ===== DATA SOURCE =====
    function renderDataSource() {
        let el = document.getElementById('esDataSource');
        if (!el) {
            const nav = document.getElementById('esDateNav');
            if (!nav) return;
            el = document.createElement('div');
            el.id = 'esDataSource';
            nav.parentNode.insertBefore(el, nav.nextSibling);
        }
        const realCount = currentMatches.filter(m => m.isReal).length;
        const simCount = currentMatches.filter(m => !m.isReal).length;

        if (dataSource === 'live') {
            el.innerHTML = `<span class="es-source-live">🔴 LIVE DATA</span> — OpenDota API — ${realCount} trận Dota 2 thực${simCount > 0 ? ` + ${simCount} LoL giả lập` : ''}`;
            el.className = 'es-data-source live';
        } else if (dataSource === 'simulator') {
            el.innerHTML = '<span class="es-source-sim">🟡 SIMULATOR</span> — Dữ liệu giả lập từ giải đấu thực';
            el.className = 'es-data-source sim';
        } else if (dataSource === 'empty') {
            el.innerHTML = '<span class="es-source-sim">📭</span> — Không tìm thấy trận top 50 trong ngày này';
            el.className = 'es-data-source sim';
        } else {
            el.innerHTML = '<span class="es-source-sim">⏳</span> Đang tải...';
            el.className = 'es-data-source sim';
        }
    }

    // ===== CAPITAL =====
    function renderCapital() {
        const el = id => document.getElementById(id);
        if (!el('esCapital')) return;
        el('esCapital').textContent = '₫' + EsportsAnalyzer.fmtFull(esState.capital);
        const today = EsportsAnalyzer.todayStr();
        const dpl = EsportsAnalyzer.calcDailyPL(esState.bets, today);
        const wpl = EsportsAnalyzer.calcWeeklyPL(esState.bets);
        const wr = EsportsAnalyzer.calcWinRate(esState.bets);

        const dEl = el('esDailyPL');
        dEl.textContent = (dpl >= 0 ? '+' : '') + '₫' + EsportsAnalyzer.fmtFull(Math.abs(dpl));
        dEl.className = 'es-pl-value ' + (dpl >= 0 ? 'es-win' : 'es-loss');

        const wEl = el('esWeeklyPL');
        wEl.textContent = (wpl >= 0 ? '+' : '') + '₫' + EsportsAnalyzer.fmtFull(Math.abs(wpl));
        wEl.className = 'es-pl-value ' + (wpl >= 0 ? 'es-win' : 'es-loss');

        const resolved = esState.bets.filter(b => b.result !== null);
        el('esWinRate').textContent = resolved.length > 0 ? (wr * 100).toFixed(0) + '%' : '—';

        const streakEl = el('esStreak');
        if (streakEl && resolved.length > 0) {
            let streak = 1, last = resolved[resolved.length - 1].result;
            for (let i = resolved.length - 2; i >= 0; i--) { if (resolved[i].result === last) streak++; else break; }
            streakEl.textContent = (last === 'win' ? '🔥 ' : '❄️ ') + streak + (last === 'win' ? 'W' : 'L');
            streakEl.className = 'es-pl-value ' + (last === 'win' ? 'es-win' : 'es-loss');
        }
    }

    // ===== MATCH LIST =====
    function renderMatchList() {
        const container = document.getElementById('esMatchList');
        if (!container) return;
        const isToday = esState.viewingDate === EsportsAnalyzer.todayStr();

        if (currentMatches.length === 0) {
            container.innerHTML = `<div class="empty-state">
                <div class="es-empty-icon">📭</div>
                <p>Không có trận đấu top 50 trong ngày ${EsportsAnalyzer.formatDate(esState.viewingDate)}</p>
                <p style="opacity:0.5;font-size:12px;">OpenDota API chỉ lưu khoảng 100 trận gần nhất</p>
            </div>`;
            return;
        }

        container.innerHTML = currentMatches.map(match => {
            const rec = EsportsAnalyzer.generateRecommendation(match.bets, esState.capital);
            const bet = esState.bets.find(b => b.matchId === match.id);
            const isFinished = match.status === 'finished' || bet?.result != null;
            const gameTag = match.game === 'dota2' ? 'dota2' : 'lol';
            const gameName = match.game === 'dota2' ? 'DOTA 2' : 'LOL';
            const isLive = match.status === 'live';
            const hasRealResult = match.result && match.isReal;
            const bo = match.bestOf || 1;
            const hasSeriesScore = match.scoreA != null && match.scoreB != null;
            const seriesFinished = isFinished && hasSeriesScore;
            const aWon = seriesFinished && match.scoreA > match.scoreB;
            const bWon = seriesFinished && match.scoreB > match.scoreA;

            return `
                <div class="es-match-card glass-card ${isFinished ? 'finished' : ''} ${isLive ? 'live' : ''}" 
                     data-match-id="${match.id}" onclick="viewEsMatch('${match.id}')">
                    <div class="es-match-header">
                        <div class="es-match-tags">
                            <span class="es-game-tag ${gameTag}">${gameName}</span>
                            ${bo > 1 ? `<span class="es-bo-badge">BO${bo}</span>` : ''}
                            ${match.league ? `<span class="es-league-tag">${match.league}</span>` : ''}
                            ${match.isReal ? '<span class="es-real-badge">📡 REAL</span>' : ''}
                        </div>
                        <div class="es-match-meta">
                            <span class="es-match-time">${isLive ? '🔴 LIVE' : match.time}</span>
                            ${rec.action === 'BET' && !isFinished && isToday ? '<span class="es-qualified-badge">🎯 VÀO LỆNH</span>' : ''}
                        </div>
                    </div>
                    <div class="es-teams">
                        <div class="es-team ${aWon ? 'es-team-winner' : ''}">
                            <span class="es-team-logo">${match.teamA.logo}</span>
                            <span class="es-team-name">${match.teamA.name}</span>
                            <span class="es-team-elo">Elo ${match.teamA.elo}</span>
                        </div>
                        <div class="es-vs-block">
                            ${hasSeriesScore
                    ? `<div class="es-series-score"><span class="es-ss ${aWon ? 'es-ss-win' : ''} ${isLive ? 'es-ss-live' : ''}">${match.scoreA}</span><span class="es-ss-sep">:</span><span class="es-ss ${bWon ? 'es-ss-win' : ''} ${isLive ? 'es-ss-live' : ''}">${match.scoreB}</span></div>`
                    : `<div class="es-vs">VS</div>`
                }
                            ${hasRealResult ? `<div class="es-score-final">${match.result.kills} kills │ ${match.result.duration}p</div>` : ''}
                        </div>
                        <div class="es-team ${bWon ? 'es-team-winner' : ''}">
                            <span class="es-team-logo">${match.teamB.logo}</span>
                            <span class="es-team-name">${match.teamB.name}</span>
                            <span class="es-team-elo">Elo ${match.teamB.elo}</span>
                        </div>
                    </div>
                    ${renderMatchBadge(rec, bet, isToday)}
                </div>`;
        }).join('');
    }

    function renderMatchBadge(rec, bet, isToday) {
        if (bet && bet.result != null) {
            const won = bet.result === 'win';
            return `<div class="es-rec-badge ${won ? 'es-rec-win' : 'es-rec-loss'}">
                ${won ? '✅ THẮNG' : '❌ THUA'} │ ${bet.betLabel}: ${bet.pickLabel} │ ${bet.pnl >= 0 ? '+' : ''}₫${EsportsAnalyzer.fmtFull(Math.abs(bet.pnl))}
            </div>`;
        }
        if (bet && bet.result === null) {
            return `<div class="es-rec-badge es-rec-pending">⏳ Đang thi đấu... ₫${EsportsAnalyzer.fmtFull(bet.amount)}</div>`;
        }
        if (rec.action === 'BET' && isToday) {
            const tc = rec.confTier === 'elite' ? 'es-rec-elite' : rec.confTier === 'high' ? 'es-rec-high' : 'es-rec-medium';
            return `<div class="es-rec-badge ${tc}">
                <div class="es-rec-header">🔮 ${rec.betLabel}: ${rec.pickLabel}</div>
                <div class="es-rec-detail">P=${(rec.probability * 100).toFixed(0)}% │ Edge=+${(rec.edge * 100).toFixed(1)}% │ Kelly=${(rec.kelly * 100).toFixed(1)}% │ ₫${EsportsAnalyzer.fmt(rec.amount)}</div>
            </div>`;
        }
        if (rec.action === 'BET') {
            return `<div class="es-rec-badge es-rec-past">📊 P=${(rec.probability * 100).toFixed(0)}% Edge=+${(rec.edge * 100).toFixed(1)}%</div>`;
        }
        return '<div class="es-rec-badge es-rec-skip">Không đủ edge — Theo dõi</div>';
    }

    // ===== AUTO-PLAY =====
    function renderAutoButton() {
        const btn = document.getElementById('esAutoBtn');
        if (!btn) return;
        const isToday = esState.viewingDate === EsportsAnalyzer.todayStr();
        if (!isToday) { btn.style.display = 'none'; return; }
        btn.style.display = 'block';

        const pending = currentMatches.filter(m => {
            const rec = EsportsAnalyzer.generateRecommendation(m.bets, esState.capital);
            return rec.action === 'BET' && !esState.bets.find(b => b.matchId === m.id);
        });

        if (isAutoRunning) {
            btn.innerHTML = '⏸ Đang thi đấu...'; btn.className = 'es-auto-btn running'; btn.onclick = () => { autoRunAbort = true; };
        } else if (pending.length > 0) {
            btn.innerHTML = `▶ Bắt đầu thi đấu (${pending.length} trận)`; btn.className = 'es-auto-btn ready'; btn.onclick = () => startAutoRun();
        } else {
            const tb = esState.bets.filter(b => b.timestamp?.startsWith(EsportsAnalyzer.todayStr()) && b.result !== null);
            if (tb.length > 0) {
                const pl = tb.reduce((s, b) => s + (b.pnl || 0), 0);
                btn.innerHTML = `✅ Hoàn thành — P&L: ${pl >= 0 ? '+' : ''}₫${EsportsAnalyzer.fmtFull(Math.abs(pl))}`;
                btn.className = 'es-auto-btn done ' + (pl >= 0 ? 'profit' : 'loss');
            } else {
                btn.innerHTML = '📊 Chờ trận đủ điều kiện'; btn.className = 'es-auto-btn waiting';
            }
            btn.onclick = null;
        }
    }

    async function startAutoRun() {
        if (isAutoRunning) return;
        isAutoRunning = true; autoRunAbort = false; renderAutoButton();

        // Only bet on UPCOMING matches — skip live and finished
        const pending = currentMatches.filter(m => {
            if (m.status !== 'upcoming') return false; // KEY: only upcoming
            const rec = EsportsAnalyzer.generateRecommendation(m.bets, esState.capital, esState.streak || 0, esState.sessionPL || 0);
            return rec.action === 'BET' && !esState.bets.find(b => b.matchId === m.id);
        });

        if (pending.length === 0) {
            window.showToast?.('⏳ Không có trận upcoming đủ điều kiện', 'info');
            isAutoRunning = false; renderAll();
            return;
        }

        window.showToast?.(`🎯 Tìm thấy ${pending.length} trận upcoming — bắt đầu đặt lệnh`, 'info');

        for (const match of pending) {
            if (autoRunAbort) break;
            const rec = EsportsAnalyzer.generateRecommendation(match.bets, esState.capital, esState.streak || 0, esState.sessionPL || 0);
            if (rec.action !== 'BET') continue;

            // Place bet
            const betRecord = { matchId: match.id, betType: rec.betType, betLabel: rec.betLabel, pick: rec.pick, pickLabel: rec.pickLabel, line: rec.bestBet.line, amount: rec.amount, odds: rec.odds, probability: rec.probability, edge: rec.edge, result: null, pnl: 0, matchResult: null, timestamp: new Date().toISOString() };
            esState.bets.push(betRecord);
            EsportsAnalyzer.saveState(esState); renderAll();
            highlightCard(match.id, 'betting');
            window.showToast?.(`🎯 Đặt ₫${EsportsAnalyzer.fmtFull(rec.amount)} — ${rec.betLabel}: ${rec.pickLabel} (Adaptive Kelly)`, 'info');
            await delay(2000);
            if (autoRunAbort) break;

            // Poll for real result — max 4 hours, check every 60s
            let result = null;
            const maxPolls = 240; // 4h at 60s intervals
            let pollCount = 0;

            // First check if match already has result
            result = EsportsAnalyzer.simulateResult(match);
            if (result) {
                // Match already finished — use real result
            } else if (match.isReal) {
                // Real match — poll API for result
                window.showToast?.('⏳ Chờ kết quả thực từ API...', 'info');
                while (!result && pollCount < maxPolls && !autoRunAbort) {
                    await delay(60000); // Wait 60 seconds
                    pollCount++;
                    result = await EsportsAnalyzer.fetchMatchResult(match);
                    if (pollCount % 5 === 0) {
                        window.showToast?.(`⏳ Đã chờ ${pollCount} phút — vẫn đang polling...`, 'info');
                    }
                }
                if (!result && !autoRunAbort) {
                    // Timeout — mark as pending, skip to next
                    window.showToast?.('⏰ Timeout chờ kết quả — chuyển trận tiếp', 'warning');
                    continue;
                }
            } else {
                // Non-real match — simulate as fallback
                const mc = EsportsAnalyzer.analyzeBetTypes(match.teamA, match.teamB, match.game);
                result = {
                    kills: Math.round(mc.mc.kills.mean),
                    towers: Math.round(mc.mc.towers.mean),
                    duration: Math.round(mc.mc.duration.mean),
                };
                if (mc.mc.dragons) result.dragons = Math.round(mc.mc.dragons.mean);
            }

            if (autoRunAbort || !result) break;

            // Resolve bet with real/simulated result
            const resolution = EsportsAnalyzer.resolveBet(betRecord, result);
            betRecord.result = resolution.won ? 'win' : 'loss';
            betRecord.pnl = resolution.pnl;
            betRecord.matchResult = result;
            esState.capital += resolution.pnl;
            match.status = 'finished'; match.result = result;

            // Update adaptive streak
            if (resolution.won) {
                esState.streak = Math.max(1, (esState.streak || 0) + 1);
            } else {
                esState.streak = Math.min(-1, (esState.streak || 0) - 1);
            }
            esState.sessionPL = (esState.sessionPL || 0) + resolution.pnl;

            EsportsAnalyzer.saveState(esState); renderAll();
            highlightCard(match.id, resolution.won ? 'win' : 'loss');
            window.showToast?.(resolution.won ? `✅ THẮNG +₫${EsportsAnalyzer.fmtFull(resolution.pnl)}! (Streak: ${esState.streak})` : `❌ Thua -₫${EsportsAnalyzer.fmtFull(Math.abs(resolution.pnl))} (Streak: ${esState.streak})`, resolution.won ? 'success' : 'error');
            await delay(1500);
        }

        isAutoRunning = false;
        EsportsAnalyzer.saveState(esState); renderAll();
        const tb = esState.bets.filter(b => b.timestamp?.startsWith(EsportsAnalyzer.todayStr()) && b.result !== null);
        const pl = tb.reduce((s, b) => s + (b.pnl || 0), 0);
        window.showToast?.(`🏆 P&L: ${pl >= 0 ? '+' : ''}₫${EsportsAnalyzer.fmtFull(Math.abs(pl))} | Streak: ${esState.streak || 0}`, pl >= 0 ? 'success' : 'error');
    }

    function highlightCard(id, state) { const c = document.querySelector(`[data-match-id="${id}"]`); if (!c) return; c.classList.remove('betting', 'win', 'loss'); c.classList.add(state); c.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

    // ===== TIMELINE =====
    function renderTimeline() {
        const container = document.getElementById('esTodayHistory');
        const list = document.getElementById('esBetList');
        if (!container || !list) return;
        const viewing = esState.viewingDate || EsportsAnalyzer.todayStr();
        const tb = esState.bets.filter(b => b.timestamp?.startsWith(viewing));
        if (tb.length === 0) { container.style.display = 'none'; return; }
        container.style.display = 'block';
        let runPL = 0;
        list.innerHTML = tb.map((b, i) => {
            const m = currentMatches.find(x => x.id === b.matchId);
            const label = m ? `${m.teamA.name} vs ${m.teamB.name}` : b.matchId;
            const cls = b.result === 'win' ? 'es-win' : b.result === 'loss' ? 'es-loss' : 'es-pending-text';
            const icon = b.result === 'win' ? '✅' : b.result === 'loss' ? '❌' : '⏳';
            if (b.result) runPL += b.pnl;
            return `<div class="es-bet-row"><div class="es-bet-match">#${i + 1} ${label}</div><div class="es-bet-info">${b.betLabel}: ${b.pickLabel}</div><div class="es-bet-amount">₫${EsportsAnalyzer.fmt(b.amount)}</div><div class="es-bet-result ${cls}">${icon}</div><div class="es-bet-pnl ${cls}">${b.result ? ((b.pnl >= 0 ? '+' : '') + '\u20AB' + EsportsAnalyzer.fmtFull(Math.abs(b.pnl))) : '—'}</div><div class="es-bet-running ${runPL >= 0 ? 'es-win' : 'es-loss'}">${b.result ? ((runPL >= 0 ? '+' : '') + '\u20AB' + EsportsAnalyzer.fmt(Math.abs(runPL))) : '—'}</div></div>`;
        }).join('');
    }

    // ===== STATS =====
    function renderStats() {
        const s = EsportsAnalyzer.calcStats(esState.bets, esState.capital, esState.initialCapital);
        const sec = document.getElementById('esStatsSection');
        if (!sec) return;
        if (s.total === 0) { sec.style.display = 'none'; return; }
        sec.style.display = 'grid';
        document.getElementById('esTotalBets').textContent = s.total;
        document.getElementById('esTotalWins').textContent = s.wins;
        document.getElementById('esTotalLosses').textContent = s.losses;
        document.getElementById('esROI').textContent = s.roi + '%';
    }
    function renderWeekly() {
        const h = EsportsAnalyzer.getDailyHistory(esState.bets);
        const sec = document.getElementById('esWeeklySection'), list = document.getElementById('esWeeklyList');
        if (!sec || !list) return;
        if (h.length === 0) { sec.style.display = 'none'; return; }
        sec.style.display = 'block';
        list.innerHTML = `<div class="es-weekly-header"><span>Ngày</span><span>Lệnh</span><span>Thắng</span><span>P&L</span></div>${h.map(d => `<div class="es-weekly-row"><span>${d.date.slice(5)}</span><span>${d.bets}</span><span>${d.wins}/${d.bets}</span><span class="${d.pnl >= 0 ? 'es-win' : 'es-loss'}">${d.pnl >= 0 ? '+' : ''}₫${EsportsAnalyzer.fmt(Math.abs(d.pnl))}</span></div>`).join('')}`;
    }

    // ===== MATCH DETAIL MODAL =====
    window.viewEsMatch = function (matchId) {
        const match = currentMatches.find(m => m.id === matchId);
        if (!match) return;
        const h2h = EsportsAnalyzer.getH2H(match.teamA, match.teamB);
        const wp = EsportsAnalyzer.winProbability(match.teamA, match.teamB);
        const rec = EsportsAnalyzer.generateRecommendation(match.bets, esState.capital);
        const bet = esState.bets.find(b => b.matchId === matchId);
        const gameName = match.game === 'dota2' ? 'DOTA 2' : 'LOL';
        const bo = match.bestOf || 1;
        const hasSeriesScore = match.scoreA != null && match.scoreB != null;
        const isFinished = match.status === 'finished';
        const aWon = isFinished && hasSeriesScore && match.scoreA > match.scoreB;
        const bWon = isFinished && hasSeriesScore && match.scoreB > match.scoreA;

        document.getElementById('esModalTitle').textContent = `${gameName} — ${match.teamA.name} vs ${match.teamB.name}`;
        const body = document.getElementById('esModalBody');

        // Generate game-by-game tabs for BO series
        const totalGames = hasSeriesScore ? (match.scoreA + match.scoreB) : 0;
        let seriesHTML = '';
        if (bo > 1) {
            seriesHTML = `
            <div class="es-modal-section es-series-section">
                <div class="es-modal-label">📋 SERIES — Best of ${bo}</div>
                <div class="es-series-overview">
                    <div class="es-series-team ${aWon ? 'es-series-winner' : ''}">
                        <span class="es-series-logo">${match.teamA.logo}</span>
                        <span class="es-series-name">${match.teamA.name}</span>
                    </div>
                    <div class="es-series-scoreboard">
                        <span class="es-series-score-num ${aWon ? 'es-series-w' : ''}">${match.scoreA ?? '—'}</span>
                        <span class="es-series-divider">:</span>
                        <span class="es-series-score-num ${bWon ? 'es-series-w' : ''}">${match.scoreB ?? '—'}</span>
                    </div>
                    <div class="es-series-team ${bWon ? 'es-series-winner' : ''}">
                        <span class="es-series-logo">${match.teamB.logo}</span>
                        <span class="es-series-name">${match.teamB.name}</span>
                    </div>
                </div>
                ${totalGames > 0 ? `
                <div class="es-game-tabs">
                    ${Array.from({ length: totalGames }, (_, i) => {
                const gNum = i + 1;
                const gameResult = match.games?.[i];
                const gWinner = gameResult?.winner || (i < (match.scoreA || 0) ? 'A' : 'B');
                return `<button class="es-game-tab ${i === 0 ? 'active' : ''}" onclick="switchGameTab(event, ${i}, '${matchId}')">
                            <span class="es-gt-label">G${gNum}</span>
                            <span class="es-gt-dot ${gWinner === 'A' ? 'es-gt-a' : 'es-gt-b'}"></span>
                        </button>`;
            }).join('')}
                </div>
                <div class="es-game-detail" id="esGameDetail_${matchId}">
                    ${renderGameDetail(match, 0)}
                </div>` : `
                <div class="es-series-status">${match.status === 'live' ? '🔴 Đang thi đấu...' : match.status === 'upcoming' ? '📅 Chưa bắt đầu' : ''}</div>`}
            </div>`;
        }

        body.innerHTML = `
            ${match.league ? `<div class="es-modal-league">🏆 ${match.league} ${bo > 1 ? `— BO${bo}` : ''} ${match.isReal ? '— 📡 Real Data' : ''}</div>` : ''}
            <div class="es-modal-teams">
                <div class="es-modal-team ${aWon ? 'es-modal-team-winner' : ''}">
                    <span class="es-modal-logo">${match.teamA.logo}</span>
                    <span class="es-modal-name">${match.teamA.name}</span>
                    <span class="es-modal-region">${match.teamA.region} │ Elo ${match.teamA.elo}</span>
                    <span class="es-modal-form">Form: ${match.teamA.form.map(f => f ? '✅' : '❌').join('')}</span>
                </div>
                <div class="es-modal-vs-area">
                    ${hasSeriesScore
                ? `<div class="es-modal-series-score"><span class="${aWon ? 'es-series-w' : ''}">${match.scoreA}</span> : <span class="${bWon ? 'es-series-w' : ''}">${match.scoreB}</span></div>`
                : '<div class="es-modal-vs">VS</div>'
            }
                    ${bo > 1 ? `<div class="es-modal-bo">BO${bo}</div>` : ''}
                </div>
                <div class="es-modal-team ${bWon ? 'es-modal-team-winner' : ''}">
                    <span class="es-modal-logo">${match.teamB.logo}</span>
                    <span class="es-modal-name">${match.teamB.name}</span>
                    <span class="es-modal-region">${match.teamB.region} │ Elo ${match.teamB.elo}</span>
                    <span class="es-modal-form">Form: ${match.teamB.form.map(f => f ? '✅' : '❌').join('')}</span>
                </div>
            </div>
            ${seriesHTML}
            <div class="es-modal-section"><div class="es-modal-label">Win Probability</div><div class="es-wp-bar"><div class="es-wp-fill" style="width:${(wp * 100).toFixed(0)}%">${match.teamA.name} ${(wp * 100).toFixed(0)}%</div></div></div>
            <div class="es-modal-section"><div class="es-modal-label">H2H Record</div><div class="es-modal-h2h"><span>${match.teamA.name}: ${h2h.wins}W</span><span class="es-h2h-total">${h2h.total} trận</span><span>${match.teamB.name}: ${h2h.losses}W</span></div></div>
            <div class="es-modal-section"><div class="es-modal-label">Phân tích kèo</div>${match.bets.map(b => { const e = b.pick ? ((b.pickProb * (b.odds - 1) - (1 - b.pickProb)) * 100).toFixed(1) : '0'; return `<div class="es-bet-analysis"><span class="es-bet-type">${b.label}</span><span class="es-bet-line">Line: ${b.line}</span><span class="es-bet-odds">Odds: ${b.odds.toFixed(2)}</span><span class="es-bet-prob">Tài: ${(b.overProb * 100).toFixed(0)}% │ Xỉu: ${(b.underProb * 100).toFixed(0)}%</span>${b.pick ? `<span class="es-bet-pick ${Number(e) > 5 ? 'es-win' : ''}">→ ${b.pick === 'over' ? 'Tài' : 'Xỉu'} (Edge: +${e}%)</span>` : '<span class="es-bet-pick">Không đủ edge</span>'}</div>`; }).join('')}</div>
            ${rec.action === 'BET' ? `<div class="es-modal-section es-modal-rec"><div class="es-modal-label">🔮 Khuyến nghị</div><div class="es-rec-summary"><div><strong>${rec.betLabel}: ${rec.pickLabel}</strong></div><div>Mức cược: <strong>₫${EsportsAnalyzer.fmtFull(rec.amount)}</strong> (${(rec.kelly * 100).toFixed(1)}% Kelly)</div><div>${rec.reason}</div></div></div>` : ''}
            ${match.result ? `<div class="es-modal-section"><div class="es-modal-label">Kết quả ${match.isReal ? 'thực' : 'giả lập'}</div><div class="es-result-grid"><div class="es-result-item"><span>Mạng</span><strong>${match.result.kills}</strong></div><div class="es-result-item"><span>Trụ</span><strong>${match.result.towers}</strong></div><div class="es-result-item"><span>Thời gian</span><strong>${match.result.duration}p</strong></div>${match.result.dragons != null ? `<div class="es-result-item"><span>Rồng</span><strong>${match.result.dragons}</strong></div>` : ''}</div></div>` : ''}
            ${bet ? `<div class="es-modal-section"><div class="es-modal-label">Lệnh đặt</div><div class="es-bet-record ${bet.result === 'win' ? 'es-win' : bet.result === 'loss' ? 'es-loss' : ''}"><div>${bet.betLabel}: ${bet.pickLabel} @ ${bet.odds.toFixed(2)}</div><div>₫${EsportsAnalyzer.fmtFull(bet.amount)}</div>${bet.result ? `<div>${bet.result === 'win' ? '✅ Thắng' : '❌ Thua'} — ${bet.pnl >= 0 ? '+' : ''}₫${EsportsAnalyzer.fmtFull(Math.abs(bet.pnl))}</div>` : '<div>⏳ Đang thi đấu...</div>'}</div></div>` : ''}`;

        document.getElementById('esMatchModal').classList.remove('hidden');
    };

    // Game-by-game tab switching + per-game detail
    function renderGameDetail(match, gameIndex) {
        const g = match.games?.[gameIndex];
        const gNum = gameIndex + 1;
        if (g) {
            return `<div class="es-gd-card">
                <div class="es-gd-header">MAP ${gNum} ${g.winner ? (g.winner === 'A' ? `— ${match.teamA.name} thắng` : `— ${match.teamB.name} thắng`) : ''}</div>
                <div class="es-gd-stats">
                    ${g.kills != null ? `<div class="es-gd-stat"><span>Mạng</span><strong>${g.kills}</strong></div>` : ''}
                    ${g.towers != null ? `<div class="es-gd-stat"><span>Trụ</span><strong>${g.towers}</strong></div>` : ''}
                    ${g.duration != null ? `<div class="es-gd-stat"><span>Thời gian</span><strong>${g.duration}p</strong></div>` : ''}
                    ${g.dragons != null ? `<div class="es-gd-stat"><span>Rồng</span><strong>${g.dragons}</strong></div>` : ''}
                </div>
            </div>`;
        }
        // Simulated game detail
        const seed = EsportsAnalyzer.hashCode ? EsportsAnalyzer.hashCode(match.id + '_g' + gNum) : (gNum * 17 + 31);
        const rng = () => { const x = Math.sin(seed + gameIndex * 37) * 10000; return x - Math.floor(x); };
        const isLol = match.game === 'lol';
        const kills = isLol ? (18 + Math.floor(rng() * 15)) : (35 + Math.floor(rng() * 20));
        const towers = isLol ? (8 + Math.floor(rng() * 6)) : (8 + Math.floor(rng() * 8));
        const dur = isLol ? (26 + Math.floor(rng() * 12)) : (28 + Math.floor(rng() * 15));
        const winner = gameIndex < (match.scoreA || 0) ? match.teamA.name : match.teamB.name;
        return `<div class="es-gd-card">
            <div class="es-gd-header">MAP ${gNum} — ${winner} thắng</div>
            <div class="es-gd-stats">
                <div class="es-gd-stat"><span>Mạng</span><strong>${kills}</strong></div>
                <div class="es-gd-stat"><span>Trụ</span><strong>${towers}</strong></div>
                <div class="es-gd-stat"><span>Thời gian</span><strong>${dur}p</strong></div>
                ${isLol ? `<div class="es-gd-stat"><span>Rồng</span><strong>${2 + Math.floor(rng() * 3)}</strong></div>` : ''}
            </div>
        </div>`;
    }

    window.switchGameTab = function (event, gameIndex, matchId) {
        const match = currentMatches.find(m => m.id === matchId);
        if (!match) return;
        document.querySelectorAll('.es-game-tab').forEach(t => t.classList.remove('active'));
        event.currentTarget.classList.add('active');
        const detail = document.getElementById('esGameDetail_' + matchId);
        if (detail) detail.innerHTML = renderGameDetail(match, gameIndex);
    };
    window.closeEsMatchModal = function () { document.getElementById('esMatchModal').classList.add('hidden'); };

    // ===== SETTINGS =====
    window.openEsSettings = function () {
        document.getElementById('esSettCapital').value = EsportsAnalyzer.fmtFull(esState.initialCapital);
        document.getElementById('esSettingsModal').classList.remove('hidden');
    };
    window.closeEsSettings = function () { document.getElementById('esSettingsModal').classList.add('hidden'); };
    window.saveEsSettings = function () {
        const val = parseInt(document.getElementById('esSettCapital').value.replace(/[^\d]/g, ''), 10);
        if (!val || val < 100000) { window.showToast?.('Vốn tối thiểu 100,000₫', 'error'); return; }
        const diff = val - esState.initialCapital;
        esState.initialCapital = val;
        esState.capital += diff;
        esState.matchCache = {};
        EsportsAnalyzer.saveState(esState);
        closeEsSettings();
        initEsports();
        window.showToast?.('Đã lưu cài đặt', 'success');
    };
    window.resetEsports = function () {
        if (!confirm('Xóa toàn bộ dữ liệu?')) return;
        esState = EsportsAnalyzer.resetState();
        initEsports();
        closeEsSettings();
        window.showToast?.('Đã xóa dữ liệu', 'info');
    };

    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') EsportsAnalyzer.saveState(esState); });

    window.EsportsUI = { initEsports, renderAll };
})();
