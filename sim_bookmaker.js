/**
 * BetWise — REALISTIC BOOKMAKER LINES BACKTEST
 * 
 * Uses REAL bookmaker lines: Dragon 4.5, Tower 11.5, Kill ~24.5, Time ~31.5
 * Includes all bet types: O/U Kill, O/U Tower, O/U Dragon, O/U Time, 
 *   First Tower, First Inhibitor (nhà lính), Dragon Soul (linh hồn rồng)
 * Shows match-by-match: prediction vs actual result
 */

const https = require('https');
const fs = require('fs');

// ===== REAL BOOKMAKER LINES (from betting sites) =====
const BOOK_LINES = {
    kill: 24.5,     // Common LoL line
    tower: 11.5,    // Common LoL line  
    dragon: 4.5,    // Common LoL line
    time: 31.5,     // Common LoL line (phút)
};

function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'BW/5' } }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
        }).on('error', reject);
    });
}

async function collectFullLoL() {
    const cacheFile = 'sim_lol_full_cache.json';
    if (fs.existsSync(cacheFile)) {
        console.log('📂 Using cached full LoL data...');
        return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    }

    console.log('📡 Re-fetching LoL games with FULL fields from TJStats...');
    const allGames = [];

    // Use existing matchIds from previous cache
    const oldCache = JSON.parse(fs.readFileSync('sim_lol_12m_cache.json', 'utf8'));
    const matchIds = [...new Set(oldCache.map(g => g.matchId))].sort((a, b) => b - a);

    console.log(`  ${matchIds.length} unique matchIds to re-fetch...`);

    for (const id of matchIds) {
        try {
            const resp = await fetchJSON(`https://betwise-ruddy.vercel.app/api/lol-stats?matchId=${id}`);
            if (resp?.success && resp.data?.data?.matchInfos?.length > 0) {
                const match = resp.data.data;
                const matchDate = match.matchTime ? new Date(match.matchTime) : null;

                for (let i = 0; i < match.matchInfos.length; i++) {
                    const g = match.matchInfos[i];
                    const t0 = g.teamInfos?.[0];
                    const t1 = g.teamInfos?.[1];
                    if (!t0 || !t1) continue;

                    const start = g.matchStartTime ? new Date(g.matchStartTime).getTime() : 0;
                    const end = g.matchEndTime ? new Date(g.matchEndTime).getTime() : 0;
                    const durMin = start && end ? (end - start) / 60000 : (g.gameTime || 0) / 60;

                    allGames.push({
                        matchId: id,
                        date: matchDate ? matchDate.toISOString().split('T')[0] : 'unknown',
                        month: matchDate ? matchDate.toISOString().slice(0, 7) : 'unknown',
                        matchName: match.matchName,
                        gameNum: i + 1,
                        bo: match.gameMode,
                        teamA: match.teamAName,
                        teamB: match.teamBName,
                        // O/U stats
                        kills: (t0.kills || 0) + (t1.kills || 0),
                        towers: (t0.turretAmount || 0) + (t1.turretAmount || 0),
                        dragons: (t0.dragonAmount || 0) + (t1.dragonAmount || 0),
                        barons: (t0.baronAmount || 0) + (t1.baronAmount || 0),
                        durationMin: Math.round(durMin * 10) / 10,
                        // Inhibitor (nhà lính)
                        inhibitors: (t0.inhibitKills || 0) + (t1.inhibitKills || 0),
                        // First objectives
                        firstTurretTeam: t0.isFirstTurret ? match.teamAName : (t1.isFirstTurret ? match.teamBName : null),
                        firstDragonTeam: t0.isFirstDragon ? match.teamAName : (t1.isFirstDragon ? match.teamBName : null),
                        firstInhibTeam: t0.isFirstInhibitor ? match.teamAName : (t1.isFirstInhibitor ? match.teamBName : null),
                        firstHeraldTeam: t0.isFirstRiftHerald ? match.teamAName : (t1.isFirstRiftHerald ? match.teamBName : null),
                        // Dragon Soul (linh hồn rồng)
                        hasDragonSoul: !!(t0.dragonSpirit || t1.dragonSpirit),
                        dragonSoulTeam: t0.dragonSpirit ? match.teamAName : (t1.dragonSpirit ? match.teamBName : null),
                        dragonSoulType: t0.dragonSpiritType || t1.dragonSpiritType || null,
                        // Winner
                        winner: g.matchWin === match.teamAId ? match.teamAName : match.teamBName,
                    });
                }
            }
        } catch (e) { /* skip */ }
        await new Promise(r => setTimeout(r, 300));
    }

    fs.writeFileSync(cacheFile, JSON.stringify(allGames, null, 2));
    console.log(`✅ Cached ${allGames.length} full LoL games`);
    return allGames;
}

function runBacktest(games) {
    const H = '='.repeat(90);
    console.log(`\n${H}`);
    console.log(`📊 BACKTEST VỚI LINE NHÀ CÁI THỰC TẾ — ${games.length} games LPL`);
    console.log(`   Kill=${BOOK_LINES.kill}  Tower=${BOOK_LINES.tower}  Dragon=${BOOK_LINES.dragon}  Time=${BOOK_LINES.time}min`);
    console.log(H);

    // ===== THỐNG KÊ CƠ BẢN =====
    const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
    const median = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

    const kills = games.map(g => g.kills);
    const towers = games.map(g => g.towers);
    const dragons = games.map(g => g.dragons);
    const durations = games.map(g => g.durationMin);
    const inhibs = games.map(g => g.inhibitors);

    console.log('\n📈 THỐNG KÊ THỰC TẾ:');
    console.log(`   Kills:      mean=${mean(kills).toFixed(1)} median=${median(kills)} → line ${BOOK_LINES.kill}`);
    console.log(`   Towers:     mean=${mean(towers).toFixed(1)} median=${median(towers)} → line ${BOOK_LINES.tower}`);
    console.log(`   Dragons:    mean=${mean(dragons).toFixed(1)} median=${median(dragons)} → line ${BOOK_LINES.dragon}`);
    console.log(`   Duration:   mean=${mean(durations).toFixed(1)} median=${median(durations)} → line ${BOOK_LINES.time}`);
    console.log(`   Inhibitors: mean=${mean(inhibs).toFixed(1)} median=${median(inhibs)}`);

    // ===== O/U PHÂN TÍ̀CH THEO TỪNG LINE =====
    console.log('\n📊 PHÂN BỔ TÀI/XỈU THEO TỪNG LINE:');

    const ouAnalysis = {};
    for (const [stat, values, lines] of [
        ['Kill', kills, [22.5, 24.5, 26.5, 28.5]],
        ['Tower', towers, [9.5, 10.5, 11.5, 12.5, 13.5]],
        ['Dragon', dragons, [3.5, 4.5, 5.5]],
        ['Time', durations, [29.5, 30.5, 31.5, 32.5, 33.5]],
        ['Inhibitor', inhibs, [0.5, 1.5, 2.5]],
    ]) {
        for (const line of lines) {
            const over = values.filter(v => v > line).length;
            const under = values.length - over;
            const overPct = over / values.length * 100;
            const pick = overPct > 55 ? 'TÀI' : overPct < 45 ? 'XỈU' : 'SKIP';
            const acc = pick === 'TÀI' ? overPct : pick === 'XỈU' ? 100 - overPct : 50;
            const marker = line === BOOK_LINES[stat.toLowerCase()] ? ' ← NHÀ CÁI' : '';
            console.log(`   ${stat.padEnd(10)} line=${String(line).padEnd(5)} TÀI:${String(over).padEnd(3)} XỈU:${String(under).padEnd(3)} → ${pick.padEnd(4)} (${acc.toFixed(1)}%)${marker}`);

            if (marker) {
                ouAnalysis[stat.toLowerCase()] = { line, over, under, overPct, pick, acc };
            }
        }
        console.log();
    }

    // ===== DRAGON SOUL (LINH HỒN RỒNG) =====
    const soulGames = games.filter(g => g.hasDragonSoul);
    const noSoulGames = games.filter(g => !g.hasDragonSoul);
    console.log(`🐉 LINH HỒN RỒNG (Dragon Soul):`);
    console.log(`   Có linh hồn: ${soulGames.length}/${games.length} (${(soulGames.length / games.length * 100).toFixed(1)}%)`);
    console.log(`   Không có:    ${noSoulGames.length}/${games.length} (${(noSoulGames.length / games.length * 100).toFixed(1)}%)`);
    if (soulGames.length > 0) {
        // Nhà cái line: Có/Không linh hồn rồng → nếu >55% game có → cược TÀI (CÓ)
        const soulPick = soulGames.length > games.length * 0.55 ? 'CÓ (TÀI)' : soulGames.length < games.length * 0.45 ? 'KHÔNG (XỈU)' : 'SKIP';
        const soulAcc = soulGames.length > games.length * 0.5 ? soulGames.length / games.length * 100 : noSoulGames.length / games.length * 100;
        console.log(`   Dự đoán: ${soulPick} → ${soulAcc.toFixed(1)}%`);

        // Soul type distribution
        const typeCount = {};
        soulGames.forEach(g => { const t = g.dragonSoulType || 'unknown'; typeCount[t] = (typeCount[t] || 0) + 1; });
        console.log(`   Types: ${Object.entries(typeCount).map(([t, c]) => `${t}=${c}`).join(', ')}`);
    }

    // ===== FIRST OBJECTIVES =====
    console.log(`\n🏰 MỤC TIÊU ĐẦU TIÊN:`);
    const firstTurretWinners = games.filter(g => g.firstTurretTeam && g.firstTurretTeam === g.winner);
    const firstDragonWinners = games.filter(g => g.firstDragonTeam && g.firstDragonTeam === g.winner);
    const firstInhibWinners = games.filter(g => g.firstInhibTeam && g.firstInhibTeam === g.winner);
    const firstTurretTotal = games.filter(g => g.firstTurretTeam).length;
    const firstDragonTotal = games.filter(g => g.firstDragonTeam).length;
    const firstInhibTotal = games.filter(g => g.firstInhibTeam).length;

    console.log(`   First Tower → Win:  ${firstTurretWinners.length}/${firstTurretTotal} = ${(firstTurretWinners.length / firstTurretTotal * 100).toFixed(1)}%`);
    console.log(`   First Dragon → Win: ${firstDragonWinners.length}/${firstDragonTotal} = ${(firstDragonWinners.length / firstDragonTotal * 100).toFixed(1)}%`);
    console.log(`   First Inhibitor → Win: ${firstInhibWinners.length}/${firstInhibTotal} = ${(firstInhibWinners.length / firstInhibTotal * 100).toFixed(1)}%`);

    // ===== MATCH-BY-MATCH: DỰ ĐOÁN VS THỰC TẾ =====
    console.log(`\n${H}`);
    console.log('📝 DỰ ĐOÁN VS THỰC TẾ (TỪNG GAME)');
    console.log(H);

    // Group by month
    const monthlyGames = {};
    games.forEach(g => {
        if (!monthlyGames[g.month]) monthlyGames[g.month] = [];
        monthlyGames[g.month].push(g);
    });

    let totalCorrect = 0, totalBets = 0;
    const monthlyResults = {};

    const months = Object.keys(monthlyGames).sort().reverse();
    for (const month of months) {
        const gamesInMonth = monthlyGames[month];
        let mCorrect = 0, mBets = 0;

        console.log(`\n📅 ${month} (${gamesInMonth.length} games)`);
        console.log(`   ${'Trận'.padEnd(18)} ${'G'.padEnd(3)} ${'K'.padEnd(5)} ${'K-P'.padEnd(5)} ${'K✓'.padEnd(4)} ${'T'.padEnd(5)} ${'T-P'.padEnd(5)} ${'T✓'.padEnd(4)} ${'Dr'.padEnd(4)} ${'Dr-P'.padEnd(5)} ${'Dr✓'.padEnd(4)} ${'Dur'.padEnd(6)} ${'D-P'.padEnd(5)} ${'D✓'.padEnd(4)} ${'Inh'.padEnd(4)} ${'Soul'.padEnd(5)}`);

        for (const g of gamesInMonth) {
            // Kill O/U @24.5
            const kOver = g.kills > BOOK_LINES.kill;
            const kOverPct = kills.filter(v => v > BOOK_LINES.kill).length / kills.length;
            const kPick = kOverPct > 0.55 ? 'T' : kOverPct < 0.45 ? 'X' : '-';
            const kWin = kPick === 'T' ? kOver : kPick === 'X' ? !kOver : null;

            // Tower O/U @11.5
            const tOver = g.towers > BOOK_LINES.tower;
            const tOverPct = towers.filter(v => v > BOOK_LINES.tower).length / towers.length;
            const tPick = tOverPct > 0.55 ? 'T' : tOverPct < 0.45 ? 'X' : '-';
            const tWin = tPick === 'T' ? tOver : tPick === 'X' ? !tOver : null;

            // Dragon O/U @4.5
            const drOver = g.dragons > BOOK_LINES.dragon;
            const drOverPct = dragons.filter(v => v > BOOK_LINES.dragon).length / dragons.length;
            const drPick = drOverPct > 0.55 ? 'T' : drOverPct < 0.45 ? 'X' : '-';
            const drWin = drPick === 'T' ? drOver : drPick === 'X' ? !drOver : null;

            // Duration O/U @31.5
            const dOver = g.durationMin > BOOK_LINES.time;
            const dOverPct = durations.filter(v => v > BOOK_LINES.time).length / durations.length;
            const dPick = dOverPct > 0.55 ? 'T' : dOverPct < 0.45 ? 'X' : '-';
            const dWin = dPick === 'T' ? dOver : dPick === 'X' ? !dOver : null;

            // Count
            for (const win of [kWin, tWin, drWin, dWin]) {
                if (win !== null) {
                    totalBets++;
                    mBets++;
                    if (win) { totalCorrect++; mCorrect++; }
                }
            }

            const name = g.matchName.padEnd(18);
            const gn = String(g.gameNum).padEnd(3);
            console.log(`   ${name} ${gn} ${String(g.kills).padEnd(5)} ${kPick.padEnd(5)} ${kWin === null ? '-' : kWin ? '✅' : '❌'}    ${String(g.towers).padEnd(5)} ${tPick.padEnd(5)} ${tWin === null ? '-' : tWin ? '✅' : '❌'}    ${String(g.dragons).padEnd(4)} ${drPick.padEnd(5)} ${drWin === null ? '-' : drWin ? '✅' : '❌'}    ${String(g.durationMin).padEnd(6)} ${dPick.padEnd(5)} ${dWin === null ? '-' : dWin ? '✅' : '❌'}    ${String(g.inhibitors).padEnd(4)} ${g.hasDragonSoul ? '✅' : '❌'}`);
        }

        monthlyResults[month] = { correct: mCorrect, bets: mBets, games: gamesInMonth.length };
        const mRate = mBets > 0 ? (mCorrect / mBets * 100).toFixed(1) : 'N/A';
        console.log(`   → Tháng ${month}: ${mCorrect}/${mBets} = ${mRate}%`);
    }

    // ===== TỔNG KẾT =====
    console.log(`\n${H}`);
    console.log('📊 TỔNG KẾT THEO THÁNG');
    console.log(H);

    console.log(`\n   ${'Tháng'.padEnd(10)} ${'Games'.padEnd(7)} ${'Bets'.padEnd(7)} ${'Correct'.padEnd(9)} ${'WR%'.padEnd(8)}`);
    for (const m of months) {
        const r = monthlyResults[m];
        const rate = r.bets > 0 ? (r.correct / r.bets * 100).toFixed(1) + '%' : 'N/A';
        console.log(`   ${m.padEnd(10)} ${String(r.games).padEnd(7)} ${String(r.bets).padEnd(7)} ${String(r.correct).padEnd(9)} ${rate}`);
    }

    const overallRate = totalBets > 0 ? (totalCorrect / totalBets * 100).toFixed(1) : 'N/A';
    console.log(`\n   TỔNG:       ${games.length} games  ${totalBets} bets   ${totalCorrect} correct  ${overallRate}%`);

    // ===== SUMMARY PER BET TYPE =====
    console.log(`\n${H}`);
    console.log('📊 TỈ LỆ THEO LOẠI CƯỢC (LINE NHÀ CÁI THỰC TẾ)');
    console.log(H);

    for (const [name, values, line] of [
        ['Kill', kills, BOOK_LINES.kill],
        ['Tower', towers, BOOK_LINES.tower],
        ['Dragon', dragons, BOOK_LINES.dragon],
        ['Time (min)', durations, BOOK_LINES.time],
    ]) {
        const overCount = values.filter(v => v > line).length;
        const overPct = overCount / values.length * 100;
        const pick = overPct > 55 ? 'TÀI' : overPct < 45 ? 'XỈU' : 'SKIP (50/50)';
        const accuracy = overPct > 55 ? overPct : overPct < 45 ? 100 - overPct : 50;
        console.log(`   ${name.padEnd(12)} line=${String(line).padEnd(5)} TÀI ${overCount}/${values.length}(${overPct.toFixed(1)}%)  XỈU ${values.length - overCount}/${values.length}(${(100 - overPct).toFixed(1)}%) → Pick: ${pick} = ${accuracy.toFixed(1)}%`);
    }

    // ===== SAVE REPORT =====
    const report = {
        lines: BOOK_LINES,
        totalGames: games.length,
        totalBets,
        totalCorrect,
        winRate: overallRate + '%',
        monthly: monthlyResults,
        perType: {
            kill: { over: kills.filter(v => v > BOOK_LINES.kill).length, total: kills.length },
            tower: { over: towers.filter(v => v > BOOK_LINES.tower).length, total: towers.length },
            dragon: { over: dragons.filter(v => v > BOOK_LINES.dragon).length, total: dragons.length },
            time: { over: durations.filter(v => v > BOOK_LINES.time).length, total: durations.length },
        },
        dragonSoul: { has: soulGames.length, total: games.length, pct: (soulGames.length / games.length * 100).toFixed(1) + '%' },
        firstObjectives: {
            firstTurretWinCorrelation: (firstTurretWinners.length / firstTurretTotal * 100).toFixed(1) + '%',
            firstDragonWinCorrelation: (firstDragonWinners.length / firstDragonTotal * 100).toFixed(1) + '%',
        }
    };
    fs.writeFileSync('backtest_bookmaker_results.json', JSON.stringify(report, null, 2));
    console.log('\n💾 Saved to backtest_bookmaker_results.json');
}

async function main() {
    const games = await collectFullLoL();
    runBacktest(games);
}

main().catch(err => console.error('Fatal:', err));
