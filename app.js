/**
 * BetWise App — Main Application Logic
 * State management, UI updates, LocalStorage persistence
 */
(function () {
    'use strict';

    // ===== STATE =====
    const STORAGE_KEY = 'betwise_data';
    let state = loadState();

    function defaultState() {
        return {
            initialBankroll: 10_000_000,
            bankroll: 10_000_000,
            target: 500_000_000,
            estimatedWR: 70,
            maxDailyLossPct: 20,
            history: [],        // [{id, timestamp, amount, odds, confidence, result, profitLoss, bankrollAfter}]
            dailyPL: 0,
            dailyDate: new Date().toDateString(),
            sessionLosses: 0,
            confidence: 0,
            activeBet: null,    // {amount, odds, confidence} — pending result
        };
    }

    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const s = JSON.parse(raw);
                // Reset daily counters if new day
                if (s.dailyDate !== new Date().toDateString()) {
                    s.dailyPL = 0;
                    s.dailyDate = new Date().toDateString();
                    s.sessionLosses = 0;
                }
                return s;
            }
        } catch (e) { /* ignore */ }
        return defaultState();
    }

    function saveState() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    // ===== FORMATTING =====
    function fmt(n) {
        if (n === 0) return '₫0';
        const abs = Math.abs(n);
        if (abs >= 1_000_000_000) return (n < 0 ? '-' : '') + '₫' + (abs / 1_000_000_000).toFixed(1) + 'B';
        if (abs >= 1_000_000) return (n < 0 ? '-' : '') + '₫' + (abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1) + 'M';
        if (abs >= 1_000) return (n < 0 ? '-' : '') + '₫' + (abs / 1_000).toFixed(0) + 'K';
        return '₫' + n.toLocaleString('vi-VN');
    }

    function fmtFull(n) {
        return '₫' + Math.abs(n).toLocaleString('vi-VN');
    }

    // ===== TAB SWITCHING =====
    window.switchTab = function (tab) {
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
        document.getElementById('tab-' + tab).classList.add('active');
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
        if (tab === 'newbet') updateBetForm();
        if (tab === 'history') renderHistory();
        if (tab === 'dashboard') updateDashboard();
    };

    // ===== SETTINGS =====
    window.openSettings = function () {
        const m = document.getElementById('settingsModal');
        m.classList.remove('hidden');
        document.getElementById('settInitBankroll').value = state.initialBankroll;
        document.getElementById('settTarget').value = state.target;
        document.getElementById('settWR').value = state.estimatedWR;
        document.getElementById('settStopLoss').value = state.maxDailyLossPct;
    };

    window.closeSettings = function () {
        document.getElementById('settingsModal').classList.add('hidden');
    };

    window.saveSettings = function () {
        const ib = parseNum(document.getElementById('settInitBankroll').value);
        const tg = parseNum(document.getElementById('settTarget').value);
        const wr = parseFloat(document.getElementById('settWR').value) || 70;
        const sl = parseFloat(document.getElementById('settStopLoss').value) || 20;

        if (ib > 0) {
            if (state.history.length === 0) state.bankroll = ib;
            state.initialBankroll = ib;
        }
        if (tg > 0) state.target = tg;
        state.estimatedWR = Math.min(100, Math.max(1, wr));
        state.maxDailyLossPct = Math.min(100, Math.max(1, sl));
        saveState();
        closeSettings();
        updateAll();
        showToast('Đã lưu cài đặt', 'success');
    };

    // ===== CONFIDENCE =====
    window.setConfidence = function (level) {
        state.confidence = level;
        document.querySelectorAll('.conf-star').forEach(s => {
            s.classList.toggle('active', parseInt(s.dataset.level) <= level);
        });
        const labels = ['', 'Rất thấp — Không khuyến nghị', 'Thấp', 'Trung bình', 'Cao', 'Rất cao — Tín hiệu mạnh'];
        document.getElementById('confLabel').textContent = labels[level];
        updateBetForm();
    };

    // ===== QUICK AMOUNT =====
    window.setQuickAmount = function (pct) {
        const amount = Math.round(state.bankroll * (pct / 100) / 10000) * 10000;
        document.getElementById('betAmount').value = amount;
        document.querySelectorAll('.quick-btn').forEach(b => b.classList.remove('active'));
        event.target.classList.add('active');
        updateOutcomes();
    };

    // ===== CONFIRM BET =====
    window.confirmBet = function () {
        const amountRaw = parseNum(document.getElementById('betAmount').value);
        const oddsRaw = parseFloat(document.getElementById('betOdds').value);

        if (!amountRaw || amountRaw <= 0) { showToast('Vui lòng nhập số tiền', 'error'); return; }
        if (!oddsRaw || oddsRaw <= 0) { showToast('Vui lòng nhập tỉ lệ cược', 'error'); return; }
        if (state.confidence < 1) { showToast('Vui lòng chọn mức tự tin', 'error'); return; }
        if (amountRaw > state.bankroll) { showToast('Số tiền vượt quá vốn hiện có', 'error'); return; }

        // Check risk
        const rec = BetEngine.recommend({
            bankroll: state.bankroll,
            initialBankroll: state.initialBankroll,
            target: state.target,
            history: state.history,
            odds: oddsRaw,
            confidence: state.confidence,
            dailyPL: state.dailyPL,
            sessionLosses: state.sessionLosses,
            estimatedWR: state.estimatedWR,
            maxDailyLossPct: state.maxDailyLossPct,
        });

        if (rec.blocked) {
            showToast(rec.reasoning, 'error');
            return;
        }

        // Set active bet
        state.activeBet = {
            amount: amountRaw,
            odds: oddsRaw,
            confidence: state.confidence,
        };
        saveState();

        // Show active bet card, hide form
        document.querySelector('.bet-form').classList.add('hidden');
        document.querySelector('.suggestion-card').classList.add('hidden');
        const card = document.getElementById('activeBetCard');
        card.classList.remove('hidden');
        document.getElementById('activeAmount').textContent = fmtFull(amountRaw);
        document.getElementById('activeOdds').textContent = `Odds: ${oddsRaw} | Tự tin: ${'★'.repeat(state.confidence)}`;

        showToast('Lệnh đã xác nhận — Chờ kết quả', 'success');
    };

    // ===== RECORD RESULT =====
    window.recordResult = function (result) {
        if (!state.activeBet) return;

        const bet = state.activeBet;
        const profitLoss = result === 'WIN'
            ? Math.round(bet.amount * bet.odds)
            : -bet.amount;

        const record = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            timestamp: new Date().toISOString(),
            amount: bet.amount,
            odds: bet.odds,
            confidence: bet.confidence,
            result,
            profitLoss,
            bankrollAfter: state.bankroll + profitLoss,
        };

        state.history.push(record);
        state.bankroll += profitLoss;
        state.dailyPL += profitLoss;
        state.activeBet = null;

        if (result === 'LOSS') {
            state.sessionLosses++;
        } else {
            state.sessionLosses = 0;
        }

        saveState();
        updateAll();

        // Reset UI
        document.getElementById('activeBetCard').classList.add('hidden');
        document.querySelector('.bet-form').classList.remove('hidden');
        document.querySelector('.suggestion-card').classList.remove('hidden');
        document.getElementById('betAmount').value = '';
        state.confidence = 0;
        document.querySelectorAll('.conf-star').forEach(s => s.classList.remove('active'));
        document.getElementById('confLabel').textContent = 'Chọn mức tự tin (1-5)';
        document.querySelectorAll('.quick-btn').forEach(b => b.classList.remove('active'));

        // Show result toast
        if (result === 'WIN') {
            showToast(`THẮNG! +${fmtFull(profitLoss)}`, 'success');
        } else {
            showToast(`Thua ${fmtFull(Math.abs(profitLoss))} — Giữ kỷ luật!`, 'error');
        }

        // Switch to dashboard after a moment
        setTimeout(() => switchTab('dashboard'), 1500);
    };

    // ===== UPDATE ALL =====
    function updateAll() {
        updateDashboard();
        updateBetForm();
    }

    // ===== UPDATE DASHBOARD =====
    function updateDashboard() {
        const stats = BetEngine.calcStats(state.history, state.initialBankroll, state.bankroll);
        const stage = BetEngine.getStage(state.bankroll);
        const streak = BetEngine.analyzeStreak(state.history);

        // Bankroll
        document.getElementById('bankrollDisplay').textContent = fmtFull(state.bankroll);
        const profitBadge = document.getElementById('profitBadge');
        profitBadge.textContent = `${stats.profitPct >= 0 ? '+' : ''}${stats.profitPct.toFixed(1)}%`;
        profitBadge.className = `profit-badge ${stats.profitPct >= 0 ? 'positive' : 'negative'}`;
        document.getElementById('targetText').textContent = `Mục tiêu: ${fmtFull(state.target)}`;

        // Progress
        const pct = Math.min(100, Math.max(0.5, (state.bankroll / state.target) * 100));
        document.getElementById('progressFill').style.width = pct + '%';

        // Stage
        document.getElementById('stageBadge').textContent = stage.name;

        // Oracle recommendation
        const rec = BetEngine.recommend({
            bankroll: state.bankroll,
            initialBankroll: state.initialBankroll,
            target: state.target,
            history: state.history,
            odds: 0.90,
            confidence: 4,
            dailyPL: state.dailyPL,
            sessionLosses: state.sessionLosses,
            estimatedWR: state.estimatedWR,
            maxDailyLossPct: state.maxDailyLossPct,
        });
        document.getElementById('oracleAmount').textContent = rec.amount > 0 ? fmtFull(rec.amount) : 'DỪNG';
        document.getElementById('oracleKelly').textContent = (rec.kellyPct * 100).toFixed(1) + '%';
        document.getElementById('oracleConf').textContent = rec.blocked ? '🛑' : '⭐⭐⭐⭐';

        const riskEl = document.getElementById('oracleRisk');
        const riskMap = { LOW: ['Thấp', 'risk-low'], MEDIUM: ['Trung bình', 'risk-medium'], HIGH: ['Cao', 'risk-high'], BLOCKED: ['DỪNG', 'risk-high'] };
        const [riskText, riskClass] = riskMap[rec.risk.level] || ['—', ''];
        riskEl.textContent = riskText;
        riskEl.className = `detail-value ${riskClass}`;

        // Streak dots
        const dotsContainer = document.getElementById('streakDots');
        if (state.history.length === 0) {
            dotsContainer.innerHTML = '<div class="empty-state">Chưa có dữ liệu — Hãy vào lệnh đầu tiên!</div>';
        } else {
            const last20 = state.history.slice(-20);
            dotsContainer.innerHTML = last20.map(b =>
                `<div class="streak-dot ${b.result.toLowerCase()}" title="${b.result === 'WIN' ? 'Thắng' : 'Thua'} ${fmtFull(Math.abs(b.profitLoss))}"></div>`
            ).join('');
        }

        // Streak info
        if (state.history.length > 0) {
            document.getElementById('currentStreak').textContent =
                `Hiện tại: ${streak.current} ${streak.currentType === 'WIN' ? 'thắng' : 'thua'}`;
            document.getElementById('longestStreak').textContent =
                `Dài nhất: ${streak.longestWin}W / ${streak.longestLoss}L`;
        }

        // Stats
        document.getElementById('winRateStat').textContent = stats.total > 0 ? stats.wr.toFixed(1) + '%' : '—';
        document.getElementById('totalBetsStat').textContent = stats.total;
        const plEl = document.getElementById('plStat');
        plEl.textContent = fmt(stats.totalPL);
        plEl.style.color = stats.totalPL >= 0 ? 'var(--primary)' : 'var(--error)';
        document.getElementById('roiStat').textContent = stats.total > 0 ? (stats.roi >= 0 ? '+' : '') + stats.roi.toFixed(1) + '%' : '—';

        // EV
        const ev = BetEngine.expectedValue(
            state.history.length >= 10 ? BetEngine.calcWinRate(state.history, 50) : state.estimatedWR / 100,
            0.90
        );
        const evEl = document.getElementById('evValue');
        evEl.textContent = (ev >= 0 ? '+' : '') + (ev * 100).toFixed(1) + '%';
        evEl.style.color = ev >= 0 ? 'var(--primary)' : 'var(--error)';

        // Stop loss today
        const slEl = document.getElementById('stopLossToday');
        if (state.dailyPL < 0) {
            const pctUsed = Math.abs(state.dailyPL) / state.bankroll * 100;
            slEl.textContent = `-${pctUsed.toFixed(1)}% / -${state.maxDailyLossPct}%`;
            slEl.style.color = pctUsed >= state.maxDailyLossPct ? 'var(--error)' : '#ffb74d';
        } else {
            slEl.textContent = 'Chưa kích hoạt';
            slEl.style.color = 'var(--primary)';
        }
    }

    // ===== UPDATE BET FORM =====
    function updateBetForm() {
        const odds = parseFloat(document.getElementById('betOdds')?.value) || 0.90;

        const rec = BetEngine.recommend({
            bankroll: state.bankroll,
            initialBankroll: state.initialBankroll,
            target: state.target,
            history: state.history,
            odds,
            confidence: state.confidence || 4,
            dailyPL: state.dailyPL,
            sessionLosses: state.sessionLosses,
            estimatedWR: state.estimatedWR,
            maxDailyLossPct: state.maxDailyLossPct,
        });

        document.getElementById('suggestAmount').textContent = rec.amount > 0 ? fmtFull(rec.amount) : 'DỪNG';
        document.getElementById('suggestKelly').textContent = `Kelly: ${(rec.kellyPct * 100).toFixed(1)}%`;
        document.getElementById('suggestReason').textContent = rec.reasoning;

        // If we have active bet, show that card instead
        if (state.activeBet) {
            document.querySelector('.bet-form').classList.add('hidden');
            document.querySelector('.suggestion-card').classList.add('hidden');
            const card = document.getElementById('activeBetCard');
            card.classList.remove('hidden');
            document.getElementById('activeAmount').textContent = fmtFull(state.activeBet.amount);
            document.getElementById('activeOdds').textContent = `Odds: ${state.activeBet.odds} | Tự tin: ${'★'.repeat(state.activeBet.confidence)}`;
        } else {
            document.querySelector('.bet-form').classList.remove('hidden');
            document.querySelector('.suggestion-card').classList.remove('hidden');
            document.getElementById('activeBetCard').classList.add('hidden');
        }

        updateOutcomes();
    }

    // ===== UPDATE OUTCOMES PREVIEW =====
    function updateOutcomes() {
        const amountRaw = parseNum(document.getElementById('betAmount')?.value);
        const oddsRaw = parseFloat(document.getElementById('betOdds')?.value) || 0.90;

        if (amountRaw > 0) {
            document.getElementById('potentialWin').textContent = '+' + fmtFull(Math.round(amountRaw * oddsRaw));
            document.getElementById('potentialLoss').textContent = '-' + fmtFull(amountRaw);
        } else {
            document.getElementById('potentialWin').textContent = '—';
            document.getElementById('potentialLoss').textContent = '—';
        }

        // Risk warning
        const warningEl = document.getElementById('riskWarning');
        const warningTextEl = document.getElementById('riskWarningText');
        if (amountRaw > state.bankroll * 0.10) {
            warningEl.classList.remove('hidden');
            warningTextEl.textContent = `Vượt 10% vốn! (${(amountRaw / state.bankroll * 100).toFixed(1)}%). Rủi ro cao.`;
        } else if (amountRaw > state.bankroll * 0.08) {
            warningEl.classList.remove('hidden');
            warningTextEl.textContent = `Tiệm cận ngưỡng an toàn (${(amountRaw / state.bankroll * 100).toFixed(1)}%)`;
            warningEl.querySelector('svg').setAttribute('stroke', '#ffb74d');
        } else {
            warningEl.classList.add('hidden');
        }
    }

    // ===== RENDER HISTORY =====
    function renderHistory() {
        const container = document.getElementById('historyList');
        const stats = BetEngine.calcStats(state.history, state.initialBankroll, state.bankroll);

        document.getElementById('histWins').textContent = `Thắng: ${stats.wins}`;
        document.getElementById('histLosses').textContent = `Thua: ${stats.losses}`;
        const plText = `P&L: ${stats.totalPL >= 0 ? '+' : ''}${fmt(stats.totalPL)}`;
        document.getElementById('histPL').textContent = plText;

        if (state.history.length === 0) {
            container.innerHTML = '<div class="empty-state">Chưa có lệnh nào — Hãy bắt đầu!</div>';
            document.getElementById('chartSection').style.display = 'none';
            return;
        }

        const reversed = [...state.history].reverse();
        container.innerHTML = reversed.map(b => {
            const date = new Date(b.timestamp);
            const timeStr = `${date.getDate()}/${date.getMonth() + 1} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
            const plClass = b.profitLoss >= 0 ? 'positive' : 'negative';
            const plSign = b.profitLoss >= 0 ? '+' : '';
            return `<div class="history-item">
                <div class="streak-dot ${b.result.toLowerCase()} history-dot"></div>
                <div class="history-info">
                    <div class="history-main">
                        <span>${fmtFull(b.amount)}</span>
                        <span class="history-pl ${plClass}">${plSign}${fmtFull(b.profitLoss)}</span>
                    </div>
                    <div class="history-sub">${timeStr} · Odds ${b.odds} · ${'★'.repeat(b.confidence)}${'☆'.repeat(5 - b.confidence)} · Vốn: ${fmt(b.bankrollAfter)}</div>
                </div>
            </div>`;
        }).join('');

        // Draw chart
        document.getElementById('chartSection').style.display = 'block';
        drawChart();
    }

    // ===== SIMPLE CANVAS CHART =====
    function drawChart() {
        const canvas = document.getElementById('bankrollChart');
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;

        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = (rect.width - 40) * dpr;
        canvas.height = 200 * dpr;
        canvas.style.width = (rect.width - 40) + 'px';
        canvas.style.height = '200px';
        ctx.scale(dpr, dpr);

        const w = rect.width - 40;
        const h = 200;
        const pad = { top: 20, right: 10, bottom: 30, left: 60 };
        const chartW = w - pad.left - pad.right;
        const chartH = h - pad.top - pad.bottom;

        // Data points: initial + after each bet
        const points = [state.initialBankroll, ...state.history.map(b => b.bankrollAfter)];
        const minVal = Math.min(...points) * 0.95;
        const maxVal = Math.max(...points) * 1.05;
        const range = maxVal - minVal || 1;

        ctx.clearRect(0, 0, w, h);

        // Grid lines
        ctx.strokeStyle = 'rgba(112,115,146,0.15)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = pad.top + (chartH / 4) * i;
            ctx.beginPath();
            ctx.moveTo(pad.left, y);
            ctx.lineTo(w - pad.right, y);
            ctx.stroke();

            // Labels
            const val = maxVal - (range / 4) * i;
            ctx.fillStyle = '#a6a9c9';
            ctx.font = '10px Be Vietnam Pro';
            ctx.textAlign = 'right';
            ctx.fillText(fmt(val), pad.left - 6, y + 4);
        }

        // Draw line
        if (points.length < 2) return;

        const step = chartW / (points.length - 1);

        // Gradient fill under line
        const gradient = ctx.createLinearGradient(0, pad.top, 0, h - pad.bottom);
        gradient.addColorStop(0, 'rgba(63,255,139,0.15)');
        gradient.addColorStop(1, 'rgba(63,255,139,0)');

        ctx.beginPath();
        ctx.moveTo(pad.left, pad.top + chartH);
        for (let i = 0; i < points.length; i++) {
            const x = pad.left + i * step;
            const y = pad.top + chartH - ((points[i] - minVal) / range) * chartH;
            ctx.lineTo(x, y);
        }
        ctx.lineTo(pad.left + (points.length - 1) * step, pad.top + chartH);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Line
        ctx.beginPath();
        for (let i = 0; i < points.length; i++) {
            const x = pad.left + i * step;
            const y = pad.top + chartH - ((points[i] - minVal) / range) * chartH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = '#3fff8b';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Initial bankroll line
        const initY = pad.top + chartH - ((state.initialBankroll - minVal) / range) * chartH;
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(196,204,255,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pad.left, initY);
        ctx.lineTo(w - pad.right, initY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Dots for last point
        const lastX = pad.left + (points.length - 1) * step;
        const lastY = pad.top + chartH - ((points[points.length - 1] - minVal) / range) * chartH;
        ctx.beginPath();
        ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#3fff8b';
        ctx.fill();
        ctx.strokeStyle = '#080c25';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // ===== EXPORT =====
    window.exportData = function () {
        const data = JSON.stringify(state, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `betwise_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Đã xuất dữ liệu', 'success');
    };

    // ===== RESET =====
    window.resetAll = function () {
        if (!confirm('Xóa TOÀN BỘ dữ liệu? Hành động này không thể hoàn tác!')) return;
        localStorage.removeItem(STORAGE_KEY);
        state = defaultState();
        saveState();
        updateAll();
        renderHistory();
        showToast('Đã xóa toàn bộ dữ liệu', 'info');
    };

    // ===== TOAST =====
    function showToast(msg, type = 'info') {
        const el = document.getElementById('toast');
        el.textContent = msg;
        el.className = `toast ${type}`;
        // Force reflow for re-animation
        el.style.animation = 'none';
        el.offsetHeight;
        el.style.animation = '';
        setTimeout(() => el.classList.add('hidden'), 3000);
    }
    window.showToast = showToast;

    // ===== PARSE =====
    function parseNum(str) {
        if (!str) return 0;
        return parseInt(String(str).replace(/[^\d]/g, ''), 10) || 0;
    }

    // ===== INPUT LISTENERS =====
    document.addEventListener('DOMContentLoaded', () => {
        updateAll();

        // Bet amount input formatting
        const betAmountInput = document.getElementById('betAmount');
        betAmountInput.addEventListener('input', () => {
            updateOutcomes();
            document.querySelectorAll('.quick-btn').forEach(b => b.classList.remove('active'));
        });

        // Odds input change
        const betOddsInput = document.getElementById('betOdds');
        betOddsInput.addEventListener('input', () => {
            updateOutcomes();
            updateBetForm();
        });

        // Handle back from active bet if needed
        if (state.activeBet) {
            switchTab('newbet');
        }
    });

})();
