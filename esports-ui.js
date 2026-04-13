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
    let selectedMatches = new Set(); // User-selected matches for betting

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
        trackPredictions();
        resolvePredictions();
        renderCapital();
        renderDataSource();
        renderMatchList();
        renderTimeline();
        renderStats();
        renderWeekly();
        renderAutoButton();
    }

    // ===== PREDICTION TRACKING =====
    function trackPredictions() {
        if (!esState.predictions) esState.predictions = [];
        for (const match of currentMatches) {
            if (esState.predictions.find(p => p.matchId === match.id)) continue;
            const rec = EsportsAnalyzer.generateRecommendation(match.bets, esState.capital, esState.streak || 0, esState.sessionPL || 0, esState.predictions, match.teamA, match.teamB, esState.bets);
            if (!rec.bestBet) continue;
            esState.predictions.push({
                matchId: match.id,
                matchLabel: `${match.teamA.name} vs ${match.teamB.name}`,
                game: match.game,
                league: match.league || '',
                betType: rec.betType || rec.bestBet.type,
                pick: rec.pick || rec.bestBet.pick,
                line: rec.bestBet.line,
                probability: rec.probability || rec.bestBet.pickProb,
                edge: rec.edge || 0,
                action: rec.action, // 'BET' or 'SKIP'
                hasBet: !!esState.bets.find(b => b.matchId === match.id),
                resolved: false,
                won: null,
                actual: null,
                timestamp: new Date().toISOString(),
            });
        }
        EsportsAnalyzer.saveState(esState);
    }

    function resolvePredictions() {
        if (!esState.predictions) return;
        let changed = false;
        for (const pred of esState.predictions) {
            if (pred.resolved) continue;
            const match = currentMatches.find(m => m.id === pred.matchId);
            if (!match) continue;
            const isFinished = match.status === 'finished';
            const result = match.result;
            if (!isFinished || !result) continue;
            const res = EsportsAnalyzer.resolvePrediction(pred, result);
            pred.resolved = true;
            pred.won = res.won;
            pred.actual = res.actual;
            pred.hasBet = !!esState.bets.find(b => b.matchId === pred.matchId);
            changed = true;
        }
        if (changed) EsportsAnalyzer.saveState(esState);
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
        el('esWinRate').textContent = resolved.length > 0 ? `${(wr * 100).toFixed(0)}% (${resolved.filter(b => b.result === 'win').length}/${resolved.length})` : '—';
        if (resolved.length > 0) el('esWinRate').className = 'es-pl-value ' + (wr >= 0.5 ? 'es-win' : 'es-loss');

        // Prediction WR (all predictions including non-bet)
        const predStats = EsportsAnalyzer.calcPredictionWinRate(esState.predictions || []);
        const predEl = el('esPredWinRate');
        if (predEl) {
            if (predStats.total > 0) {
                predEl.textContent = `${(predStats.rate * 100).toFixed(0)}% (${predStats.wins}/${predStats.total})`;
                predEl.className = 'es-pl-value ' + (predStats.rate >= 0.5 ? 'es-win' : 'es-loss');
            } else {
                predEl.textContent = '—';
            }
        }

        const streakEl = el('esStreak');
        if (streakEl && resolved.length > 0) {
            let streak = 1, last = resolved[resolved.length - 1].result;
            for (let i = resolved.length - 2; i >= 0; i--) { if (resolved[i].result === last) streak++; else break; }
            streakEl.textContent = (last === 'win' ? '🔥 ' : '❄️ ') + streak + (last === 'win' ? 'W' : 'L');
            streakEl.className = 'es-pl-value ' + (last === 'win' ? 'es-win' : 'es-loss');
        }
    }

    function renderMatchCard(match, isToday) {
        const rec = EsportsAnalyzer.generateRecommendation(match.bets, esState.capital, esState.streak || 0, esState.sessionPL || 0, esState.predictions, match.teamA, match.teamB, esState.bets);
        const bet = esState.bets.find(b => b.matchId === match.id);
        const isFinished = match.status === 'finished' || bet?.result != null;
        const gameTag = match.game === 'dota2' ? 'dota2' : 'lol';
        const gameName = match.game === 'dota2' ? 'DOTA 2' : 'LOL';
        const isLive = match.status === 'live';
        const bo = match.bestOf || 1;
        const hasSeriesScore = match.scoreA != null && match.scoreB != null;
        const seriesFinished = isFinished && hasSeriesScore;
        const aWon = seriesFinished && match.scoreA > match.scoreB;
        const bWon = seriesFinished && match.scoreB > match.scoreA;
        const isSelected = selectedMatches.has(match.id);
        const isUpcoming = match.status === 'upcoming';
        const wp = EsportsAnalyzer.winProbability(match.teamA, match.teamB);

        return `
                <div class="es-match-card glass-card ${isFinished ? 'finished' : ''} ${isLive ? 'live' : ''} ${isSelected ? 'selected' : ''}" 
                     data-match-id="${match.id}">
                    <div class="es-match-header">
                        <div class="es-match-tags">
                            ${isToday && isUpcoming ? `<label class="es-checkbox" onclick="event.stopPropagation()">
                                <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleMatchSelection('${match.id}')">
                                <span class="es-checkmark"></span>
                            </label>` : ''}
                            <span class="es-game-tag ${gameTag}">${gameName}</span>
                            ${bo > 1 ? `<span class="es-bo-badge">BO${bo}</span>` : ''}
                            ${match.league ? `<span class="es-league-tag">${match.league}</span>` : ''}
                            ${match.isReal ? '<span class="es-real-badge">📡</span>' : ''}
                        </div>
                        <div class="es-match-meta" onclick="viewEsMatch('${match.id}')">
                            <span class="es-match-time">${isLive ? '🔴 LIVE' : match.time}</span>
                            ${rec.action === 'BET' && !isFinished && isToday ? `<span class="es-qualified-badge">WR ${(wp * 100).toFixed(0)}%</span>` : ''}
                        </div>
                    </div>
                    <div class="es-teams" onclick="viewEsMatch('${match.id}')">
                        <div class="es-team ${aWon ? 'es-team-winner' : ''}">
                            <span class="es-team-logo">${match.teamA.logo}</span>
                            <span class="es-team-name">${match.teamA.name}</span>
                            <span class="es-team-elo">Elo ${match.teamA.elo}</span>
                        </div>
                        <div class="es-vs-block">
                            ${hasSeriesScore
                ? `<div class="es-series-score"><span class="es-ss ${aWon ? 'es-ss-win' : ''} ${isLive ? 'es-ss-live' : ''}">${match.scoreA}</span><span class="es-ss-sep">:</span><span class="es-ss ${bWon ? 'es-ss-win' : ''} ${isLive ? 'es-ss-live' : ''}">${match.scoreB}</span></div>`
                : `<div class="es-vs">${isLive ? '🔴' : isFinished ? '✅' : 'VS'}</div>`
            }
                            ${isFinished && match.result ? `<div class="es-score-final">${match.result.kills}K │ ${match.result.towers}T │ ${match.result.duration}p${match.result.dragons != null ? ' │ ' + match.result.dragons + 'D' : ''}</div>` : ''}
                            ${isLive && !hasSeriesScore ? '<div class="es-live-dot">LIVE</div>' : ''}
                        </div>
                        <div class="es-team ${bWon ? 'es-team-winner' : ''}">
                            <span class="es-team-logo">${match.teamB.logo}</span>
                            <span class="es-team-name">${match.teamB.name}</span>
                            <span class="es-team-elo">Elo ${match.teamB.elo}</span>
                        </div>
                    </div>
                    ${isFinished && bo > 1 && hasSeriesScore ? `<div class="es-series-result-bar">${aWon ? '🏆 ' + match.teamA.name : bWon ? '🏆 ' + match.teamB.name : ''} thắng BO${bo} (${match.scoreA}:${match.scoreB})</div>` : ''}
                    ${isLive && bo > 1 ? `<div class="es-series-live-bar">🔴 Đang thi đấu Game ${(match.scoreA || 0) + (match.scoreB || 0) + 1} / BO${bo}</div>` : ''}
                    ${renderMatchBadge(rec, bet, isToday)}
                </div>`;
    }

    function renderMatchList() {
        const container = document.getElementById('esMatchList');
        if (!container) return;
        const isToday = esState.viewingDate === EsportsAnalyzer.todayStr();

        if (currentMatches.length === 0) {
            container.innerHTML = `<div class="empty-state">
                <div class="es-empty-icon">📭</div>
                <p>Không có trận hợp lệ ngày ${EsportsAnalyzer.formatDate(esState.viewingDate)}</p>
                <p style="opacity:0.5;font-size:12px;">Top 30 teams + Tier 1 leagues (LCK, LPL, LEC, DPC, PGL...)</p>
            </div>`;
            return;
        }

        // Split matches by status
        const liveMatches = currentMatches.filter(m => m.status === 'live');
        const upcomingMatches = currentMatches.filter(m => m.status === 'upcoming');
        const finishedMatches = currentMatches.filter(m => m.status === 'finished' || esState.bets.find(b => b.matchId === m.id)?.result != null);

        let html = '';

        // === SECTION 1: LIVE ===
        if (liveMatches.length > 0) {
            html += `<div class="es-section">
                <div class="es-section-header es-section-live">
                    <span class="es-section-icon">🔴</span>
                    <span class="es-section-title">Đang thi đấu</span>
                    <span class="es-section-count">${liveMatches.length}</span>
                </div>
                <div class="es-section-body">
                    ${liveMatches.map(m => renderMatchCard(m, isToday)).join('')}
                </div>
            </div>`;
        }

        // === SECTION 2: UPCOMING ===
        if (upcomingMatches.length > 0) {
            const selectControls = isToday ? `<div class="es-select-controls">
                <button class="es-select-btn" onclick="selectAllMatches()">☑ Chọn tất cả</button>
                <button class="es-select-btn" onclick="deselectAllMatches()">☐ Bỏ chọn</button>
                <span class="es-selected-count">${selectedMatches.size}/${upcomingMatches.length} đã chọn</span>
            </div>` : '';

            html += `<div class="es-section">
                <div class="es-section-header es-section-upcoming">
                    <span class="es-section-icon">⏳</span>
                    <span class="es-section-title">Sắp diễn ra</span>
                    <span class="es-section-count">${upcomingMatches.length}</span>
                </div>
                <div class="es-section-body">
                    ${selectControls}
                    ${upcomingMatches.map(m => renderMatchCard(m, isToday)).join('')}
                </div>
            </div>`;
        }

        // === SECTION 3: FINISHED (collapsible) ===
        if (finishedMatches.length > 0) {
            html += `<div class="es-section">
                <div class="es-section-header es-section-finished" onclick="toggleFinishedSection()" style="cursor:pointer">
                    <span class="es-section-icon">✅</span>
                    <span class="es-section-title">Đã kết thúc</span>
                    <span class="es-section-count">${finishedMatches.length}</span>
                    <span class="es-section-toggle" id="esFinishedToggle">▼</span>
                </div>
                <div class="es-section-body" id="esFinishedBody">
                    ${finishedMatches.map(m => renderMatchCard(m, isToday)).join('')}
                </div>
            </div>`;
        }

        // Empty active section
        if (liveMatches.length === 0 && upcomingMatches.length === 0) {
            html = `<div class="empty-state" style="margin-bottom:16px">
                <p style="opacity:0.6;font-size:13px;">Không có trận live/upcoming — Chỉ có ${finishedMatches.length} trận đã kết thúc</p>
            </div>` + html;
        }

        container.innerHTML = html;
    }

    // Toggle finished section collapse
    window.toggleFinishedSection = function () {
        const body = document.getElementById('esFinishedBody');
        const toggle = document.getElementById('esFinishedToggle');
        if (!body) return;
        const collapsed = body.style.display === 'none';
        body.style.display = collapsed ? '' : 'none';
        if (toggle) toggle.textContent = collapsed ? '▼' : '▶';
    };

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

    // ===== MATCH SELECTION =====
    window.toggleMatchSelection = function (matchId) {
        if (selectedMatches.has(matchId)) {
            selectedMatches.delete(matchId);
        } else {
            selectedMatches.add(matchId);
        }
        renderAll();
    };
    window.selectAllMatches = function () {
        currentMatches.filter(m => m.status === 'upcoming').forEach(m => selectedMatches.add(m.id));
        renderAll();
    };
    window.deselectAllMatches = function () {
        selectedMatches.clear();
        renderAll();
    };

    // ===== AUTO-PLAY =====
    function renderAutoButton() {
        const btn = document.getElementById('esAutoBtn');
        if (!btn) return;
        const isToday = esState.viewingDate === EsportsAnalyzer.todayStr();
        if (!isToday) { btn.style.display = 'none'; return; }
        btn.style.display = 'block';

        // Use selected matches if any, otherwise all upcoming with edge
        const betCandidates = selectedMatches.size > 0
            ? currentMatches.filter(m => selectedMatches.has(m.id) && m.status === 'upcoming' && !esState.bets.find(b => b.matchId === m.id))
            : currentMatches.filter(m => {
                if (m.status !== 'upcoming') return false;
                const rec = EsportsAnalyzer.generateRecommendation(m.bets, esState.capital, esState.streak || 0, esState.sessionPL || 0, esState.predictions, m.teamA, m.teamB, esState.bets);
                return rec.action === 'BET' && !esState.bets.find(b => b.matchId === m.id);
            });

        if (isAutoRunning) {
            btn.innerHTML = '⏸ Đang thi đấu... (click để dừng)'; btn.className = 'es-auto-btn running'; btn.onclick = () => { autoRunAbort = true; };
        } else if (betCandidates.length > 0) {
            const label = selectedMatches.size > 0 ? `▶ Vào lệnh ${betCandidates.length} trận đã chọn` : `▶ Auto-bet (${betCandidates.length} trận)`;
            btn.innerHTML = label + ` <span style="font-size:10px;opacity:0.7">(max 3 cùng lúc)</span>`;
            btn.className = 'es-auto-btn ready'; btn.onclick = () => startAutoRun();
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

        // Determine candidates: selected or all upcoming with edge
        let candidates = selectedMatches.size > 0
            ? currentMatches.filter(m => selectedMatches.has(m.id) && m.status === 'upcoming' && !esState.bets.find(b => b.matchId === m.id))
            : currentMatches.filter(m => {
                if (m.status !== 'upcoming') return false;
                const rec = EsportsAnalyzer.generateRecommendation(m.bets, esState.capital, esState.streak || 0, esState.sessionPL || 0, esState.predictions, m.teamA, m.teamB, esState.bets);
                return rec.action === 'BET' && !esState.bets.find(b => b.matchId === m.id);
            });

        // Sort by win probability (highest first)
        candidates.sort((a, b) => {
            const wpA = EsportsAnalyzer.winProbability(a.teamA, a.teamB);
            const wpB = EsportsAnalyzer.winProbability(b.teamA, b.teamB);
            return Math.abs(wpB - 0.5) - Math.abs(wpA - 0.5); // Bigger edge first
        });

        if (candidates.length === 0) {
            window.showToast?.('⏳ Không có trận đủ điều kiện', 'info');
            isAutoRunning = false; renderAll();
            return;
        }

        // Max 3 concurrent bets
        const MAX_CONCURRENT = 3;
        const activeBets = esState.bets.filter(b => b.result === null).length;
        const slotsAvailable = Math.max(0, MAX_CONCURRENT - activeBets);
        candidates = candidates.slice(0, slotsAvailable);

        if (candidates.length === 0) {
            window.showToast?.('⚠️ Đã đạt giới hạn 3 kèo cùng lúc', 'warning');
            isAutoRunning = false; renderAll();
            return;
        }

        window.showToast?.(`🎯 Vào lệnh ${candidates.length} trận (ưu tiên WR cao nhất, max ${MAX_CONCURRENT})`, 'info');

        for (const match of candidates) {
            if (autoRunAbort) break;
            const rec = EsportsAnalyzer.generateRecommendation(match.bets, esState.capital, esState.streak || 0, esState.sessionPL || 0, esState.predictions, match.teamA, match.teamB, esState.bets);
            if (rec.action !== 'BET' && selectedMatches.size === 0) continue;

            // Place bet — for selected matches, force bet even if edge is marginal
            const betAmount = rec.action === 'BET' ? rec.amount : Math.round(esState.capital * 0.03 / 10000) * 10000;
            const betRecord = {
                matchId: match.id,
                betType: rec.betType || match.bets[0]?.type || 'kill_ou',
                betLabel: rec.betLabel || match.bets[0]?.label || 'Tài/Xỉu Mạng',
                pick: rec.pick || match.bets[0]?.pick || 'over',
                pickLabel: rec.pickLabel || (match.bets[0]?.pick === 'over' ? `Tài (>${match.bets[0]?.line})` : `Xỉu (<${match.bets[0]?.line})`),
                line: rec.bestBet?.line || match.bets[0]?.line || 45.5,
                amount: betAmount,
                odds: rec.odds || match.bets[0]?.odds || 1.85,
                probability: rec.probability || 0.55,
                edge: rec.edge || 0.05,
                result: null, pnl: 0, matchResult: null,
                timestamp: new Date().toISOString()
            };
            esState.bets.push(betRecord);
            EsportsAnalyzer.saveState(esState); renderAll();
            highlightCard(match.id, 'betting');
            const wp = EsportsAnalyzer.winProbability(match.teamA, match.teamB);
            window.showToast?.(`🎯 ${match.teamA.name} vs ${match.teamB.name} — ₫${EsportsAnalyzer.fmtFull(betAmount)} (WR ${(wp * 100).toFixed(0)}%)`, 'info');
            await delay(2000);
            if (autoRunAbort) break;

            // Poll for real result
            let result = null;
            result = EsportsAnalyzer.simulateResult(match);
            if (!result && match.isReal) {
                window.showToast?.('⏳ Chờ kết quả thực...', 'info');
                let pollCount = 0;
                while (!result && pollCount < 240 && !autoRunAbort) {
                    await delay(60000);
                    pollCount++;
                    result = await EsportsAnalyzer.fetchMatchResult(match);
                    if (pollCount % 5 === 0) window.showToast?.(`⏳ Đã chờ ${pollCount}p...`, 'info');
                }
                if (!result && !autoRunAbort) { window.showToast?.('⏰ Timeout — bỏ qua', 'warning'); continue; }
            } else if (!result) {
                const mc = EsportsAnalyzer.analyzeBetTypes(match.teamA, match.teamB, match.game);
                result = { kills: Math.round(mc.mc.kills.mean), towers: Math.round(mc.mc.towers.mean), duration: Math.round(mc.mc.duration.mean) };
                if (mc.mc.dragons) result.dragons = Math.round(mc.mc.dragons.mean);
            }
            if (autoRunAbort || !result) break;

            const resolution = EsportsAnalyzer.resolveBet(betRecord, result);
            betRecord.result = resolution.won ? 'win' : 'loss';
            betRecord.pnl = resolution.pnl;
            betRecord.matchResult = result;
            esState.capital += resolution.pnl;
            match.status = 'finished'; match.result = result;

            // Adaptive streak update
            esState.streak = resolution.won ? Math.max(1, (esState.streak || 0) + 1) : Math.min(-1, (esState.streak || 0) - 1);
            esState.sessionPL = (esState.sessionPL || 0) + resolution.pnl;

            EsportsAnalyzer.saveState(esState); renderAll();
            highlightCard(match.id, resolution.won ? 'win' : 'loss');
            window.showToast?.(resolution.won
                ? `✅ THẮNG +₫${EsportsAnalyzer.fmtFull(resolution.pnl)} (Streak: ${esState.streak})`
                : `❌ Thua -₫${EsportsAnalyzer.fmtFull(Math.abs(resolution.pnl))} (Streak: ${esState.streak})`,
                resolution.won ? 'success' : 'error');
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
        const rec = EsportsAnalyzer.generateRecommendation(match.bets, esState.capital, 0, 0, esState.predictions, match.teamA, match.teamB, esState.bets);
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
