/**
 * BetWise Esports UI Controller v2.0 — Auto-Simulation
 * 
 * Flow: User clicks "▶ Bắt đầu thi đấu" → System auto-plays through
 * all high-confidence matches sequentially with animated delays.
 * Each match: auto-bet → wait 2s → auto-resolve → update P&L → next match.
 * No manual steps required.
 */
(function () {
    'use strict';

    let esState = EsportsAnalyzer.loadState();
    let currentMatches = [];
    let isAutoRunning = false;
    let autoRunAbort = false;

    // ===== INIT =====
    function initEsports() {
        const today = EsportsAnalyzer.todayStr();
        if (!esState.dailyMatches[today]) {
            esState.dailyMatches[today] = EsportsAnalyzer.generateDailyMatches(today);
            EsportsAnalyzer.saveState(esState);
        }
        currentMatches = esState.dailyMatches[today];
        renderAll();
    }

    // ===== RENDER ALL =====
    function renderAll() {
        renderCapital();
        renderQualifiedMatches();
        renderTimeline();
        renderStats();
        renderWeekly();
        renderAutoButton();
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

        // Streak
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

    // ===== QUALIFIED MATCHES — Only high-confidence =====
    function getQualifiedMatches() {
        return currentMatches.filter(m => {
            const rec = EsportsAnalyzer.generateRecommendation(m.bets, esState.capital);
            return rec.action === 'BET';
        });
    }

    function renderQualifiedMatches() {
        const container = document.getElementById('esMatchList');
        if (!container) return;

        const allMatches = currentMatches;
        const qualifiedIds = new Set(getQualifiedMatches().map(m => m.id));

        if (allMatches.length === 0) {
            container.innerHTML = '<div class="empty-state">Không có trận đấu nào hôm nay</div>';
            return;
        }

        container.innerHTML = allMatches.map(match => {
            const rec = EsportsAnalyzer.generateRecommendation(match.bets, esState.capital);
            const bet = esState.bets.find(b => b.matchId === match.id);
            const isQualified = qualifiedIds.has(match.id);
            const isFinished = match.status === 'finished' || bet?.result != null;
            const gameTag = match.game === 'dota2' ? 'dota2' : 'lol';
            const gameName = match.game === 'dota2' ? 'DOTA 2' : 'LOL';

            return `
                <div class="es-match-card glass-card ${isFinished ? 'finished' : ''} ${!isQualified && !isFinished ? 'skipped' : ''}" 
                     data-match-id="${match.id}" onclick="viewEsMatch('${match.id}')">
                    <div class="es-match-top">
                        <span class="es-game-tag ${gameTag}">${gameName}</span>
                        <span class="es-match-time">${match.time}</span>
                        ${isQualified && !isFinished ? '<span class="es-qualified-badge">🎯 VÀO LỆNH</span>' : ''}
                    </div>
                    <div class="es-teams">
                        <div class="es-team">
                            <span class="es-team-logo">${match.teamA.logo}</span>
                            <span class="es-team-name">${match.teamA.name}</span>
                        </div>
                        <div class="es-vs">VS</div>
                        <div class="es-team">
                            <span class="es-team-logo">${match.teamB.logo}</span>
                            <span class="es-team-name">${match.teamB.name}</span>
                        </div>
                    </div>
                    ${renderMatchBadge(rec, bet, isQualified)}
                </div>`;
        }).join('');
    }

    function renderMatchBadge(rec, bet, isQualified) {
        if (bet && bet.result != null) {
            const won = bet.result === 'win';
            return `<div class="es-rec-badge ${won ? 'es-rec-win' : 'es-rec-loss'}">
                ${won ? '✅ THẮNG' : '❌ THUA'} │ ${bet.betLabel}: ${bet.pickLabel} │ ${bet.pnl >= 0 ? '+' : ''}₫${EsportsAnalyzer.fmtFull(Math.abs(bet.pnl))}
                <div class="es-rec-reason">Kết quả: Mạng ${bet.matchResult?.kills || '—'} │ Trụ ${bet.matchResult?.towers || '—'} │ ${bet.matchResult?.duration || '—'} phút</div>
            </div>`;
        }
        if (bet && bet.result === null) {
            return `<div class="es-rec-badge es-rec-pending">
                ⏳ Đang thi đấu... ₫${EsportsAnalyzer.fmtFull(bet.amount)}
            </div>`;
        }
        if (rec.action === 'BET' && isQualified) {
            const tierClass = rec.confTier === 'elite' ? 'es-rec-elite' : rec.confTier === 'high' ? 'es-rec-high' : 'es-rec-medium';
            return `<div class="es-rec-badge ${tierClass}">
                <div class="es-rec-header">🔮 ${rec.betLabel}: ${rec.pickLabel}</div>
                <div class="es-rec-detail">P=${(rec.probability * 100).toFixed(0)}% │ Edge=+${(rec.edge * 100).toFixed(1)}% │ Kelly=${(rec.kelly * 100).toFixed(1)}% │ ₫${EsportsAnalyzer.fmt(rec.amount)}</div>
            </div>`;
        }
        return `<div class="es-rec-badge es-rec-skip">⏭️ BỎ QUA — ${rec.reason}</div>`;
    }

    // ===== AUTO-PLAY BUTTON =====
    function renderAutoButton() {
        const btn = document.getElementById('esAutoBtn');
        if (!btn) return;

        const qualified = getQualifiedMatches();
        const pending = qualified.filter(m => !esState.bets.find(b => b.matchId === m.id));

        if (isAutoRunning) {
            btn.innerHTML = '⏸ Đang thi đấu...';
            btn.className = 'es-auto-btn running';
            btn.onclick = () => { autoRunAbort = true; };
        } else if (pending.length > 0) {
            btn.innerHTML = `▶ Bắt đầu thi đấu (${pending.length} trận)`;
            btn.className = 'es-auto-btn ready';
            btn.onclick = () => startAutoRun();
        } else if (esState.bets.filter(b => b.timestamp?.startsWith(EsportsAnalyzer.todayStr())).length > 0) {
            const todayBets = esState.bets.filter(b => b.timestamp?.startsWith(EsportsAnalyzer.todayStr()) && b.result !== null);
            const todayPL = todayBets.reduce((s, b) => s + (b.pnl || 0), 0);
            btn.innerHTML = `✅ Đã hoàn thành — P&L: ${todayPL >= 0 ? '+' : ''}₫${EsportsAnalyzer.fmtFull(Math.abs(todayPL))}`;
            btn.className = 'es-auto-btn done ' + (todayPL >= 0 ? 'profit' : 'loss');
            btn.onclick = null;
        } else {
            btn.innerHTML = '📊 Chờ dữ liệu...';
            btn.className = 'es-auto-btn waiting';
            btn.onclick = null;
        }
    }

    // ===== AUTO-RUN ENGINE =====
    async function startAutoRun() {
        if (isAutoRunning) return;
        isAutoRunning = true;
        autoRunAbort = false;
        renderAutoButton();

        const qualified = getQualifiedMatches();
        const pending = qualified.filter(m => !esState.bets.find(b => b.matchId === m.id));

        for (const match of pending) {
            if (autoRunAbort) break;

            // 1. Recalculate recommendation with current capital
            const rec = EsportsAnalyzer.generateRecommendation(match.bets, esState.capital);
            if (rec.action !== 'BET') continue;

            // 2. Place bet
            const betRecord = {
                matchId: match.id,
                betType: rec.betType, betLabel: rec.betLabel,
                pick: rec.pick, pickLabel: rec.pickLabel,
                line: rec.bestBet.line,
                amount: rec.amount, odds: rec.odds,
                probability: rec.probability, edge: rec.edge,
                result: null, pnl: 0, matchResult: null,
                timestamp: new Date().toISOString(),
            };
            esState.bets.push(betRecord);
            EsportsAnalyzer.saveState(esState);
            renderAll();
            highlightCard(match.id, 'betting');
            window.showToast?.(`🎯 Đặt ₫${EsportsAnalyzer.fmtFull(rec.amount)} — ${rec.betLabel}: ${rec.pickLabel}`, 'info');

            // 3. Wait for "match to complete" (animated delay)
            await delay(2000);
            if (autoRunAbort) break;

            // 4. Simulate result
            const result = EsportsAnalyzer.simulateResult(match);
            const resolution = EsportsAnalyzer.resolveBet(betRecord, result);

            betRecord.result = resolution.won ? 'win' : 'loss';
            betRecord.pnl = resolution.pnl;
            betRecord.matchResult = result;
            esState.capital += resolution.pnl;
            match.status = 'finished';
            match.result = result;

            EsportsAnalyzer.saveState(esState);
            renderAll();
            highlightCard(match.id, resolution.won ? 'win' : 'loss');

            const msg = resolution.won
                ? `✅ THẮNG +₫${EsportsAnalyzer.fmtFull(resolution.pnl)}!`
                : `❌ Thua -₫${EsportsAnalyzer.fmtFull(Math.abs(resolution.pnl))}`;
            window.showToast?.(msg, resolution.won ? 'success' : 'error');

            // 5. Brief pause before next match
            await delay(1500);
        }

        isAutoRunning = false;
        esState.autoRunComplete = true;
        EsportsAnalyzer.saveState(esState);
        renderAll();

        const todayBets = esState.bets.filter(b => b.timestamp?.startsWith(EsportsAnalyzer.todayStr()) && b.result !== null);
        const totalPL = todayBets.reduce((s, b) => s + (b.pnl || 0), 0);
        window.showToast?.(`🏆 Hoàn thành! P&L: ${totalPL >= 0 ? '+' : ''}₫${EsportsAnalyzer.fmtFull(Math.abs(totalPL))}`, totalPL >= 0 ? 'success' : 'error');
    }

    function highlightCard(matchId, state) {
        const card = document.querySelector(`[data-match-id="${matchId}"]`);
        if (!card) return;
        card.classList.remove('betting', 'win', 'loss');
        card.classList.add(state);
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

    // ===== TIMELINE — Today's Results =====
    function renderTimeline() {
        const container = document.getElementById('esTodayHistory');
        const list = document.getElementById('esBetList');
        if (!container || !list) return;

        const today = EsportsAnalyzer.todayStr();
        const todayBets = esState.bets.filter(b => b.timestamp?.startsWith(today));

        if (todayBets.length === 0) { container.style.display = 'none'; return; }

        container.style.display = 'block';
        let runningPL = 0;

        list.innerHTML = todayBets.map((b, i) => {
            const match = currentMatches.find(m => m.id === b.matchId);
            const label = match ? `${match.teamA.name} vs ${match.teamB.name}` : b.matchId;
            const cls = b.result === 'win' ? 'es-win' : b.result === 'loss' ? 'es-loss' : 'es-pending-text';
            const icon = b.result === 'win' ? '✅' : b.result === 'loss' ? '❌' : '⏳';
            if (b.result) runningPL += b.pnl;
            const runPL = b.result ? `${runningPL >= 0 ? '+' : ''}₫${EsportsAnalyzer.fmt(Math.abs(runningPL))}` : '—';

            return `<div class="es-bet-row">
                <div class="es-bet-match">#${i + 1} ${label}</div>
                <div class="es-bet-info">${b.betLabel}: ${b.pickLabel}</div>
                <div class="es-bet-amount">₫${EsportsAnalyzer.fmt(b.amount)}</div>
                <div class="es-bet-result ${cls}">${icon}</div>
                <div class="es-bet-pnl ${cls}">${b.result ? ((b.pnl >= 0 ? '+' : '') + '₫' + EsportsAnalyzer.fmtFull(Math.abs(b.pnl))) : '—'}</div>
                <div class="es-bet-running ${runningPL >= 0 ? 'es-win' : 'es-loss'}">${runPL}</div>
            </div>`;
        }).join('');
    }

    // ===== STATS GRID =====
    function renderStats() {
        const stats = EsportsAnalyzer.calcStats(esState.bets, esState.capital, esState.initialCapital);
        const section = document.getElementById('esStatsSection');
        if (!section) return;
        if (stats.total === 0) { section.style.display = 'none'; return; }
        section.style.display = 'grid';
        document.getElementById('esTotalBets').textContent = stats.total;
        document.getElementById('esTotalWins').textContent = stats.wins;
        document.getElementById('esTotalLosses').textContent = stats.losses;
        document.getElementById('esROI').textContent = stats.roi + '%';
    }

    // ===== WEEKLY =====
    function renderWeekly() {
        const history = EsportsAnalyzer.getDailyHistory(esState.bets);
        const section = document.getElementById('esWeeklySection');
        const list = document.getElementById('esWeeklyList');
        if (!section || !list) return;
        if (history.length === 0) { section.style.display = 'none'; return; }
        section.style.display = 'block';
        list.innerHTML = `
            <div class="es-weekly-header"><span>Ngày</span><span>Lệnh</span><span>Thắng</span><span>P&L</span></div>
            ${history.map(d => `<div class="es-weekly-row">
                <span>${d.date.slice(5)}</span><span>${d.bets}</span><span>${d.wins}/${d.bets}</span>
                <span class="${d.pnl >= 0 ? 'es-win' : 'es-loss'}">${d.pnl >= 0 ? '+' : ''}₫${EsportsAnalyzer.fmt(Math.abs(d.pnl))}</span>
            </div>`).join('')}`;
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
            <div class="es-modal-teams">
                <div class="es-modal-team">
                    <span class="es-modal-logo">${match.teamA.logo}</span>
                    <span class="es-modal-name">${match.teamA.name}</span>
                    <span class="es-modal-region">${match.teamA.region} │ Elo ${match.teamA.elo}</span>
                    <span class="es-modal-form">Form: ${match.teamA.form.map(f => f ? '✅' : '❌').join('')}</span>
                </div>
                <div class="es-modal-vs">VS</div>
                <div class="es-modal-team">
                    <span class="es-modal-logo">${match.teamB.logo}</span>
                    <span class="es-modal-name">${match.teamB.name}</span>
                    <span class="es-modal-region">${match.teamB.region} │ Elo ${match.teamB.elo}</span>
                    <span class="es-modal-form">Form: ${match.teamB.form.map(f => f ? '✅' : '❌').join('')}</span>
                </div>
            </div>

            <div class="es-modal-section">
                <div class="es-modal-label">Win Probability (Elo + Bayesian)</div>
                <div class="es-wp-bar">
                    <div class="es-wp-fill" style="width:${(wp * 100).toFixed(0)}%">${match.teamA.name} ${(wp * 100).toFixed(0)}%</div>
                </div>
            </div>

            <div class="es-modal-section">
                <div class="es-modal-label">H2H Record</div>
                <div class="es-modal-h2h">
                    <span>${match.teamA.name}: ${h2h.wins}W</span>
                    <span class="es-h2h-total">${h2h.total} trận</span>
                    <span>${match.teamB.name}: ${h2h.losses}W</span>
                </div>
            </div>

            <div class="es-modal-section">
                <div class="es-modal-label">Phân tích kèo (Poisson + Monte Carlo)</div>
                ${match.bets.map(b => {
            const edge = b.pick ? ((b.pickProb * (b.odds - 1) - (1 - b.pickProb)) * 100).toFixed(1) : '0';
            return `<div class="es-bet-analysis">
                        <span class="es-bet-type">${b.label}</span>
                        <span class="es-bet-line">Line: ${b.line}</span>
                        <span class="es-bet-odds">Odds: ${b.odds.toFixed(2)}</span>
                        <span class="es-bet-prob">Tài: ${(b.overProb * 100).toFixed(0)}% │ Xỉu: ${(b.underProb * 100).toFixed(0)}%</span>
                        ${b.pick ? `<span class="es-bet-pick ${Number(edge) > 5 ? 'es-win' : ''}">→ ${b.pick === 'over' ? 'Tài' : 'Xỉu'} (Edge: +${edge}%)</span>` : '<span class="es-bet-pick">Không đủ edge</span>'}
                    </div>`;
        }).join('')}
            </div>

            ${rec.action === 'BET' ? `
            <div class="es-modal-section es-modal-rec">
                <div class="es-modal-label">🔮 Khuyến nghị hệ thống</div>
                <div class="es-rec-summary">
                    <div><strong>${rec.betLabel}: ${rec.pickLabel}</strong></div>
                    <div>Mức cược: <strong>₫${EsportsAnalyzer.fmtFull(rec.amount)}</strong> (${(rec.kelly * 100).toFixed(1)}% Kelly)</div>
                    <div>${rec.reason}</div>
                </div>
            </div>` : `
            <div class="es-modal-section es-modal-rec skip">
                <div class="es-modal-label">⏭️ Khuyến nghị</div>
                <div class="es-rec-summary">${rec.reason}</div>
            </div>`}

            ${match.result ? `
            <div class="es-modal-section">
                <div class="es-modal-label">Kết quả thực tế</div>
                <div class="es-result-grid">
                    <div class="es-result-item"><span>Tổng Mạng</span><strong>${match.result.kills}</strong></div>
                    <div class="es-result-item"><span>Tổng Trụ</span><strong>${match.result.towers}</strong></div>
                    <div class="es-result-item"><span>Thời gian</span><strong>${match.result.duration}p</strong></div>
                </div>
            </div>` : ''}

            ${bet ? `
            <div class="es-modal-section">
                <div class="es-modal-label">Lệnh đã đặt</div>
                <div class="es-bet-record ${bet.result === 'win' ? 'es-win' : bet.result === 'loss' ? 'es-loss' : ''}">
                    <div>${bet.betLabel}: ${bet.pickLabel} @ ${bet.odds.toFixed(2)}</div>
                    <div>Đặt: ₫${EsportsAnalyzer.fmtFull(bet.amount)}</div>
                    ${bet.result ? `<div>${bet.result === 'win' ? '✅ Thắng' : '❌ Thua'} — ${bet.pnl >= 0 ? '+' : ''}₫${EsportsAnalyzer.fmtFull(Math.abs(bet.pnl))}</div>` : '<div>⏳ Đang thi đấu...</div>'}
                </div>
            </div>` : ''}
        `;

        document.getElementById('esMatchModal').classList.remove('hidden');
    };

    window.closeEsMatchModal = function () {
        document.getElementById('esMatchModal').classList.add('hidden');
    };

    // ===== SETTINGS =====
    window.openEsSettings = function () {
        document.getElementById('esSettCapital').value = EsportsAnalyzer.fmtFull(esState.initialCapital);
        document.getElementById('esSettingsModal').classList.remove('hidden');
    };
    window.closeEsSettings = function () {
        document.getElementById('esSettingsModal').classList.add('hidden');
    };
    window.saveEsSettings = function () {
        const val = parseInt(document.getElementById('esSettCapital').value.replace(/[^\d]/g, ''), 10);
        if (!val || val < 100000) { window.showToast?.('Vốn tối thiểu 100,000₫', 'error'); return; }
        const diff = val - esState.initialCapital;
        esState.initialCapital = val;
        esState.capital += diff;
        EsportsAnalyzer.saveState(esState);
        closeEsSettings();
        renderAll();
        window.showToast?.('Đã lưu cài đặt', 'success');
    };
    window.resetEsports = function () {
        if (!confirm('Xóa toàn bộ dữ liệu Esports? Hành động này không thể hoàn tác.')) return;
        esState = EsportsAnalyzer.resetState();
        initEsports();
        closeEsSettings();
        window.showToast?.('Đã xóa dữ liệu', 'info');
    };

    // ===== AUTO-SAVE =====
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') EsportsAnalyzer.saveState(esState);
    });

    // ===== EXPOSE =====
    window.EsportsUI = { initEsports, renderAll };
})();
