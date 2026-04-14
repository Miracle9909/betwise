/**
 * BetWise Backtester v2 — Calibrated Lines + Multi-threshold Testing
 * Tests multiple line values and confidence thresholds to find optimal settings
 */

const https = require('https');

const TOP_DOTA2 = {
    'team spirit': { elo: 1750, region: 'CIS', avgK: 24, avgT: 6.5, avgD: 34, sdK: 5, sdT: 1.5, sdD: 5 },
    'team falcons': { elo: 1730, region: 'MENA', avgK: 23, avgT: 6.4, avgD: 35, sdK: 6, sdT: 1.6, sdD: 6 },
    'gaimin gladiators': { elo: 1720, region: 'EU', avgK: 23, avgT: 6.4, avgD: 33, sdK: 5, sdT: 1.4, sdD: 4 },
    'virtus.pro': { elo: 1710, region: 'CIS', avgK: 23, avgT: 6.5, avgD: 33, sdK: 5, sdT: 1.4, sdD: 4 },
    'xtreme gaming': { elo: 1700, region: 'CN', avgK: 22, avgT: 6.0, avgD: 33, sdK: 6, sdT: 1.8, sdD: 5 },
    'team liquid': { elo: 1700, region: 'EU', avgK: 22, avgT: 6.3, avgD: 34, sdK: 5, sdT: 1.5, sdD: 5 },
    'betboom team': { elo: 1690, region: 'CIS', avgK: 24, avgT: 6.6, avgD: 33, sdK: 4, sdT: 1.4, sdD: 4 },
    'tundra esports': { elo: 1680, region: 'EU', avgK: 20, avgT: 6.7, avgD: 31, sdK: 3, sdT: 1.2, sdD: 3 },
    'heroic': { elo: 1670, region: 'EU', avgK: 22, avgT: 6.3, avgD: 33, sdK: 5, sdT: 1.4, sdD: 4 },
    'natus vincere': { elo: 1660, region: 'CIS', avgK: 24, avgT: 6.2, avgD: 35, sdK: 6, sdT: 1.6, sdD: 6 },
    'mouz': { elo: 1650, region: 'EU', avgK: 22, avgT: 6.1, avgD: 34, sdK: 5, sdT: 1.5, sdD: 5 },
    'og': { elo: 1640, region: 'EU', avgK: 23, avgT: 6.2, avgD: 35, sdK: 6, sdT: 1.6, sdD: 6 },
    'aurora': { elo: 1640, region: 'CIS', avgK: 23, avgT: 6.0, avgD: 35, sdK: 6, sdT: 1.6, sdD: 6 },
    'l1ga team': { elo: 1620, region: 'CIS', avgK: 24, avgT: 6.1, avgD: 35, sdK: 6, sdT: 1.6, sdD: 6 },
    'nemiga gaming': { elo: 1610, region: 'CIS', avgK: 23, avgT: 6.0, avgD: 34, sdK: 5, sdT: 1.5, sdD: 5 },
    'avulus': { elo: 1600, region: 'EU', avgK: 22, avgT: 5.9, avgD: 34, sdK: 5, sdT: 1.5, sdD: 5 },
    '1win': { elo: 1590, region: 'CIS', avgK: 24, avgT: 6.0, avgD: 34, sdK: 6, sdT: 1.6, sdD: 6 },
    'beastcoast': { elo: 1580, region: 'SA', avgK: 25, avgT: 5.8, avgD: 36, sdK: 7, sdT: 1.8, sdD: 7 },
    'talon esports': { elo: 1570, region: 'SEA', avgK: 24, avgT: 5.9, avgD: 34, sdK: 6, sdT: 1.6, sdD: 6 },
    'nouns': { elo: 1560, region: 'NA', avgK: 25, avgT: 5.8, avgD: 36, sdK: 7, sdT: 1.8, sdD: 7 },
    'nigma galaxy': { elo: 1530, region: 'EU', avgK: 22, avgT: 6.0, avgD: 35, sdK: 5, sdT: 1.5, sdD: 5 },
};

// ===== SEEDED RNG =====
function hashCode(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; } return Math.abs(h); }
function matchRng(matchId) {
    let seed = hashCode(matchId + '_mc');
    return function () { seed = (seed * 1664525 + 1013904223) & 0x7fffffff; return seed / 0x7fffffff; };
}
function seededGRand(m, s, rngFn) {
    let u = 0, v = 0;
    while (u === 0) u = rngFn(); while (v === 0) v = rngFn();
    return m + s * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function eloWP(a, b) { return 1 / (1 + Math.pow(10, (b - a) / 400)); }
function poissonPMF(k, l) { let r = Math.exp(-l); for (let i = 1; i <= k; i++) r *= l / i; return r; }
function poissonOP(l, line) { let c = 0; for (let k = 0; k <= Math.floor(line); k++) c += poissonPMF(k, l); return 1 - c; }

function mapTeam(name) {
    const key = (name || '').toLowerCase().trim();
    if (TOP_DOTA2[key]) {
        const t = TOP_DOTA2[key];
        return { id: key, name, elo: t.elo, region: t.region, avgKills: t.avgK, sdKills: t.sdK, avgTowers: t.avgT, sdTowers: t.sdT, avgDuration: t.avgD, sdDur: t.sdD };
    }
    return { id: key, name, elo: 1500, region: 'OTHER', avgKills: 23, sdKills: 6, avgTowers: 6, sdTowers: 1.5, avgDuration: 34, sdDur: 5 };
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

// ===== FETCH DATA =====
function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'BetWise-Backtester/2.0' } }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
        }).on('error', reject);
    });
}

async function fetchAllProMatches() {
    // Use cached data if available
    const fs = require('fs');
    const cacheFile = 'backtest_cache.json';
    if (fs.existsSync(cacheFile)) {
        console.log('📂 Using cached match data...');
        return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    }

    console.log('📡 Fetching pro matches from OpenDota API...');
    const all = [];
    let lastMatchId = null;
    for (let page = 0; page < 6; page++) {
        const url = lastMatchId
            ? `https://api.opendota.com/api/proMatches?less_than_match_id=${lastMatchId}`
            : 'https://api.opendota.com/api/proMatches';
        console.log(`  Page ${page + 1}/6...`);
        const matches = await fetchJSON(url);
        if (!matches || !matches.length) break;
        all.push(...matches);
        lastMatchId = matches[matches.length - 1].match_id;
        await new Promise(r => setTimeout(r, 1100));
    }
    console.log(`✅ Fetched ${all.length} total matches`);
    fs.writeFileSync(cacheFile, JSON.stringify(all));
    return all;
}

// ===== BACKTEST with VARIABLE LINES and THRESHOLDS =====
function backtestWithParams(validMatches, lines, minPickProb) {
    const results = { kills: { c: 0, t: 0 }, towers: { c: 0, t: 0 }, time: { c: 0, t: 0 }, all: { c: 0, t: 0 } };

    for (const m of validMatches) {
        const tA = mapTeam(m.radiant_name);
        const tB = mapTeam(m.dire_name);
        const matchId = `d2_bt_${m.match_id}`;
        const mc = mcSim(tA, tB, matchId);

        const realKill = m.radiant_score + m.dire_score;
        const realDur = Math.round(m.duration / 60);
        const realTower = Math.min(22, Math.round(m.duration / 160));

        // Kill prediction
        const killOP = poissonOP(mc.kills, lines.kill);
        const killPick = killOP > minPickProb ? 'over' : (1 - killOP) > minPickProb ? 'under' : null;
        if (killPick) {
            const actualOver = realKill > lines.kill;
            const correct = (killPick === 'over' && actualOver) || (killPick === 'under' && !actualOver);
            results.kills.t++; results.all.t++;
            if (correct) { results.kills.c++; results.all.c++; }
        }

        // Tower prediction
        const towerOP = poissonOP(mc.towers, lines.tower);
        const towerPick = towerOP > minPickProb ? 'over' : (1 - towerOP) > minPickProb ? 'under' : null;
        if (towerPick) {
            const actualOver = realTower > lines.tower;
            const correct = (towerPick === 'over' && actualOver) || (towerPick === 'under' && !actualOver);
            results.towers.t++; results.all.t++;
            if (correct) { results.towers.c++; results.all.c++; }
        }

        // Time prediction
        const timeOP = mc.samplesD.filter(d => d > lines.time).length / mc.samplesD.length;
        const timePick = timeOP > minPickProb ? 'over' : (1 - timeOP) > minPickProb ? 'under' : null;
        if (timePick) {
            const actualOver = realDur > lines.time;
            const correct = (timePick === 'over' && actualOver) || (timePick === 'under' && !actualOver);
            results.time.t++; results.all.t++;
            if (correct) { results.time.c++; results.all.c++; }
        }
    }

    return results;
}

async function run() {
    const rawMatches = await fetchAllProMatches();
    const validMatches = rawMatches.filter(m =>
        m.radiant_name && m.dire_name &&
        m.radiant_score != null && m.dire_score != null &&
        m.duration && m.duration > 300
    );

    console.log(`\n📊 Valid matches: ${validMatches.length}`);

    // Compute real stats first
    const realKills = validMatches.map(m => m.radiant_score + m.dire_score);
    const realDurations = validMatches.map(m => Math.round(m.duration / 60));
    const realTowers = validMatches.map(m => Math.min(22, Math.round(m.duration / 160)));
    const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
    const median = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

    console.log(`\n📊 Real Statistics:`);
    console.log(`  Kills:    mean=${mean(realKills).toFixed(1)}, median=${median(realKills)}`);
    console.log(`  Towers:   mean=${mean(realTowers).toFixed(1)}, median=${median(realTowers)}`);
    console.log(`  Duration: mean=${mean(realDurations).toFixed(1)}, median=${median(realDurations)}`);

    // ===== GRID SEARCH: Find best kill line =====
    console.log('\n' + '='.repeat(70));
    console.log('🔍 GRID SEARCH: Finding optimal lines');
    console.log('='.repeat(70));

    const killLines = [45.5, 48.5, 50.5, 52.5, 54.5, 55.5, 56.5, 58.5, 60.5];
    const towerLines = [10.5, 11.5, 12.5, 13.5, 14.5];
    const timeLines = [30.5, 32.5, 33.5, 34.5, 36.5];
    const pickThresholds = [0.55, 0.60, 0.65, 0.70, 0.75, 0.80];

    // Test kill lines
    console.log('\n--- Kill Line Optimization (minProb=0.55) ---');
    for (const kl of killLines) {
        const r = backtestWithParams(validMatches, { kill: kl, tower: 12.5, time: 33.5 }, 0.55);
        const pct = r.kills.t > 0 ? (r.kills.c / r.kills.t * 100).toFixed(1) : 'N/A';
        const bar = '█'.repeat(Math.round(parseFloat(pct) / 5)) + '░'.repeat(20 - Math.round(parseFloat(pct) / 5));
        console.log(`  kill=${String(kl).padEnd(5)} → ${r.kills.c}/${r.kills.t} = ${pct}% ${bar}`);
    }

    // Test tower lines
    console.log('\n--- Tower Line Optimization (minProb=0.55) ---');
    for (const tl of towerLines) {
        const r = backtestWithParams(validMatches, { kill: 55.5, tower: tl, time: 33.5 }, 0.55);
        const pct = r.towers.t > 0 ? (r.towers.c / r.towers.t * 100).toFixed(1) : 'N/A';
        const bar = '█'.repeat(Math.round(parseFloat(pct) / 5)) + '░'.repeat(20 - Math.round(parseFloat(pct) / 5));
        console.log(`  tower=${String(tl).padEnd(5)} → ${r.towers.c}/${r.towers.t} = ${pct}% ${bar}`);
    }

    // Test time lines
    console.log('\n--- Time Line Optimization (minProb=0.55) ---');
    for (const tl of timeLines) {
        const r = backtestWithParams(validMatches, { kill: 55.5, tower: 12.5, time: tl }, 0.55);
        const pct = r.time.t > 0 ? (r.time.c / r.time.t * 100).toFixed(1) : 'N/A';
        const bar = '█'.repeat(Math.round(parseFloat(pct) / 5)) + '░'.repeat(20 - Math.round(parseFloat(pct) / 5));
        console.log(`  time=${String(tl).padEnd(5)} → ${r.time.c}/${r.time.t} = ${pct}% ${bar}`);
    }

    // ===== CONFIDENCE THRESHOLD TESTING =====
    console.log('\n' + '='.repeat(70));
    console.log('🎯 CONFIDENCE THRESHOLD: Accuracy vs Volume');
    console.log('='.repeat(70));

    // Use calibrated lines
    const optLines = { kill: 55.5, tower: 12.5, time: 33.5 };

    for (const thresh of pickThresholds) {
        const r = backtestWithParams(validMatches, optLines, thresh);
        const killPct = r.kills.t > 0 ? (r.kills.c / r.kills.t * 100).toFixed(1) : 'N/A';
        const towerPct = r.towers.t > 0 ? (r.towers.c / r.towers.t * 100).toFixed(1) : 'N/A';
        const timePct = r.time.t > 0 ? (r.time.c / r.time.t * 100).toFixed(1) : 'N/A';
        const allPct = r.all.t > 0 ? (r.all.c / r.all.t * 100).toFixed(1) : 'N/A';
        console.log(`  minProb=${thresh.toFixed(2)} → ALL: ${r.all.c}/${r.all.t}=${allPct}% | kills=${killPct}% (${r.kills.t}) | towers=${towerPct}% (${r.towers.t}) | time=${timePct}% (${r.time.t})`);
    }

    // ===== SWEET SPOT ANALYSIS =====
    console.log('\n' + '='.repeat(70));
    console.log('💎 SWEET SPOT: Best accuracy-to-volume ratio');
    console.log('='.repeat(70));

    let bestConfig = null, bestScore = 0;
    for (const kl of [52.5, 54.5, 55.5, 56.5, 58.5]) {
        for (const tl of [11.5, 12.5, 13.5]) {
            for (const timl of [32.5, 33.5, 34.5]) {
                for (const th of [0.55, 0.60, 0.65, 0.70, 0.75]) {
                    const r = backtestWithParams(validMatches, { kill: kl, tower: tl, time: timl }, th);
                    if (r.all.t < 20) continue; // Need minimum sample
                    const pct = r.all.c / r.all.t * 100;
                    // Score = accuracy * sqrt(volume) — balance accuracy and volume
                    const score = pct * Math.sqrt(r.all.t);
                    if (score > bestScore) {
                        bestScore = score;
                        bestConfig = { kill: kl, tower: tl, time: timl, thresh: th, correct: r.all.c, total: r.all.t, pct, score, kills: r.kills, towers: r.towers, time: r.time };
                    }
                }
            }
        }
    }

    if (bestConfig) {
        console.log(`\n  🏆 OPTIMAL CONFIG:`);
        console.log(`     Kill line: ${bestConfig.kill}`);
        console.log(`     Tower line: ${bestConfig.tower}`);
        console.log(`     Time line: ${bestConfig.time}`);
        console.log(`     Min probability: ${bestConfig.thresh}`);
        console.log(`     Overall: ${bestConfig.correct}/${bestConfig.total} = ${bestConfig.pct.toFixed(1)}%`);
        console.log(`     Kills: ${bestConfig.kills.c}/${bestConfig.kills.t} = ${bestConfig.kills.t > 0 ? (bestConfig.kills.c / bestConfig.kills.t * 100).toFixed(1) : 'N/A'}%`);
        console.log(`     Towers: ${bestConfig.towers.c}/${bestConfig.towers.t} = ${bestConfig.towers.t > 0 ? (bestConfig.towers.c / bestConfig.towers.t * 100).toFixed(1) : 'N/A'}%`);
        console.log(`     Time: ${bestConfig.time.c}/${bestConfig.time.t} = ${bestConfig.time.t > 0 ? (bestConfig.time.c / bestConfig.time.t * 100).toFixed(1) : 'N/A'}%`);
        console.log(`     Score (accuracy*√volume): ${bestConfig.score.toFixed(1)}`);
    }

    // Also find best config for HIGH ACCURACY (>70%) with decent volume (>10 bets)
    console.log('\n  🎯 HIGH ACCURACY CONFIGS (>70%, >10 bets):');
    const highAccConfigs = [];
    for (const kl of [52.5, 54.5, 55.5, 56.5, 58.5]) {
        for (const tl of [11.5, 12.5, 13.5]) {
            for (const timl of [32.5, 33.5, 34.5]) {
                for (const th of [0.55, 0.60, 0.65, 0.70, 0.75, 0.80]) {
                    const r = backtestWithParams(validMatches, { kill: kl, tower: tl, time: timl }, th);
                    if (r.all.t < 10) continue;
                    const pct = r.all.c / r.all.t * 100;
                    if (pct >= 70) highAccConfigs.push({ kill: kl, tower: tl, time: timl, thresh: th, c: r.all.c, t: r.all.t, pct });
                }
            }
        }
    }

    highAccConfigs.sort((a, b) => b.t - a.t); // Sort by volume
    for (const c of highAccConfigs.slice(0, 10)) {
        console.log(`     kill=${c.kill} tower=${c.tower} time=${c.time} thresh=${c.thresh} → ${c.c}/${c.t} = ${c.pct.toFixed(1)}%`);
    }

    // Save results
    const fs = require('fs');
    fs.writeFileSync('backtest_v2_results.json', JSON.stringify({ bestConfig, highAccConfigs: highAccConfigs.slice(0, 20) }, null, 2));
    console.log('\n💾 Results saved to backtest_v2_results.json');
}

run().catch(err => console.error('Fatal:', err));
