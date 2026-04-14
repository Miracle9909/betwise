/**
 * BetWise LoL Deep Backtester — Using TJStats API via Vercel Proxy
 * 
 * Scans sequential matchIds to collect LPL match data with per-game stats
 * then runs O/U backtest for kills, towers, and duration.
 */

const https = require('https');
const fs = require('fs');

const PROXY_URL = 'https://betwise-ruddy.vercel.app/api/lol-stats';

// ===== LoL LINES to test =====
const LOL_LINES = {
    kill: 24.5,
    tower: 11.5,
    time: 31.5,
    dragon: 4.5,
};

function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'BetWise/4.0' } }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('Parse error')); } });
        }).on('error', reject);
    });
}

async function fetchMatchData(matchId) {
    try {
        const resp = await fetchJSON(`${PROXY_URL}?matchId=${matchId}`);
        if (!resp.success || !resp.data?.data || !resp.data.success) return null;
        return resp.data.data;
    } catch (e) { return null; }
}

function extractGames(match) {
    if (!match.matchInfos?.length) return [];
    return match.matchInfos.map((g, idx) => {
        const teamA = g.teamInfos?.[0];
        const teamB = g.teamInfos?.[1];
        if (!teamA || !teamB) return null;

        const totalKills = (teamA.kills || 0) + (teamB.kills || 0);
        const totalTowers = (teamA.turretAmount || 0) + (teamB.turretAmount || 0);
        const totalDragons = (teamA.dragonAmount || 0) + (teamB.dragonAmount || 0);
        const totalBarons = (teamA.baronAmount || 0) + (teamB.baronAmount || 0);

        const start = g.matchStartTime ? new Date(g.matchStartTime).getTime() : 0;
        const end = g.matchEndTime ? new Date(g.matchEndTime).getTime() : 0;
        const durationMin = start && end ? (end - start) / 60000 : (g.gameTime || 0) / 60;

        return {
            matchId: match.matchId,
            matchName: match.matchName,
            gameNum: idx + 1,
            totalGames: match.matchInfos.length,
            teamA: match.teamAName,
            teamB: match.teamBName,
            kills: totalKills,
            towers: totalTowers,
            dragons: totalDragons,
            barons: totalBarons,
            durationMin: Math.round(durationMin * 10) / 10,
            durationSec: g.gameTime || Math.round((end - start) / 1000),
            winner: g.matchWin === match.teamAId ? match.teamAName : match.teamBName,
            matchTime: match.matchTime,
        };
    }).filter(Boolean);
}

async function run() {
    const cacheFile = 'backtest_lol_tjstats_cache.json';
    let allGames = [];

    if (fs.existsSync(cacheFile)) {
        console.log('📂 Using cached LoL TJStats data...');
        allGames = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    } else {
        // Scan matchIds from most recent backward
        const START_ID = 13213; // Most recent known
        const SCAN_COUNT = 500; // Go back 500 IDs

        console.log(`📡 Scanning ${SCAN_COUNT} matchIds from ${START_ID} backward...`);
        let found = 0, empty = 0;

        for (let id = START_ID; id > START_ID - SCAN_COUNT; id--) {
            const match = await fetchMatchData(id);
            if (match && match.matchInfos?.length > 0) {
                const games = extractGames(match);
                allGames.push(...games);
                found++;
                if (found % 20 === 0) {
                    console.log(`  Found ${found} matches, ${allGames.length} games (id=${id})...`);
                }
                empty = 0;
            } else {
                empty++;
                if (empty > 30) {
                    console.log(`  30 consecutive empty IDs at ${id}, stopping.`);
                    break;
                }
            }
            // Rate limit
            await new Promise(r => setTimeout(r, 250));
        }

        fs.writeFileSync(cacheFile, JSON.stringify(allGames, null, 2));
        console.log(`✅ Cached ${allGames.length} games from ${found} matches`);
    }

    if (allGames.length === 0) {
        console.log('❌ No games found');
        return;
    }

    // ===== STATISTICS =====
    const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
    const median = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
    const sd = a => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length); };

    console.log(`\n${'='.repeat(70)}`);
    console.log(`📈 LOL DEEP BACKTEST — ${allGames.length} games from TJStats`);
    console.log('='.repeat(70));

    const kills = allGames.map(g => g.kills);
    const towers = allGames.map(g => g.towers);
    const durations = allGames.map(g => g.durationMin);
    const dragons = allGames.map(g => g.dragons);

    console.log('\n📊 Real LoL Statistics:');
    console.log(`  Kills:    mean=${mean(kills).toFixed(1)}, median=${median(kills)}, sd=${sd(kills).toFixed(1)}`);
    console.log(`  Towers:   mean=${mean(towers).toFixed(1)}, median=${median(towers)}, sd=${sd(towers).toFixed(1)}`);
    console.log(`  Duration: mean=${mean(durations).toFixed(1)}, median=${median(durations)}, sd=${sd(durations).toFixed(1)}`);
    console.log(`  Dragons:  mean=${mean(dragons).toFixed(1)}, median=${median(dragons)}, sd=${sd(dragons).toFixed(1)}`);

    // ===== GRID SEARCH =====
    console.log(`\n${'='.repeat(70)}`);
    console.log('🔍 GRID SEARCH: Optimal LoL Lines');
    console.log('='.repeat(70));

    const results = [];
    for (const kl of [20.5, 22.5, 24.5, 26.5, 28.5]) {
        for (const tl of [9.5, 10.5, 11.5, 12.5, 13.5]) {
            for (const dl of [29.5, 30.5, 31.5, 32.5, 33.5]) {
                for (const drl of [3.5, 4.5, 5.5]) {
                    let correct = 0, total = 0;
                    let kCorrect = 0, kTotal = 0;
                    let tCorrect = 0, tTotal = 0;
                    let dCorrect = 0, dTotal = 0;
                    let drCorrect = 0, drTotal = 0;

                    for (const g of allGames) {
                        // For each stat, if the value is > line, pick "Over", else "Under"  
                        // We check if the pick is correct

                        // Kill O/U — which side has better edge?
                        const killOver = g.kills > kl;
                        const killOverRate = allGames.filter(x => x.kills > kl).length / allGames.length;
                        const killPick = killOverRate > 0.55 ? 'over' : killOverRate < 0.45 ? 'under' : null;
                        if (killPick) {
                            kTotal++;
                            if ((killPick === 'over' && killOver) || (killPick === 'under' && !killOver)) kCorrect++;
                        }

                        // Tower O/U
                        const towerOver = g.towers > tl;
                        const towerOverRate = allGames.filter(x => x.towers > tl).length / allGames.length;
                        const towerPick = towerOverRate > 0.55 ? 'over' : towerOverRate < 0.45 ? 'under' : null;
                        if (towerPick) {
                            tTotal++;
                            if ((towerPick === 'over' && towerOver) || (towerPick === 'under' && !towerOver)) tCorrect++;
                        }

                        // Duration O/U
                        const durOver = g.durationMin > dl;
                        const durOverRate = allGames.filter(x => x.durationMin > dl).length / allGames.length;
                        const durPick = durOverRate > 0.55 ? 'over' : durOverRate < 0.45 ? 'under' : null;
                        if (durPick) {
                            dTotal++;
                            if ((durPick === 'over' && durOver) || (durPick === 'under' && !durOver)) dCorrect++;
                        }

                        // Dragon O/U
                        const drOver = g.dragons > drl;
                        const drOverRate = allGames.filter(x => x.dragons > drl).length / allGames.length;
                        const drPick = drOverRate > 0.55 ? 'over' : drOverRate < 0.45 ? 'under' : null;
                        if (drPick) {
                            drTotal++;
                            if ((drPick === 'over' && drOver) || (drPick === 'under' && !drOver)) drCorrect++;
                        }
                    }

                    const allCorrect = kCorrect + tCorrect + dCorrect + drCorrect;
                    const allTotal = kTotal + tTotal + dTotal + drTotal;
                    if (allTotal > 0) {
                        results.push({
                            kl, tl, dl, drl,
                            allPct: allCorrect / allTotal * 100,
                            allCorrect, allTotal,
                            kPct: kTotal > 0 ? kCorrect / kTotal * 100 : 0,
                            tPct: tTotal > 0 ? tCorrect / tTotal * 100 : 0,
                            dPct: dTotal > 0 ? dCorrect / dTotal * 100 : 0,
                            drPct: drTotal > 0 ? drCorrect / drTotal * 100 : 0,
                        });
                    }
                }
            }
        }
    }

    // Sort by accuracy
    results.sort((a, b) => b.allPct - a.allPct);

    console.log('\n  TOP 10 LoL Configs:');
    console.log('  ' + 'Kill'.padEnd(6) + 'Tower'.padEnd(7) + 'Time'.padEnd(6) + 'Dragon'.padEnd(8) + 'ALL'.padEnd(15) + 'K%'.padEnd(8) + 'T%'.padEnd(8) + 'D%'.padEnd(8) + 'Dr%'.padEnd(8));
    for (const c of results.slice(0, 10)) {
        console.log(`  ${String(c.kl).padEnd(6)}${String(c.tl).padEnd(7)}${String(c.dl).padEnd(6)}${String(c.drl).padEnd(8)}${c.allPct.toFixed(1)}%`.padEnd(17) + `${c.kPct.toFixed(0)}%`.padEnd(8) + `${c.tPct.toFixed(0)}%`.padEnd(8) + `${c.dPct.toFixed(0)}%`.padEnd(8) + `${c.drPct.toFixed(0)}%`.padEnd(8));
    }

    // ===== Per-stat optimal line =====
    console.log('\n  OPTIMAL LINE PER STAT:');
    for (const [stat, values, lineOptions] of [
        ['Kills', kills, [18.5, 20.5, 22.5, 24.5, 26.5, 28.5, 30.5]],
        ['Towers', towers, [8.5, 9.5, 10.5, 11.5, 12.5, 13.5, 14.5]],
        ['Duration', durations, [28.5, 29.5, 30.5, 31.5, 32.5, 33.5, 34.5]],
        ['Dragons', dragons, [3.5, 4.5, 5.5, 6.5]],
    ]) {
        for (const line of lineOptions) {
            const overCount = values.filter(v => v > line).length;
            const overPct = overCount / values.length * 100;
            const edgePct = Math.abs(overPct - 50);
            const pick = overPct > 55 ? 'OVER' : overPct < 45 ? 'UNDER' : 'SKIP';
            const accuracy = pick === 'OVER' ? overPct : pick === 'UNDER' ? 100 - overPct : 50;
            console.log(`    ${stat.padEnd(10)} line=${String(line).padEnd(6)} ${overCount}/${values.length} over (${overPct.toFixed(1)}%) → ${pick.padEnd(6)} acc=${accuracy.toFixed(1)}% edge=${edgePct.toFixed(1)}%`);
        }
        console.log();
    }

    // Save results
    const summary = {
        totalGames: allGames.length,
        realStats: {
            kills: { mean: mean(kills), median: median(kills), sd: sd(kills) },
            towers: { mean: mean(towers), median: median(towers), sd: sd(towers) },
            duration: { mean: mean(durations), median: median(durations), sd: sd(durations) },
            dragons: { mean: mean(dragons), median: median(dragons), sd: sd(dragons) },
        },
        bestConfig: results[0],
        top10: results.slice(0, 10),
    };

    fs.writeFileSync('backtest_lol_deep_results.json', JSON.stringify(summary, null, 2));
    console.log('\n💾 Saved to backtest_lol_deep_results.json');
}

run().catch(err => console.error('Fatal:', err));
