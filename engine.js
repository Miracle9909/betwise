/**
 * BetWise Engine v2.0 — Advanced Probability & Decision Engine
 * Kelly Criterion, Bayesian WR, Momentum Detection, Dynamic Edge,
 * Anti-Tilt, Session Optimizer, and Bankroll Protection
 */
const BetEngine = (() => {

    // ===== CORE: KELLY CRITERION =====
    function kellyFraction(winRate, odds) {
        const p = winRate;
        const q = 1 - p;
        const b = odds;
        const f = (b * p - q) / b;
        return Math.max(0, f);
    }

    // ===== CORE: EXPECTED VALUE =====
    function expectedValue(winRate, odds) {
        return winRate * odds - (1 - winRate);
    }

    // ===== ADVANCED: BAYESIAN WIN RATE =====
    // Uses Beta distribution prior to smooth early-session estimates
    // Prior: α=7, β=3 (prior belief: ~70% WR based on user's stated edge)
    function bayesianWinRate(history, priorAlpha = 7, priorBeta = 3) {
        const wins = history.filter(b => b.result === 'WIN').length;
        const losses = history.length - wins;
        // Posterior mean: (α + wins) / (α + β + total)
        return (priorAlpha + wins) / (priorAlpha + priorBeta + history.length);
    }

    // Bayesian confidence interval (approximate 95% CI)
    function bayesianCI(history, priorAlpha = 7, priorBeta = 3) {
        const a = priorAlpha + history.filter(b => b.result === 'WIN').length;
        const b = priorBeta + history.filter(b => b.result === 'LOSS').length;
        const mean = a / (a + b);
        const variance = (a * b) / ((a + b) ** 2 * (a + b + 1));
        const sd = Math.sqrt(variance);
        return { mean, lower: Math.max(0, mean - 1.96 * sd), upper: Math.min(1, mean + 1.96 * sd), sd };
    }

    // ===== ADVANCED: MOMENTUM SCORE =====
    // Detects hot/cold streaks using weighted recent results
    // Returns [-100, +100]: <-30 cold, >+30 hot, else neutral
    function momentumScore(history) {
        if (history.length < 3) return 0;
        const recent = history.slice(-10);
        let score = 0;
        for (let i = 0; i < recent.length; i++) {
            // More recent = higher weight (exponential decay)
            const weight = Math.pow(1.3, i) / Math.pow(1.3, recent.length - 1);
            score += recent[i].result === 'WIN' ? weight * 20 : -weight * 20;
        }
        return Math.max(-100, Math.min(100, Math.round(score)));
    }

    // ===== ADVANCED: EDGE STRENGTH =====
    // Combines EV, WR confidence, and momentum into a single score [0-100]
    function edgeStrength(history, odds, estimatedWR) {
        const wr = history.length >= 5 ? bayesianWinRate(history) : estimatedWR / 100;
        const ev = expectedValue(wr, odds);
        const ci = history.length >= 5 ? bayesianCI(history) : { lower: estimatedWR / 100 - 0.15, upper: estimatedWR / 100 + 0.15, sd: 0.15 };
        const momentum = momentumScore(history);

        let score = 0;

        // EV contribution (0-40 points)
        if (ev > 0) score += Math.min(40, ev * 200);

        // WR reliability (0-30 points) — narrower CI = more reliable
        const ciWidth = ci.upper - ci.lower;
        score += Math.max(0, 30 - ciWidth * 100);

        // Momentum bonus (0-20 points)
        if (momentum > 0) score += Math.min(20, momentum * 0.2);

        // Sample size bonus (0-10 points)
        score += Math.min(10, history.length * 0.5);

        return {
            score: Math.round(Math.max(0, Math.min(100, score))),
            ev, wr, ci, momentum,
            label: score >= 70 ? 'MẠNH' : score >= 45 ? 'VỪA' : score >= 20 ? 'YẾU' : 'KHÔNG CÓ',
        };
    }

    // ===== ADVANCED: ANTI-TILT DETECTOR =====
    // Detects emotional betting patterns
    function detectTilt(history) {
        if (history.length < 5) return { isTilting: false, signals: [], severity: 0 };

        const signals = [];
        let severity = 0;
        const recent5 = history.slice(-5);
        const recent3 = history.slice(-3);

        // Signal 1: Chasing losses — betting MORE after losing
        for (let i = 1; i < recent5.length; i++) {
            if (recent5[i - 1].result === 'LOSS' && recent5[i].amount > recent5[i - 1].amount * 1.3) {
                signals.push('Tăng cược sau khi thua (dấu hiệu gỡ vốn)');
                severity += 30;
                break;
            }
        }

        // Signal 2: Rapid betting — too many bets in short time
        if (recent3.length >= 3) {
            const t1 = new Date(recent3[0].timestamp).getTime();
            const t2 = new Date(recent3[2].timestamp).getTime();
            const minutesElapsed = (t2 - t1) / 60000;
            if (minutesElapsed < 15 && minutesElapsed > 0) {
                signals.push('Đặt cược quá nhanh (3 lệnh/<15 phút)');
                severity += 25;
            }
        }

        // Signal 3: Escalating bet sizes in a losing streak
        const lastLosses = [];
        for (let i = history.length - 1; i >= Math.max(0, history.length - 5); i--) {
            if (history[i].result === 'LOSS') lastLosses.push(history[i].amount);
            else break;
        }
        if (lastLosses.length >= 3) {
            const isEscalating = lastLosses.every((val, i) => i === 0 || val >= lastLosses[i - 1]);
            if (isEscalating) {
                signals.push('Tăng dần cược qua các lệnh thua (Martingale risk)');
                severity += 40;
            }
        }

        return { isTilting: severity >= 25, signals, severity: Math.min(100, severity) };
    }

    // ===== ADVANCED: SESSION PERFORMANCE =====
    // Tracks session health metrics
    function sessionAnalysis(history, initialBankroll, bankroll) {
        if (history.length === 0) return {
            phase: 'NEW', profitFactor: 0, avgWinSize: 0, avgLossSize: 0,
            riskRewardRatio: 0, sharpeRatio: 0, maxDrawdown: 0, recommendation: 'Bắt đầu với cược nhỏ 3-5% vốn',
        };

        const wins = history.filter(b => b.result === 'WIN');
        const losses = history.filter(b => b.result === 'LOSS');

        const avgWin = wins.length > 0 ? wins.reduce((s, b) => s + b.profitLoss, 0) / wins.length : 0;
        const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, b) => s + b.profitLoss, 0) / losses.length) : 0;

        // Profit Factor = Gross Profit / Gross Loss
        const grossProfit = wins.reduce((s, b) => s + b.profitLoss, 0);
        const grossLoss = Math.abs(losses.reduce((s, b) => s + b.profitLoss, 0));
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : 0);

        // Risk-Reward ratio
        const rrRatio = avgLoss > 0 ? avgWin / avgLoss : 0;

        // Max Drawdown
        let peak = initialBankroll;
        let maxDD = 0;
        let running = initialBankroll;
        for (const b of history) {
            running += b.profitLoss;
            peak = Math.max(peak, running);
            const dd = (peak - running) / peak;
            maxDD = Math.max(maxDD, dd);
        }

        // Sharpe-like ratio (returns consistency)
        const returns = history.map(b => b.profitLoss / b.amount);
        const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const stdReturn = Math.sqrt(returns.reduce((s, r) => s + (r - avgReturn) ** 2, 0) / returns.length);
        const sharpe = stdReturn > 0 ? avgReturn / stdReturn : 0;

        // Phase detection
        let phase = 'STABLE';
        if (history.length < 10) phase = 'WARMING';
        else if (maxDD > 0.3) phase = 'RECOVERY';
        else if (profitFactor > 1.5 && sharpe > 0.3) phase = 'STRONG';
        else if (profitFactor < 0.8) phase = 'WEAK';

        // Recommendation
        let recommendation = '';
        if (phase === 'WARMING') recommendation = 'Tiếp tục thu thập dữ liệu. Giữ cược nhỏ.';
        else if (phase === 'STRONG') recommendation = '🔥 Hiệu suất tốt! Có thể tăng nhẹ sizing.';
        else if (phase === 'WEAK') recommendation = '⚠️ Nên giảm cược 50% hoặc nghỉ ngơi.';
        else if (phase === 'RECOVERY') recommendation = '🛡️ Đang hồi phục. Giữ cược bảo thủ.';
        else recommendation = '✅ Ổn định. Tiếp tục theo plan.';

        return { phase, profitFactor, avgWinSize: avgWin, avgLossSize: avgLoss, riskRewardRatio: rrRatio, sharpeRatio: sharpe, maxDrawdown: maxDD, recommendation };
    }

    // ===== ADVANCED: OPTIMAL BETTING WINDOW =====
    // Analyzes which time periods have the best performance
    function analyzeTimePatterns(history) {
        if (history.length < 10) return { bestPeriod: null, worstPeriod: null, currentPeriodAdvice: '' };

        const periods = { morning: { w: 0, l: 0 }, afternoon: { w: 0, l: 0 }, evening: { w: 0, l: 0 }, night: { w: 0, l: 0 } };

        for (const b of history) {
            const h = new Date(b.timestamp).getHours();
            let period;
            if (h >= 6 && h < 12) period = 'morning';
            else if (h >= 12 && h < 17) period = 'afternoon';
            else if (h >= 17 && h < 22) period = 'evening';
            else period = 'night';

            if (b.result === 'WIN') periods[period].w++;
            else periods[period].l++;
        }

        const periodNames = { morning: 'Sáng (6-12h)', afternoon: 'Chiều (12-17h)', evening: 'Tối (17-22h)', night: 'Đêm (22-6h)' };
        let best = null, worst = null, bestWR = 0, worstWR = 1;

        for (const [key, val] of Object.entries(periods)) {
            const total = val.w + val.l;
            if (total >= 3) {
                const wr = val.w / total;
                if (wr > bestWR) { bestWR = wr; best = { period: periodNames[key], wr, total }; }
                if (wr < worstWR) { worstWR = wr; worst = { period: periodNames[key], wr, total }; }
            }
        }

        const now = new Date().getHours();
        let currentPeriod;
        if (now >= 6 && now < 12) currentPeriod = 'morning';
        else if (now >= 12 && now < 17) currentPeriod = 'afternoon';
        else if (now >= 17 && now < 22) currentPeriod = 'evening';
        else currentPeriod = 'night';

        let advice = '';
        const cp = periods[currentPeriod];
        if (cp.w + cp.l >= 3) {
            const cpWR = cp.w / (cp.w + cp.l);
            if (cpWR >= 0.7) advice = '🟢 Khung giờ hiện tại có WR tốt!';
            else if (cpWR < 0.5) advice = '🟡 Khung giờ này WR thấp. Cân nhắc nghỉ.';
        }

        return { bestPeriod: best, worstPeriod: worst, currentPeriodAdvice: advice };
    }

    // ===== STAGE DETECTION =====
    function getStage(bankroll) {
        if (bankroll < 30_000_000) return { id: 1, name: 'GĐ 1', label: 'Xác nhận Edge', kellyDiv: 8, maxPct: 0.05 };
        if (bankroll < 100_000_000) return { id: 2, name: 'GĐ 2', label: 'Tăng tốc', kellyDiv: 4, maxPct: 0.08 };
        if (bankroll < 300_000_000) return { id: 3, name: 'GĐ 3', label: 'Đẩy mạnh', kellyDiv: 3, maxPct: 0.10 };
        return { id: 4, name: 'GĐ 4', label: 'Chốt lời', kellyDiv: 5, maxPct: 0.07 };
    }

    // ===== CONFIDENCE MULTIPLIER (now optional — defaults to 1.0) =====
    function confidenceMultiplier(level) {
        if (!level || level < 1) return 1.0; // Default to full sizing if not set
        const map = { 1: 0.5, 2: 0.65, 3: 0.8, 4: 1.0, 5: 1.15 };
        return map[level] || 1.0;
    }

    // ===== STREAK ANALYSIS =====
    function analyzeStreak(history) {
        if (!history.length) return { current: 0, currentType: null, longestWin: 0, longestLoss: 0, consecutiveLosses: 0 };

        let currentStreak = 1;
        let currentType = history[history.length - 1].result;
        let longestWin = 0, longestLoss = 0;
        let tempStreak = 1, tempType = history[0].result;

        let consecutiveLosses = 0;
        for (let i = history.length - 1; i >= 0; i--) {
            if (history[i].result === 'LOSS') consecutiveLosses++;
            else break;
        }

        for (let i = history.length - 2; i >= 0; i--) {
            if (history[i].result === currentType) currentStreak++;
            else break;
        }

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

    // ===== WIN RATE CALCULATOR =====
    function calcWinRate(history, window = 0) {
        if (!history.length) return 0;
        const subset = window > 0 ? history.slice(-window) : history;
        return subset.filter(b => b.result === 'WIN').length / subset.length;
    }

    // ===== RISK ASSESSMENT (Enhanced) =====
    function assessRisk(state) {
        const { bankroll, initialBankroll, history, dailyPL, sessionLosses, maxDailyLossPct } = state;
        let score = 0;
        const reasons = [];

        // Factor 1: Consecutive losses
        const streak = analyzeStreak(history);
        if (streak.consecutiveLosses >= 4) {
            score += 50;
            reasons.push(`Chuỗi thua ${streak.consecutiveLosses} liên tiếp — nghiêm trọng`);
        } else if (streak.consecutiveLosses >= 3) {
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

        // Factor 3: Win rate declining (Bayesian)
        if (history.length >= 15) {
            const recentWR = calcWinRate(history, 8);
            const overallWR = bayesianWinRate(history);
            if (recentWR < overallWR - 0.15) {
                score += 25;
                reasons.push('WR giảm mạnh gần đây');
            }
        }

        // Factor 4: Bankroll health
        if (bankroll < initialBankroll * 0.5) {
            score += 30;
            reasons.push('Vốn giảm > 50%');
        } else if (bankroll < initialBankroll * 0.7) {
            score += 15;
        }

        // Factor 5: Tilt detection
        const tilt = detectTilt(history);
        if (tilt.isTilting) {
            score += tilt.severity * 0.4;
            reasons.push(...tilt.signals.slice(0, 2));
        }

        // Factor 6: Negative momentum
        const mom = momentumScore(history);
        if (mom < -40) {
            score += 15;
            reasons.push('Momentum rất tiêu cực');
        }

        if (score >= 70) return { level: 'BLOCKED', reasons, score: Math.round(score) };
        if (score >= 40) return { level: 'HIGH', reasons, score: Math.round(score) };
        if (score >= 20) return { level: 'MEDIUM', reasons, score: Math.round(score) };
        return { level: 'LOW', reasons: ['Ổn định'], score: Math.round(score) };
    }

    // ===== MAIN RECOMMEND (Enhanced v2) =====
    function recommend(state) {
        const { bankroll, initialBankroll, target, history, odds, confidence, dailyPL, sessionLosses, estimatedWR, maxDailyLossPct } = state;

        // 1. Smart Win Rate (Bayesian if enough data, else prior)
        const actualWR = history.length >= 5 ? bayesianWinRate(history) : (estimatedWR / 100);

        // 2. EV
        const ev = expectedValue(actualWR, odds);

        // 3. Stage
        const stage = getStage(bankroll);

        // 4. Kelly (fractional)
        const fullKelly = kellyFraction(actualWR, odds);
        const fractionalKelly = fullKelly / stage.kellyDiv;

        // 5. Confidence adjustment (now OPTIONAL — defaults to 1.0)
        const confMult = confidenceMultiplier(confidence);
        let adjustedPct = fractionalKelly * confMult;

        // 6. Cap at stage max
        adjustedPct = Math.min(adjustedPct, stage.maxPct);

        // 7. Streak adjustment (graduated)
        const streak = analyzeStreak(history);
        if (streak.consecutiveLosses >= 4) {
            adjustedPct *= 0.3; // -70% after 4+ losses
        } else if (streak.consecutiveLosses >= 3) {
            adjustedPct *= 0.5; // -50% after 3 losses
        } else if (streak.consecutiveLosses >= 2) {
            adjustedPct *= 0.7; // -30% after 2 losses
        }

        // Hot streak protection (avoid overconfidence)
        if (streak.currentType === 'WIN' && streak.current >= 5) {
            adjustedPct = Math.min(adjustedPct, stage.maxPct * 0.8);
        }

        // 8. Momentum adjustment
        const mom = momentumScore(history);
        if (mom < -30) adjustedPct *= 0.85;
        else if (mom > 50 && history.length >= 10) adjustedPct *= 1.05; // Slight boost with strong positive momentum

        // 9. Edge strength factor
        const edge = edgeStrength(history, odds, estimatedWR);
        if (edge.score < 20 && history.length >= 15) {
            adjustedPct *= 0.6; // Significantly reduce if no edge detected
        }

        // 10. Risk assessment (enhanced with tilt + momentum)
        const risk = assessRisk({ bankroll, initialBankroll, history, dailyPL, sessionLosses, maxDailyLossPct });

        // 11. Blocked?
        const blocked = risk.level === 'BLOCKED' || (ev < -0.02 && history.length >= 15);

        // 12. Final amount
        let amount = Math.round(bankroll * adjustedPct / 10000) * 10000;
        if (blocked) amount = 0;
        if (amount < 10000 && !blocked) amount = 10000;

        // 13. Reasoning (contextual)
        let reasoning = '';
        if (blocked) {
            reasoning = risk.level === 'BLOCKED'
                ? `🛑 DỪNG: ${risk.reasons.join(', ')}`
                : `⚠️ EV âm (${(ev * 100).toFixed(1)}%) — Edge không đủ, nghỉ ngơi`;
        } else if (risk.level === 'HIGH') {
            reasoning = `⚠️ Rủi ro cao: ${risk.reasons.join(', ')} — Giảm cược`;
        } else {
            const parts = [stage.label];
            if (edge.label !== 'KHÔNG CÓ') parts.push(`Edge: ${edge.label}`);
            if (mom > 30) parts.push('📈 Momentum tốt');
            else if (mom < -20) parts.push('📉 Momentum yếu');
            parts.push(`Kelly ${(adjustedPct * 100).toFixed(1)}%`);
            reasoning = parts.join(' | ');
        }

        return {
            amount, kellyPct: adjustedPct, ev, stage, risk, reasoning, blocked, actualWR,
            edge, momentum: mom,
        };
    }

    // ===== SESSION STATS =====
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

    // ===== MOTIVATIONAL MESSAGE =====
    // Context-aware messages to keep player focused
    function getMotivation(history, bankroll, initialBankroll) {
        const streak = analyzeStreak(history);
        const stats = history.length > 0 ? calcStats(history, initialBankroll, bankroll) : null;
        const messages = [];

        if (history.length === 0) {
            return '🚀 Mọi hành trình đều bắt đầu từ bước đầu tiên. Kỷ luật là vũ khí mạnh nhất!';
        }

        // After a win
        if (streak.currentType === 'WIN') {
            if (streak.current === 1) messages.push('✅ Thắng đẹp! Giữ nhịp, đừng tham.');
            else if (streak.current === 2) messages.push('🔥 2 liên tiếp! Nhưng nhớ — hệ thống > cảm xúc.');
            else if (streak.current >= 3) messages.push(`🔥 Chuỗi ${streak.current} thắng! Cực kỳ tốt. Nhưng đừng tăng cược vì "đang hên" — đó là bẫy.`);
        }

        // After a loss
        if (streak.currentType === 'LOSS') {
            if (streak.current === 1) messages.push('💪 Thua 1 lệnh không sao. Variance là bình thường. Tiếp tục tin vào hệ thống.');
            else if (streak.current === 2) messages.push('🧘 2 thua liên tiếp — hoàn toàn nằm trong xác suất. Hệ thống đã tự giảm cược. Bạn vẫn đúng hướng.');
            else if (streak.current === 3) messages.push('⏸️ 3 thua liên tiếp. Hãy nghỉ 15 phút, uống nước, hít thở sâu. Đây KHÔNG phải là thua — đây là variance.');
            else messages.push('🛑 Chuỗi thua dài. DỪNG LẠI. Nghỉ ngơi ít nhất 30 phút. Cố gỡ = tự hại mình.');
        }

        // Profit milestones
        if (stats && stats.profitPct >= 100) messages.push('🏆 Đã x2 vốn! Bạn đang trên đường đến mục tiêu!');
        else if (stats && stats.profitPct >= 50) messages.push('📈 +50% vốn! Chiến thuật đang phát huy tác dụng.');
        else if (stats && stats.profitPct <= -30) messages.push('🛡️ Vốn giảm. Hãy giảm kích thước cược và review lại chiến thuật.');

        // WR feedback
        if (stats && stats.total >= 10) {
            if (stats.wr >= 70) messages.push('🎯 WR 70%+! Edge rất mạnh. Giữ kỷ luật!');
            else if (stats.wr >= 55) messages.push('📊 WR ổn định. Tiếp tục theo hệ thống, thời gian sẽ chứng minh.');
            else if (stats.wr < 50) messages.push('📉 WR dưới 50%. Nên dừng và xem lại chiến thuật chọn kèo.');
        }

        return messages.length > 0 ? messages[0] : '💎 Kỷ luật và kiên nhẫn — hai vũ khí bất bại.';
    }

    // ===== PUBLIC API =====
    return {
        kellyFraction, expectedValue, getStage, confidenceMultiplier,
        analyzeStreak, calcWinRate, assessRisk, recommend, calcStats,
        // New v2 exports
        bayesianWinRate, bayesianCI, momentumScore, edgeStrength,
        detectTilt, sessionAnalysis, analyzeTimePatterns, getMotivation,
    };
})();
