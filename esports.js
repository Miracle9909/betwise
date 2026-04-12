/**
 * BetWise Esports Analyzer v2.0 — Advanced Auto-Simulation Engine
 * 
 * Algorithms:
 * - Elo Rating System for team strength calibration
 * - Bayesian Win Probability with H2H prior
 * - Poisson Distribution for O/U predictions
 * - Monte Carlo Simulation (N=500) for result variance
 * - Kelly Criterion (Half-Kelly) for optimal bet sizing
 * - Edge-weighted confidence scoring with decay
 */
const EsportsAnalyzer = (() => {
    'use strict';

    const STORAGE_KEY = 'betwise_esports_v2';
    const MIN_CONFIDENCE = 0.60;  // Only bet ≥60% probability
    const MIN_EDGE = 0.06;        // Minimum 6% edge to enter
    const MONTE_CARLO_N = 500;    // Simulation iterations

    // ===== TEAM DATABASE =====
    const TEAMS = {
        dota2: [
            { id: 'ts', name: 'Team Spirit', elo: 1680, region: 'CIS', logo: '🐻', avgKills: 32, avgTowers: 8.2, avgDuration: 38, form: [1, 1, 1, 0, 1], sdKills: 6, sdTowers: 1.8, sdDur: 5 },
            { id: 'og', name: 'OG', elo: 1620, region: 'EU', logo: '🌸', avgKills: 29, avgTowers: 7.8, avgDuration: 36, form: [1, 0, 1, 1, 0], sdKills: 7, sdTowers: 2.0, sdDur: 6 },
            { id: 'lgd', name: 'PSG.LGD', elo: 1660, region: 'CN', logo: '🐉', avgKills: 27, avgTowers: 8.5, avgDuration: 35, form: [1, 1, 0, 1, 1], sdKills: 5, sdTowers: 1.5, sdDur: 4 },
            { id: 'tl', name: 'Team Liquid', elo: 1640, region: 'EU', logo: '💧', avgKills: 30, avgTowers: 7.5, avgDuration: 37, form: [0, 1, 1, 1, 0], sdKills: 6, sdTowers: 1.9, sdDur: 5 },
            { id: 'eg', name: 'Evil Geniuses', elo: 1520, region: 'NA', logo: '⚡', avgKills: 28, avgTowers: 7.0, avgDuration: 39, form: [1, 0, 0, 1, 1], sdKills: 8, sdTowers: 2.2, sdDur: 7 },
            { id: 'bb', name: 'BetBoom', elo: 1670, region: 'CIS', logo: '💥', avgKills: 31, avgTowers: 8.0, avgDuration: 34, form: [1, 1, 1, 1, 0], sdKills: 5, sdTowers: 1.6, sdDur: 4 },
            { id: 'fg', name: 'Falcons', elo: 1650, region: 'MENA', logo: '🦅', avgKills: 33, avgTowers: 8.8, avgDuration: 40, form: [1, 1, 0, 0, 1], sdKills: 7, sdTowers: 2.1, sdDur: 6 },
            { id: 'gg', name: 'Gaimin Gladiators', elo: 1635, region: 'EU', logo: '⚔️', avgKills: 30, avgTowers: 7.6, avgDuration: 36, form: [0, 1, 1, 0, 1], sdKills: 6, sdTowers: 1.8, sdDur: 5 },
            { id: 'xtm', name: 'Xtreme', elo: 1480, region: 'SEA', logo: '🔥', avgKills: 34, avgTowers: 7.2, avgDuration: 41, form: [0, 0, 1, 1, 1], sdKills: 9, sdTowers: 2.5, sdDur: 8 },
            { id: 'ta', name: 'Tundra', elo: 1655, region: 'EU', logo: '❄️', avgKills: 26, avgTowers: 8.4, avgDuration: 33, form: [1, 1, 1, 0, 0], sdKills: 4, sdTowers: 1.4, sdDur: 3 },
        ],
        lol: [
            { id: 't1', name: 'T1', elo: 1720, region: 'KR', logo: '🔴', avgKills: 18, avgTowers: 9.0, avgDuration: 31, form: [1, 1, 1, 1, 0], sdKills: 4, sdTowers: 1.5, sdDur: 4 },
            { id: 'geng', name: 'Gen.G', elo: 1700, region: 'KR', logo: '🟡', avgKills: 16, avgTowers: 8.8, avgDuration: 30, form: [1, 1, 0, 1, 1], sdKills: 3, sdTowers: 1.3, sdDur: 3 },
            { id: 'blg', name: 'BLG', elo: 1690, region: 'CN', logo: '🟢', avgKills: 20, avgTowers: 8.5, avgDuration: 29, form: [1, 0, 1, 1, 1], sdKills: 5, sdTowers: 1.7, sdDur: 4 },
            { id: 'hle', name: 'HLE', elo: 1650, region: 'KR', logo: '🟠', avgKills: 17, avgTowers: 8.2, avgDuration: 32, form: [0, 1, 1, 0, 1], sdKills: 4, sdTowers: 1.6, sdDur: 5 },
            { id: 'weibo', name: 'Weibo Gaming', elo: 1640, region: 'CN', logo: '🐯', avgKills: 21, avgTowers: 7.8, avgDuration: 28, form: [1, 1, 0, 0, 1], sdKills: 6, sdTowers: 2.0, sdDur: 5 },
            { id: 'fly', name: 'FlyQuest', elo: 1500, region: 'NA', logo: '🦋', avgKills: 15, avgTowers: 7.5, avgDuration: 33, form: [0, 1, 0, 1, 0], sdKills: 5, sdTowers: 2.1, sdDur: 6 },
            { id: 'fnc', name: 'Fnatic', elo: 1540, region: 'EU', logo: '🟧', avgKills: 19, avgTowers: 7.9, avgDuration: 31, form: [1, 0, 1, 0, 1], sdKills: 5, sdTowers: 1.8, sdDur: 5 },
            { id: 'jdg', name: 'JDG', elo: 1680, region: 'CN', logo: '🏆', avgKills: 18, avgTowers: 8.6, avgDuration: 30, form: [1, 1, 1, 0, 0], sdKills: 4, sdTowers: 1.4, sdDur: 4 },
            { id: 'drx', name: 'DRX', elo: 1510, region: 'KR', logo: '🐲', avgKills: 16, avgTowers: 7.4, avgDuration: 34, form: [0, 0, 1, 1, 0], sdKills: 5, sdTowers: 2.2, sdDur: 6 },
            { id: 'tes', name: 'TES', elo: 1670, region: 'CN', logo: '⚡', avgKills: 22, avgTowers: 8.0, avgDuration: 27, form: [1, 1, 0, 1, 0], sdKills: 5, sdTowers: 1.7, sdDur: 4 },
        ]
    };

    // ===== HEAD-TO-HEAD CACHE =====
    const H2H = {};

    function getH2H(teamA, teamB) {
        const key = [teamA.id, teamB.id].sort().join('-');
        if (!H2H[key]) {
            const eloDiff = teamA.elo - teamB.elo;
            const base = 5 + Math.floor(Math.abs(eloDiff) / 40);
            const aAdv = eloDiff > 0 ? Math.ceil(base * 0.6) : Math.floor(base * 0.4);
            H2H[key] = { a: teamA.id, aWins: aAdv, b: teamB.id, bWins: base - aAdv, total: base };
        }
        const r = H2H[key];
        return r.a === teamA.id
            ? { wins: r.aWins, losses: r.bWins, total: r.total }
            : { wins: r.bWins, losses: r.aWins, total: r.total };
    }

    // ===== PROBABILITY ENGINE — Elo + Bayesian + Form =====

    /** Elo-based expected win probability */
    function eloWinProb(eloA, eloB) {
        return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
    }

    /** Exponentially-weighted form score (recent matches matter more) */
    function formScore(form) {
        const weights = [1, 2, 3, 4, 5];
        let sum = 0, wSum = 0;
        for (let i = 0; i < form.length; i++) {
            sum += form[i] * weights[i];
            wSum += weights[i];
        }
        return sum / wSum;
    }

    /** Combined Bayesian win probability: Elo prior + H2H evidence + Form momentum */
    function winProbability(teamA, teamB) {
        const eloPrior = eloWinProb(teamA.elo, teamB.elo);
        const h2h = getH2H(teamA, teamB);
        const h2hLikelihood = h2h.wins / h2h.total;
        const formA = formScore(teamA.form);
        const formB = formScore(teamB.form);
        const formFactor = formA / (formA + formB + 0.001);

        // Bayesian posterior: weighted combination
        const h2hWeight = Math.min(h2h.total / 15, 0.35);
        const formWeight = 0.20;
        const eloWeight = 1 - h2hWeight - formWeight;

        const posterior = eloPrior * eloWeight + h2hLikelihood * h2hWeight + formFactor * formWeight;
        return Math.max(0.10, Math.min(0.90, posterior));
    }

    // ===== POISSON DISTRIBUTION for O/U =====

    function poissonPMF(k, lambda) {
        let result = Math.exp(-lambda);
        for (let i = 1; i <= k; i++) {
            result *= lambda / i;
        }
        return result;
    }

    /** P(X > line) using Poisson CDF */
    function poissonOverProb(lambda, line) {
        let cdfUnder = 0;
        const intLine = Math.floor(line);
        for (let k = 0; k <= intLine; k++) {
            cdfUnder += poissonPMF(k, lambda);
        }
        return 1 - cdfUnder;
    }

    // ===== MONTE CARLO SIMULATION =====

    function gaussianRandom(mean, sd) {
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        return mean + sd * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    }

    function monteCarloSimulate(teamA, teamB, game, n = MONTE_CARLO_N) {
        const results = { kills: [], towers: [], duration: [] };
        const wp = winProbability(teamA, teamB);

        for (let i = 0; i < n; i++) {
            // Winner influences stats
            const aWins = Math.random() < wp;
            const killMultiplier = aWins ? 1.05 : 0.95;
            const towerMultiplier = aWins ? 1.08 : 0.92;

            const avgK = (teamA.avgKills + teamB.avgKills) / 2;
            const sdK = Math.sqrt((teamA.sdKills ** 2 + teamB.sdKills ** 2) / 2);
            const simKills = Math.max(8, Math.round(gaussianRandom(avgK * killMultiplier, sdK)));

            const avgT = teamA.avgTowers + teamB.avgTowers;
            const sdT = Math.sqrt(teamA.sdTowers ** 2 + teamB.sdTowers ** 2);
            const simTowers = Math.max(3, Math.round(gaussianRandom(avgT * towerMultiplier, sdT)));

            const avgD = (teamA.avgDuration + teamB.avgDuration) / 2;
            const sdD = Math.sqrt((teamA.sdDur ** 2 + teamB.sdDur ** 2) / 2);
            const simDur = Math.max(15, Math.round(gaussianRandom(avgD, sdD)));

            results.kills.push(game === 'dota2' ? simKills * 2 : simKills);
            results.towers.push(simTowers);
            results.duration.push(simDur);
        }

        return {
            kills: { mean: mean(results.kills), sd: stdDev(results.kills), samples: results.kills },
            towers: { mean: mean(results.towers), sd: stdDev(results.towers), samples: results.towers },
            duration: { mean: mean(results.duration), sd: stdDev(results.duration), samples: results.duration },
        };
    }

    function mean(arr) { return arr.reduce((s, v) => s + v, 0) / arr.length; }
    function stdDev(arr) {
        const m = mean(arr);
        return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
    }

    // ===== BET ANALYSIS with Monte Carlo + Poisson =====

    function analyzeBetTypes(teamA, teamB, game) {
        const mc = monteCarloSimulate(teamA, teamB, game);
        const bets = [];

        // --- Kill O/U ---
        const killLine = Math.round(mc.kills.mean) + 0.5;
        const killOverProb = poissonOverProb(mc.kills.mean, killLine);
        const killOdds = 1.75 + Math.random() * 0.25;
        bets.push(buildBet('kill_ou', 'Tài/Xỉu Mạng', killLine, killOverProb, killOdds));

        // --- Tower O/U ---
        const towerLine = Math.round(mc.towers.mean) + 0.5;
        const towerOverProb = poissonOverProb(mc.towers.mean, towerLine);
        const towerOdds = 1.80 + Math.random() * 0.20;
        bets.push(buildBet('tower_ou', 'Tài/Xỉu Trụ', towerLine, towerOverProb, towerOdds));

        // --- Time O/U ---
        const timeLine = Math.round(mc.duration.mean) + 0.5;
        // For time, use MC simulation directly (not Poisson — duration is Gaussian)
        const timeOverCount = mc.duration.samples.filter(d => d > timeLine).length;
        const timeOverProb = timeOverCount / mc.duration.samples.length;
        const timeOdds = 1.82 + Math.random() * 0.18;
        bets.push(buildBet('time_ou', 'Tài/Xỉu Thời gian', timeLine, timeOverProb, timeOdds));

        return { bets, mc };
    }

    function buildBet(type, label, line, overProb, odds) {
        const op = Math.max(0.10, Math.min(0.90, overProb));
        const up = 1 - op;
        const pick = op > 0.55 ? 'over' : up > 0.55 ? 'under' : null;
        const pickProb = pick === 'over' ? op : pick === 'under' ? up : Math.max(op, up);
        return { type, label, line, overProb: op, underProb: up, odds, pick, pickProb };
    }

    // ===== RECOMMENDATION ENGINE — Kelly Criterion =====

    function generateRecommendation(betAnalysis, bankroll) {
        let bestBet = null, bestEdge = -Infinity;

        for (const bet of betAnalysis) {
            if (!bet.pick) continue;
            const p = bet.pickProb;
            if (p < MIN_CONFIDENCE) continue;
            const edge = p * (bet.odds - 1) - (1 - p);
            if (edge > bestEdge && edge >= MIN_EDGE) {
                bestEdge = edge;
                bestBet = bet;
            }
        }

        if (!bestBet) {
            return { action: 'SKIP', reason: `Không đủ edge (cần ≥${(MIN_EDGE * 100).toFixed(0)}% và P≥${(MIN_CONFIDENCE * 100).toFixed(0)}%)`, bestBet: null, amount: 0, probability: 0, edge: 0 };
        }

        // Half-Kelly sizing
        const b = bestBet.odds - 1;
        const p = bestBet.pickProb;
        const kellyFull = (b * p - (1 - p)) / b;
        const kellyHalf = kellyFull / 2;

        // Confidence tiers
        let confTier, sizing;
        if (p >= 0.75) { confTier = 'elite'; sizing = Math.min(kellyHalf * 1.3, 0.22); }
        else if (p >= 0.68) { confTier = 'high'; sizing = Math.min(kellyHalf, 0.16); }
        else if (p >= 0.60) { confTier = 'medium'; sizing = Math.min(kellyHalf * 0.7, 0.10); }
        else { confTier = 'skip'; sizing = 0; }

        const amount = Math.round(bankroll * sizing / 10000) * 10000;
        if (amount < 50000) {
            return { action: 'SKIP', reason: 'Mức cược quá nhỏ so với vốn', bestBet, amount: 0, probability: p, edge: bestEdge };
        }

        const pickLabel = bestBet.pick === 'over' ? `Tài (>${bestBet.line})` : `Xỉu (<${bestBet.line})`;
        const edgePct = (bestEdge * 100).toFixed(1);
        const probPct = (p * 100).toFixed(0);

        return {
            action: 'BET', bestBet, betType: bestBet.type, betLabel: bestBet.label,
            pick: bestBet.pick, pickLabel, probability: p, edge: bestEdge,
            kelly: kellyHalf, confTier, amount, odds: bestBet.odds,
            reason: `${confTier === 'elite' ? '🔥' : confTier === 'high' ? '✅' : '⚡'} P=${probPct}% Edge=+${edgePct}% Kelly=${(kellyHalf * 100).toFixed(1)}%`,
        };
    }

    // ===== DAILY MATCH GENERATION =====

    function generateDailyMatches(dateStr) {
        const seed = hashCode(dateStr);
        const rng = seededRandom(seed);
        const matches = [];
        const usedDota = new Set(), usedLol = new Set();

        const dotaCount = 4 + Math.floor(rng() * 3);
        for (let i = 0; i < dotaCount; i++) {
            const [a, b] = pickTwo(TEAMS.dota2, usedDota, rng);
            if (!a) break;
            const time = `${14 + Math.floor(rng() * 8)}:${rng() > 0.5 ? '00' : '30'}`;
            const { bets, mc } = analyzeBetTypes(a, b, 'dota2');
            const rec = generateRecommendation(bets, 10000000);
            matches.push({ id: `d2_${dateStr}_${i}`, game: 'dota2', teamA: a, teamB: b, time, bets, mc, rec, status: 'upcoming', result: null });
        }

        const lolCount = 3 + Math.floor(rng() * 3);
        for (let i = 0; i < lolCount; i++) {
            const [a, b] = pickTwo(TEAMS.lol, usedLol, rng);
            if (!a) break;
            const time = `${15 + Math.floor(rng() * 7)}:${rng() > 0.5 ? '00' : '30'}`;
            const { bets, mc } = analyzeBetTypes(a, b, 'lol');
            const rec = generateRecommendation(bets, 10000000);
            matches.push({ id: `lol_${dateStr}_${i}`, game: 'lol', teamA: a, teamB: b, time, bets, mc, rec, status: 'upcoming', result: null });
        }

        matches.sort((a, b) => a.time.localeCompare(b.time));
        return matches;
    }

    function pickTwo(pool, used, rng) {
        const avail = pool.filter(t => !used.has(t.id));
        if (avail.length < 2) return [null, null];
        const s = avail.sort(() => rng() - 0.5);
        used.add(s[0].id); used.add(s[1].id);
        return [s[0], s[1]];
    }

    // ===== MATCH RESULT SIMULATION (Monte Carlo based) =====

    function simulateResult(match) {
        const mc = monteCarloSimulate(match.teamA, match.teamB, match.game, 1);
        return {
            kills: mc.kills.samples[0],
            towers: mc.towers.samples[0],
            duration: mc.duration.samples[0],
        };
    }

    function resolveBet(bet, result) {
        let actual;
        switch (bet.betType) {
            case 'kill_ou': actual = result.kills; break;
            case 'tower_ou': actual = result.towers; break;
            case 'time_ou': actual = result.duration; break;
        }
        const won = bet.pick === 'over' ? actual > bet.line : actual < bet.line;
        return { won, pnl: won ? Math.round(bet.amount * (bet.odds - 1)) : -bet.amount, actual };
    }

    // ===== STATE =====

    function defaultState() {
        return { capital: 10000000, initialCapital: 10000000, bets: [], dailyMatches: {}, currentDate: todayStr(), autoRunComplete: false };
    }

    function todayStr() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return defaultState();
            return { ...defaultState(), ...JSON.parse(raw) };
        } catch { return defaultState(); }
    }

    function saveState(state) { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    function resetState() { localStorage.removeItem(STORAGE_KEY); return defaultState(); }

    // ===== STATISTICS =====

    function calcDailyPL(bets, dateStr) {
        return bets.filter(b => b.timestamp?.startsWith(dateStr) && b.result !== null).reduce((s, b) => s + (b.pnl || 0), 0);
    }

    function calcWeeklyPL(bets) {
        const cutoff = new Date(Date.now() - 7 * 86400000);
        return bets.filter(b => b.result !== null && new Date(b.timestamp) >= cutoff).reduce((s, b) => s + (b.pnl || 0), 0);
    }

    function calcWinRate(bets) {
        const r = bets.filter(b => b.result !== null);
        return r.length === 0 ? 0 : r.filter(b => b.result === 'win').length / r.length;
    }

    function calcStats(bets, capital, initialCapital) {
        const r = bets.filter(b => b.result !== null);
        const wins = r.filter(b => b.result === 'win').length;
        const totalPL = r.reduce((s, b) => s + (b.pnl || 0), 0);
        const roi = initialCapital > 0 ? (totalPL / initialCapital) * 100 : 0;
        return { total: r.length, wins, losses: r.length - wins, winRate: r.length > 0 ? (wins / r.length * 100).toFixed(1) : '0', totalPL, roi: roi.toFixed(1) };
    }

    function getDailyHistory(bets) {
        const days = {};
        for (const b of bets) {
            if (!b.timestamp || b.result === null) continue;
            const d = b.timestamp.slice(0, 10);
            if (!days[d]) days[d] = { date: d, bets: 0, wins: 0, pnl: 0 };
            days[d].bets++;
            if (b.result === 'win') days[d].wins++;
            days[d].pnl += b.pnl || 0;
        }
        return Object.values(days).sort((a, b) => b.date.localeCompare(a.date));
    }

    // ===== FORMAT =====
    function fmt(n) {
        if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + 'B';
        if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
        if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(0) + 'k';
        return n.toString();
    }
    function fmtFull(n) { return new Intl.NumberFormat('vi-VN').format(n); }

    // ===== UTILS =====
    function hashCode(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; } return Math.abs(h); }
    function seededRandom(s) { return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

    return {
        TEAMS, loadState, saveState, resetState, defaultState,
        generateDailyMatches, generateRecommendation, analyzeBetTypes,
        winProbability, simulateResult, resolveBet,
        calcDailyPL, calcWeeklyPL, calcWinRate, calcStats, getDailyHistory,
        todayStr, fmt, fmtFull, getH2H, formScore, eloWinProb,
        MIN_CONFIDENCE, MIN_EDGE,
    };
})();
