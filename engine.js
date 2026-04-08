/**
 * BetWise Engine — Core Algorithm Module
 * Kelly Criterion, Dynamic Sizing, Streak Analysis, Risk Assessment
 */
const BetEngine = (() => {
    /**
     * Kelly Criterion Calculator
     * f* = (b*p - q) / b
     * @param {number} winRate — P(win) [0-1]
     * @param {number} odds — decimal odds (e.g. 0.90)
     * @returns {number} optimal fraction [0-1]
     */
    function kellyFraction(winRate, odds) {
        const p = winRate;
        const q = 1 - p;
        const b = odds;
        const f = (b * p - q) / b;
        return Math.max(0, f);
    }

    /**
     * Expected Value per unit bet
     * EV = p*odds - q*1
     */
    function expectedValue(winRate, odds) {
        return winRate * odds - (1 - winRate) * 1;
    }

    /**
     * Determine which stage (GĐ) based on bankroll
     */
    function getStage(bankroll) {
        if (bankroll < 30_000_000) return { id: 1, name: 'GĐ 1', label: 'Xác nhận Edge', kellyDiv: 8, maxPct: 0.05 };
        if (bankroll < 100_000_000) return { id: 2, name: 'GĐ 2', label: 'Tăng tốc', kellyDiv: 4, maxPct: 0.08 };
        if (bankroll < 300_000_000) return { id: 3, name: 'GĐ 3', label: 'Đẩy mạnh', kellyDiv: 3, maxPct: 0.10 };
        return { id: 4, name: 'GĐ 4', label: 'Chốt lời', kellyDiv: 5, maxPct: 0.07 };
    }

    /**
     * Confidence multiplier (1-5 stars → 0.4x to 1.2x)
     */
    function confidenceMultiplier(level) {
        const map = { 1: 0, 2: 0.4, 3: 0.7, 4: 1.0, 5: 1.2 };
        return map[level] || 0;
    }

    /**
     * Analyze streak from bet history
     * @param {Array} history — array of {result: 'WIN'|'LOSS'}
     * @returns {Object} streak analysis
     */
    function analyzeStreak(history) {
        if (!history.length) return { current: 0, currentType: null, longestWin: 0, longestLoss: 0, consecutiveLosses: 0 };

        let currentStreak = 1;
        let currentType = history[history.length - 1].result;
        let longestWin = 0;
        let longestLoss = 0;
        let tempStreak = 1;
        let tempType = history[0].result;

        // Count consecutive losses from the end
        let consecutiveLosses = 0;
        for (let i = history.length - 1; i >= 0; i--) {
            if (history[i].result === 'LOSS') consecutiveLosses++;
            else break;
        }

        // Current streak from end
        for (let i = history.length - 2; i >= 0; i--) {
            if (history[i].result === currentType) currentStreak++;
            else break;
        }

        // Longest streaks
        for (let i = 1; i < history.length; i++) {
            if (history[i].result === tempType) {
                tempStreak++;
            } else {
                if (tempType === 'WIN') longestWin = Math.max(longestWin, tempStreak);
                else longestLoss = Math.max(longestLoss, tempStreak);
                tempType = history[i].result;
                tempStreak = 1;
            }
        }
        if (tempType === 'WIN') longestWin = Math.max(longestWin, tempStreak);
        else longestLoss = Math.max(longestLoss, tempStreak);

        return { current: currentStreak, currentType, longestWin, longestLoss, consecutiveLosses };
    }

    /**
     * Calculate Win Rate from history
     * @param {Array} history
     * @param {number} window — rolling window size (0 = all)
     */
    function calcWinRate(history, window = 0) {
        if (!history.length) return 0;
        const subset = window > 0 ? history.slice(-window) : history;
        const wins = subset.filter(b => b.result === 'WIN').length;
        return wins / subset.length;
    }

    /**
     * Risk Assessment (multi-factor)
     * Returns: 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED'
     */
    function assessRisk(state) {
        const { bankroll, initialBankroll, history, dailyPL, sessionLosses, maxDailyLossPct } = state;
        let score = 0;
        const reasons = [];

        // Factor 1: Consecutive losses
        const streak = analyzeStreak(history);
        if (streak.consecutiveLosses >= 3) {
            score += 40;
            reasons.push(`Chuỗi thua ${streak.consecutiveLosses} liên tiếp`);
        } else if (streak.consecutiveLosses >= 2) {
            score += 20;
        }

        // Factor 2: Daily drawdown
        const dailyDrawdown = dailyPL / bankroll;
        if (dailyDrawdown <= -(maxDailyLossPct / 100)) {
            score += 50;
            reasons.push(`Lỗ ngày vượt ${maxDailyLossPct}%`);
        } else if (dailyDrawdown <= -(maxDailyLossPct / 200)) {
            score += 20;
        }

        // Factor 3: Win rate declining
        if (history.length >= 20) {
            const recentWR = calcWinRate(history, 10);
            const overallWR = calcWinRate(history);
            if (recentWR < overallWR - 0.15) {
                score += 25;
                reasons.push('WR giảm mạnh gần đây');
            }
        }

        // Factor 4: Bankroll health
        if (bankroll < initialBankroll * 0.5) {
            score += 30;
            reasons.push('Vốn giảm > 50%');
        }

        if (score >= 70) return { level: 'BLOCKED', reasons, score };
        if (score >= 40) return { level: 'HIGH', reasons, score };
        if (score >= 20) return { level: 'MEDIUM', reasons, score };
        return { level: 'LOW', reasons: ['Ổn định'], score };
    }

    /**
     * MAIN: Calculate recommended bet size
     */
    function recommend(state) {
        const { bankroll, initialBankroll, target, history, odds, confidence, dailyPL, sessionLosses, estimatedWR, maxDailyLossPct } = state;

        // 1. Win Rate (use rolling 50 if enough data, else estimated)
        const actualWR = history.length >= 10 ? calcWinRate(history, 50) : (estimatedWR / 100);

        // 2. EV
        const ev = expectedValue(actualWR, odds);

        // 3. Stage
        const stage = getStage(bankroll);

        // 4. Kelly (fractional)
        const fullKelly = kellyFraction(actualWR, odds);
        const fractionalKelly = fullKelly / stage.kellyDiv;

        // 5. Confidence adjustment
        const confMult = confidenceMultiplier(confidence);
        if (confMult === 0) {
            return {
                amount: 0,
                kellyPct: 0,
                ev,
                stage,
                risk: { level: 'LOW', reasons: ['Chưa chọn confidence'], score: 0 },
                reasoning: 'Chưa chọn mức tự tin — hệ thống không gợi ý',
                blocked: false,
                actualWR,
            };
        }
        let adjustedPct = fractionalKelly * confMult;

        // 6. Cap at stage max
        adjustedPct = Math.min(adjustedPct, stage.maxPct);

        // 7. Streak adjustment
        const streak = analyzeStreak(history);
        if (streak.consecutiveLosses >= 3) {
            adjustedPct *= 0.5; // -50% after 3 losses
        } else if (streak.consecutiveLosses >= 2) {
            adjustedPct *= 0.7; // -30% after 2 losses
        }
        // Don't increase for win streaks (avoid hot hand)
        if (streak.currentType === 'WIN' && streak.current >= 5) {
            adjustedPct = Math.min(adjustedPct, stage.maxPct * 0.8);
        }

        // 8. Risk assessment
        const risk = assessRisk({ bankroll, initialBankroll, history, dailyPL, sessionLosses, maxDailyLossPct });

        // 9. Blocked?
        const blocked = risk.level === 'BLOCKED' || ev < 0;

        // 10. Final amount
        let amount = Math.round(bankroll * adjustedPct / 10000) * 10000; // Round to 10K
        if (blocked) amount = 0;
        if (amount < 10000) amount = blocked ? 0 : 10000; // Minimum 10K if not blocked

        // 11. Reasoning
        let reasoning = '';
        if (blocked) {
            reasoning = risk.level === 'BLOCKED'
                ? `🛑 DỪNG: ${risk.reasons.join(', ')}`
                : '⚠️ EV âm — Không có edge, khuyến nghị dừng';
        } else if (risk.level === 'HIGH') {
            reasoning = `⚠️ Rủi ro cao: ${risk.reasons.join(', ')} — Giảm cược`;
        } else {
            const labels = ['', '', 'Thấp', 'Vừa', 'Mạnh', 'Rất mạnh'];
            reasoning = `${stage.label} | Tự tin: ${labels[confidence] || '—'} | Kelly ${(adjustedPct * 100).toFixed(1)}%`;
        }

        return {
            amount,
            kellyPct: adjustedPct,
            ev,
            stage,
            risk,
            reasoning,
            blocked,
            actualWR,
        };
    }

    /**
     * Calculate session stats
     */
    function calcStats(history, initialBankroll, currentBankroll) {
        const total = history.length;
        const wins = history.filter(b => b.result === 'WIN').length;
        const losses = total - wins;
        const wr = total > 0 ? (wins / total * 100) : 0;
        const totalPL = history.reduce((sum, b) => sum + b.profitLoss, 0);
        const totalWagered = history.reduce((sum, b) => sum + b.amount, 0);
        const roi = totalWagered > 0 ? (totalPL / totalWagered * 100) : 0;
        const profitPct = ((currentBankroll - initialBankroll) / initialBankroll * 100);

        return { total, wins, losses, wr, totalPL, roi, profitPct, totalWagered };
    }

    return { kellyFraction, expectedValue, getStage, confidenceMultiplier, analyzeStreak, calcWinRate, assessRisk, recommend, calcStats };
})();
