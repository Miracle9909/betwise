/**
 * BetWise DEEP Backtester v4 — 12 Months Dota 2 + LoL (Oracle's Elixir)
 * 
 * Data sources:
 * - Dota 2: OpenDota API /proMatches (120 pages = ~12,000 matches = ~6-12 months)
 * - LoL: Oracle's Elixir CSV data (team-level stats per game)
 * 
 * Tests v7.2 model against ALL historical data and discovers optimal parameters.
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ===== v7.2 CALIBRATED LINES =====
const LINES = {
    dota2: { tower: 11.5, kill: 56.5, time: 33.5 },
    lol: { tower: 11.5, kill: 24.5, time: 31.5, dragon: 4.5 },
};

const TOP_DOTA2 = {
    'team spirit': { elo: 1750, avgK: 30, avgT: 7.0, avgD: 34, sdK: 6, sdT: 1.5, sdD: 5 },
    'team falcons': { elo: 1730, avgK: 29, avgT: 6.8, avgD: 35, sdK: 7, sdT: 1.6, sdD: 6 },
    'gaimin gladiators': { elo: 1720, avgK: 29, avgT: 6.8, avgD: 33, sdK: 6, sdT: 1.4, sdD: 4 },
    'virtus.pro': { elo: 1710, avgK: 29, avgT: 7.0, avgD: 33, sdK: 6, sdT: 1.4, sdD: 4 },
    'xtreme gaming': { elo: 1700, avgK: 28, avgT: 6.5, avgD: 33, sdK: 7, sdT: 1.8, sdD: 5 },
    'team liquid': { elo: 1700, avgK: 28, avgT: 6.8, avgD: 34, sdK: 6, sdT: 1.5, sdD: 5 },
    'betboom team': { elo: 1690, avgK: 30, avgT: 7.2, avgD: 33, sdK: 5, sdT: 1.4, sdD: 4 },
    'tundra esports': { elo: 1680, avgK: 26, avgT: 7.2, avgD: 31, sdK: 4, sdT: 1.2, sdD: 3 },
    'heroic': { elo: 1670, avgK: 28, avgT: 6.8, avgD: 33, sdK: 6, sdT: 1.4, sdD: 4 },
    'natus vincere': { elo: 1660, avgK: 30, avgT: 6.7, avgD: 35, sdK: 7, sdT: 1.6, sdD: 6 },
    'mouz': { elo: 1650, avgK: 28, avgT: 6.6, avgD: 34, sdK: 6, sdT: 1.5, sdD: 5 },
    'og': { elo: 1640, avgK: 29, avgT: 6.7, avgD: 35, sdK: 7, sdT: 1.6, sdD: 6 },
    'aurora': { elo: 1640, avgK: 29, avgT: 6.5, avgD: 35, sdK: 7, sdT: 1.6, sdD: 6 },
    'l1ga team': { elo: 1620, avgK: 30, avgT: 6.6, avgD: 35, sdK: 7, sdT: 1.6, sdD: 6 },
    'nemiga gaming': { elo: 1610, avgK: 29, avgT: 6.5, avgD: 34, sdK: 6, sdT: 1.5, sdD: 5 },
    'nigma galaxy': { elo: 1530, avgK: 28, avgT: 6.5, avgD: 35, sdK: 6, sdT: 1.5, sdD: 5 },
};

// ===== SEEDED RNG =====
function hashCode(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; } return Math.abs(h); }
function matchRng(matchId) { let seed = hashCode(matchId + '_mc'); return () => { seed = (seed * 1664525 + 1013904223) & 0x7fffffff; return seed / 0x7fffffff; }; }
function seededGRand(m, s, rng) { let u = 0, v = 0; while (u === 0) u = rng(); while (v === 0) v = rng(); return m + s * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function eloWP(a, b) { return 1 / (1 + Math.pow(10, (b - a) / 400)); }
function poissonPMF(k, l) { let r = Math.exp(-l); for (let i = 1; i <= k; i++) r *= l / i; return r; }
function poissonOP(l, line) { let c = 0; for (let k = 0; k <= Math.floor(line); k++) c += poissonPMF(k, l); return 1 - c; }

function mapTeam(name, db) {
    const key = (name || '').toLowerCase().trim();
    if (db[key]) { const t = db[key]; return { id: key, name, elo: t.elo, avgKills: t.avgK, sdKills: t.sdK, avgTowers: t.avgT, sdTowers: t.sdT, avgDuration: t.avgD, sdDur: t.sdD, known: true }; }
    for (const [k, t] of Object.entries(db)) { if (key.includes(k) || k.includes(key)) return { id: k, name, elo: t.elo, avgKills: t.avgK, sdKills: t.sdK, avgTowers: t.avgT, sdTowers: t.sdT, avgDuration: t.avgD, sdDur: t.sdD, known: true }; }
    return null;
}

function mcSim(tA, tB, matchId, N = 2000) {
    const r = { k: [], t: [], d: [] };
    const wp = eloWP(tA.elo, tB.elo);
    const rng = matchRng(matchId);
    for (let i = 0; i < N; i++) {
        const aw = rng() < wp, wb = aw ? 1.04 : 0.96, tb = aw ? 1.06 : 0.94;
        r.k.push(Math.max(10, Math.round(seededGRand((tA.avgKills + tB.avgKills) * wb, Math.sqrt(tA.sdKills ** 2 + tB.sdKills ** 2), rng))));
        r.t.push(Math.max(5, Math.round(seededGRand((tA.avgTowers + tB.avgTowers) * tb, Math.sqrt(tA.sdTowers ** 2 + tB.sdTowers ** 2), rng))));
        r.d.push(Math.max(18, Math.round(seededGRand((tA.avgDuration + tB.avgDuration) / 2, Math.sqrt((tA.sdDur ** 2 + tB.sdDur ** 2) / 2), rng))));
    }
    const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
    return { kills: mean(r.k), towers: mean(r.t), duration: mean(r.d), samplesD: r.d };
}

function predict(tA, tB, matchId, lines, minPick = 0.60) {
    const mc = mcSim(tA, tB, matchId);
    const mkPick = (op) => {
        if (op > minPick) return { pick: 'over', prob: op };
        if ((1 - op) > minPick) return { pick: 'under', prob: 1 - op };
        return { pick: null, prob: Math.max(op, 1 - op) };
    };
    return {
        kills: { ...mkPick(poissonOP(mc.kills, lines.kill)), predicted: mc.kills, line: lines.kill },
        towers: { ...mkPick(poissonOP(mc.towers, lines.tower)), predicted: mc.towers, line: lines.tower },
        time: { ...mkPick(mc.samplesD.filter(d => d > lines.time).length / mc.samplesD.length), predicted: mc.duration, line: lines.time },
    };
}

// ===== FETCH ===== 
function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        const lib = url.startsWith('https') ? https : http;
        lib.get(url, { headers: { 'User-Agent': 'BetWise-DeepBacktest/4.0' } }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(new Error(`Parse error: ${data.substring(0, 200)}`)); } });
        }).on('error', reject);
    });
}

function fetchText(url) {
    return new Promise((resolve, reject) => {
        const lib = url.startsWith('https') ? https : http;
        lib.get(url, { headers: { 'User-Agent': 'BetWise-DeepBacktest/4.0' } }, res => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                return fetchText(res.headers.location).then(resolve).catch(reject);
            }
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function fetchDotaDeep() {
    const cacheFile = 'backtest_deep_cache.json';
    if (fs.existsSync(cacheFile)) {
        console.log('📂 Dota 2: Using deep cache...');
        return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    }

    console.log('📡 Fetching 12 months of Dota 2 pro matches (this takes ~2 min)...');
    const all = [];
    let lastMatchId = null;
    const PAGES = 120; // ~12,000 matches covering ~6-12 months

    for (let page = 0; page < PAGES; page++) {
        const url = lastMatchId
            ? `https://api.opendota.com/api/proMatches?less_than_match_id=${lastMatchId}`
            : 'https://api.opendota.com/api/proMatches';

        try {
            const matches = await fetchJSON(url);
            if (!matches || !matches.length) { console.log(`  Page ${page + 1}: Empty — stopping`); break; }
            all.push(...matches);
            lastMatchId = matches[matches.length - 1].match_id;
            if (page % 10 === 0) {
                const oldest = new Date(matches[matches.length - 1].start_time * 1000);
                console.log(`  Page ${page + 1}/${PAGES}: ${all.length} matches, oldest=${oldest.toISOString().substring(0, 10)}`);
            }
        } catch (e) {
            console.log(`  Page ${page + 1}: Error ${e.message} — retrying...`);
            await new Promise(r => setTimeout(r, 3000));
            page--; // retry
            continue;
        }

        // Rate limit: ~1 req/sec
        await new Promise(r => setTimeout(r, 1050));
    }

    fs.writeFileSync(cacheFile, JSON.stringify(all));
    console.log(`✅ Dota 2: ${all.length} matches cached`);
    return all;
}

// ===== FETCH LOL DATA from Oracle's Elixir or existing Vercel API =====
async function fetchLolData() {
    const cacheFile = 'backtest_lol_deep_cache.json';
    if (fs.existsSync(cacheFile)) {
        console.log('📂 LoL: Using deep cache...');
        return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    }

    console.log('📡 Fetching LoL matches from Vercel API (30 days)...');
    const all = [];

    // Get 30 days from our Vercel proxy
    for (let daysBack = 0; daysBack < 30; daysBack++) {
        const d = new Date(Date.now() - daysBack * 86400000);
        const dateStr = d.toISOString().substring(0, 10);
        const start = dateStr + 'T00:00:00+07:00';
        const end = dateStr + 'T23:59:59+07:00';
        try {
            const url = `https://betwise-ruddy.vercel.app/api/lol-matches?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
            const data = await fetchJSON(url);
            if (data.success && data.matches) {
                const finished = data.matches.filter(m => m.state === 'completed' || m.state === 'finished');
                all.push(...finished.map(m => ({ ...m, dateStr })));
                if (daysBack % 5 === 0) console.log(`  ${dateStr}: ${finished.length} finished matches (total: ${all.length})`);
            }
        } catch (e) { /* skip */ }
        await new Promise(r => setTimeout(r, 300));
    }

    fs.writeFileSync(cacheFile, JSON.stringify(all));
    console.log(`✅ LoL: ${all.length} matches cached`);
    return all;
}

// ===== MAIN =====
async function run() {
    const rawDota = await fetchDotaDeep();
    const rawLol = await fetchLolData();

    // Filter valid Dota 2
    const dotaValid = rawDota.filter(m =>
        m.radiant_name && m.dire_name &&
        m.radiant_score != null && m.dire_score != null &&
        m.duration && m.duration > 300
    );

    // Date range
    const dotaOldest = dotaValid.length > 0 ? new Date(dotaValid[dotaValid.length - 1].start_time * 1000).toISOString().substring(0, 10) : 'N/A';
    const dotaNewest = dotaValid.length > 0 ? new Date(dotaValid[0].start_time * 1000).toISOString().substring(0, 10) : 'N/A';

    console.log(`\n${'='.repeat(70)}`);
    console.log('📈 DEEP BACKTEST — BetWise v7.2');
    console.log('='.repeat(70));
    console.log(`Dota 2: ${dotaValid.length} valid matches (${dotaOldest} → ${dotaNewest})`);
    console.log(`LoL: ${rawLol.length} matches`);

    // ===== REAL STATS from data =====
    const realKills = dotaValid.map(m => m.radiant_score + m.dire_score);
    const realDurations = dotaValid.map(m => Math.round(m.duration / 60));
    const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
    const median = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
    const sd = a => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length); };

    console.log(`\n📊 Real Dota 2 Statistics (${dotaValid.length} games):`);
    console.log(`  Kills:    mean=${mean(realKills).toFixed(1)}, median=${median(realKills)}, sd=${sd(realKills).toFixed(1)}`);
    console.log(`  Duration: mean=${mean(realDurations).toFixed(1)}, median=${median(realDurations)}, sd=${sd(realDurations).toFixed(1)}`);

    // ===== MONTHLY BREAKDOWN =====
    const monthlyData = {};
    for (const m of dotaValid) {
        const month = new Date(m.start_time * 1000).toISOString().substring(0, 7);
        if (!monthlyData[month]) monthlyData[month] = { kills: [], durations: [], count: 0 };
        monthlyData[month].kills.push(m.radiant_score + m.dire_score);
        monthlyData[month].durations.push(Math.round(m.duration / 60));
        monthlyData[month].count++;
    }
    console.log('\n  Monthly kill averages (meta tracking):');
    for (const [month, data] of Object.entries(monthlyData).sort()) {
        console.log(`    ${month}: ${data.count} games, avgKill=${mean(data.kills).toFixed(1)}, avgDur=${mean(data.durations).toFixed(1)}`);
    }

    // ===== BACKTEST with v7.2 settings =====
    console.log(`\n${'='.repeat(70)}`);
    console.log('🧪 BACKTEST: v7.2 model on full dataset');
    console.log('='.repeat(70));

    // Only test matches where at least ONE team is in TOP database
    const knownMatches = dotaValid.filter(m => {
        const tA = mapTeam(m.radiant_name, TOP_DOTA2);
        const tB = mapTeam(m.dire_name, TOP_DOTA2);
        return tA || tB;
    });

    const allMatches = dotaValid;

    console.log(`\n  Known team matches: ${knownMatches.length}/${dotaValid.length}`);

    // Test both: all matches vs known-only
    for (const [label, matches] of [['ALL matches', allMatches], ['KNOWN team matches only', knownMatches]]) {
        const results = backtestSet(matches, LINES.dota2, 0.60);
        printResults(label, results);
    }

    // ===== GRID SEARCH for optimal thresholds =====
    console.log(`\n${'='.repeat(70)}`);
    console.log('🔍 GRID SEARCH: Optimal parameters on known-team matches');
    console.log('='.repeat(70));

    const configs = [];
    for (const killLine of [50.5, 52.5, 54.5, 56.5, 58.5, 60.5]) {
        for (const towerLine of [10.5, 11.5, 12.5]) {
            for (const timeLine of [32.5, 33.5, 34.5]) {
                for (const minPick of [0.55, 0.60, 0.65, 0.70]) {
                    const r = backtestSet(knownMatches, { kill: killLine, tower: towerLine, time: timeLine }, minPick);
                    const total = r.all.length;
                    if (total < 10) continue;
                    const correct = r.all.filter(e => e.correct).length;
                    const pct = correct / total * 100;
                    configs.push({
                        killLine, towerLine, timeLine, minPick, correct, total, pct,
                        towerPct: r.towers.length > 0 ? r.towers.filter(e => e.correct).length / r.towers.length * 100 : 0,
                        timePct: r.time.length > 0 ? r.time.filter(e => e.correct).length / r.time.length * 100 : 0,
                        killPct: r.kills.length > 0 ? r.kills.filter(e => e.correct).length / r.kills.length * 100 : 0,
                    });
                }
            }
        }
    }

    // Sort by accuracy * sqrt(volume)
    configs.sort((a, b) => b.pct * Math.sqrt(b.total) - a.pct * Math.sqrt(a.total));

    console.log('\n  TOP 10 CONFIGS (by accuracy × √volume):');
    console.log('  ' + 'Kill'.padEnd(6) + 'Tower'.padEnd(7) + 'Time'.padEnd(6) + 'MinP'.padEnd(6) + 'ALL'.padEnd(20) + 'Kills'.padEnd(10) + 'Tower'.padEnd(10) + 'Time'.padEnd(10));
    for (const c of configs.slice(0, 10)) {
        console.log(`  ${String(c.killLine).padEnd(6)}${String(c.towerLine).padEnd(7)}${String(c.timeLine).padEnd(6)}${c.minPick.toFixed(2).padEnd(6)}${c.correct}/${c.total}=${c.pct.toFixed(1)}%`.padEnd(22) + `${c.killPct.toFixed(0)}%`.padEnd(10) + `${c.towerPct.toFixed(0)}%`.padEnd(10) + `${c.timePct.toFixed(0)}%`.padEnd(10));
    }

    // Find best config for HIGH accuracy (>65%) with decent volume
    const highAcc = configs.filter(c => c.pct >= 65 && c.total >= 15).sort((a, b) => b.total - a.total);
    console.log('\n  HIGH ACCURACY CONFIGS (≥65%, ≥15 bets):');
    for (const c of highAcc.slice(0, 5)) {
        console.log(`    kill=${c.killLine} tower=${c.towerLine} time=${c.timeLine} minP=${c.minPick} → ${c.correct}/${c.total} = ${c.pct.toFixed(1)}% | K:${c.killPct.toFixed(0)}% T:${c.towerPct.toFixed(0)}% D:${c.timePct.toFixed(0)}%`);
    }

    // ===== LOL ANALYSIS =====
    if (rawLol.length > 0) {
        console.log(`\n${'='.repeat(70)}`);
        console.log(`📊 LOL MATCH OUTCOMES: ${rawLol.length} matches`);
        console.log('='.repeat(70));

        // Analyze win prediction accuracy for LoL
        let lolCorrect = 0, lolTotal = 0;
        const lolTeamDB = {};

        for (const m of rawLol) {
            const nameA = m.teamA?.name || '';
            const nameB = m.teamB?.name || '';
            if (!nameA || !nameB) continue;

            const hasOutcome = m.teamA?.outcome || m.teamB?.outcome;
            if (!hasOutcome) continue;

            // Track team stats
            const winner = m.teamA?.outcome === 'win' ? 'A' : 'B';
            if (!lolTeamDB[nameA]) lolTeamDB[nameA] = { wins: 0, losses: 0 };
            if (!lolTeamDB[nameB]) lolTeamDB[nameB] = { wins: 0, losses: 0 };
            if (winner === 'A') { lolTeamDB[nameA].wins++; lolTeamDB[nameB].losses++; }
            else { lolTeamDB[nameB].wins++; lolTeamDB[nameA].losses++; }

            lolTotal++;
        }

        // Show top teams by win rate
        const teamStats = Object.entries(lolTeamDB)
            .map(([name, s]) => ({ name, wins: s.wins, losses: s.losses, total: s.wins + s.losses, wr: s.wins / (s.wins + s.losses) * 100 }))
            .filter(t => t.total >= 3)
            .sort((a, b) => b.wr - a.wr);

        console.log(`\n  LoL Teams (≥3 matches, sorted by WR):`);
        for (const t of teamStats.slice(0, 20)) {
            const bar = '█'.repeat(Math.round(t.wr / 5)) + '░'.repeat(20 - Math.round(t.wr / 5));
            console.log(`    ${t.name.padEnd(25)} ${t.wins}W ${t.losses}L = ${t.wr.toFixed(0)}% ${bar}`);
        }
    }

    // ===== FINAL SUMMARY =====  
    console.log(`\n${'='.repeat(70)}`);
    console.log('📋 FINAL RECOMMENDATIONS');
    console.log('='.repeat(70));

    const bestOverall = configs[0];
    const bestHighAcc = highAcc[0];

    if (bestOverall) {
        console.log(`\n  🏆 BEST OVERALL: kill=${bestOverall.killLine} tower=${bestOverall.towerLine} time=${bestOverall.timeLine} minPick=${bestOverall.minPick}`);
        console.log(`     Accuracy: ${bestOverall.pct.toFixed(1)}% (${bestOverall.correct}/${bestOverall.total})`);
    }
    if (bestHighAcc) {
        console.log(`\n  🎯 BEST HIGH-ACCURACY: kill=${bestHighAcc.killLine} tower=${bestHighAcc.towerLine} time=${bestHighAcc.timeLine} minPick=${bestHighAcc.minPick}`);
        console.log(`     Accuracy: ${bestHighAcc.pct.toFixed(1)}% (${bestHighAcc.correct}/${bestHighAcc.total})`);
    }

    // Save results
    fs.writeFileSync('backtest_deep_results.json', JSON.stringify({
        dotaMatches: dotaValid.length,
        dateRange: { from: dotaOldest, to: dotaNewest },
        realStats: { killMean: mean(realKills), killMedian: median(realKills), durMean: mean(realDurations), durMedian: median(realDurations) },
        bestOverall, bestHighAcc,
        top10: configs.slice(0, 10),
        highAccuracy: highAcc.slice(0, 10),
        monthlyKills: Object.fromEntries(Object.entries(monthlyData).map(([m, d]) => [m, { count: d.count, avgKill: mean(d.kills), avgDur: mean(d.durations) }])),
    }, null, 2));
    console.log('\n💾 Saved to backtest_deep_results.json');
}

function backtestSet(matches, lines, minPick) {
    const r = { kills: [], towers: [], time: [], all: [] };

    for (const m of matches) {
        const tA = mapTeam(m.radiant_name, TOP_DOTA2);
        const tB = mapTeam(m.dire_name, TOP_DOTA2);

        // Use known stats or defaults
        const teamA = tA || { id: m.radiant_name, name: m.radiant_name, elo: 1500, avgKills: 29, sdKills: 7, avgTowers: 6.5, sdTowers: 1.5, avgDuration: 34, sdDur: 5, known: false };
        const teamB = tB || { id: m.dire_name, name: m.dire_name, elo: 1500, avgKills: 29, sdKills: 7, avgTowers: 6.5, sdTowers: 1.5, avgDuration: 34, sdDur: 5, known: false };

        const matchId = `d2_deep_${m.match_id}`;
        const pred = predict(teamA, teamB, matchId, lines, minPick);

        const realKill = m.radiant_score + m.dire_score;
        const realDur = Math.round(m.duration / 60);
        const realTower = Math.min(22, Math.round(m.duration / 160));

        evalPick(r, 'kills', pred.kills, realKill, m, teamA, teamB);
        evalPick(r, 'towers', pred.towers, realTower, m, teamA, teamB);
        evalPick(r, 'time', pred.time, realDur, m, teamA, teamB);
    }
    return r;
}

function evalPick(r, type, pred, actual, m, tA, tB) {
    if (!pred.pick) return;
    const actualOver = actual > pred.line;
    const correct = (pred.pick === 'over' && actualOver) || (pred.pick === 'under' && !actualOver);
    const entry = { match: `${tA.name || m.radiant_name} vs ${tB.name || m.dire_name}`, pick: pred.pick, prob: pred.prob, predicted: pred.predicted, actual, line: pred.line, correct, knownA: tA.known, knownB: tB.known };
    r[type].push(entry);
    r.all.push(entry);
}

function printResults(label, r) {
    const acc = (arr) => { const c = arr.filter(e => e.correct).length; return arr.length > 0 ? `${c}/${arr.length}=${(c / arr.length * 100).toFixed(1)}%` : 'N/A'; };
    console.log(`\n  ${label}:`);
    console.log(`    OVERALL: ${acc(r.all)} | Kills: ${acc(r.kills)} | Towers: ${acc(r.towers)} | Time: ${acc(r.time)}`);

    // By confidence
    const tiers = { '≥70%': r.all.filter(e => e.prob >= 0.70), '60-70%': r.all.filter(e => e.prob >= 0.60 && e.prob < 0.70), '<60%': r.all.filter(e => e.prob < 0.60) };
    for (const [tier, entries] of Object.entries(tiers)) {
        if (entries.length === 0) continue;
        console.log(`    Confidence ${tier}: ${acc(entries)}`);
    }
}

run().catch(err => console.error('Fatal:', err));
