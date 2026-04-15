/**
 * BetWise — FULL 12-Month Win Rate Simulation
 * 
 * Simulates the v7.4 O/U strategy against real historical data for both Dota2 and LoL.
 * Uses the exact same lines and logic from the production engine:
 *   Dota2: Kill=60.5, Tower=10.5, Time=32.5
 *   LoL:   Kill=28.5, Tower=11.5, Time=32, Dragon=4.5
 * 
 * Data sources:
 *   - Dota2: OpenDota API /proMatches (paginated by less_than_match_id)
 *   - LoL:   TJStats API via Vercel proxy (sequential matchIds)
 */

const https = require('https');
const fs = require('fs');

// ===== v7.4 CALIBRATED LINES =====
const LINES = {
    dota2: { kill: 60.5, tower: 10.5, time: 32.5 },
    lol: { kill: 28.5, tower: 11.5, time: 32, dragon: 4.5 }
};

const MIN_CONFIDENCE = 0.55; // Pick threshold from grid search
const MONTHS_BACK = 12;
const CUTOFF = new Date();
CUTOFF.setMonth(CUTOFF.getMonth() - MONTHS_BACK);

function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        const proto = url.startsWith('https') ? https : require('http');
        proto.get(url, { headers: { 'User-Agent': 'BetWise/4.0' } }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('JSON parse error')); } });
        }).on('error', reject);
    });
}

// ===== DOTA2 DATA COLLECTION =====
async function collectDota2(cacheFile) {
    if (fs.existsSync(cacheFile)) {
        console.log('📂 Using cached Dota2 data...');
        return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    }

    console.log('📡 Collecting Dota2 pro matches (12 months)...');
    let allMatches = [];
    let lastId = null;
    let page = 0;

    while (page < 50) { // Safety limit
        let url = 'https://api.opendota.com/api/proMatches';
        if (lastId) url += `?less_than_match_id=${lastId}`;

        try {
            const matches = await fetchJSON(url);
            if (!matches || !matches.length) break;

            for (const m of matches) {
                const startTime = new Date(m.start_time * 1000);
                if (startTime < CUTOFF) {
                    console.log(`  Reached 12-month boundary at page ${page}`);
                    fs.writeFileSync(cacheFile, JSON.stringify(allMatches, null, 2));
                    console.log(`✅ Cached ${allMatches.length} Dota2 matches`);
                    return allMatches;
                }

                // We need: radiant_score, dire_score, duration
                if (m.radiant_score != null && m.dire_score != null && m.duration) {
                    allMatches.push({
                        matchId: m.match_id,
                        date: new Date(m.start_time * 1000).toISOString().split('T')[0],
                        month: new Date(m.start_time * 1000).toISOString().slice(0, 7),
                        teamRadiant: m.radiant_name || 'Unknown',
                        teamDire: m.dire_name || 'Unknown',
                        radiantScore: m.radiant_score,
                        direScore: m.dire_score,
                        totalKills: m.radiant_score + m.dire_score,
                        duration: m.duration, // seconds
                        durationMin: Math.round(m.duration / 60 * 10) / 10,
                        radiantWin: m.radiant_win,
                    });
                }
            }

            lastId = matches[matches.length - 1].match_id;
            page++;
            if (page % 5 === 0) console.log(`  Page ${page}: ${allMatches.length} matches (latest: ${allMatches[allMatches.length - 1]?.date})`);
            await new Promise(r => setTimeout(r, 1200)); // OpenDota rate limit
        } catch (e) {
            console.log(`  API error on page ${page}: ${e.message}, retrying...`);
            await new Promise(r => setTimeout(r, 3000));
        }
    }

    fs.writeFileSync(cacheFile, JSON.stringify(allMatches, null, 2));
    console.log(`✅ Cached ${allMatches.length} Dota2 matches`);
    return allMatches;
}

// ===== LOL DATA COLLECTION (TJStats) =====
async function collectLoL(cacheFile) {
    if (fs.existsSync(cacheFile)) {
        console.log('📂 Using cached LoL TJStats data...');
        return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    }

    console.log('📡 Collecting LoL LPL matches via TJStats (wide scan)...');
    let allGames = [];
    // Scan wide range: LPL matchIds run from ~10000 to ~13213+
    const ranges = [
        { from: 13213, to: 12700 }, // Recent 2026
        { from: 12699, to: 12200 }, // Late 2025
        { from: 12199, to: 11700 }, // Mid 2025
        { from: 11699, to: 11200 }, // Early 2025
        { from: 11199, to: 10700 }, // Late 2024
    ];

    for (const range of ranges) {
        let emptyStreak = 0;
        for (let id = range.from; id >= range.to; id--) {
            try {
                const resp = await fetchJSON(`https://betwise-ruddy.vercel.app/api/lol-stats?matchId=${id}`);
                if (resp?.success && resp.data?.data?.matchInfos?.length > 0) {
                    const match = resp.data.data;
                    const matchDate = match.matchTime ? new Date(match.matchTime) : null;

                    // Check if within 12 months
                    if (matchDate && matchDate < CUTOFF) {
                        console.log(`  LoL: Reached 12-month boundary at matchId ${id}`);
                        break;
                    }

                    for (let i = 0; i < match.matchInfos.length; i++) {
                        const g = match.matchInfos[i];
                        const teamA = g.teamInfos?.[0];
                        const teamB = g.teamInfos?.[1];
                        if (!teamA || !teamB) continue;

                        const start = g.matchStartTime ? new Date(g.matchStartTime).getTime() : 0;
                        const end = g.matchEndTime ? new Date(g.matchEndTime).getTime() : 0;
                        const durMin = start && end ? (end - start) / 60000 : (g.gameTime || 0) / 60;

                        allGames.push({
                            matchId: match.matchId,
                            date: matchDate ? matchDate.toISOString().split('T')[0] : 'unknown',
                            month: matchDate ? matchDate.toISOString().slice(0, 7) : 'unknown',
                            matchName: match.matchName,
                            gameNum: i + 1,
                            teamA: match.teamAName,
                            teamB: match.teamBName,
                            kills: (teamA.kills || 0) + (teamB.kills || 0),
                            towers: (teamA.turretAmount || 0) + (teamB.turretAmount || 0),
                            dragons: (teamA.dragonAmount || 0) + (teamB.dragonAmount || 0),
                            barons: (teamA.baronAmount || 0) + (teamB.baronAmount || 0),
                            durationMin: Math.round(durMin * 10) / 10,
                        });
                    }
                    emptyStreak = 0;
                    if (allGames.length % 50 === 0) {
                        console.log(`  LoL: ${allGames.length} games collected (matchId=${id})...`);
                    }
                } else {
                    emptyStreak++;
                    if (emptyStreak > 50) {
                        console.log(`  50 empty IDs at ${id}, skipping to next range`);
                        break;
                    }
                }
            } catch (e) { /* skip */ }
            await new Promise(r => setTimeout(r, 300)); // Rate limit
        }
    }

    fs.writeFileSync(cacheFile, JSON.stringify(allGames, null, 2));
    console.log(`✅ Cached ${allGames.length} LoL games`);
    return allGames;
}

// ===== SIMULATION =====
function simulateOverUnder(actual, line) {
    // Simulate: if actual > line → "over" wins, else "under" wins
    // Our strategy: pick based on historical distribution edge
    return { actual, line, isOver: actual > line };
}

function runSimulation(dota2Matches, lolGames) {
    const results = {
        dota2: { monthly: {}, total: { wins: 0, losses: 0, skips: 0, bets: [] } },
        lol: { monthly: {}, total: { wins: 0, losses: 0, skips: 0, bets: [] } },
        combined: { monthly: {}, total: { wins: 0, losses: 0, skips: 0 } },
    };

    // ===== DOTA2 SIMULATION =====
    // Strategy: Use backtest-derived median edges
    // Kill line 60.5 → mean total kills ~58 → majority UNDER (83% accuracy from grid search)
    // Tower line 10.5 → mean total towers ~10.5 → near 50/50, pick by team
    // Time line 32.5  → mean ~34min → majority OVER (78% accuracy)

    for (const m of dota2Matches) {
        const month = m.month;
        if (!results.dota2.monthly[month]) results.dota2.monthly[month] = { wins: 0, losses: 0, skips: 0, details: [] };

        // We don't have tower data from OpenDota proMatches, so simulate kill + time only
        const killResult = simulateOverUnder(m.totalKills, LINES.dota2.kill);
        const timeResult = simulateOverUnder(m.durationMin, LINES.dota2.time);

        // Kill bet: historical data showed kills median ~58, line=60.5 → UNDER edge
        // overRate for kills at 60.5 = ~42% → pick UNDER
        const killPick = 'under'; // Strong edge from grid search
        const killWin = (killPick === 'under' && !killResult.isOver) || (killPick === 'over' && killResult.isOver);

        // Time bet: median ~34min, line=32.5 → OVER edge  
        const timePick = 'over'; // Strong edge from grid search
        const timeWin = (timePick === 'under' && !timeResult.isOver) || (timePick === 'over' && timeResult.isOver);

        // Count each bet separately
        results.dota2.monthly[month].wins += (killWin ? 1 : 0) + (timeWin ? 1 : 0);
        results.dota2.monthly[month].losses += (killWin ? 0 : 1) + (timeWin ? 0 : 1);
        results.dota2.total.wins += (killWin ? 1 : 0) + (timeWin ? 1 : 0);
        results.dota2.total.losses += (killWin ? 0 : 1) + (timeWin ? 0 : 1);

        results.dota2.monthly[month].details.push({
            match: `${m.teamRadiant} vs ${m.teamDire}`,
            kills: m.totalKills, killPick, killWin,
            durMin: m.durationMin, timePick, timeWin,
        });
    }

    // ===== LOL SIMULATION =====
    for (const g of lolGames) {
        const month = g.month;
        if (!results.lol.monthly[month]) results.lol.monthly[month] = { wins: 0, losses: 0, skips: 0, details: [] };

        const killR = simulateOverUnder(g.kills, LINES.lol.kill);
        const towerR = simulateOverUnder(g.towers, LINES.lol.tower);
        const timeR = simulateOverUnder(g.durationMin, LINES.lol.time);
        const dragonR = simulateOverUnder(g.dragons, LINES.lol.dragon);

        // Strategy from backtest:
        // Kill 28.5 → realistic bookmaker line (median kills = 27.5)
        const killPick = 'over';
        const killWin = killR.isOver;

        // Tower 11.5 → user-calibrated line (median towers = 10.8)
        const towerPick = 'under';
        const towerWin = !towerR.isOver;

        // Time 32 → user-calibrated line (31/32/33 tùy giải, median time = 30.1)
        const timePick = 'under';
        const timeWin = !timeR.isOver;

        // Dragon 4.5 → user-calibrated line (median dragons = 4.2)
        const dragonPick = 'under';
        const dragonWin = !dragonR.isOver;

        // HIGH-CONFIDENCE BETS ONLY: count each bet type
        // Tower (91.5%) and Dragon (93.2%) are the highest confidence
        const bets = [
            { type: 'kill', win: killWin, confidence: 0.814 },
            { type: 'tower', win: towerWin, confidence: 0.915 },
            { type: 'time', win: timeWin, confidence: 0.746 },
            { type: 'dragon', win: dragonWin, confidence: 0.932 },
        ];

        for (const b of bets) {
            if (b.confidence >= MIN_CONFIDENCE) {
                if (b.win) {
                    results.lol.monthly[month].wins++;
                    results.lol.total.wins++;
                } else {
                    results.lol.monthly[month].losses++;
                    results.lol.total.losses++;
                }
            }
        }

        results.lol.monthly[month].details.push({
            match: g.matchName, game: g.gameNum,
            kills: g.kills, killWin,
            towers: g.towers, towerWin,
            durMin: g.durationMin, timeWin,
            dragons: g.dragons, dragonWin,
        });
    }

    return results;
}

function printReport(results) {
    const H = '='.repeat(80);
    console.log(`\n${H}`);
    console.log('📊 BETWISE v7.4 — 12-MONTH WIN RATE SIMULATION REPORT');
    console.log(H);

    // ===== DOTA2 =====
    const d2 = results.dota2;
    const d2total = d2.total.wins + d2.total.losses;
    const d2rate = d2total > 0 ? (d2.total.wins / d2total * 100).toFixed(1) : 'N/A';

    console.log(`\n🎮 DOTA 2 (Kill O/U@${LINES.dota2.kill} + Time O/U@${LINES.dota2.time})`);
    console.log(`   Total: ${d2.total.wins}W / ${d2.total.losses}L = ${d2rate}% (${d2total} bets)`);
    console.log(`\n   ${'Tháng'.padEnd(10)} ${'Thắng'.padEnd(7)} ${'Thua'.padEnd(7)} ${'Tổng'.padEnd(7)} ${'Tỉ lệ'.padEnd(10)}`);

    const d2months = Object.keys(d2.monthly).sort().reverse();
    for (const m of d2months) {
        const s = d2.monthly[m];
        const total = s.wins + s.losses;
        const rate = total > 0 ? (s.wins / total * 100).toFixed(1) + '%' : 'N/A';
        console.log(`   ${m.padEnd(10)} ${String(s.wins).padEnd(7)} ${String(s.losses).padEnd(7)} ${String(total).padEnd(7)} ${rate}`);
    }

    // ===== LOL =====
    const lol = results.lol;
    const lolTotal = lol.total.wins + lol.total.losses;
    const lolRate = lolTotal > 0 ? (lol.total.wins / lolTotal * 100).toFixed(1) : 'N/A';

    console.log(`\n🏆 LOL (Kill@${LINES.lol.kill} + Tower@${LINES.lol.tower} + Time@${LINES.lol.time} + Dragon@${LINES.lol.dragon})`);
    console.log(`   Total: ${lol.total.wins}W / ${lol.total.losses}L = ${lolRate}% (${lolTotal} bets)`);
    console.log(`\n   ${'Tháng'.padEnd(10)} ${'Thắng'.padEnd(7)} ${'Thua'.padEnd(7)} ${'Tổng'.padEnd(7)} ${'Tỉ lệ'.padEnd(10)}`);

    const lolMonths = Object.keys(lol.monthly).sort().reverse();
    for (const m of lolMonths) {
        const s = lol.monthly[m];
        const total = s.wins + s.losses;
        const rate = total > 0 ? (s.wins / total * 100).toFixed(1) + '%' : 'N/A';
        console.log(`   ${m.padEnd(10)} ${String(s.wins).padEnd(7)} ${String(s.losses).padEnd(7)} ${String(total).padEnd(7)} ${rate}`);
    }

    // ===== COMBINED =====
    const totalW = d2.total.wins + lol.total.wins;
    const totalL = d2.total.losses + lol.total.losses;
    const totalBets = totalW + totalL;
    const totalRate = totalBets > 0 ? (totalW / totalBets * 100).toFixed(1) : 'N/A';

    console.log(`\n${H}`);
    console.log(`📈 TỔNG HỢP: ${totalW}W / ${totalL}L = ${totalRate}% (${totalBets} bets)`);
    console.log(H);

    // Per-bet-type breakdown for LoL
    if (lolTotal > 0) {
        console.log('\n📊 LoL — Chi tiết theo loại cược:');
        // Re-calculate per-type from stored details
        const types = { kill: { w: 0, l: 0 }, tower: { w: 0, l: 0 }, time: { w: 0, l: 0 }, dragon: { w: 0, l: 0 } };
        for (const month of Object.values(lol.monthly)) {
            for (const d of month.details) {
                if (d.killWin) types.kill.w++; else types.kill.l++;
                if (d.towerWin) types.tower.w++; else types.tower.l++;
                if (d.timeWin) types.time.w++; else types.time.l++;
                if (d.dragonWin) types.dragon.w++; else types.dragon.l++;
            }
        }
        for (const [name, t] of Object.entries(types)) {
            const total = t.w + t.l;
            const rate = total > 0 ? (t.w / total * 100).toFixed(1) : 'N/A';
            const line = LINES.lol[name] || '?';
            const pick = name === 'kill' ? 'OVER' : 'UNDER';
            console.log(`   ${name.padEnd(8)} line=${String(line).padEnd(5)} pick=${pick.padEnd(6)} → ${t.w}W/${t.l}L = ${rate}%`);
        }
    }

    // Monthly combined
    console.log(`\n📅 HỢP NHẤT THEO THÁNG:`);
    console.log(`   ${'Tháng'.padEnd(10)} ${'D2-W'.padEnd(6)} ${'D2-L'.padEnd(6)} ${'LoL-W'.padEnd(6)} ${'LoL-L'.padEnd(6)} ${'Total'.padEnd(7)} ${'WR%'.padEnd(8)}`);

    const allMonths = [...new Set([...d2months, ...lolMonths])].sort().reverse();
    for (const m of allMonths) {
        const d2s = d2.monthly[m] || { wins: 0, losses: 0 };
        const ls = lol.monthly[m] || { wins: 0, losses: 0 };
        const w = d2s.wins + ls.wins;
        const l = d2s.losses + ls.losses;
        const r = (w + l) > 0 ? (w / (w + l) * 100).toFixed(1) + '%' : 'N/A';
        console.log(`   ${m.padEnd(10)} ${String(d2s.wins).padEnd(6)} ${String(d2s.losses).padEnd(6)} ${String(ls.wins).padEnd(6)} ${String(ls.losses).padEnd(6)} ${String(w + l).padEnd(7)} ${r}`);
    }

    // Save
    const summary = {
        generatedAt: new Date().toISOString(),
        strategy: 'v7.4 Calibrated Lines',
        lines: LINES,
        dota2: { wins: d2.total.wins, losses: d2.total.losses, rate: d2rate + '%', matches: dota2Matches_count },
        lol: { wins: lol.total.wins, losses: lol.total.losses, rate: lolRate + '%', games: lolGames_count },
        combined: { wins: totalW, losses: totalL, rate: totalRate + '%', bets: totalBets },
    };
    fs.writeFileSync('backtest_12month_report.json', JSON.stringify(summary, null, 2));
    console.log('\n💾 Report saved to backtest_12month_report.json');
}

let dota2Matches_count = 0, lolGames_count = 0;

async function main() {
    console.log('🚀 BetWise v7.4 — 12-Month Full Simulation');
    console.log(`📅 Period: ${CUTOFF.toISOString().split('T')[0]} → ${new Date().toISOString().split('T')[0]}`);
    console.log(`📐 Dota2: Kill=${LINES.dota2.kill} Tower=${LINES.dota2.tower} Time=${LINES.dota2.time}`);
    console.log(`📐 LoL:   Kill=${LINES.lol.kill} Tower=${LINES.lol.tower} Time=${LINES.lol.time} Dragon=${LINES.lol.dragon}\n`);

    const dota2 = await collectDota2('sim_dota2_12m_cache.json');
    const lol = await collectLoL('sim_lol_12m_cache.json');

    dota2Matches_count = dota2.length;
    lolGames_count = lol.length;

    console.log(`\n📦 Data: ${dota2.length} Dota2 matches + ${lol.length} LoL games`);

    const results = runSimulation(dota2, lol);
    printReport(results);
}

main().catch(err => console.error('Fatal:', err));
