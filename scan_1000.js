/**
 * BetWise — High-Speed LoL Match Scanner
 * 
 * Scans TJStats matchIds with parallel requests (10 concurrent) to collect ~1000 games.
 * Saves match-by-match data with all fields needed for backtest.
 */

const https = require('https');
const fs = require('fs');

const PROXY = 'https://betwise-ruddy.vercel.app/api/lol-stats';
const CACHE_FILE = 'lol_1000games_cache.json';
const CONCURRENCY = 5;  // 5 parallel requests to avoid Vercel rate limit
const SCAN_FROM = 13220;
const SCAN_TO = 5000;   // Go back far enough
const TARGET_GAMES = 1000;

function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), 8000);
        https.get(url, { headers: { 'User-Agent': 'BW/5' } }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => { clearTimeout(timer); try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
        }).on('error', e => { clearTimeout(timer); reject(e); });
    });
}

function extractGames(match) {
    if (!match?.matchInfos?.length) return [];
    const matchDate = match.matchTime ? new Date(match.matchTime) : null;

    return match.matchInfos.map((g, idx) => {
        const t0 = g.teamInfos?.[0];
        const t1 = g.teamInfos?.[1];
        if (!t0 || !t1) return null;

        const totalKills = (t0.kills || 0) + (t1.kills || 0);
        // Filter out match-level summary rows (kills < 5 = not a real game)
        if (totalKills < 5) return null;

        const start = g.matchStartTime ? new Date(g.matchStartTime).getTime() : 0;
        const end = g.matchEndTime ? new Date(g.matchEndTime).getTime() : 0;
        const durMin = start && end ? (end - start) / 60000 : (g.gameTime || 0) / 60;

        return {
            matchId: match.matchId,
            date: matchDate ? matchDate.toISOString().split('T')[0] : 'unknown',
            month: matchDate ? matchDate.toISOString().slice(0, 7) : 'unknown',
            name: match.matchName,
            game: idx + 1,
            teamA: match.teamAName,
            teamB: match.teamBName,
            kills: totalKills,
            towers: (t0.turretAmount || 0) + (t1.turretAmount || 0),
            dragons: (t0.dragonAmount || 0) + (t1.dragonAmount || 0),
            barons: (t0.baronAmount || 0) + (t1.baronAmount || 0),
            durMin: Math.round(durMin * 10) / 10,
            inhibs: (t0.inhibitKills || 0) + (t1.inhibitKills || 0),
            hasSoul: !!(t0.dragonSpirit || t1.dragonSpirit),
            firstTower: t0.isFirstTurret ? 'A' : (t1.isFirstTurret ? 'B' : null),
            winner: g.matchWin === match.teamAId ? match.teamAName : match.teamBName,
        };
    }).filter(Boolean);
}

async function scanBatch(ids) {
    const results = [];
    const promises = ids.map(async id => {
        try {
            const resp = await fetchJSON(`${PROXY}?matchId=${id}`);
            if (resp?.success && resp.data?.data?.matchInfos?.length > 0) {
                const games = extractGames(resp.data.data);
                if (games.length > 0) results.push(...games);
            }
        } catch (e) { /* skip */ }
    });
    await Promise.all(promises);
    return results;
}

async function main() {
    // Check cache
    if (fs.existsSync(CACHE_FILE)) {
        const cached = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        console.log(`📂 Cache exists: ${cached.length} games`);
        if (cached.length >= TARGET_GAMES) {
            console.log('✅ Already have enough games, running backtest...');
            runBacktest(cached);
            return;
        }
        console.log(`   Need ${TARGET_GAMES - cached.length} more, continuing scan...`);
    }

    console.log(`📡 Scanning matchIds ${SCAN_FROM} → ${SCAN_TO} (${CONCURRENCY} parallel)`);
    console.log(`   Target: ${TARGET_GAMES} games\n`);

    let allGames = [];
    if (fs.existsSync(CACHE_FILE)) {
        allGames = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    }
    const scannedIds = new Set(allGames.map(g => g.matchId));

    let emptyStreak = 0;
    let id = SCAN_FROM;

    while (id > SCAN_TO && allGames.length < TARGET_GAMES) {
        // Build batch of IDs
        const batch = [];
        for (let i = 0; i < CONCURRENCY && id > SCAN_TO; i++, id--) {
            if (!scannedIds.has(id)) batch.push(id);
        }

        const newGames = await scanBatch(batch);
        if (newGames.length > 0) {
            allGames.push(...newGames);
            emptyStreak = 0;
        } else {
            emptyStreak += CONCURRENCY;
        }

        // Progress update every 50 IDs
        if ((SCAN_FROM - id) % 100 < CONCURRENCY) {
            process.stdout.write(`\r  ID=${id} | ${allGames.length} games | empty=${emptyStreak}     `);
        }

        // If 200 consecutive empty, skip ahead
        if (emptyStreak > 200) {
            console.log(`\n  ⚡ 200 empty streak at ${id}, skipping ahead 500...`);
            id -= 500;
            emptyStreak = 0;
        }

        // Small delay between batches
        await new Promise(r => setTimeout(r, 150));

        // Save checkpoint every 100 games
        if (allGames.length % 100 < CONCURRENCY && allGames.length > 0) {
            fs.writeFileSync(CACHE_FILE, JSON.stringify(allGames, null, 2));
        }
    }

    // Final save
    fs.writeFileSync(CACHE_FILE, JSON.stringify(allGames, null, 2));
    console.log(`\n\n✅ Total: ${allGames.length} games from ${new Set(allGames.map(g => g.matchId)).size} matches`);
    console.log(`   Date range: ${allGames[allGames.length - 1]?.date} → ${allGames[0]?.date}`);

    // Run backtest
    runBacktest(allGames);
}

function runBacktest(games) {
    const H = '='.repeat(100);
    const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;

    console.log(`\n${H}`);
    console.log(`📊 BACKTEST ${games.length} GAMES LOL — LINE NHÀ CÁI: Kill@24.5 Tower@11.5 Dragon@4.5 Time@31.5`);
    console.log(H);

    const LINES = { kill: 24.5, tower: 11.5, dragon: 4.5, time: 31.5 };

    // Stats
    const kills = games.map(g => g.kills);
    const towers = games.map(g => g.towers);
    const dragons = games.map(g => g.dragons);
    const durs = games.map(g => g.durMin);

    console.log(`\n📈 Thống kê: Kill=${mean(kills).toFixed(1)} Tower=${mean(towers).toFixed(1)} Dragon=${mean(dragons).toFixed(1)} Time=${mean(durs).toFixed(1)}min`);

    // Determine pick direction based on full population stats
    const killOverRate = kills.filter(v => v > LINES.kill).length / kills.length;
    const towerOverRate = towers.filter(v => v > LINES.tower).length / towers.length;
    const dragonOverRate = dragons.filter(v => v > LINES.dragon).length / dragons.length;
    const timeOverRate = durs.filter(v => v > LINES.time).length / durs.length;

    const picks = {
        kill: { pick: killOverRate > 0.55 ? 'TÀI' : killOverRate < 0.45 ? 'XỈU' : 'SKIP', rate: killOverRate },
        tower: { pick: towerOverRate > 0.55 ? 'TÀI' : towerOverRate < 0.45 ? 'XỈU' : 'SKIP', rate: towerOverRate },
        dragon: { pick: dragonOverRate > 0.55 ? 'TÀI' : dragonOverRate < 0.45 ? 'XỈU' : 'SKIP', rate: dragonOverRate },
        time: { pick: timeOverRate > 0.55 ? 'TÀI' : timeOverRate < 0.45 ? 'XỈU' : 'SKIP', rate: timeOverRate },
    };

    console.log(`\n📊 Phân bổ Over/Under:`);
    for (const [name, p] of Object.entries(picks)) {
        const line = LINES[name];
        const total = games.length;
        const over = Math.round(p.rate * total);
        console.log(`   ${name.padEnd(8)} @${String(line).padEnd(5)} TÀI=${over}(${(p.rate * 100).toFixed(1)}%) XỈU=${total - over}(${((1 - p.rate) * 100).toFixed(1)}%) → Pick: ${p.pick}`);
    }

    // ===== MATCH-BY-MATCH TABLE =====
    console.log(`\n${H}`);
    console.log('📝 DỰ ĐOÁN VS THỰC TẾ — TỪNG GAME');
    console.log(H);

    // Group by month
    const monthly = {};
    games.forEach(g => {
        if (!monthly[g.month]) monthly[g.month] = [];
        monthly[g.month].push(g);
    });

    const monthlyStats = {};
    let totalW = 0, totalL = 0, totalS = 0;
    let maxLossStreak = 0, currentLossStreak = 0;
    let streakHistory = [];

    const perType = {
        kill: { w: 0, l: 0 }, tower: { w: 0, l: 0 },
        dragon: { w: 0, l: 0 }, time: { w: 0, l: 0 },
    };

    const months = Object.keys(monthly).sort().reverse();
    for (const month of months) {
        const gs = monthly[month];
        let mW = 0, mL = 0, mS = 0;

        console.log(`\n📅 ${month} (${gs.length} games)`);
        console.log(`   ${'Trận'.padEnd(20)} ${'G'} ${'K'.padEnd(4)}${'→'.padEnd(3)}${'✓'.padEnd(3)} ${'T'.padEnd(4)}${'→'.padEnd(3)}${'✓'.padEnd(3)} ${'Dr'.padEnd(3)}${'→'.padEnd(3)}${'✓'.padEnd(3)} ${'Min'.padEnd(5)}${'→'.padEnd(3)}${'✓'.padEnd(3)} | ${'W'} ${'L'}`);

        for (const g of gs) {
            let gW = 0, gL = 0;

            // Kill
            const kActual = g.kills > LINES.kill ? 'T' : 'X';
            const kPick = picks.kill.pick === 'SKIP' ? '-' : picks.kill.pick[0];
            const kWin = kPick === '-' ? null : kActual === kPick;
            if (kWin !== null) { if (kWin) { gW++; perType.kill.w++; } else { gL++; perType.kill.l++; } }

            // Tower
            const tActual = g.towers > LINES.tower ? 'T' : 'X';
            const tPick = picks.tower.pick === 'SKIP' ? '-' : picks.tower.pick[0];
            const tWin = tPick === '-' ? null : tActual === tPick;
            if (tWin !== null) { if (tWin) { gW++; perType.tower.w++; } else { gL++; perType.tower.l++; } }

            // Dragon
            const drActual = g.dragons > LINES.dragon ? 'T' : 'X';
            const drPick = picks.dragon.pick === 'SKIP' ? '-' : picks.dragon.pick[0];
            const drWin = drPick === '-' ? null : drActual === drPick;
            if (drWin !== null) { if (drWin) { gW++; perType.dragon.w++; } else { gL++; perType.dragon.l++; } }

            // Time
            const dActual = g.durMin > LINES.time ? 'T' : 'X';
            const dPick = picks.time.pick === 'SKIP' ? '-' : picks.time.pick[0];
            const dWin = dPick === '-' ? null : dActual === dPick;
            if (dWin !== null) { if (dWin) { gW++; perType.time.w++; } else { gL++; perType.time.l++; } }

            mW += gW; mL += gL;
            totalW += gW; totalL += gL;

            // Streak tracking (per bet)
            for (const result of [kWin, tWin, drWin, dWin]) {
                if (result === null) continue;
                if (!result) {
                    currentLossStreak++;
                    if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
                } else {
                    if (currentLossStreak > 0) streakHistory.push(currentLossStreak);
                    currentLossStreak = 0;
                }
            }

            const kR = kWin === null ? '- ' : kWin ? '✅' : '❌';
            const tR = tWin === null ? '- ' : tWin ? '✅' : '❌';
            const drR = drWin === null ? '- ' : drWin ? '✅' : '❌';
            const dR = dWin === null ? '- ' : dWin ? '✅' : '❌';

            console.log(`   ${g.name.padEnd(20)} ${g.game} ${String(g.kills).padEnd(4)}${kActual.padEnd(3)}${kR.padEnd(3)} ${String(g.towers).padEnd(4)}${tActual.padEnd(3)}${tR.padEnd(3)} ${String(g.dragons).padEnd(3)}${drActual.padEnd(3)}${drR.padEnd(3)} ${String(g.durMin).padEnd(5)}${dActual.padEnd(3)}${dR.padEnd(3)} | ${gW} ${gL}`);
        }

        const mTotal = mW + mL;
        const mRate = mTotal > 0 ? (mW / mTotal * 100).toFixed(1) : 'N/A';
        monthlyStats[month] = { games: gs.length, bets: mTotal, wins: mW, losses: mL, rate: mRate };
        console.log(`   → ${month}: ${mW}W/${mL}L = ${mRate}% (${gs.length} games, ${mTotal} bets)`);
    }

    // ===== SUMMARY =====
    const totalBets = totalW + totalL;
    const totalRate = totalBets > 0 ? (totalW / totalBets * 100).toFixed(1) : 'N/A';

    console.log(`\n${H}`);
    console.log(`📊 TỔNG KẾT`);
    console.log(H);

    console.log(`\n   TỔNG: ${totalW}W / ${totalL}L = ${totalRate}% trên ${totalBets} lệnh (${games.length} games)`);

    console.log(`\n   Theo loại cược:`);
    for (const [name, t] of Object.entries(perType)) {
        const total = t.w + t.l;
        if (total === 0) { console.log(`   ${name.padEnd(8)} SKIPPED`); continue; }
        const rate = (t.w / total * 100).toFixed(1);
        const line = LINES[name];
        const pick = picks[name].pick;
        console.log(`   ${name.padEnd(8)} @${String(line).padEnd(5)} ${pick.padEnd(4)} → ${t.w}W/${t.l}L = ${rate}%`);
    }

    console.log(`\n   Theo tháng:`);
    console.log(`   ${'Tháng'.padEnd(10)} ${'Games'.padEnd(7)} ${'Bets'.padEnd(7)} ${'W'.padEnd(6)} ${'L'.padEnd(6)} ${'WR%'.padEnd(8)}`);
    for (const m of months) {
        const s = monthlyStats[m];
        console.log(`   ${m.padEnd(10)} ${String(s.games).padEnd(7)} ${String(s.bets).padEnd(7)} ${String(s.wins).padEnd(6)} ${String(s.losses).padEnd(6)} ${s.rate}%`);
    }

    // === CHÁY (BURN) ANALYSIS ===
    if (currentLossStreak > 0) streakHistory.push(currentLossStreak);
    const burnStreaks = streakHistory.filter(s => s >= 3);

    console.log(`\n🔥 PHÂN TÍCH CHÁY (Loss Streaks):`);
    console.log(`   Max chuỗi thua liên tiếp: ${maxLossStreak} lệnh`);
    console.log(`   Số lần "cháy" (≥3 thua liên tiếp): ${burnStreaks.length} lần`);
    if (burnStreaks.length > 0) {
        console.log(`   Chi tiết cháy: ${burnStreaks.map(s => s + ' lệnh').join(', ')}`);
    }
    console.log(`   Tổng lệnh thua: ${totalL}/${totalBets} (${(totalL / totalBets * 100).toFixed(1)}%)`);

    // Save report
    const report = {
        totalGames: games.length, totalBets, totalWins: totalW, totalLosses: totalL,
        winRate: totalRate + '%',
        perType, picks,
        maxLossStreak, burnCount: burnStreaks.length, burnDetails: burnStreaks,
        monthlyStats,
        dateRange: { from: games[games.length - 1]?.date, to: games[0]?.date },
    };
    fs.writeFileSync('lol_1000games_report.json', JSON.stringify(report, null, 2));
    console.log(`\n💾 Report saved!`);
}

main().catch(err => console.error('Fatal:', err));
