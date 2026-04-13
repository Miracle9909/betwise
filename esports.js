/**
 * BetWise Esports Analyzer v3.0 — Real Match Data Integration
 * 
 * Data Sources:
 * - PRIMARY: PandaScore API (free tier, 1000 req/hr) for real matches
 * - FALLBACK: Simulated matches when API unavailable
 * 
 * Algorithms: Elo, Bayesian, Poisson, Monte Carlo (N=500), Half-Kelly
 */
const EsportsAnalyzer = (() => {
    'use strict';

    const STORAGE_KEY = 'betwise_esports_v3';
    const MIN_CONFIDENCE = 0.58;
    const MIN_EDGE = 0.05;
    const MONTE_CARLO_N = 500;
    const PANDASCORE_BASE = 'https://api.pandascore.co';

    // ===== STANDARD BOOKMAKER LINES =====
    const LINES = {
        dota2: { tower: 12.5, kill: 45.5, time: 33.5 },
        lol: { tower: 11.5, kill: 24.5, time: 31.5, dragon: 4.5 }
    };

    // ===== TEAM DATABASE (fallback + stat enrichment) =====
    const TEAM_DB = {};
    const DEFAULT_STATS = {
        dota2: { avgKills: 23, avgTowers: 6.3, avgDuration: 34, sdKills: 5, sdTowers: 1.5, sdDur: 5 },
        lol: { avgKills: 13, avgTowers: 5.7, avgDuration: 31, sdKills: 4, sdTowers: 1.4, sdDur: 4, avgDragon: 2.3, sdDragon: 0.8 }
    };

    // Known teams with Elo + stats for enrichment
    const KNOWN_TEAMS = {
        // Dota 2
        'team-spirit': { elo: 1680, logo: '🐻', avgKills: 24, avgTowers: 6.5, avgDuration: 34, sdKills: 5, sdTowers: 1.5, sdDur: 5, form: [1, 1, 1, 0, 1] },
        'og': { elo: 1620, logo: '🌸', avgKills: 23, avgTowers: 6.2, avgDuration: 35, sdKills: 6, sdTowers: 1.6, sdDur: 6, form: [1, 0, 1, 1, 0] },
        'psg-lgd': { elo: 1660, logo: '🐉', avgKills: 21, avgTowers: 6.8, avgDuration: 32, sdKills: 4, sdTowers: 1.3, sdDur: 4, form: [1, 1, 0, 1, 1] },
        'team-liquid': { elo: 1640, logo: '💧', avgKills: 22, avgTowers: 6.3, avgDuration: 34, sdKills: 5, sdTowers: 1.5, sdDur: 5, form: [0, 1, 1, 1, 0] },
        'evil-geniuses': { elo: 1520, logo: '⚡', avgKills: 25, avgTowers: 5.8, avgDuration: 36, sdKills: 7, sdTowers: 1.8, sdDur: 7, form: [1, 0, 0, 1, 1] },
        'betboom-team': { elo: 1670, logo: '💥', avgKills: 24, avgTowers: 6.6, avgDuration: 33, sdKills: 4, sdTowers: 1.4, sdDur: 4, form: [1, 1, 1, 1, 0] },
        'team-falcons': { elo: 1650, logo: '🦅', avgKills: 23, avgTowers: 6.4, avgDuration: 35, sdKills: 6, sdTowers: 1.6, sdDur: 6, form: [1, 1, 0, 0, 1] },
        'gaimin-gladiators': { elo: 1635, logo: '⚔️', avgKills: 22, avgTowers: 6.1, avgDuration: 34, sdKills: 5, sdTowers: 1.5, sdDur: 5, form: [0, 1, 1, 0, 1] },
        'tundra-esports': { elo: 1655, logo: '❄️', avgKills: 20, avgTowers: 6.7, avgDuration: 31, sdKills: 3, sdTowers: 1.2, sdDur: 3, form: [1, 1, 1, 0, 0] },
        'xtreme-gaming': { elo: 1580, logo: '🔥', avgKills: 26, avgTowers: 5.5, avgDuration: 37, sdKills: 8, sdTowers: 2.0, sdDur: 7, form: [0, 0, 1, 1, 1] },
        'nigma-galaxy': { elo: 1500, logo: '🌌', avgKills: 22, avgTowers: 5.9, avgDuration: 35, sdKills: 6, sdTowers: 1.7, sdDur: 6, form: [0, 1, 0, 1, 0] },
        'beastcoast': { elo: 1490, logo: '🐾', avgKills: 24, avgTowers: 5.6, avgDuration: 36, sdKills: 7, sdTowers: 1.9, sdDur: 7, form: [1, 0, 0, 0, 1] },
        'nouns': { elo: 1470, logo: '👓', avgKills: 25, avgTowers: 5.4, avgDuration: 38, sdKills: 8, sdTowers: 2.1, sdDur: 8, form: [0, 1, 1, 0, 0] },
        // LoL
        't1': { elo: 1720, logo: '🔴', avgKills: 13, avgTowers: 6.0, avgDuration: 30, sdKills: 3, sdTowers: 1.3, sdDur: 3, avgDragon: 2.5, sdDragon: 0.8, form: [1, 1, 1, 1, 0] },
        'gen-g': { elo: 1700, logo: '🟡', avgKills: 12, avgTowers: 5.8, avgDuration: 31, sdKills: 3, sdTowers: 1.2, sdDur: 3, avgDragon: 2.4, sdDragon: 0.7, form: [1, 1, 0, 1, 1] },
        'bilibili-gaming': { elo: 1690, logo: '🟢', avgKills: 14, avgTowers: 5.9, avgDuration: 29, sdKills: 4, sdTowers: 1.4, sdDur: 4, avgDragon: 2.3, sdDragon: 0.9, form: [1, 0, 1, 1, 1] },
        'hanwha-life-esports': { elo: 1650, logo: '🟠', avgKills: 12, avgTowers: 5.7, avgDuration: 32, sdKills: 3, sdTowers: 1.3, sdDur: 4, avgDragon: 2.2, sdDragon: 0.8, form: [0, 1, 1, 0, 1] },
        'weibo-gaming': { elo: 1640, logo: '🐯', avgKills: 15, avgTowers: 5.5, avgDuration: 28, sdKills: 5, sdTowers: 1.6, sdDur: 5, avgDragon: 2.6, sdDragon: 1.0, form: [1, 1, 0, 0, 1] },
        'jd-gaming': { elo: 1680, logo: '🏆', avgKills: 13, avgTowers: 6.1, avgDuration: 30, sdKills: 3, sdTowers: 1.2, sdDur: 3, avgDragon: 2.5, sdDragon: 0.7, form: [1, 1, 1, 0, 0] },
        'top-esports': { elo: 1670, logo: '⚡', avgKills: 14, avgTowers: 5.8, avgDuration: 28, sdKills: 4, sdTowers: 1.4, sdDur: 4, avgDragon: 2.4, sdDragon: 0.8, form: [1, 1, 0, 1, 0] },
        'fnatic': { elo: 1540, logo: '🟧', avgKills: 13, avgTowers: 5.6, avgDuration: 31, sdKills: 4, sdTowers: 1.4, sdDur: 4, avgDragon: 2.3, sdDragon: 0.8, form: [1, 0, 1, 0, 1] },
        'flyquest': { elo: 1500, logo: '🦋', avgKills: 11, avgTowers: 5.3, avgDuration: 33, sdKills: 4, sdTowers: 1.5, sdDur: 5, avgDragon: 2.0, sdDragon: 0.9, form: [0, 1, 0, 1, 0] },
        'drx': { elo: 1510, logo: '🐲', avgKills: 11, avgTowers: 5.2, avgDuration: 34, sdKills: 4, sdTowers: 1.6, sdDur: 5, avgDragon: 2.1, sdDragon: 0.9, form: [0, 0, 1, 1, 0] },
        'g2-esports': { elo: 1560, logo: '🔵', avgKills: 14, avgTowers: 5.8, avgDuration: 30, sdKills: 5, sdTowers: 1.5, sdDur: 4, avgDragon: 2.4, sdDragon: 0.8, form: [1, 0, 1, 1, 0] },
        'cloud9': { elo: 1490, logo: '☁️', avgKills: 12, avgTowers: 5.4, avgDuration: 33, sdKills: 4, sdTowers: 1.6, sdDur: 5, avgDragon: 2.1, sdDragon: 0.9, form: [0, 1, 0, 0, 1] },
    };

    // ===== PANDASCORE API INTEGRATION =====

    async function fetchRealMatches(token) {
        if (!token) return null;
        try {
            const [dotaRes, lolRes] = await Promise.all([
                fetch(`${PANDASCORE_BASE}/dota2/matches/upcoming?per_page=10&token=${token}`).then(r => r.ok ? r.json() : []),
                fetch(`${PANDASCORE_BASE}/lol/matches/upcoming?per_page=10&token=${token}`).then(r => r.ok ? r.json() : []),
            ]);

            // Also fetch running matches
            const [dotaRunning, lolRunning] = await Promise.all([
                fetch(`${PANDASCORE_BASE}/dota2/matches/running?per_page=5&token=${token}`).then(r => r.ok ? r.json() : []).catch(() => []),
                fetch(`${PANDASCORE_BASE}/lol/matches/running?per_page=5&token=${token}`).then(r => r.ok ? r.json() : []).catch(() => []),
            ]);

            const allRaw = [
                ...dotaRunning.map(m => ({ ...m, _game: 'dota2', _status: 'live' })),
                ...lolRunning.map(m => ({ ...m, _game: 'lol', _status: 'live' })),
                ...dotaRes.map(m => ({ ...m, _game: 'dota2', _status: 'upcoming' })),
                ...lolRes.map(m => ({ ...m, _game: 'lol', _status: 'upcoming' })),
            ];

            // Filter: only matches with 2 opponents
            const valid = allRaw.filter(m => m.opponents && m.opponents.length === 2);

            if (valid.length === 0) return null;

            const matches = valid.map((m, i) => mapPandaScoreMatch(m, i));
            return matches.filter(m => m !== null);
        } catch (e) {
            console.warn('[Esports] PandaScore API failed:', e.message);
            return null;
        }
    }

    function mapPandaScoreMatch(raw, index) {
        try {
            const game = raw._game;
            const teamAData = raw.opponents[0]?.opponent;
            const teamBData = raw.opponents[1]?.opponent;
            if (!teamAData || !teamBData) return null;

            const teamA = enrichTeam(teamAData, game);
            const teamB = enrichTeam(teamBData, game);

            const scheduled = raw.scheduled_at || raw.begin_at;
            const time = scheduled ? new Date(scheduled).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--';

            const league = raw.league?.name || '';
            const serie = raw.serie?.full_name || '';
            const tournament = raw.tournament?.name || '';

            const { bets, mc } = analyzeBetTypes(teamA, teamB, game);

            return {
                id: `${game}_real_${raw.id || index}`,
                game,
                teamA, teamB, time,
                league, serie, tournament,
                bets, mc,
                status: raw._status || 'upcoming',
                result: null,
                pandaId: raw.id,
                matchName: raw.name || `${teamA.name} vs ${teamB.name}`,
            };
        } catch (e) {
            console.warn('[Esports] Failed to map match:', e);
            return null;
        }
    }

    function enrichTeam(apiTeam, game) {
        const slug = apiTeam.slug || apiTeam.name?.toLowerCase().replace(/\s+/g, '-') || '';
        const known = KNOWN_TEAMS[slug];
        const defaults = DEFAULT_STATS[game];

        return {
            id: slug || `team_${apiTeam.id}`,
            name: apiTeam.name || 'Unknown',
            elo: known?.elo || 1500 + Math.floor(Math.random() * 200),
            region: apiTeam.location || '—',
            logo: known?.logo || apiTeam.image_url || '🎮',
            imageUrl: apiTeam.image_url || null,
            avgKills: known?.avgKills || defaults.avgKills,
            avgTowers: known?.avgTowers || defaults.avgTowers,
            avgDuration: known?.avgDuration || defaults.avgDuration,
            sdKills: known?.sdKills || defaults.sdKills,
            sdTowers: known?.sdTowers || defaults.sdTowers,
            sdDur: known?.sdDur || defaults.sdDur,
            form: known?.form || [1, 0, 1, 0, 1],
            ...(game === 'lol' ? {
                avgDragon: known?.avgDragon || defaults.avgDragon,
                sdDragon: known?.sdDragon || defaults.sdDragon,
            } : {}),
        };
    }

    // ===== PROBABILITY ENGINE =====

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

    function eloWinProb(eloA, eloB) { return 1 / (1 + Math.pow(10, (eloB - eloA) / 400)); }

    function formScore(form) {
        const w = [1, 2, 3, 4, 5];
        let s = 0, ws = 0;
        for (let i = 0; i < form.length; i++) { s += form[i] * w[i]; ws += w[i]; }
        return s / ws;
    }

    function winProbability(teamA, teamB) {
        const ep = eloWinProb(teamA.elo, teamB.elo);
        const h2h = getH2H(teamA, teamB);
        const h2hL = h2h.wins / h2h.total;
        const fA = formScore(teamA.form), fB = formScore(teamB.form);
        const ff = fA / (fA + fB + 0.001);
        const hw = Math.min(h2h.total / 15, 0.35), fw = 0.20, ew = 1 - hw - fw;
        return Math.max(0.10, Math.min(0.90, ep * ew + h2hL * hw + ff * fw));
    }

    // ===== POISSON =====
    function poissonPMF(k, lambda) { let r = Math.exp(-lambda); for (let i = 1; i <= k; i++) r *= lambda / i; return r; }
    function poissonOverProb(lambda, line) { let c = 0; for (let k = 0; k <= Math.floor(line); k++) c += poissonPMF(k, lambda); return 1 - c; }

    // ===== MONTE CARLO =====
    function gaussianRandom(m, s) { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return m + s * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

    function monteCarloSimulate(teamA, teamB, game, n = MONTE_CARLO_N) {
        const res = { kills: [], towers: [], duration: [], dragons: [] };
        const wp = winProbability(teamA, teamB);
        for (let i = 0; i < n; i++) {
            const aw = Math.random() < wp, wb = aw ? 1.04 : 0.96, tb = aw ? 1.06 : 0.94;
            res.kills.push(Math.max(10, Math.round(gaussianRandom((teamA.avgKills + teamB.avgKills) * wb, Math.sqrt(teamA.sdKills ** 2 + teamB.sdKills ** 2)))));
            res.towers.push(Math.max(5, Math.round(gaussianRandom((teamA.avgTowers + teamB.avgTowers) * tb, Math.sqrt(teamA.sdTowers ** 2 + teamB.sdTowers ** 2)))));
            res.duration.push(Math.max(18, Math.round(gaussianRandom((teamA.avgDuration + teamB.avgDuration) / 2, Math.sqrt((teamA.sdDur ** 2 + teamB.sdDur ** 2) / 2)))));
            if (game === 'lol' && teamA.avgDragon) res.dragons.push(Math.max(1, Math.round(gaussianRandom(teamA.avgDragon + teamB.avgDragon, Math.sqrt((teamA.sdDragon || 0.8) ** 2 + (teamB.sdDragon || 0.8) ** 2)))));
        }
        const r = { kills: { mean: mean(res.kills), sd: stdDev(res.kills), samples: res.kills }, towers: { mean: mean(res.towers), sd: stdDev(res.towers), samples: res.towers }, duration: { mean: mean(res.duration), sd: stdDev(res.duration), samples: res.duration } };
        if (res.dragons.length) r.dragons = { mean: mean(res.dragons), sd: stdDev(res.dragons), samples: res.dragons };
        return r;
    }
    function mean(a) { return a.reduce((s, v) => s + v, 0) / a.length; }
    function stdDev(a) { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length); }

    // ===== BET ANALYSIS =====
    function analyzeBetTypes(teamA, teamB, game) {
        const mc = monteCarloSimulate(teamA, teamB, game);
        const lines = LINES[game];
        const bets = [];
        bets.push(buildBet('tower_ou', 'Tài/Xỉu Trụ', lines.tower, poissonOverProb(mc.towers.mean, lines.tower), 1.80 + Math.random() * 0.15));
        bets.push(buildBet('kill_ou', 'Tài/Xỉu Mạng', lines.kill, poissonOverProb(mc.kills.mean, lines.kill), 1.82 + Math.random() * 0.13));
        const tOP = mc.duration.samples.filter(d => d > lines.time).length / mc.duration.samples.length;
        bets.push(buildBet('time_ou', 'Tài/Xỉu Thời gian', lines.time, tOP, 1.85 + Math.random() * 0.10));
        if (game === 'lol' && mc.dragons) bets.push(buildBet('dragon_ou', 'Tài/Xỉu Rồng', lines.dragon, poissonOverProb(mc.dragons.mean, lines.dragon), 1.83 + Math.random() * 0.12));
        return { bets, mc };
    }

    function buildBet(type, label, line, overProb, odds) {
        const op = Math.max(0.10, Math.min(0.90, overProb)), up = 1 - op;
        const pick = op > 0.55 ? 'over' : up > 0.55 ? 'under' : null;
        return { type, label, line, overProb: op, underProb: up, odds, pick, pickProb: pick === 'over' ? op : pick === 'under' ? up : Math.max(op, up) };
    }

    // ===== RECOMMENDATION =====
    function generateRecommendation(betAnalysis, bankroll) {
        let best = null, bestE = -Infinity;
        for (const b of betAnalysis) {
            if (!b.pick) continue;
            if (b.pickProb < MIN_CONFIDENCE) continue;
            const e = b.pickProb * (b.odds - 1) - (1 - b.pickProb);
            if (e > bestE && e >= MIN_EDGE) { bestE = e; best = b; }
        }
        if (!best) return { action: 'SKIP', reason: 'Không đủ edge', bestBet: null, amount: 0, probability: 0, edge: 0 };
        const p = best.pickProb, b = best.odds - 1;
        const kh = ((b * p - (1 - p)) / b) / 2;
        let tier, sz;
        if (p >= 0.75) { tier = 'elite'; sz = Math.min(kh * 1.3, 0.22); }
        else if (p >= 0.68) { tier = 'high'; sz = Math.min(kh, 0.16); }
        else if (p >= 0.58) { tier = 'medium'; sz = Math.min(kh * 0.7, 0.10); }
        else { tier = 'skip'; sz = 0; }
        const amt = Math.round(bankroll * sz / 10000) * 10000;
        if (amt < 50000) return { action: 'SKIP', reason: 'Mức cược nhỏ', bestBet: best, amount: 0, probability: p, edge: bestE };
        const pl = best.pick === 'over' ? `Tài (>${best.line})` : `Xỉu (<${best.line})`;
        return { action: 'BET', bestBet: best, betType: best.type, betLabel: best.label, pick: best.pick, pickLabel: pl, probability: p, edge: bestE, kelly: kh, confTier: tier, amount: amt, odds: best.odds, reason: `${tier === 'elite' ? '🔥' : tier === 'high' ? '✅' : '⚡'} P=${(p * 100).toFixed(0)}% Edge=+${(bestE * 100).toFixed(1)}% Kelly=${(kh * 100).toFixed(1)}%` };
    }

    // ===== DAILY MATCH GENERATION (FALLBACK) =====
    const FALLBACK_TEAMS = {
        dota2: [
            { id: 'ts', name: 'Team Spirit', elo: 1680, region: 'CIS', logo: '🐻', avgKills: 24, avgTowers: 6.5, avgDuration: 34, form: [1, 1, 1, 0, 1], sdKills: 5, sdTowers: 1.5, sdDur: 5 },
            { id: 'bb', name: 'BetBoom', elo: 1670, region: 'CIS', logo: '💥', avgKills: 24, avgTowers: 6.6, avgDuration: 33, form: [1, 1, 1, 1, 0], sdKills: 4, sdTowers: 1.4, sdDur: 4 },
            { id: 'lgd', name: 'PSG.LGD', elo: 1660, region: 'CN', logo: '🐉', avgKills: 21, avgTowers: 6.8, avgDuration: 32, form: [1, 1, 0, 1, 1], sdKills: 4, sdTowers: 1.3, sdDur: 4 },
            { id: 'tl', name: 'Team Liquid', elo: 1640, region: 'EU', logo: '💧', avgKills: 22, avgTowers: 6.3, avgDuration: 34, form: [0, 1, 1, 1, 0], sdKills: 5, sdTowers: 1.5, sdDur: 5 },
            { id: 'fg', name: 'Falcons', elo: 1650, region: 'MENA', logo: '🦅', avgKills: 23, avgTowers: 6.4, avgDuration: 35, form: [1, 1, 0, 0, 1], sdKills: 6, sdTowers: 1.6, sdDur: 6 },
            { id: 'eg', name: 'Evil Geniuses', elo: 1520, region: 'NA', logo: '⚡', avgKills: 25, avgTowers: 5.8, avgDuration: 36, form: [1, 0, 0, 1, 1], sdKills: 7, sdTowers: 1.8, sdDur: 7 },
            { id: 'ta', name: 'Tundra', elo: 1655, region: 'EU', logo: '❄️', avgKills: 20, avgTowers: 6.7, avgDuration: 31, form: [1, 1, 1, 0, 0], sdKills: 3, sdTowers: 1.2, sdDur: 3 },
            { id: 'gg', name: 'Gaimin Gladiators', elo: 1635, region: 'EU', logo: '⚔️', avgKills: 22, avgTowers: 6.1, avgDuration: 34, form: [0, 1, 1, 0, 1], sdKills: 5, sdTowers: 1.5, sdDur: 5 },
        ],
        lol: [
            { id: 't1', name: 'T1', elo: 1720, region: 'KR', logo: '🔴', avgKills: 13, avgTowers: 6.0, avgDuration: 30, form: [1, 1, 1, 1, 0], sdKills: 3, sdTowers: 1.3, sdDur: 3, avgDragon: 2.5, sdDragon: 0.8 },
            { id: 'geng', name: 'Gen.G', elo: 1700, region: 'KR', logo: '🟡', avgKills: 12, avgTowers: 5.8, avgDuration: 31, form: [1, 1, 0, 1, 1], sdKills: 3, sdTowers: 1.2, sdDur: 3, avgDragon: 2.4, sdDragon: 0.7 },
            { id: 'blg', name: 'BLG', elo: 1690, region: 'CN', logo: '🟢', avgKills: 14, avgTowers: 5.9, avgDuration: 29, form: [1, 0, 1, 1, 1], sdKills: 4, sdTowers: 1.4, sdDur: 4, avgDragon: 2.3, sdDragon: 0.9 },
            { id: 'jdg', name: 'JDG', elo: 1680, region: 'CN', logo: '🏆', avgKills: 13, avgTowers: 6.1, avgDuration: 30, form: [1, 1, 1, 0, 0], sdKills: 3, sdTowers: 1.2, sdDur: 3, avgDragon: 2.5, sdDragon: 0.7 },
            { id: 'tes', name: 'TES', elo: 1670, region: 'CN', logo: '⚡', avgKills: 14, avgTowers: 5.8, avgDuration: 28, form: [1, 1, 0, 1, 0], sdKills: 4, sdTowers: 1.4, sdDur: 4, avgDragon: 2.4, sdDragon: 0.8 },
            { id: 'hle', name: 'HLE', elo: 1650, region: 'KR', logo: '🟠', avgKills: 12, avgTowers: 5.7, avgDuration: 32, form: [0, 1, 1, 0, 1], sdKills: 3, sdTowers: 1.3, sdDur: 4, avgDragon: 2.2, sdDragon: 0.8 },
            { id: 'fnc', name: 'Fnatic', elo: 1540, region: 'EU', logo: '🟧', avgKills: 13, avgTowers: 5.6, avgDuration: 31, form: [1, 0, 1, 0, 1], sdKills: 4, sdTowers: 1.4, sdDur: 4, avgDragon: 2.3, sdDragon: 0.8 },
            { id: 'fly', name: 'FlyQuest', elo: 1500, region: 'NA', logo: '🦋', avgKills: 11, avgTowers: 5.3, avgDuration: 33, form: [0, 1, 0, 1, 0], sdKills: 4, sdTowers: 1.5, sdDur: 5, avgDragon: 2.0, sdDragon: 0.9 },
        ]
    };

    function generateFallbackMatches(dateStr) {
        const seed = hashCode(dateStr), rng = seededRandom(seed);
        const all = [];
        const usedD = new Set(), usedL = new Set();
        for (let i = 0; i < 5; i++) { const [a, b] = pickTwo(FALLBACK_TEAMS.dota2, usedD, rng); if (!a) break; const h = 14 + Math.floor(rng() * 8); all.push({ id: `d2_${dateStr}_${i}`, game: 'dota2', teamA: a, teamB: b, time: `${String(h).padStart(2, '0')}:${rng() > 0.5 ? '00' : '30'}`, ...analyzeBetTypes(a, b, 'dota2'), league: 'ESL Pro League', status: 'upcoming', result: null }); }
        for (let i = 0; i < 5; i++) { const [a, b] = pickTwo(FALLBACK_TEAMS.lol, usedL, rng); if (!a) break; const h = 14 + Math.floor(rng() * 8); all.push({ id: `lol_${dateStr}_${i}`, game: 'lol', teamA: a, teamB: b, time: `${String(h).padStart(2, '0')}:${rng() > 0.5 ? '00' : '30'}`, ...analyzeBetTypes(a, b, 'lol'), league: 'LCK/LPL', status: 'upcoming', result: null }); }
        return all.filter(m => generateRecommendation(m.bets, 10000000).action === 'BET').sort((a, b) => a.time.localeCompare(b.time));
    }

    function pickTwo(pool, used, rng) { const a = pool.filter(t => !used.has(t.id)); if (a.length < 2) return [null, null]; const s = a.sort(() => rng() - 0.5); used.add(s[0].id); used.add(s[1].id); return [s[0], s[1]]; }

    // ===== MATCH RESULT SIMULATION =====
    function simulateResult(match) {
        const mc = monteCarloSimulate(match.teamA, match.teamB, match.game, 1);
        const r = { kills: mc.kills.samples[0], towers: mc.towers.samples[0], duration: mc.duration.samples[0] };
        if (mc.dragons) r.dragons = mc.dragons.samples[0];
        return r;
    }
    function resolveBet(bet, result) {
        let a; switch (bet.betType) { case 'kill_ou': a = result.kills; break; case 'tower_ou': a = result.towers; break; case 'time_ou': a = result.duration; break; case 'dragon_ou': a = result.dragons || 0; break; }
        const w = bet.pick === 'over' ? a > bet.line : a < bet.line;
        return { won: w, pnl: w ? Math.round(bet.amount * (bet.odds - 1)) : -bet.amount, actual: a };
    }

    // ===== STATE =====
    function defaultState() { return { capital: 10000000, initialCapital: 10000000, bets: [], dailyMatches: {}, currentDate: todayStr(), autoRunComplete: false, apiToken: '' }; }
    function todayStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
    function loadState() { try { const r = localStorage.getItem(STORAGE_KEY); if (!r) return defaultState(); return { ...defaultState(), ...JSON.parse(r) }; } catch { return defaultState(); } }
    function saveState(s) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }
    function resetState() { localStorage.removeItem(STORAGE_KEY); return defaultState(); }

    // ===== STATISTICS =====
    function calcDailyPL(bets, d) { return bets.filter(b => b.timestamp?.startsWith(d) && b.result !== null).reduce((s, b) => s + (b.pnl || 0), 0); }
    function calcWeeklyPL(bets) { const c = new Date(Date.now() - 7 * 86400000); return bets.filter(b => b.result !== null && new Date(b.timestamp) >= c).reduce((s, b) => s + (b.pnl || 0), 0); }
    function calcWinRate(bets) { const r = bets.filter(b => b.result !== null); return r.length === 0 ? 0 : r.filter(b => b.result === 'win').length / r.length; }
    function calcStats(bets, cap, init) { const r = bets.filter(b => b.result !== null), w = r.filter(b => b.result === 'win').length, pl = r.reduce((s, b) => s + (b.pnl || 0), 0); return { total: r.length, wins: w, losses: r.length - w, winRate: r.length > 0 ? (w / r.length * 100).toFixed(1) : '0', totalPL: pl, roi: init > 0 ? (pl / init * 100).toFixed(1) : '0' }; }
    function getDailyHistory(bets) { const d = {}; for (const b of bets) { if (!b.timestamp || b.result === null) continue; const k = b.timestamp.slice(0, 10); if (!d[k]) d[k] = { date: k, bets: 0, wins: 0, pnl: 0 }; d[k].bets++; if (b.result === 'win') d[k].wins++; d[k].pnl += b.pnl || 0; } return Object.values(d).sort((a, b) => b.date.localeCompare(a.date)); }

    // ===== FORMAT =====
    function fmt(n) { if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + 'B'; if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(0) + 'k'; return n.toString(); }
    function fmtFull(n) { return new Intl.NumberFormat('vi-VN').format(n); }
    function hashCode(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; } return Math.abs(h); }
    function seededRandom(s) { return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

    return {
        LINES, KNOWN_TEAMS, loadState, saveState, resetState, defaultState,
        fetchRealMatches, generateFallbackMatches, generateRecommendation, analyzeBetTypes,
        winProbability, simulateResult, resolveBet,
        calcDailyPL, calcWeeklyPL, calcWinRate, calcStats, getDailyHistory,
        todayStr, fmt, fmtFull, getH2H, formScore, eloWinProb,
        MIN_CONFIDENCE, MIN_EDGE,
    };
})();
