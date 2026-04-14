/**
 * BetWise — Analyze 1000 LoL Games (cached data)
 * Uses cached lol_1000games_cache.json and outputs full statistics
 */
const fs = require('fs');

const games = JSON.parse(fs.readFileSync('lol_1000games_cache.json', 'utf8'));
const LINES = { kill: 24.5, tower: 11.5, dragon: 4.5, time: 31.5 };
const H = '='.repeat(100);

console.log(`${H}`);
console.log(`📊 BACKTEST ${games.length} GAMES LOL — LINE NHÀ CÁI THỰC TẾ`);
console.log(`   Kill@${LINES.kill}  Tower@${LINES.tower}  Dragon@${LINES.dragon}  Time@${LINES.time}min`);
console.log(`   Thời gian: ${games[games.length - 1]?.date} → ${games[0]?.date}`);
console.log(H);

const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
const median = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

const kills = games.map(g => g.kills), towers = games.map(g => g.towers);
const dragons = games.map(g => g.dragons), durs = games.map(g => g.durMin);

console.log(`\n📈 THỐNG KÊ (${games.length} games):`);
console.log(`   Kills:   mean=${mean(kills).toFixed(1)} median=${median(kills)}`);
console.log(`   Towers:  mean=${mean(towers).toFixed(1)} median=${median(towers)}`);
console.log(`   Dragons: mean=${mean(dragons).toFixed(1)} median=${median(dragons)}`);
console.log(`   Time:    mean=${mean(durs).toFixed(1)}min median=${median(durs)}min`);

// Distribution per line
console.log(`\n📊 PHÂN BỔ TÀI/XỈU:`);
for (const [name, values, lineOptions] of [
    ['Kill', kills, [22.5, 24.5, 26.5, 28.5]],
    ['Tower', towers, [9.5, 10.5, 11.5, 12.5, 13.5]],
    ['Dragon', dragons, [3.5, 4.5, 5.5]],
    ['Time', durs, [29.5, 30.5, 31.5, 32.5, 33.5]],
]) {
    for (const line of lineOptions) {
        const over = values.filter(v => v > line).length;
        const pct = over / values.length * 100;
        const marker = line === LINES[name.toLowerCase()] ? ' ← NHÀ CÁI' : '';
        const pick = pct > 55 ? 'TÀI' : pct < 45 ? 'XỈU' : 'SKIP';
        const acc = pick === 'TÀI' ? pct : pick === 'XỈU' ? 100 - pct : 50;
        console.log(`   ${name.padEnd(8)} @${String(line).padEnd(5)} TÀI:${String(over).padEnd(4)}(${pct.toFixed(1)}%) XỈU:${String(values.length - over).padEnd(4)}(${(100 - pct).toFixed(1)}%) → ${pick} ${acc.toFixed(1)}%${marker}`);
    }
    console.log();
}

// Determine picks
const overRates = {
    kill: kills.filter(v => v > LINES.kill).length / kills.length,
    tower: towers.filter(v => v > LINES.tower).length / towers.length,
    dragon: dragons.filter(v => v > LINES.dragon).length / dragons.length,
    time: durs.filter(v => v > LINES.time).length / durs.length,
};

const picks = {};
for (const [k, r] of Object.entries(overRates)) {
    picks[k] = r > 0.55 ? 'TÀI' : r < 0.45 ? 'XỈU' : 'SKIP';
}

// ===== MATCH-BY-MATCH TABLE (last 3 months detail + monthly summary for older) =====
console.log(`${H}`);
console.log('📝 DỰ ĐOÁN VS THỰC TẾ — TỪNG GAME (Tháng gần nhất)');
console.log(H);

const monthly = {};
games.forEach(g => { if (!monthly[g.month]) monthly[g.month] = []; monthly[g.month].push(g); });

const perType = { kill: { w: 0, l: 0, s: 0 }, tower: { w: 0, l: 0, s: 0 }, dragon: { w: 0, l: 0, s: 0 }, time: { w: 0, l: 0, s: 0 } };
const monthlyStats = {};
let maxLossStreak = 0, curLoss = 0;
let streaks = [];

const months = Object.keys(monthly).sort().reverse();
const DETAIL_MONTHS = months.slice(0, 5); // Show detail for 5 most recent months

for (const month of months) {
    const gs = monthly[month];
    let mW = 0, mL = 0;

    const showDetail = DETAIL_MONTHS.includes(month);

    if (showDetail) {
        console.log(`\n📅 ${month} (${gs.length} games)`);
        console.log(`   ${'Trận'.padEnd(22)} G  ${'Kill'.padEnd(4)} P  ✓  ${'Trụ'.padEnd(4)} P  ✓  ${'Dr'.padEnd(3)} P  ✓  ${'Min'.padEnd(6)} P  ✓`);
    }

    for (const g of gs) {
        let gW = 0, gL = 0;
        const bets = [];

        for (const [stat, val, line] of [['kill', g.kills, LINES.kill], ['tower', g.towers, LINES.tower], ['dragon', g.dragons, LINES.dragon], ['time', g.durMin, LINES.time]]) {
            const actual = val > line ? 'T' : 'X';
            const pick = picks[stat];
            if (pick === 'SKIP') {
                perType[stat].s++;
                bets.push({ actual, pick: '-', win: null });
            } else {
                const win = actual === pick[0];
                if (win) { gW++; perType[stat].w++; } else { gL++; perType[stat].l++; }
                bets.push({ actual, pick: pick[0], win });

                // Streak
                if (!win) { curLoss++; if (curLoss > maxLossStreak) maxLossStreak = curLoss; }
                else { if (curLoss > 0) streaks.push(curLoss); curLoss = 0; }
            }
        }

        mW += gW; mL += gL;

        if (showDetail) {
            const r = b => b.win === null ? '- ' : b.win ? '✅' : '❌';
            const p = b => b.pick;
            console.log(`   ${g.name.padEnd(22)} ${g.game}  ${String(g.kills).padEnd(4)} ${p(bets[0])}  ${r(bets[0])} ${String(g.towers).padEnd(4)} ${p(bets[1])}  ${r(bets[1])} ${String(g.dragons).padEnd(3)} ${p(bets[2])}  ${r(bets[2])} ${String(g.durMin).padEnd(6)} ${p(bets[3])}  ${r(bets[3])}`);
        }
    }

    const mTotal = mW + mL;
    monthlyStats[month] = { games: gs.length, bets: mTotal, w: mW, l: mL, rate: mTotal > 0 ? (mW / mTotal * 100).toFixed(1) : 'N/A' };

    if (showDetail) {
        console.log(`   → ${month}: ${mW}W/${mL}L = ${monthlyStats[month].rate}%`);
    }
}
if (curLoss > 0) streaks.push(curLoss);

// ===== TỔNG KẾT =====
const totalW = Object.values(perType).reduce((s, t) => s + t.w, 0);
const totalL = Object.values(perType).reduce((s, t) => s + t.l, 0);
const totalBets = totalW + totalL;
const totalRate = totalBets > 0 ? (totalW / totalBets * 100).toFixed(1) : 'N/A';

console.log(`\n${H}`);
console.log(`📊 TỔNG KẾT — ${games.length} games, ${totalBets} lệnh`);
console.log(H);

console.log(`\n   🎯 TỔNG: ${totalW}W / ${totalL}L = ${totalRate}%`);

console.log(`\n   📊 Theo loại cược:`);
for (const [name, t] of Object.entries(perType)) {
    const total = t.w + t.l;
    if (total === 0) { console.log(`   ${name.padEnd(8)} @${LINES[name]} SKIPPED (50/50)`); continue; }
    console.log(`   ${name.padEnd(8)} @${String(LINES[name]).padEnd(5)} ${picks[name].padEnd(4)} → ${t.w}W/${t.l}L = ${(t.w / total * 100).toFixed(1)}% ${t.s > 0 ? '(+' + t.s + ' skip)' : ''}`);
}

console.log(`\n   📅 Theo tháng:`);
console.log(`   ${'Tháng'.padEnd(10)} ${'Games'.padEnd(7)} ${'Bets'.padEnd(6)} ${'W'.padEnd(5)} ${'L'.padEnd(5)} ${'WR%'.padEnd(7)}`);
for (const m of months) {
    const s = monthlyStats[m];
    console.log(`   ${m.padEnd(10)} ${String(s.games).padEnd(7)} ${String(s.bets).padEnd(6)} ${String(s.w).padEnd(5)} ${String(s.l).padEnd(5)} ${s.rate}%`);
}

// BURN analysis
const burns = streaks.filter(s => s >= 3);
console.log(`\n🔥 PHÂN TÍCH CHÁY:`);
console.log(`   Chuỗi thua dài nhất: ${maxLossStreak} lệnh`);
console.log(`   Số lần cháy (≥3 thua liên tiếp): ${burns.length} lần`);
console.log(`   Chi tiết: ${burns.length > 0 ? burns.sort((a, b) => b - a).slice(0, 20).join(', ') : 'Không có'}`);
console.log(`   Tổng lệnh thua: ${totalL}/${totalBets} = ${(totalL / totalBets * 100).toFixed(1)}%`);

// Profit simulation (flat 1 unit per bet, odds 1.85)
const ODDS = 1.85;
const profit = totalW * (ODDS - 1) - totalL * 1;
console.log(`\n💰 MÔ PHỎNG LỢI NHUẬN (1 đơn vị/lệnh, odds ${ODDS}):`);
console.log(`   Lãi: +${(totalW * (ODDS - 1)).toFixed(0)} | Lỗ: -${totalL} | ROI: ${(profit / totalBets * 100).toFixed(1)}%`);
console.log(`   Net: ${profit >= 0 ? '+' : ''}${profit.toFixed(1)} đơn vị trên ${totalBets} lệnh`);
