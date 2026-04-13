/**
 * BetWise Esports UI Controller v3.0 — Real Match Data + Fallback
 * 
 * Fetches real matches from PandaScore API when token is available.
 * Falls back to simulated matches otherwise.
 * Shows data source indicator (LIVE vs SIMULATOR).
 */
(function () {
    'use strict';

    let esState = EsportsAnalyzer.loadState();
    let currentMatches = [];
    let isAutoRunning = false;
    let autoRunAbort = false;
    let dataSource = 'simulator'; // 'live' or 'simulator'

    // ===== INIT =====
    async function initEsports() {
        const today = EsportsAnalyzer.todayStr();
        if (esState.currentDate !== today) {
            esState.dailyMatches = {};
            esState.currentDate = today;
            esState.autoRunComplete = false;
        }

        // Show loading state
        const container = document.getElementById('esMatchList');
        if (container) container.innerHTML = '<div class="es-loading">⏳ Đang tải lịch thi đấu...</div>';

        // Try fetching real matches
        if (esState.apiToken) {
            const realMatches = await EsportsAnalyzer.fetchRealMatches(esState.apiToken);
            if (realMatches && realMatches.length > 0) {
                // Filter to only qualifying matches
                const qualified = realMatches.filter(m => {
                    const rec = EsportsAnalyzer.generateRecommendation(m.bets, esState.capital);
                    return rec.action === 'BET';
                });
                currentMatches = qualified.length > 0 ? qualified : realMatches.slice(0, 8);
                esState.dailyMatches[today] = currentMatches;
                dataSource = 'live';
                EsportsAnalyzer.saveState(esState);
                renderAll();
                window.showToast?.(`🔴 LIVE — ${currentMatches.length} trận Dota 2 + LoL từ PandaScore`, 'success');
                return;
            }
        }

        // Fallback to simulated
        if (!esState.dailyMatches[today] || esState.dailyMatches[today].length === 0) {
            esState.dailyMatches[today] = EsportsAnalyzer.generateFallbackMatches(today);
            EsportsAnalyzer.saveState(esState);
        }
        currentMatches = esState.dailyMatches[today];
        dataSource = 'simulator';
        renderAll();
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

    // ===== DATA SOURCE INDICATOR =====
    function renderDataSource() {
        let el = document.getElementById('esDataSource');
        if (!el) {
            const header = document.querySelector('#esportsContent .es-capital-card');
            if (!header) return;
            el = document.createElement('div');
            el.id = 'esDataSource';
            header.parentNode.insertBefore(el, header.nextSibling);
        }
        if (dataSource === 'live') {
            el.innerHTML = '<span class="es-source-live">🔴 LIVE DATA</span> — PandaScore API — Trận đấu thực';
            el.className = 'es-data-source live';
        } else {
            el.innerHTML = `<span class="es-source-sim">🟡 SIMULATOR</span> — Dữ liệu giả lập — <a href="#" onclick="openEsSettings(); return false;">Nhập API Token để xem trận thực</a>`;
            el.className = 'es-data-source sim';
        }
    }

    // ===== CAPITAL CARD =====
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
            for (let i = resolved.length - 2; i >= 0; i--) {
                if (resolved[i].result === last) streak++; else break;
            }
            streakEl.textContent = (last === 'win' ? '🔥 ' : '❄️ ') + streak + (last === 'win' ? 'W' : 'L');
            streakEl.className = 'es-pl-value ' + (last === 'win' ? 'es-win' : 'es-loss');
        }
    }

    // ===== MATCH LIST =====
    function renderMatchList() {
        const container = document.getElementById('esMatchList');
        if (!container) return;

        if (currentMatches.length === 0) {
            container.innerHTML = `<div class="empty-state">
                <p>Không có trận đấu hôm nay</p>
                ${!esState.apiToken ? '<p style="opacity:0.7;font-size:13px;">Nhập PandaScore API Token trong ⚙️ Settings để xem trận thực</p>' : ''}
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

            // Team logo: use image URL if available, else emoji
            const teamLogoA = match.teamA.imageUrl
                ? `<img src="${match.teamA.imageUrl}" alt="${match.teamA.name}" class="es-team-img" onerror="this.style.display='none';this.nextElementSibling.style.display='inline'">`
                : '';
            const teamLogoB = match.teamB.imageUrl
                ? `<img src="${match.teamB.imageUrl}" alt="${match.teamB.name}" class="es-team-img" onerror="this.style.display='none';this.nextElementSibling.style.display='inline'">`
                : '';

            return `
                <div class="es-match-card glass-card ${isFinished ? 'finished' : ''} ${isLive ? 'live' : ''}" 
                     data-match-id="${match.id}" onclick="viewEsMatch('${match.id}')">
                    <div class="es-match-top">
                        <span class="es-game-tag ${gameTag}">${gameName}</span>
                        ${match.league ? `<span class="es-league-tag">${match.league}</span>` : ''}
                        <span class="es-match-time">${isLive ? '🔴 LIVE' : match.time}</span>
                        ${rec.action === 'BET' && !isFinished ? '<span class="es-qualified-badge">🎯 VÀO LỆNH</span>' : ''}
                    </div>
                    <div class="es-teams">
                        <div class="es-team">
                            ${teamLogoA}<span class="es-team-logo">${match.teamA.logo}</span>
                            <span class="es-team-name">${match.teamA.name}</span>
                        </div>
                        <div class="es-vs">VS</div>
                        <div class="es-team">
                            ${teamLogoB}<span class="es-team-logo">${match.teamB.logo}</span>
                            <span class="es-team-name">${match.teamB.name}</span>
                        </div>
                    </div>
                    ${renderMatchBadge(rec, bet)}
                </div>`;
        }).join('');
    }

    function renderMatchBadge(rec, bet) {
        if (bet && bet.result != null) {
            const won = bet.result === 'win';
            const parts = [`Mạng ${bet.matchResult?.kills || '—'}`, `Trụ ${bet.matchResult?.towers || '—'}`, `${bet.matchResult?.duration || '—'}p`];
            if (bet.matchResult?.dragons != null) parts.push(`Rồng ${bet.matchResult.dragons}`);
            return `<div class="es-rec-badge ${won ? 'es-rec-win' : 'es-rec-loss'}">
                ${won ? '✅ THẮNG' : '❌ THUA'} │ ${bet.betLabel}: ${bet.pickLabel} │ ${bet.pnl >= 0 ? '+' : ''}₫${EsportsAnalyzer.fmtFull(Math.abs(bet.pnl))}
                <div class="es-rec-reason">${parts.join(' │ ')}</div>
            </div>`;
        }
        if (bet && bet.result === null) {
            return `<div class="es-rec-badge es-rec-pending">⏳ Đang thi đấu... ₫${EsportsAnalyzer.fmtFull(bet.amount)}</div>`;
        }
        if (rec.action === 'BET') {
            const tc = rec.confTier === 'elite' ? 'es-rec-elite' : rec.confTier === 'high' ? 'es-rec-high' : 'es-rec-medium';
            return `<div class="es-rec-badge ${tc}">
                <div class="es-rec-header">🔮 ${rec.betLabel}: ${rec.pickLabel}</div>
                <div class="es-rec-detail">P=${(rec.probability * 100).toFixed(0)}% │ Edge=+${(rec.edge * 100).toFixed(1)}% │ Kelly=${(rec.kelly * 100).toFixed(1)}% │ ₫${EsportsAnalyzer.fmt(rec.amount)}</div>
            </div>`;
        }
        return '<div class="es-rec-badge es-rec-skip">📊 Không đủ edge — Theo dõi</div>';
    }

    // ===== AUTO-PLAY =====
    function renderAutoButton() {
        const btn = document.getElementById('esAutoBtn');
        if (!btn) return;
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

        const pending = currentMatches.filter(m => {
            const rec = EsportsAnalyzer.generateRecommendation(m.bets, esState.capital);
            return rec.action === 'BET' && !esState.bets.find(b => b.matchId === m.id);
        });

        for (const match of pending) {
            if (autoRunAbort) break;
            const rec = EsportsAnalyzer.generateRecommendation(match.bets, esState.capital);
            if (rec.action !== 'BET') continue;

            const betRecord = { matchId: match.id, betType: rec.betType, betLabel: rec.betLabel, pick: rec.pick, pickLabel: rec.pickLabel, line: rec.bestBet.line, amount: rec.amount, odds: rec.odds, probability: rec.probability, edge: rec.edge, result: null, pnl: 0, matchResult: null, timestamp: new Date().toISOString() };
            esState.bets.push(betRecord);
            EsportsAnalyzer.saveState(esState); renderAll();
            highlightCard(match.id, 'betting');
            window.showToast?.(`🎯 Đặt ₫${EsportsAnalyzer.fmtFull(rec.amount)} — ${rec.betLabel}: ${rec.pickLabel}`, 'info');
            await delay(2000);
            if (autoRunAbort) break;

            const result = EsportsAnalyzer.simulateResult(match);
            const resolution = EsportsAnalyzer.resolveBet(betRecord, result);
            betRecord.result = resolution.won ? 'win' : 'loss';
            betRecord.pnl = resolution.pnl;
            betRecord.matchResult = result;
            esState.capital += resolution.pnl;
            match.status = 'finished'; match.result = result;
            EsportsAnalyzer.saveState(esState); renderAll();
            highlightCard(match.id, resolution.won ? 'win' : 'loss');
            window.showToast?.(resolution.won ? `✅ THẮNG +₫${EsportsAnalyzer.fmtFull(resolution.pnl)}!` : `❌ Thua -₫${EsportsAnalyzer.fmtFull(Math.abs(resolution.pnl))}`, resolution.won ? 'success' : 'error');
            await delay(1500);
        }

        isAutoRunning = false; esState.autoRunComplete = true;
        EsportsAnalyzer.saveState(esState); renderAll();
        const tb = esState.bets.filter(b => b.timestamp?.startsWith(EsportsAnalyzer.todayStr()) && b.result !== null);
        const pl = tb.reduce((s, b) => s + (b.pnl || 0), 0);
        window.showToast?.(`🏆 Hoàn thành! P&L: ${pl >= 0 ? '+' : ''}₫${EsportsAnalyzer.fmtFull(Math.abs(pl))}`, pl >= 0 ? 'success' : 'error');
    }

    function highlightCard(id, state) {
        const c = document.querySelector(`[data-match-id="${id}"]`);
        if (!c) return;
        c.classList.remove('betting', 'win', 'loss');
        c.classList.add(state);
        c.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

    // ===== TIMELINE =====
    function renderTimeline() {
        const container = document.getElementById('esTodayHistory');
        const list = document.getElementById('esBetList');
        if (!container || !list) return;
        const today = EsportsAnalyzer.todayStr();
        const tb = esState.bets.filter(b => b.timestamp?.startsWith(today));
        if (tb.length === 0) { container.style.display = 'none'; return; }
        container.style.display = 'block';
        let runPL = 0;
        list.innerHTML = tb.map((b, i) => {
            const m = currentMatches.find(x => x.id === b.matchId);
            const label = m ? `${m.teamA.name} vs ${m.teamB.name}` : b.matchId;
            const cls = b.result === 'win' ? 'es-win' : b.result === 'loss' ? 'es-loss' : 'es-pending-text';
            const icon = b.result === 'win' ? '✅' : b.result === 'loss' ? '❌' : '⏳';
            if (b.result) runPL += b.pnl;
            const rp = b.result ? `${runPL >= 0 ? '+' : ''}₫${EsportsAnalyzer.fmt(Math.abs(runPL))}` : '—';
            return `<div class="es-bet-row"><div class="es-bet-match">#${i + 1} ${label}</div><div class="es-bet-info">${b.betLabel}: ${b.pickLabel}</div><div class="es-bet-amount">₫${EsportsAnalyzer.fmt(b.amount)}</div><div class="es-bet-result ${cls}">${icon}</div><div class="es-bet-pnl ${cls}">${b.result ? ((b.pnl >= 0 ? '+' : '') + '₫' + EsportsAnalyzer.fmtFull(Math.abs(b.pnl))) : '—'}</div><div class="es-bet-running ${runPL >= 0 ? 'es-win' : 'es-loss'}">${rp}</div></div>`;
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

        document.getElementById('esModalTitle').textContent = `${gameName} — ${match.teamA.name} vs ${match.teamB.name}`;
        const body = document.getElementById('esModalBody');

        body.innerHTML = `
            ${match.league ? `<div class="es-modal-league">🏆 ${match.league} ${match.tournament ? '— ' + match.tournament : ''}</div>` : ''}
            <div class="es-modal-teams">
                <div class="es-modal-team">
                    ${match.teamA.imageUrl ? `<img src="${match.teamA.imageUrl}" class="es-modal-team-img" onerror="this.style.display='none'">` : ''}
                    <span class="es-modal-logo">${match.teamA.logo}</span>
                    <span class="es-modal-name">${match.teamA.name}</span>
                    <span class="es-modal-region">${match.teamA.region} │ Elo ${match.teamA.elo}</span>
                    <span class="es-modal-form">Form: ${match.teamA.form.map(f => f ? '✅' : '❌').join('')}</span>
                </div>
                <div class="es-modal-vs">VS</div>
                <div class="es-modal-team">
                    ${match.teamB.imageUrl ? `<img src="${match.teamB.imageUrl}" class="es-modal-team-img" onerror="this.style.display='none'">` : ''}
                    <span class="es-modal-logo">${match.teamB.logo}</span>
                    <span class="es-modal-name">${match.teamB.name}</span>
                    <span class="es-modal-region">${match.teamB.region} │ Elo ${match.teamB.elo}</span>
                    <span class="es-modal-form">Form: ${match.teamB.form.map(f => f ? '✅' : '❌').join('')}</span>
                </div>
            </div>
            <div class="es-modal-section"><div class="es-modal-label">Win Probability</div><div class="es-wp-bar"><div class="es-wp-fill" style="width:${(wp * 100).toFixed(0)}%">${match.teamA.name} ${(wp * 100).toFixed(0)}%</div></div></div>
            <div class="es-modal-section"><div class="es-modal-label">H2H Record</div><div class="es-modal-h2h"><span>${match.teamA.name}: ${h2h.wins}W</span><span class="es-h2h-total">${h2h.total} trận</span><span>${match.teamB.name}: ${h2h.losses}W</span></div></div>
            <div class="es-modal-section"><div class="es-modal-label">Phân tích kèo</div>${match.bets.map(b => { const e = b.pick ? ((b.pickProb * (b.odds - 1) - (1 - b.pickProb)) * 100).toFixed(1) : '0'; return `<div class="es-bet-analysis"><span class="es-bet-type">${b.label}</span><span class="es-bet-line">Line: ${b.line}</span><span class="es-bet-odds">Odds: ${b.odds.toFixed(2)}</span><span class="es-bet-prob">Tài: ${(b.overProb * 100).toFixed(0)}% │ Xỉu: ${(b.underProb * 100).toFixed(0)}%</span>${b.pick ? `<span class="es-bet-pick ${Number(e) > 5 ? 'es-win' : ''}">→ ${b.pick === 'over' ? 'Tài' : 'Xỉu'} (Edge: +${e}%)</span>` : '<span class="es-bet-pick">Không đủ edge</span>'}</div>`; }).join('')}</div>
            ${rec.action === 'BET' ? `<div class="es-modal-section es-modal-rec"><div class="es-modal-label">🔮 Khuyến nghị</div><div class="es-rec-summary"><div><strong>${rec.betLabel}: ${rec.pickLabel}</strong></div><div>Mức cược: <strong>₫${EsportsAnalyzer.fmtFull(rec.amount)}</strong> (${(rec.kelly * 100).toFixed(1)}% Kelly)</div><div>${rec.reason}</div></div></div>` : ''}
            ${match.result ? `<div class="es-modal-section"><div class="es-modal-label">Kết quả</div><div class="es-result-grid"><div class="es-result-item"><span>Mạng</span><strong>${match.result.kills}</strong></div><div class="es-result-item"><span>Trụ</span><strong>${match.result.towers}</strong></div><div class="es-result-item"><span>Thời gian</span><strong>${match.result.duration}p</strong></div>${match.result.dragons != null ? `<div class="es-result-item"><span>Rồng</span><strong>${match.result.dragons}</strong></div>` : ''}</div></div>` : ''}
            ${bet ? `<div class="es-modal-section"><div class="es-modal-label">Lệnh đặt</div><div class="es-bet-record ${bet.result === 'win' ? 'es-win' : bet.result === 'loss' ? 'es-loss' : ''}"><div>${bet.betLabel}: ${bet.pickLabel} @ ${bet.odds.toFixed(2)}</div><div>₫${EsportsAnalyzer.fmtFull(bet.amount)}</div>${bet.result ? `<div>${bet.result === 'win' ? '✅ Thắng' : '❌ Thua'} — ${bet.pnl >= 0 ? '+' : ''}₫${EsportsAnalyzer.fmtFull(Math.abs(bet.pnl))}</div>` : '<div>⏳ Đang thi đấu...</div>'}</div></div>` : ''}`;

        document.getElementById('esMatchModal').classList.remove('hidden');
    };
    window.closeEsMatchModal = function () { document.getElementById('esMatchModal').classList.add('hidden'); };

    // ===== SETTINGS (with API token) =====
    window.openEsSettings = function () {
        document.getElementById('esSettCapital').value = EsportsAnalyzer.fmtFull(esState.initialCapital);
        const tokenInput = document.getElementById('esSettToken');
        if (tokenInput) tokenInput.value = esState.apiToken || '';
        document.getElementById('esSettingsModal').classList.remove('hidden');
    };
    window.closeEsSettings = function () { document.getElementById('esSettingsModal').classList.add('hidden'); };
    window.saveEsSettings = function () {
        const val = parseInt(document.getElementById('esSettCapital').value.replace(/[^\d]/g, ''), 10);
        if (!val || val < 100000) { window.showToast?.('Vốn tối thiểu 100,000₫', 'error'); return; }
        const diff = val - esState.initialCapital;
        esState.initialCapital = val;
        esState.capital += diff;
        const tokenInput = document.getElementById('esSettToken');
        if (tokenInput) {
            const newToken = tokenInput.value.trim();
            if (newToken !== (esState.apiToken || '')) {
                esState.apiToken = newToken;
                esState.dailyMatches = {};  // Clear cache to force re-fetch
            }
        }
        EsportsAnalyzer.saveState(esState);
        closeEsSettings();
        initEsports(); // Re-fetch with new token
        window.showToast?.('Đã lưu cài đặt' + (esState.apiToken ? ' — Đang tải trận thực...' : ''), 'success');
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
