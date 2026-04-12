/**
 * BetWise Esports UI Controller
 * Renders matches, handles interactions, manages esports tab state
 */
(function () {
    'use strict';

    let esState = EsportsAnalyzer.loadState();
    let currentFilter = 'all';
    let currentMatches = [];

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
        renderMatches();
        renderTodayBets();
        renderStats();
        renderWeekly();
    }

    // ===== CAPITAL CARD =====
    function renderCapital() {
        const el = (id) => document.getElementById(id);
        el('esCapital').textContent = '₫' + EsportsAnalyzer.fmtFull(esState.capital);

        const today = EsportsAnalyzer.todayStr();
        const dailyPL = EsportsAnalyzer.calcDailyPL(esState.bets, today);
        const weeklyPL = EsportsAnalyzer.calcWeeklyPL(esState.bets);
        const winRate = EsportsAnalyzer.calcWinRate(esState.bets);

        const plEl = el('esDailyPL');
        plEl.textContent = (dailyPL >= 0 ? '+' : '') + '₫' + EsportsAnalyzer.fmtFull(Math.abs(dailyPL));
        plEl.className = 'es-pl-value ' + (dailyPL >= 0 ? 'es-win' : 'es-loss');

        const wkEl = el('esWeeklyPL');
        wkEl.textContent = (weeklyPL >= 0 ? '+' : '') + '₫' + EsportsAnalyzer.fmtFull(Math.abs(weeklyPL));
        wkEl.className = 'es-pl-value ' + (weeklyPL >= 0 ? 'es-win' : 'es-loss');

        el('esWinRate').textContent = esState.bets.filter(b => b.result !== null).length > 0
            ? (winRate * 100).toFixed(0) + '%'
            : '—';
    }

    // ===== MATCH CARDS =====
    function renderMatches() {
        const container = document.getElementById('esMatchList');
        const filtered = currentFilter === 'all'
            ? currentMatches
            : currentMatches.filter(m => m.game === currentFilter);

        if (filtered.length === 0) {
            container.innerHTML = '<div class="empty-state">Không có trận đấu nào</div>';
            return;
        }

        container.innerHTML = filtered.map(match => {
            const rec = EsportsAnalyzer.generateRecommendation(match.bets, esState.capital);
            const gameTag = match.game === 'dota2' ? 'dota2' : 'lol';
            const gameName = match.game === 'dota2' ? 'DOTA 2' : 'LOL';
            const alreadyBet = esState.bets.find(b => b.matchId === match.id);
            const isFinished = match.status === 'finished' || alreadyBet?.result != null;

            return `
                <div class="es-match-card glass-card ${isFinished ? 'finished' : ''}" data-match-id="${match.id}">
                    <div class="es-match-top">
                        <span class="es-game-tag ${gameTag}">${gameName}</span>
                        <span class="es-match-time">${match.time}</span>
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
                    ${renderRecBadge(rec, alreadyBet)}
                    <div class="es-match-actions">
                        ${isFinished
                    ? `<button class="es-btn-detail" onclick="viewEsMatch('${match.id}')">Xem kết quả</button>`
                    : alreadyBet && alreadyBet.result === null
                        ? `<button class="es-btn-result" onclick="finishEsMatch('${match.id}')">Nhập kết quả</button>`
                        : rec.action === 'BET'
                            ? `<button class="es-btn-bet" onclick="placeBetEs('${match.id}')">Đi theo ₫${EsportsAnalyzer.fmt(rec.amount)}</button>
                               <button class="es-btn-skip" onclick="skipEsMatch('${match.id}')">Bỏ qua</button>
                               <button class="es-btn-detail" onclick="viewEsMatch('${match.id}')">Chi tiết</button>`
                            : `<button class="es-btn-detail" onclick="viewEsMatch('${match.id}')">Chi tiết</button>`
                }
                    </div>
                </div>`;
        }).join('');
    }

    function renderRecBadge(rec, alreadyBet) {
        if (alreadyBet && alreadyBet.result != null) {
            const won = alreadyBet.result === 'win';
            return `<div class="es-rec-badge ${won ? 'es-rec-win' : 'es-rec-loss'}">
                ${won ? '✅ THẮNG' : '❌ THUA'} — ${(alreadyBet.pnl >= 0 ? '+' : '')}₫${EsportsAnalyzer.fmtFull(Math.abs(alreadyBet.pnl))}
            </div>`;
        }
        if (alreadyBet && alreadyBet.result === null) {
            return `<div class="es-rec-badge es-rec-pending">
                ⏳ Đã đặt ₫${EsportsAnalyzer.fmtFull(alreadyBet.amount)} — Chờ kết quả
            </div>`;
        }
        if (rec.action === 'BET') {
            const tierClass = rec.confTier === 'elite' ? 'es-rec-elite' : rec.confTier === 'high' ? 'es-rec-high' : 'es-rec-medium';
            return `<div class="es-rec-badge ${tierClass}">
                <div class="es-rec-header">🔮 KHUYẾN NGHỊ: <strong>BET</strong></div>
                <div class="es-rec-detail">${rec.betLabel}: ${rec.pickLabel}</div>
                <div class="es-rec-detail">Odds: ${rec.odds.toFixed(2)} │ Kelly: ${(rec.kelly * 100).toFixed(1)}% │ ₫${EsportsAnalyzer.fmt(rec.amount)}</div>
                <div class="es-rec-reason">${rec.reason}</div>
            </div>`;
        }
        return `<div class="es-rec-badge es-rec-skip">
            ⏭️ SKIP — ${rec.reason}
        </div>`;
    }

    // ===== TODAY BET HISTORY =====
    function renderTodayBets() {
        const today = EsportsAnalyzer.todayStr();
        const todayBets = esState.bets.filter(b => b.timestamp && b.timestamp.startsWith(today));

        const container = document.getElementById('esTodayHistory');
        const list = document.getElementById('esBetList');

        if (todayBets.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        list.innerHTML = todayBets.map(b => {
            const match = currentMatches.find(m => m.id === b.matchId);
            const matchLabel = match ? `${match.teamA.name} vs ${match.teamB.name}` : b.matchId;
            const statusClass = b.result === 'win' ? 'es-win' : b.result === 'loss' ? 'es-loss' : 'es-pending-text';
            const statusText = b.result === 'win' ? '✅ W' : b.result === 'loss' ? '❌ L' : '⏳';
            const pnlText = b.result ? ((b.pnl >= 0 ? '+' : '') + '₫' + EsportsAnalyzer.fmtFull(Math.abs(b.pnl))) : '—';

            return `<div class="es-bet-row">
                <div class="es-bet-match">${matchLabel}</div>
                <div class="es-bet-info">${b.betLabel || b.betType} — ${b.pickLabel || b.pick}</div>
                <div class="es-bet-amount">₫${EsportsAnalyzer.fmt(b.amount)}</div>
                <div class="es-bet-result ${statusClass}">${statusText}</div>
                <div class="es-bet-pnl ${statusClass}">${pnlText}</div>
            </div>`;
        }).join('');
    }

    // ===== STATS GRID =====
    function renderStats() {
        const stats = EsportsAnalyzer.calcStats(esState.bets, esState.capital, esState.initialCapital);
        const section = document.getElementById('esStatsSection');

        if (stats.total === 0) {
            section.style.display = 'none';
            return;
        }
        section.style.display = 'grid';

        document.getElementById('esTotalBets').textContent = stats.total;
        document.getElementById('esTotalWins').textContent = stats.wins;
        document.getElementById('esTotalLosses').textContent = stats.losses;
        document.getElementById('esROI').textContent = stats.roi + '%';
    }

    // ===== WEEKLY HISTORY =====
    function renderWeekly() {
        const history = EsportsAnalyzer.getDailyHistory(esState.bets);
        const section = document.getElementById('esWeeklySection');
        const list = document.getElementById('esWeeklyList');

        if (history.length === 0) {
            section.style.display = 'none';
            return;
        }
        section.style.display = 'block';

        list.innerHTML = `
            <div class="es-weekly-header">
                <span>Ngày</span><span>Lệnh</span><span>Thắng</span><span>P&L</span>
            </div>
            ${history.map(d => {
            const pnlClass = d.pnl >= 0 ? 'es-win' : 'es-loss';
            return `<div class="es-weekly-row">
                    <span>${d.date.slice(5)}</span>
                    <span>${d.bets}</span>
                    <span>${d.wins}/${d.bets}</span>
                    <span class="${pnlClass}">${d.pnl >= 0 ? '+' : ''}₫${EsportsAnalyzer.fmt(Math.abs(d.pnl))}</span>
                </div>`;
        }).join('')}`;
    }

    // ===== ACTIONS =====

    window.filterEsGame = function (game) {
        currentFilter = game;
        document.querySelectorAll('.es-filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.game === game);
        });
        renderMatches();
    };

    window.placeBetEs = function (matchId) {
        const match = currentMatches.find(m => m.id === matchId);
        if (!match) return;

        const rec = EsportsAnalyzer.generateRecommendation(match.bets, esState.capital);
        if (rec.action !== 'BET') return;

        // Check if already bet on this match
        if (esState.bets.find(b => b.matchId === matchId)) {
            window.showToast('Đã đặt cược trận này rồi', 'warning');
            return;
        }

        const betRecord = {
            matchId,
            betType: rec.betType,
            betLabel: rec.betLabel,
            pick: rec.pick,
            pickLabel: rec.pickLabel,
            line: rec.bestBet.line,
            amount: rec.amount,
            odds: rec.odds,
            probability: rec.probability,
            result: null,
            pnl: 0,
            timestamp: new Date().toISOString(),
        };

        esState.bets.push(betRecord);
        EsportsAnalyzer.saveState(esState);
        renderAll();
        window.showToast(`Đã đặt ₫${EsportsAnalyzer.fmtFull(rec.amount)} — ${rec.betLabel}: ${rec.pickLabel}`, 'success');
    };

    window.skipEsMatch = function (matchId) {
        const card = document.querySelector(`[data-match-id="${matchId}"]`);
        if (card) card.style.opacity = '0.4';
        window.showToast('Đã bỏ qua trận này', 'info');
    };

    window.finishEsMatch = function (matchId) {
        const match = currentMatches.find(m => m.id === matchId);
        const bet = esState.bets.find(b => b.matchId === matchId && b.result === null);
        if (!match || !bet) return;

        // Simulate match result
        const result = EsportsAnalyzer.simulateResult(match);
        const resolution = EsportsAnalyzer.resolveBet(bet, result);

        bet.result = resolution.won ? 'win' : 'loss';
        bet.pnl = resolution.pnl;
        esState.capital += resolution.pnl;
        match.status = 'finished';
        match.result = result;

        EsportsAnalyzer.saveState(esState);
        renderAll();

        const msg = resolution.won
            ? `✅ THẮNG +₫${EsportsAnalyzer.fmtFull(resolution.pnl)}!`
            : `❌ Thua -₫${EsportsAnalyzer.fmtFull(Math.abs(resolution.pnl))}`;
        window.showToast(msg, resolution.won ? 'success' : 'error');
    };

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
                    <span class="es-modal-region">${match.teamA.region} • Tier ${match.teamA.tier}</span>
                    <span class="es-modal-form">Form: ${match.teamA.form.map(f => f ? '✅' : '❌').join('')}</span>
                </div>
                <div class="es-modal-vs">VS</div>
                <div class="es-modal-team">
                    <span class="es-modal-logo">${match.teamB.logo}</span>
                    <span class="es-modal-name">${match.teamB.name}</span>
                    <span class="es-modal-region">${match.teamB.region} • Tier ${match.teamB.tier}</span>
                    <span class="es-modal-form">Form: ${match.teamB.form.map(f => f ? '✅' : '❌').join('')}</span>
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
                <div class="es-modal-label">Win Probability</div>
                <div class="es-wp-bar">
                    <div class="es-wp-fill" style="width:${(wp * 100).toFixed(0)}%">
                        ${match.teamA.name} ${(wp * 100).toFixed(0)}%
                    </div>
                </div>
            </div>

            <div class="es-modal-section">
                <div class="es-modal-label">Phân tích kèo</div>
                ${match.bets.map(b => {
            const probPct = (b.pickProb * 100).toFixed(0);
            const edge = b.pick ? ((b.pickProb * (b.odds - 1) - (1 - b.pickProb)) * 100).toFixed(1) : '0';
            return `<div class="es-bet-analysis">
                        <span class="es-bet-type">${b.label}</span>
                        <span class="es-bet-line">Line: ${b.line}</span>
                        <span class="es-bet-odds">Odds: ${b.odds.toFixed(2)}</span>
                        <span class="es-bet-prob">P(Tài): ${(b.overProb * 100).toFixed(0)}% / P(Xỉu): ${(b.underProb * 100).toFixed(0)}%</span>
                        ${b.pick ? `<span class="es-bet-pick ${Number(edge) > 5 ? 'es-win' : ''}">Pick: ${b.pick === 'over' ? 'Tài' : 'Xỉu'} (Edge: +${edge}%)</span>` : '<span class="es-bet-pick">Không có edge</span>'}
                    </div>`;
        }).join('')}
            </div>

            ${rec.action === 'BET' ? `
            <div class="es-modal-section es-modal-rec">
                <div class="es-modal-label">🔮 Khuyến nghị Pro</div>
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
                    <div class="es-result-item"><span>Tổng mạng</span><strong>${match.result.kills}</strong></div>
                    <div class="es-result-item"><span>Tổng trụ</span><strong>${match.result.towers}</strong></div>
                    <div class="es-result-item"><span>Thời gian</span><strong>${match.result.duration} phút</strong></div>
                </div>
            </div>` : ''}

            ${bet ? `
            <div class="es-modal-section">
                <div class="es-modal-label">Lệnh đã đặt</div>
                <div class="es-bet-record ${bet.result === 'win' ? 'es-win' : bet.result === 'loss' ? 'es-loss' : ''}">
                    <div>${bet.betLabel}: ${bet.pickLabel}</div>
                    <div>Đặt: ₫${EsportsAnalyzer.fmtFull(bet.amount)} @ ${bet.odds.toFixed(2)}</div>
                    ${bet.result ? `<div>Kết quả: ${bet.result === 'win' ? '✅ Thắng' : '❌ Thua'} — ${bet.pnl >= 0 ? '+' : ''}₫${EsportsAnalyzer.fmtFull(Math.abs(bet.pnl))}</div>` : '<div>⏳ Chờ kết quả</div>'}
                </div>
            </div>` : ''}

            ${!bet && rec.action === 'BET' ? `
            <div class="es-modal-actions">
                <button class="es-btn-bet" onclick="placeBetEs('${matchId}');closeEsMatchModal()">Đi theo ₫${EsportsAnalyzer.fmt(rec.amount)}</button>
                <button class="es-btn-skip" onclick="closeEsMatchModal()">Bỏ qua</button>
            </div>` : ''}

            ${bet && bet.result === null ? `
            <div class="es-modal-actions">
                <button class="es-btn-result" onclick="finishEsMatch('${matchId}');closeEsMatchModal()">Kết thúc trận — Xem kết quả</button>
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
        const raw = document.getElementById('esSettCapital').value.replace(/[^\d]/g, '');
        const val = parseInt(raw, 10);
        if (!val || val < 100000) {
            window.showToast('Vốn tối thiểu 100,000₫', 'error');
            return;
        }
        // Adjust capital by difference
        const diff = val - esState.initialCapital;
        esState.initialCapital = val;
        esState.capital += diff;
        EsportsAnalyzer.saveState(esState);
        closeEsSettings();
        renderAll();
        window.showToast('Đã lưu cài đặt', 'success');
    };

    window.resetEsports = function () {
        if (!confirm('Xóa toàn bộ dữ liệu Esports? Hành động này không thể hoàn tác.')) return;
        esState = EsportsAnalyzer.resetState();
        initEsports();
        closeEsSettings();
        window.showToast('Đã xóa toàn bộ dữ liệu Esports', 'info');
    };

    // Tab system integration handled by app.js switchTab

    // ===== AUTO-SAVE =====
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') EsportsAnalyzer.saveState(esState);
    });
    setInterval(() => EsportsAnalyzer.saveState(esState), 30000);

    // ===== EXPOSE =====
    window.EsportsUI = { initEsports, renderAll };

})();
