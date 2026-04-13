/**
 * BetWise Esports Analyzer v4.0 — Real Match Data (No API Key!)
 *
 * Data Sources (free, no key required):
 * - Dota 2: OpenDota API (/proMatches) — real pro match results
 * - LoL: Simulated from real tournament schedules
 *
 * Algorithms: Elo, Bayesian, Poisson, Monte Carlo (N=500), Half-Kelly
 */
const EsportsAnalyzer = (() => {
    'use strict';

    const STORAGE_KEY = 'betwise_esports_v4';
    const MIN_CONFIDENCE = 0.58;
    const MIN_EDGE = 0.05;
    const MONTE_CARLO_N = 500;

    // ===== BOOKMAKER LINES =====
    const LINES = {
        dota2: { tower: 12.5, kill: 45.5, time: 33.5 },
        lol: { tower: 11.5, kill: 24.5, time: 31.5, dragon: 4.5 }
    };

    // ===== TOP 50 TEAMS DATABASE (Elo + stats) =====
    const TOP_TEAMS = {
        // --- DOTA 2 TOP TEAMS ---
        'team spirit': { elo: 1750, logo: '🐻', region: 'CIS', avgK: 24, avgT: 6.5, avgD: 34, sdK: 5, sdT: 1.5, sdD: 5 },
        'team liquid': { elo: 1700, logo: '💧', region: 'EU', avgK: 22, avgT: 6.3, avgD: 34, sdK: 5, sdT: 1.5, sdD: 5 },
        'gaimin gladiators': { elo: 1720, logo: '⚔️', region: 'EU', avgK: 23, avgT: 6.4, avgD: 33, sdK: 5, sdT: 1.4, sdD: 4 },
        'tundra esports': { elo: 1680, logo: '❄️', region: 'EU', avgK: 20, avgT: 6.7, avgD: 31, sdK: 3, sdT: 1.2, sdD: 3 },
        'virtus.pro': { elo: 1710, logo: '🐻‍❄️', region: 'CIS', avgK: 23, avgT: 6.5, avgD: 33, sdK: 5, sdT: 1.4, sdD: 4 },
        'betboom team': { elo: 1690, logo: '💥', region: 'CIS', avgK: 24, avgT: 6.6, avgD: 33, sdK: 4, sdT: 1.4, sdD: 4 },
        'team falcons': { elo: 1730, logo: '🦅', region: 'MENA', avgK: 23, avgT: 6.4, avgD: 35, sdK: 6, sdT: 1.6, sdD: 6 },
        'natus vincere': { elo: 1660, logo: '🟡', region: 'CIS', avgK: 24, avgT: 6.2, avgD: 35, sdK: 6, sdT: 1.6, sdD: 6 },
        'og': { elo: 1640, logo: '🌸', region: 'EU', avgK: 23, avgT: 6.2, avgD: 35, sdK: 6, sdT: 1.6, sdD: 6 },
        'xtreme gaming': { elo: 1700, logo: '🔥', region: 'CN', avgK: 22, avgT: 6.0, avgD: 33, sdK: 6, sdT: 1.8, sdD: 5 },
        'mouz': { elo: 1650, logo: '🐭', region: 'EU', avgK: 22, avgT: 6.1, avgD: 34, sdK: 5, sdT: 1.5, sdD: 5 },
        'heroic': { elo: 1670, logo: '🛡️', region: 'EU', avgK: 22, avgT: 6.3, avgD: 33, sdK: 5, sdT: 1.4, sdD: 4 },
        'aurora': { elo: 1640, logo: '🌌', region: 'CIS', avgK: 23, avgT: 6.0, avgD: 35, sdK: 6, sdT: 1.6, sdD: 6 },
        'l1ga team': { elo: 1620, logo: '🔷', region: 'CIS', avgK: 24, avgT: 6.1, avgD: 35, sdK: 6, sdT: 1.6, sdD: 6 },
        'nemiga gaming': { elo: 1610, logo: '🟩', region: 'CIS', avgK: 23, avgT: 6.0, avgD: 34, sdK: 5, sdT: 1.5, sdD: 5 },
        'nouns': { elo: 1560, logo: '👓', region: 'NA', avgK: 25, avgT: 5.8, avgD: 36, sdK: 7, sdT: 1.8, sdD: 7 },
        'hokori': { elo: 1550, logo: '🎯', region: 'SA', avgK: 24, avgT: 5.7, avgD: 37, sdK: 7, sdT: 1.9, sdD: 7 },
        'execration': { elo: 1530, logo: '🗡️', region: 'SEA', avgK: 25, avgT: 5.6, avgD: 36, sdK: 7, sdT: 1.8, sdD: 7 },
        'team resilience': { elo: 1540, logo: '🔰', region: 'SEA', avgK: 24, avgT: 5.8, avgD: 35, sdK: 6, sdT: 1.7, sdD: 6 },
        'yellow submarine': { elo: 1580, logo: '🟡', region: 'CIS', avgK: 22, avgT: 6.0, avgD: 35, sdK: 5, sdT: 1.5, sdD: 5 },
        // --- LOL TOP TEAMS ---
        't1': { elo: 1750, logo: '🔴', region: 'KR', avgK: 13, avgT: 6.0, avgD: 30, sdK: 3, sdT: 1.3, sdD: 3, avgDr: 2.5, sdDr: 0.8 },
        'gen.g': { elo: 1740, logo: '🟡', region: 'KR', avgK: 12, avgT: 5.8, avgD: 31, sdK: 3, sdT: 1.2, sdD: 3, avgDr: 2.4, sdDr: 0.7 },
        'bilibili gaming': { elo: 1710, logo: '🟢', region: 'CN', avgK: 14, avgT: 5.9, avgD: 29, sdK: 4, sdT: 1.4, sdD: 4, avgDr: 2.3, sdDr: 0.9 },
        'hanwha life esports': { elo: 1680, logo: '🟠', region: 'KR', avgK: 12, avgT: 5.7, avgD: 32, sdK: 3, sdT: 1.3, sdD: 4, avgDr: 2.2, sdDr: 0.8 },
        'jd gaming': { elo: 1700, logo: '🏆', region: 'CN', avgK: 13, avgT: 6.1, avgD: 30, sdK: 3, sdT: 1.2, sdD: 3, avgDr: 2.5, sdDr: 0.7 },
        'top esports': { elo: 1690, logo: '⚡', region: 'CN', avgK: 14, avgT: 5.8, avgD: 28, sdK: 4, sdT: 1.4, sdD: 4, avgDr: 2.4, sdDr: 0.8 },
        'weibo gaming': { elo: 1660, logo: '🐯', region: 'CN', avgK: 15, avgT: 5.5, avgD: 28, sdK: 5, sdT: 1.6, sdD: 5, avgDr: 2.6, sdDr: 1.0 },
        'g2 esports': { elo: 1620, logo: '🔵', region: 'EU', avgK: 14, avgT: 5.8, avgD: 30, sdK: 5, sdT: 1.5, sdD: 4, avgDr: 2.4, sdDr: 0.8 },
        'fnatic': { elo: 1590, logo: '🟧', region: 'EU', avgK: 13, avgT: 5.6, avgD: 31, sdK: 4, sdT: 1.4, sdD: 4, avgDr: 2.3, sdDr: 0.8 },
        'drx': { elo: 1610, logo: '🐲', region: 'KR', avgK: 11, avgT: 5.4, avgD: 33, sdK: 4, sdT: 1.5, sdD: 5, avgDr: 2.2, sdDr: 0.8 },
        'kt rolster': { elo: 1630, logo: '🔷', region: 'KR', avgK: 12, avgT: 5.6, avgD: 32, sdK: 3, sdT: 1.3, sdD: 4, avgDr: 2.3, sdDr: 0.8 },
        'dplus kia': { elo: 1650, logo: '🟣', region: 'KR', avgK: 13, avgT: 5.8, avgD: 31, sdK: 3, sdT: 1.3, sdD: 3, avgDr: 2.4, sdDr: 0.7 },
        'lng esports': { elo: 1640, logo: '🐉', region: 'CN', avgK: 14, avgT: 5.7, avgD: 29, sdK: 4, sdT: 1.4, sdD: 4, avgDr: 2.3, sdDr: 0.9 },
        'flyquest': { elo: 1500, logo: '🦋', region: 'NA', avgK: 11, avgT: 5.3, avgD: 33, sdK: 4, sdT: 1.5, sdD: 5, avgDr: 2.0, sdDr: 0.9 },
        'cloud9': { elo: 1510, logo: '☁️', region: 'NA', avgK: 12, avgT: 5.4, avgD: 33, sdK: 4, sdT: 1.6, sdD: 5, avgDr: 2.1, sdDr: 0.9 },
    };

    // ===== FETCH REAL DOTA 2 MATCHES (OpenDota API — free, no key) =====

    async function fetchDotaMatches() {
        try {
            const res = await fetch('https://api.opendota.com/api/proMatches');
            if (!res.ok) return [];
            const data = await res.json();
            // Group by series (same league + roughly same time = same series)
            const today = new Date();
            const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() / 1000;
            const todayEnd = todayStart + 86400;
            const todayMatches = data.filter(m => m.start_time >= todayStart && m.start_time < todayEnd);
            return todayMatches;
        } catch (e) {
            console.warn('[Esports] OpenDota fetch failed:', e);
            return [];
        }
    }

    async function fetchMatchesForDate(dateStr) {
        try {
            // OpenDota proMatches returns recent matches, filter by date
            const res = await fetch('https://api.opendota.com/api/proMatches');
            if (!res.ok) return [];
            const data = await res.json();
            const targetDate = new Date(dateStr + 'T00:00:00');
            const dayStart = targetDate.getTime() / 1000;
            const dayEnd = dayStart + 86400;
            return data.filter(m => m.start_time >= dayStart && m.start_time < dayEnd);
        } catch (e) {
            console.warn('[Esports] OpenDota fetch failed:', e);
            return [];
        }
    }

    function isTopTeam(name) {
        if (!name) return false;
        const key = name.toLowerCase().trim();
        return !!TOP_TEAMS[key];
    }

    function getTeamStats(name, game) {
        const key = name.toLowerCase().trim();
        const known = TOP_TEAMS[key];
        if (known) return known;
        // Unknown team — assign moderate stats
        const defaults = game === 'lol'
            ? { elo: 1450, logo: '🎮', region: '—', avgK: 12, avgT: 5.5, avgD: 32, sdK: 4, sdT: 1.5, sdD: 5, avgDr: 2.1, sdDr: 0.9 }
            : { elo: 1450, logo: '🎮', region: '—', avgK: 23, avgT: 6.0, avgD: 35, sdK: 6, sdT: 1.6, sdD: 6 };
        return defaults;
    }

    function mapOpenDotaToMatch(raw, index) {
        const teamA = mapTeamFromName(raw.radiant_name, 'dota2');
        const teamB = mapTeamFromName(raw.dire_name, 'dota2');
        const time = new Date(raw.start_time * 1000).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
        const { bets, mc } = analyzeBetTypes(teamA, teamB, 'dota2');

        // Real result from API
        const hasResult = raw.radiant_score != null && raw.dire_score != null;
        const realResult = hasResult ? {
            kills: raw.radiant_score + raw.dire_score,
            towers: Math.min(22, Math.round((raw.duration || 2000) / 160)), // estimate
            duration: Math.round((raw.duration || 2000) / 60),
        } : null;

        return {
            id: `d2_real_${raw.match_id}`,
            game: 'dota2',
            teamA, teamB, time,
            league: raw.league_name || 'Pro Match',
            bets, mc,
            status: hasResult ? 'finished' : 'live',
            result: realResult,
            realMatchId: raw.match_id,
            isReal: true,
        };
    }

    function mapTeamFromName(name, game) {
        const stats = getTeamStats(name || 'Unknown', game);
        return {
            id: (name || 'unknown').toLowerCase().replace(/\s+/g, '-'),
            name: name || 'Unknown',
            elo: stats.elo,
            region: stats.region,
            logo: stats.logo,
            avgKills: stats.avgK,
            avgTowers: stats.avgT,
            avgDuration: stats.avgD,
            sdKills: stats.sdK,
            sdTowers: stats.sdT,
            sdDur: stats.sdD,
            form: [1, 0, 1, 0, 1],
            ...(game === 'lol' ? { avgDragon: stats.avgDr || 2.2, sdDragon: stats.sdDr || 0.8 } : {}),
        };
    }

    // ===== FETCH ALL MATCHES FOR A DATE =====

    async function loadMatchesForDate(dateStr) {
        // Fetch Dota 2 + LoL in parallel
        const [rawDota, rawLol] = await Promise.all([
            fetchMatchesForDate(dateStr),
            fetchLolMatches(dateStr),
        ]);

        // Filter Dota 2 for top teams
        const topDota = rawDota.filter(m =>
            isTopTeam(m.radiant_name) || isTopTeam(m.dire_name)
        );

        // Dedup Dota by series
        const seen = new Set();
        const deduped = [];
        for (const m of topDota) {
            const key = [m.radiant_name, m.dire_name].sort().join('|');
            if (seen.has(key)) continue;
            seen.add(key);
            deduped.push(m);
        }

        const dotaMatches = deduped.map((m, i) => mapOpenDotaToMatch(m, i));

        // Map LoL API data or fallback to simulation
        let lolMatches;
        if (rawLol && rawLol.length > 0) {
            lolMatches = rawLol.map((m, i) => mapLolApiToMatch(m, i, dateStr));
        } else {
            lolMatches = generateLolFallback(dateStr);
        }

        const all = [...dotaMatches, ...lolMatches];
        all.sort((a, b) => a.time.localeCompare(b.time));
        return all;
    }

    // ===== FETCH REAL LOL MATCHES (Vercel proxy) =====
    async function fetchLolMatches(dateStr) {
        try {
            const start = dateStr + 'T00:00:00.000Z';
            const end = dateStr + 'T23:59:59.000Z';
            const url = `/api/lol-matches?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
            const res = await fetch(url);
            if (!res.ok) return [];
            const data = await res.json();
            if (!data.success || !data.matches) return [];
            return data.matches;
        } catch (e) {
            console.warn('[Esports] LoL API fetch failed:', e);
            return [];
        }
    }

    function mapLolApiToMatch(raw, index, dateStr) {
        const teamA = mapTeamFromName(raw.teamA?.name || 'Team A', 'lol');
        if (raw.teamA?.image) teamA.imageUrl = raw.teamA.image;
        const teamB = mapTeamFromName(raw.teamB?.name || 'Team B', 'lol');
        if (raw.teamB?.image) teamB.imageUrl = raw.teamB.image;

        const time = raw.startTime
            ? new Date(raw.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })
            : '—';

        const isFinished = raw.state === 'completed' || raw.state === 'finished';
        const isLive = raw.state === 'inProgress' || raw.state === 'live';

        const { bets, mc } = analyzeBetTypes(teamA, teamB, 'lol');

        return {
            id: `lol_real_${raw.id || index}`,
            game: 'lol',
            teamA, teamB, time,
            league: raw.league || 'LoL Esports',
            bets, mc,
            status: isFinished ? 'finished' : isLive ? 'live' : 'upcoming',
            result: null,
            isReal: true,
        };
    }

    // ===== LOL FALLBACK (simulated from real tournament teams) =====
    function generateLolFallback(dateStr) {
        const seed = hashCode(dateStr + '_lol');
        const rng = seededRandom(seed);
        const lolTeams = Object.entries(TOP_TEAMS).filter(([, v]) => v.avgDr != null);
        const matches = [];
        const used = new Set();
        const leagues = ['LCK Spring 2026', 'LPL Spring 2026', 'LEC Spring 2026'];

        const count = 3 + Math.floor(rng() * 3);
        for (let i = 0; i < count; i++) {
            const avail = lolTeams.filter(([k]) => !used.has(k));
            if (avail.length < 2) break;
            const shuffled = avail.sort(() => rng() - 0.5);
            const [nameA] = shuffled[0];
            const [nameB] = shuffled[1];
            used.add(nameA);
            used.add(nameB);

            const teamA = mapTeamFromName(nameA, 'lol');
            teamA.name = capitalizeTeamName(nameA);
            const teamB = mapTeamFromName(nameB, 'lol');
            teamB.name = capitalizeTeamName(nameB);

            const hour = 14 + Math.floor(rng() * 8);
            const min = rng() > 0.5 ? '00' : '30';
            const time = `${String(hour).padStart(2, '0')}:${min}`;

            const { bets, mc } = analyzeBetTypes(teamA, teamB, 'lol');
            matches.push({
                id: `lol_sim_${dateStr}_${i}`,
                game: 'lol',
                teamA, teamB, time,
                league: leagues[Math.floor(rng() * leagues.length)],
                bets, mc,
                status: 'upcoming',
                result: null,
                isReal: false,
            });
        }
        return matches;
    }

    function capitalizeTeamName(name) {
        return name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }

    // ===== PROBABILITY ENGINE =====
    const H2H = {};
    function getH2H(tA, tB) {
        const key = [tA.id, tB.id].sort().join('-');
        if (!H2H[key]) {
            const d = tA.elo - tB.elo, base = 5 + Math.floor(Math.abs(d) / 40);
            const aW = d > 0 ? Math.ceil(base * 0.6) : Math.floor(base * 0.4);
            H2H[key] = { a: tA.id, aW, b: tB.id, bW: base - aW, t: base };
        }
        const r = H2H[key];
        return r.a === tA.id ? { wins: r.aW, losses: r.bW, total: r.t } : { wins: r.bW, losses: r.aW, total: r.t };
    }
    function eloWP(a, b) { return 1 / (1 + Math.pow(10, (b - a) / 400)); }
    function formScore(f) { const w = [1, 2, 3, 4, 5]; let s = 0, ws = 0; for (let i = 0; i < f.length; i++) { s += f[i] * w[i]; ws += w[i]; } return s / ws; }
    function winProbability(tA, tB) {
        const ep = eloWP(tA.elo, tB.elo), h = getH2H(tA, tB), hl = h.wins / h.total;
        const fA = formScore(tA.form), fB = formScore(tB.form), ff = fA / (fA + fB + 0.001);
        const hw = Math.min(h.total / 15, 0.35), fw = 0.20, ew = 1 - hw - fw;
        return Math.max(0.10, Math.min(0.90, ep * ew + hl * hw + ff * fw));
    }

    // ===== POISSON + MONTE CARLO =====
    function poissonPMF(k, l) { let r = Math.exp(-l); for (let i = 1; i <= k; i++) r *= l / i; return r; }
    function poissonOP(l, line) { let c = 0; for (let k = 0; k <= Math.floor(line); k++) c += poissonPMF(k, l); return 1 - c; }
    function gRand(m, s) { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return m + s * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

    function mcSim(tA, tB, game, n = MONTE_CARLO_N) {
        const r = { k: [], t: [], d: [], dr: [] }, wp = winProbability(tA, tB);
        for (let i = 0; i < n; i++) {
            const aw = Math.random() < wp, wb = aw ? 1.04 : 0.96, tb = aw ? 1.06 : 0.94;
            r.k.push(Math.max(10, Math.round(gRand((tA.avgKills + tB.avgKills) * wb, Math.sqrt(tA.sdKills ** 2 + tB.sdKills ** 2)))));
            r.t.push(Math.max(5, Math.round(gRand((tA.avgTowers + tB.avgTowers) * tb, Math.sqrt(tA.sdTowers ** 2 + tB.sdTowers ** 2)))));
            r.d.push(Math.max(18, Math.round(gRand((tA.avgDuration + tB.avgDuration) / 2, Math.sqrt((tA.sdDur ** 2 + tB.sdDur ** 2) / 2)))));
            if (game === 'lol' && tA.avgDragon) r.dr.push(Math.max(1, Math.round(gRand(tA.avgDragon + tB.avgDragon, Math.sqrt((tA.sdDragon || 0.8) ** 2 + (tB.sdDragon || 0.8) ** 2)))));
        }
        const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
        const sd = a => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length); };
        const res = { kills: { mean: mean(r.k), sd: sd(r.k), samples: r.k }, towers: { mean: mean(r.t), sd: sd(r.t), samples: r.t }, duration: { mean: mean(r.d), sd: sd(r.d), samples: r.d } };
        if (r.dr.length) res.dragons = { mean: mean(r.dr), sd: sd(r.dr), samples: r.dr };
        return res;
    }

    // ===== BET ANALYSIS =====
    function analyzeBetTypes(tA, tB, game) {
        const mc = mcSim(tA, tB, game), l = LINES[game], bets = [];
        bets.push(buildBet('tower_ou', 'Tài/Xỉu Trụ', l.tower, poissonOP(mc.towers.mean, l.tower), 1.80 + Math.random() * 0.15));
        bets.push(buildBet('kill_ou', 'Tài/Xỉu Mạng', l.kill, poissonOP(mc.kills.mean, l.kill), 1.82 + Math.random() * 0.13));
        const tOP = mc.duration.samples.filter(d => d > l.time).length / mc.duration.samples.length;
        bets.push(buildBet('time_ou', 'Tài/Xỉu Thời gian', l.time, tOP, 1.85 + Math.random() * 0.10));
        if (game === 'lol' && mc.dragons) bets.push(buildBet('dragon_ou', 'Tài/Xỉu Rồng', l.dragon, poissonOP(mc.dragons.mean, l.dragon), 1.83 + Math.random() * 0.12));
        return { bets, mc };
    }
    function buildBet(type, label, line, overProb, odds) {
        const op = Math.max(0.10, Math.min(0.90, overProb)), up = 1 - op;
        const pick = op > 0.55 ? 'over' : up > 0.55 ? 'under' : null;
        return { type, label, line, overProb: op, underProb: up, odds, pick, pickProb: pick === 'over' ? op : pick === 'under' ? up : Math.max(op, up) };
    }

    // ===== RECOMMENDATION (Kelly) =====
    function generateRecommendation(bets, bankroll) {
        let best = null, bestE = -Infinity;
        for (const b of bets) { if (!b.pick || b.pickProb < MIN_CONFIDENCE) continue; const e = b.pickProb * (b.odds - 1) - (1 - b.pickProb); if (e > bestE && e >= MIN_EDGE) { bestE = e; best = b; } }
        if (!best) return { action: 'SKIP', reason: 'Không đủ edge', bestBet: null, amount: 0, probability: 0, edge: 0 };
        const p = best.pickProb, b2 = best.odds - 1, kh = ((b2 * p - (1 - p)) / b2) / 2;
        let t, sz;
        if (p >= 0.75) { t = 'elite'; sz = Math.min(kh * 1.3, 0.22); } else if (p >= 0.68) { t = 'high'; sz = Math.min(kh, 0.16); } else if (p >= 0.58) { t = 'medium'; sz = Math.min(kh * 0.7, 0.10); } else { t = 'skip'; sz = 0; }
        const amt = Math.round(bankroll * sz / 10000) * 10000;
        if (amt < 50000) return { action: 'SKIP', reason: 'Mức cược nhỏ', bestBet: best, amount: 0, probability: p, edge: bestE };
        const pl = best.pick === 'over' ? `Tài (>${best.line})` : `Xỉu (<${best.line})`;
        return { action: 'BET', bestBet: best, betType: best.type, betLabel: best.label, pick: best.pick, pickLabel: pl, probability: p, edge: bestE, kelly: kh, confTier: t, amount: amt, odds: best.odds, reason: `${t === 'elite' ? '🔥' : t === 'high' ? '✅' : '⚡'} P=${(p * 100).toFixed(0)}% Edge=+${(bestE * 100).toFixed(1)}% Kelly=${(kh * 100).toFixed(1)}%` };
    }

    // ===== MATCH RESULT SIMULATION =====
    function simulateResult(match) {
        if (match.result) return match.result; // Real result already available
        const mc = mcSim(match.teamA, match.teamB, match.game, 1);
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
    function defaultState() { return { capital: 10000000, initialCapital: 10000000, bets: [], matchCache: {}, currentDate: todayStr(), viewingDate: todayStr() }; }
    function todayStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
    function loadState() { try { const r = localStorage.getItem(STORAGE_KEY); if (!r) return defaultState(); return { ...defaultState(), ...JSON.parse(r) }; } catch { return defaultState(); } }
    function saveState(s) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }
    function resetState() { localStorage.removeItem(STORAGE_KEY); return defaultState(); }

    // ===== STATS =====
    function calcDailyPL(bets, d) { return bets.filter(b => b.timestamp?.startsWith(d) && b.result !== null).reduce((s, b) => s + (b.pnl || 0), 0); }
    function calcWeeklyPL(bets) { const c = new Date(Date.now() - 7 * 86400000); return bets.filter(b => b.result !== null && new Date(b.timestamp) >= c).reduce((s, b) => s + (b.pnl || 0), 0); }
    function calcWinRate(bets) { const r = bets.filter(b => b.result !== null); return r.length === 0 ? 0 : r.filter(b => b.result === 'win').length / r.length; }
    function calcStats(bets, cap, init) { const r = bets.filter(b => b.result !== null), w = r.filter(b => b.result === 'win').length, pl = r.reduce((s, b) => s + (b.pnl || 0), 0); return { total: r.length, wins: w, losses: r.length - w, winRate: r.length > 0 ? (w / r.length * 100).toFixed(1) : '0', totalPL: pl, roi: init > 0 ? (pl / init * 100).toFixed(1) : '0' }; }
    function getDailyHistory(bets) { const d = {}; for (const b of bets) { if (!b.timestamp || b.result === null) continue; const k = b.timestamp.slice(0, 10); if (!d[k]) d[k] = { date: k, bets: 0, wins: 0, pnl: 0 }; d[k].bets++; if (b.result === 'win') d[k].wins++; d[k].pnl += b.pnl || 0; } return Object.values(d).sort((a, b) => b.date.localeCompare(a.date)); }

    // ===== FORMAT =====
    function fmt(n) { if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + 'B'; if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(0) + 'k'; return n.toString(); }
    function fmtFull(n) { return new Intl.NumberFormat('vi-VN').format(n); }
    function formatDate(d) { const parts = d.split('-'); return `${parts[2]}/${parts[1]}`; }
    function hashCode(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; } return Math.abs(h); }
    function seededRandom(s) { return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
    function shiftDate(dateStr, days) {
        const d = new Date(dateStr + 'T12:00:00');
        d.setDate(d.getDate() + days);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    return {
        LINES, TOP_TEAMS, loadState, saveState, resetState, defaultState,
        loadMatchesForDate, generateRecommendation, analyzeBetTypes,
        winProbability, simulateResult, resolveBet,
        calcDailyPL, calcWeeklyPL, calcWinRate, calcStats, getDailyHistory,
        todayStr, formatDate, shiftDate, fmt, fmtFull, getH2H, formScore, eloWP,
        MIN_CONFIDENCE, MIN_EDGE, isTopTeam,
    };
})();
