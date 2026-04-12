/**
 * BetWise Esports Analyzer v1.0
 * Professional esports betting analysis for Dota 2 & LoL
 * Kelly Criterion betting, h2h analysis, bankroll simulation
 */
const EsportsAnalyzer = (() => {
    'use strict';

    const STORAGE_KEY = 'betwise_esports';

    // ===== TEAM DATABASE =====
    const TEAMS = {
        dota2: [
            { id: 'ts', name: 'Team Spirit', tier: 1, region: 'CIS', logo: '🐻', avgKills: 32, avgTowers: 8.2, avgDuration: 38, form: [1, 1, 1, 0, 1] },
            { id: 'og', name: 'OG', tier: 1, region: 'EU', logo: '🌸', avgKills: 29, avgTowers: 7.8, avgDuration: 36, form: [1, 0, 1, 1, 0] },
            { id: 'lgd', name: 'PSG.LGD', tier: 1, region: 'CN', logo: '🐉', avgKills: 27, avgTowers: 8.5, avgDuration: 35, form: [1, 1, 0, 1, 1] },
            { id: 'tl', name: 'Team Liquid', tier: 1, region: 'EU', logo: '💧', avgKills: 30, avgTowers: 7.5, avgDuration: 37, form: [0, 1, 1, 1, 0] },
            { id: 'eg', name: 'Evil Geniuses', tier: 2, region: 'NA', logo: '⚡', avgKills: 28, avgTowers: 7.0, avgDuration: 39, form: [1, 0, 0, 1, 1] },
            { id: 'bb', name: 'BetBoom', tier: 1, region: 'CIS', logo: '💥', avgKills: 31, avgTowers: 8.0, avgDuration: 34, form: [1, 1, 1, 1, 0] },
            { id: 'fg', name: 'Falcons', tier: 1, region: 'MENA', logo: '🦅', avgKills: 33, avgTowers: 8.8, avgDuration: 40, form: [1, 1, 0, 0, 1] },
            { id: 'gg', name: 'Gaimin Gladiators', tier: 1, region: 'EU', logo: '⚔️', avgKills: 30, avgTowers: 7.6, avgDuration: 36, form: [0, 1, 1, 0, 1] },
            { id: 'xtm', name: 'Xtreme', tier: 2, region: 'SEA', logo: '🔥', avgKills: 34, avgTowers: 7.2, avgDuration: 41, form: [0, 0, 1, 1, 1] },
            { id: 'ta', name: 'Tundra', tier: 1, region: 'EU', logo: '❄️', avgKills: 26, avgTowers: 8.4, avgDuration: 33, form: [1, 1, 1, 0, 0] },
        ],
        lol: [
            { id: 't1', name: 'T1', tier: 1, region: 'KR', logo: '🔴', avgKills: 18, avgTowers: 9.0, avgDuration: 31, form: [1, 1, 1, 1, 0] },
            { id: 'geng', name: 'Gen.G', tier: 1, region: 'KR', logo: '🟡', avgKills: 16, avgTowers: 8.8, avgDuration: 30, form: [1, 1, 0, 1, 1] },
            { id: 'blg', name: 'BLG', tier: 1, region: 'CN', logo: '🟢', avgKills: 20, avgTowers: 8.5, avgDuration: 29, form: [1, 0, 1, 1, 1] },
            { id: 'hle', name: 'HLE', tier: 1, region: 'KR', logo: '🟠', avgKills: 17, avgTowers: 8.2, avgDuration: 32, form: [0, 1, 1, 0, 1] },
            { id: 'weibo', name: 'Weibo Gaming', tier: 1, region: 'CN', logo: '🐯', avgKills: 21, avgTowers: 7.8, avgDuration: 28, form: [1, 1, 0, 0, 1] },
            { id: 'fly', name: 'FlyQuest', tier: 2, region: 'NA', logo: '🦋', avgKills: 15, avgTowers: 7.5, avgDuration: 33, form: [0, 1, 0, 1, 0] },
            { id: 'fnc', name: 'Fnatic', tier: 2, region: 'EU', logo: '🟧', avgKills: 19, avgTowers: 7.9, avgDuration: 31, form: [1, 0, 1, 0, 1] },
            { id: 'jdg', name: 'JDG', tier: 1, region: 'CN', logo: '🏆', avgKills: 18, avgTowers: 8.6, avgDuration: 30, form: [1, 1, 1, 0, 0] },
            { id: 'drx', name: 'DRX', tier: 2, region: 'KR', logo: '🐲', avgKills: 16, avgTowers: 7.4, avgDuration: 34, form: [0, 0, 1, 1, 0] },
            { id: 'tes', name: 'TES', tier: 1, region: 'CN', logo: '⚡', avgKills: 22, avgTowers: 8.0, avgDuration: 27, form: [1, 1, 0, 1, 0] },
        ]
    };

    // ===== HEAD-TO-HEAD RECORDS =====
    const H2H = {};

    function getH2HKey(a, b) {
        return [a, b].sort().join('-');
    }

    function getH2H(teamA, teamB) {
        const key = getH2HKey(teamA.id, teamB.id);
        if (!H2H[key]) {
            // Generate realistic h2h
            const diff = (teamA.tier === teamB.tier) ? 0 : (teamA.tier < teamB.tier ? 1 : -1);
            const base = 5 + Math.floor(Math.random() * 6);
            const aWins = Math.max(1, base + diff * 2 + Math.floor(Math.random() * 3));
            const bWins = Math.max(1, base - diff * 2 + Math.floor(Math.random() * 3));
            H2H[key] = { a: teamA.id, aWins, b: teamB.id, bWins, total: aWins + bWins };
        }
        const rec = H2H[key];
        return rec.a === teamA.id
            ? { wins: rec.aWins, losses: rec.bWins, total: rec.total }
            : { wins: rec.bWins, losses: rec.aWins, total: rec.total };
    }

    // ===== PROBABILITY ENGINE =====

    function teamStrength(team) {
        const formScore = team.form.reduce((s, v, i) => s + v * (i + 1), 0) / 15; // Recent = more weight
        const tierScore = team.tier === 1 ? 0.7 : 0.4;
        return tierScore * 0.4 + formScore * 0.6;
    }

    function winProbability(teamA, teamB) {
        const sA = teamStrength(teamA);
        const sB = teamStrength(teamB);
        const h2h = getH2H(teamA, teamB);
        const h2hFactor = h2h.wins / h2h.total;

        // Bayesian combination: prior (strength) + evidence (h2h)
        const prior = sA / (sA + sB);
        const weight = Math.min(h2h.total / 20, 0.5); // More games = more weight
        return prior * (1 - weight) + h2hFactor * weight;
    }

    function predictKills(teamA, teamB) {
        const total = (teamA.avgKills + teamB.avgKills) / 2;
        const variance = total * 0.15;
        return { expected: total, low: total - variance, high: total + variance };
    }

    function predictTowers(teamA, teamB) {
        const total = teamA.avgTowers + teamB.avgTowers;
        const variance = total * 0.12;
        return { expected: total, low: total - variance, high: total + variance };
    }

    function predictDuration(teamA, teamB) {
        const avg = (teamA.avgDuration + teamB.avgDuration) / 2;
        const variance = avg * 0.1;
        return { expected: avg, low: avg - variance, high: avg + variance };
    }

    // ===== BET ANALYSIS — Pro-level =====

    function analyzeBetTypes(teamA, teamB, game) {
        const wp = winProbability(teamA, teamB);
        const kills = predictKills(teamA, teamB);
        const towers = predictTowers(teamA, teamB);
        const duration = predictDuration(teamA, teamB);

        const bets = [];

        // Kill Over/Under
        const killLine = game === 'dota2'
            ? Math.round(kills.expected * 2) + 0.5  // Dota total kills both teams
            : Math.round(kills.expected) + 0.5;

        const killOverProb = 0.5 + (kills.expected - killLine) / (kills.high - kills.low) * 0.3;
        const killUnderProb = 1 - killOverProb;
        const killOdds = 1.75 + Math.random() * 0.25;

        bets.push({
            type: 'kill_ou',
            label: game === 'dota2' ? 'Tài/Xỉu Mạng' : 'Tài/Xỉu Mạng',
            line: killLine,
            overProb: Math.min(0.85, Math.max(0.15, killOverProb)),
            underProb: Math.min(0.85, Math.max(0.15, killUnderProb)),
            odds: killOdds,
            pick: killOverProb > 0.55 ? 'over' : killUnderProb > 0.55 ? 'under' : null,
            pickProb: killOverProb > 0.55 ? killOverProb : killUnderProb > 0.55 ? killUnderProb : Math.max(killOverProb, killUnderProb),
        });

        // Tower Over/Under
        const towerLine = Math.round(towers.expected) + 0.5;
        const towerOverProb = 0.5 + (towers.expected - towerLine) / (towers.high - towers.low) * 0.3;
        const towerUnderProb = 1 - towerOverProb;
        const towerOdds = 1.80 + Math.random() * 0.2;

        bets.push({
            type: 'tower_ou',
            label: 'Tài/Xỉu Trụ',
            line: towerLine,
            overProb: Math.min(0.85, Math.max(0.15, towerOverProb)),
            underProb: Math.min(0.85, Math.max(0.15, towerUnderProb)),
            odds: towerOdds,
            pick: towerOverProb > 0.55 ? 'over' : towerUnderProb > 0.55 ? 'under' : null,
            pickProb: towerOverProb > 0.55 ? towerOverProb : towerUnderProb > 0.55 ? towerUnderProb : Math.max(towerOverProb, towerUnderProb),
        });

        // Time Over/Under
        const timeLine = Math.round(duration.expected) + 0.5;
        const timeOverProb = 0.5 + (duration.expected - timeLine) / (duration.high - duration.low) * 0.35;
        const timeUnderProb = 1 - timeOverProb;
        const timeOdds = 1.82 + Math.random() * 0.18;

        bets.push({
            type: 'time_ou',
            label: 'Tài/Xỉu Thời gian',
            line: timeLine,
            overProb: Math.min(0.85, Math.max(0.15, timeOverProb)),
            underProb: Math.min(0.85, Math.max(0.15, timeUnderProb)),
            odds: timeOdds,
            pick: timeOverProb > 0.55 ? 'over' : timeUnderProb > 0.55 ? 'under' : null,
            pickProb: timeOverProb > 0.55 ? timeOverProb : timeUnderProb > 0.55 ? timeUnderProb : Math.max(timeOverProb, timeUnderProb),
        });

        return bets;
    }

    function generateRecommendation(betAnalysis, bankroll) {
        // Find best bet — highest edge
        let bestBet = null;
        let bestEdge = -Infinity;

        for (const bet of betAnalysis) {
            if (!bet.pick) continue;
            const prob = bet.pickProb;
            const ev = prob * (bet.odds - 1) - (1 - prob);
            if (ev > bestEdge && prob >= 0.58) {  // PRO: Only bet if ≥58% confidence
                bestEdge = ev;
                bestBet = bet;
            }
        }

        if (!bestBet || bestEdge < 0.05) {
            return { action: 'SKIP', reason: 'Không có kèo có lợi thế rõ ràng (edge < 5%)', bestBet: null, amount: 0 };
        }

        // Kelly sizing
        const b = bestBet.odds - 1;
        const p = bestBet.pickProb;
        const q = 1 - p;
        const kellyFull = (b * p - q) / b;
        const kellyHalf = kellyFull / 2;  // Half-Kelly for safety

        // Confidence tier
        let confTier, sizing;
        if (p >= 0.72) {
            confTier = 'elite';
            sizing = Math.min(kellyHalf * 1.2, 0.20);
        } else if (p >= 0.65) {
            confTier = 'high';
            sizing = Math.min(kellyHalf, 0.15);
        } else if (p >= 0.58) {
            confTier = 'medium';
            sizing = Math.min(kellyHalf * 0.7, 0.10);
        } else {
            confTier = 'skip';
            sizing = 0;
        }

        const amount = Math.round(bankroll * sizing / 10000) * 10000; // Round to 10k
        if (amount < 50000) {
            return { action: 'SKIP', reason: 'Mức cược quá nhỏ, chờ kèo tốt hơn', bestBet, amount: 0 };
        }

        const pickLabel = bestBet.pick === 'over' ? `Tài (>${bestBet.line})` : `Xỉu (<${bestBet.line})`;

        return {
            action: 'BET',
            bestBet,
            betType: bestBet.type,
            betLabel: bestBet.label,
            pick: bestBet.pick,
            pickLabel,
            probability: bestBet.pickProb,
            edge: bestEdge,
            kelly: kellyHalf,
            confTier,
            amount,
            odds: bestBet.odds,
            reason: buildReason(bestBet, bestEdge, confTier),
        };
    }

    function buildReason(bet, edge, tier) {
        const edgePct = (edge * 100).toFixed(1);
        const probPct = (bet.pickProb * 100).toFixed(0);
        const tierMap = { elite: '🔥 Edge cực mạnh', high: '✅ Edge tốt', medium: '⚡ Edge vừa' };
        return `${tierMap[tier]} — Xác suất ${probPct}%, Edge +${edgePct}%, Odds ${bet.odds.toFixed(2)}`;
    }

    // ===== DAILY MATCH GENERATION =====

    function generateDailyMatches(dateStr) {
        const seed = hashCode(dateStr);
        const rng = seededRandom(seed);

        const matches = [];
        const usedDota = new Set();
        const usedLol = new Set();

        // Generate 4-6 Dota 2 matches
        const dotaCount = 4 + Math.floor(rng() * 3);
        for (let i = 0; i < dotaCount; i++) {
            const [a, b] = pickTwoTeams(TEAMS.dota2, usedDota, rng);
            if (!a || !b) break;
            const time = `${14 + Math.floor(rng() * 8)}:${rng() > 0.5 ? '00' : '30'}`;
            const bets = analyzeBetTypes(a, b, 'dota2');
            matches.push({
                id: `d2_${dateStr}_${i}`,
                game: 'dota2',
                teamA: a,
                teamB: b,
                time,
                bets,
                status: 'upcoming', // upcoming | live | finished
                result: null,
            });
        }

        // Generate 3-5 LoL matches
        const lolCount = 3 + Math.floor(rng() * 3);
        for (let i = 0; i < lolCount; i++) {
            const [a, b] = pickTwoTeams(TEAMS.lol, usedLol, rng);
            if (!a || !b) break;
            const time = `${15 + Math.floor(rng() * 7)}:${rng() > 0.5 ? '00' : '30'}`;
            const bets = analyzeBetTypes(a, b, 'lol');
            matches.push({
                id: `lol_${dateStr}_${i}`,
                game: 'lol',
                teamA: a,
                teamB: b,
                time,
                bets,
                status: 'upcoming',
                result: null,
            });
        }

        // Sort by time
        matches.sort((a, b) => a.time.localeCompare(b.time));
        return matches;
    }

    function pickTwoTeams(pool, used, rng) {
        const available = pool.filter(t => !used.has(t.id));
        if (available.length < 2) return [null, null];
        const shuffled = available.sort(() => rng() - 0.5);
        used.add(shuffled[0].id);
        used.add(shuffled[1].id);
        return [shuffled[0], shuffled[1]];
    }

    function hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    }

    function seededRandom(seed) {
        return () => {
            seed = (seed * 16807 + 0) % 2147483647;
            return seed / 2147483647;
        };
    }

    // ===== STATE MANAGEMENT =====

    function defaultState() {
        return {
            capital: 10000000,      // 10M VND
            initialCapital: 10000000,
            bets: [],               // { matchId, betType, pick, amount, odds, result, pnl, timestamp }
            dailyMatches: {},       // { 'YYYY-MM-DD': [...matches] }
            currentDate: todayStr(),
        };
    }

    function todayStr() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return defaultState();
            const s = JSON.parse(raw);
            // Ensure all fields exist
            return { ...defaultState(), ...s };
        } catch {
            return defaultState();
        }
    }

    function saveState(state) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function resetState() {
        localStorage.removeItem(STORAGE_KEY);
        return defaultState();
    }

    // ===== MATCH RESULT SIMULATION =====

    function simulateResult(match) {
        const kills = predictKills(match.teamA, match.teamB);
        const towers = predictTowers(match.teamA, match.teamB);
        const duration = predictDuration(match.teamA, match.teamB);

        // Add realistic variance
        const actualKills = Math.round(kills.expected + (Math.random() - 0.5) * (kills.high - kills.low) * 1.5);
        const actualTowers = Math.round(towers.expected + (Math.random() - 0.5) * (towers.high - towers.low) * 1.5);
        const actualDuration = Math.round(duration.expected + (Math.random() - 0.5) * (duration.high - duration.low) * 1.5);

        return {
            kills: Math.max(10, actualKills),
            towers: Math.max(4, actualTowers),
            duration: Math.max(15, actualDuration),
        };
    }

    function resolveBet(bet, matchResult) {
        let won = false;
        switch (bet.betType) {
            case 'kill_ou':
                won = bet.pick === 'over'
                    ? matchResult.kills > bet.line
                    : matchResult.kills < bet.line;
                break;
            case 'tower_ou':
                won = bet.pick === 'over'
                    ? matchResult.towers > bet.line
                    : matchResult.towers < bet.line;
                break;
            case 'time_ou':
                won = bet.pick === 'over'
                    ? matchResult.duration > bet.line
                    : matchResult.duration < bet.line;
                break;
        }
        return {
            won,
            pnl: won ? Math.round(bet.amount * (bet.odds - 1)) : -bet.amount,
        };
    }

    // ===== STATISTICS =====

    function calcDailyPL(bets, dateStr) {
        return bets
            .filter(b => b.timestamp && b.timestamp.startsWith(dateStr) && b.result !== null)
            .reduce((sum, b) => sum + (b.pnl || 0), 0);
    }

    function calcWeeklyPL(bets) {
        const now = new Date();
        const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
        return bets
            .filter(b => b.result !== null && new Date(b.timestamp) >= weekAgo)
            .reduce((sum, b) => sum + (b.pnl || 0), 0);
    }

    function calcWinRate(bets) {
        const resolved = bets.filter(b => b.result !== null);
        if (resolved.length === 0) return 0;
        const wins = resolved.filter(b => b.result === 'win').length;
        return wins / resolved.length;
    }

    function calcStats(bets, capital, initialCapital) {
        const resolved = bets.filter(b => b.result !== null);
        const wins = resolved.filter(b => b.result === 'win').length;
        const losses = resolved.filter(b => b.result === 'loss').length;
        const totalPL = resolved.reduce((s, b) => s + (b.pnl || 0), 0);
        const roi = initialCapital > 0 ? (totalPL / initialCapital) * 100 : 0;
        const avgBet = resolved.length > 0 ? resolved.reduce((s, b) => s + b.amount, 0) / resolved.length : 0;

        return {
            total: resolved.length,
            wins,
            losses,
            winRate: resolved.length > 0 ? (wins / resolved.length * 100).toFixed(1) : '0',
            totalPL,
            roi: roi.toFixed(1),
            avgBet,
            streak: calcStreak(resolved),
        };
    }

    function calcStreak(bets) {
        if (bets.length === 0) return { current: 0, type: 'none' };
        let count = 1;
        const last = bets[bets.length - 1].result;
        for (let i = bets.length - 2; i >= 0; i--) {
            if (bets[i].result === last) count++;
            else break;
        }
        return { current: count, type: last };
    }

    function getDailyHistory(bets) {
        const days = {};
        for (const bet of bets) {
            if (!bet.timestamp || bet.result === null) continue;
            const day = bet.timestamp.slice(0, 10);
            if (!days[day]) days[day] = { date: day, bets: 0, wins: 0, pnl: 0 };
            days[day].bets++;
            if (bet.result === 'win') days[day].wins++;
            days[day].pnl += bet.pnl || 0;
        }
        return Object.values(days).sort((a, b) => b.date.localeCompare(a.date));
    }

    // ===== FORMAT HELPERS =====

    function fmt(n) {
        if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + 'B';
        if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
        if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(0) + 'k';
        return n.toString();
    }

    function fmtFull(n) {
        return new Intl.NumberFormat('vi-VN').format(n);
    }

    // ===== PUBLIC API =====
    return {
        TEAMS, loadState, saveState, resetState, defaultState,
        generateDailyMatches, generateRecommendation, analyzeBetTypes,
        winProbability, simulateResult, resolveBet,
        calcDailyPL, calcWeeklyPL, calcWinRate, calcStats, getDailyHistory,
        todayStr, fmt, fmtFull, getH2H, teamStrength,
    };
})();
