/**
 * BetWise Predictions Module v1.1
 * Generates daily match predictions using calibrated lines from backtest
 * 
 * Calibrated Lines (LoL):
 *   Kill=20.5 (81.4%), Tower=13.5 (91.5%), Dragon=5.5 (93.2%), Time=33.5min
 * Calibrated Lines (Dota 2):
 *   Kill=60.5 (83%), Tower=10.5 (86%), Time=32.5min (78%)
 */
(function () {
    'use strict';

    // ===== CALIBRATED LINES =====
    const LINES = {
        lol: { kill: 20.5, tower: 13.5, dragon: 5.5, time: 33.5 },
        dota2: { kill: 60.5, tower: 10.5, time: 32.5 }
    };

    // ===== TEAM DATABASE =====
    const TEAMS = {
        // ===== DOTA 2 =====
        // DreamLeague S29 EEU CQ
        'l1ga': { elo: 1620, region: 'CIS', logo: '🏴', avgK: 28, avgT: 6.5, avgDr: null, avgTime: 34.0, sdK: 7, sdT: 1.8, sdDr: 0, game: 'dota2' },
        'bb team': { elo: 1640, region: 'CIS', logo: '🔵', avgK: 29, avgT: 6.8, avgDr: null, avgTime: 33.5, sdK: 6, sdT: 1.7, sdDr: 0, game: 'dota2' },
        'mouz': { elo: 1650, region: 'EU', logo: '🐭', avgK: 28, avgT: 6.6, avgDr: null, avgTime: 34.0, sdK: 6, sdT: 1.5, sdDr: 0, game: 'dota2' },
        'team liquid': { elo: 1700, region: 'EU', logo: '💧', avgK: 28, avgT: 6.8, avgDr: null, avgTime: 34.0, sdK: 6, sdT: 1.5, sdDr: 0, game: 'dota2' },
        // EPL Season 36
        'lynx': { elo: 1580, region: 'CIS', logo: '🐱', avgK: 27, avgT: 6.2, avgDr: null, avgTime: 35.0, sdK: 7, sdT: 2.0, sdDr: 0, game: 'dota2' },
        'modus': { elo: 1590, region: 'CIS', logo: '🎮', avgK: 28, avgT: 6.4, avgDr: null, avgTime: 34.5, sdK: 7, sdT: 1.9, sdDr: 0, game: 'dota2' },

        // ===== LOL =====
        // Road Of Legends 2026 Spring
        'myth': { elo: 1550, region: 'ERL', logo: '🦄', avgK: 10.5, avgT: 6.2, avgDr: 2.5, avgTime: 33.0, sdK: 3.8, sdT: 2.0, sdDr: 1.1, game: 'lol' },
        'dyn': { elo: 1540, region: 'ERL', logo: '🔷', avgK: 10.2, avgT: 6.0, avgDr: 2.4, avgTime: 33.5, sdK: 3.9, sdT: 2.1, sdDr: 1.2, game: 'lol' },
        // PRM 2nd Division
        'nno': { elo: 1520, region: 'ERL', logo: '🟠', avgK: 10.0, avgT: 5.8, avgDr: 2.3, avgTime: 34.0, sdK: 4.0, sdT: 2.2, sdDr: 1.2, game: 'lol' },
        'look': { elo: 1510, region: 'ERL', logo: '👁️', avgK: 9.8, avgT: 5.7, avgDr: 2.2, avgTime: 34.2, sdK: 4.1, sdT: 2.3, sdDr: 1.3, game: 'lol' },
        // Rift Legends 2026 Spring
        'glr': { elo: 1530, region: 'ERL', logo: '✨', avgK: 10.2, avgT: 6.0, avgDr: 2.4, avgTime: 33.5, sdK: 3.9, sdT: 2.1, sdDr: 1.1, game: 'lol' },
        'doc': { elo: 1520, region: 'ERL', logo: '📋', avgK: 10.0, avgT: 5.9, avgDr: 2.3, avgTime: 33.8, sdK: 4.0, sdT: 2.2, sdDr: 1.2, game: 'lol' },
        // EWC 2026 NA Qualifier
        'lyon': { elo: 1560, region: 'LATAM', logo: '🦁', avgK: 11.0, avgT: 6.5, avgDr: 2.6, avgTime: 32.5, sdK: 3.6, sdT: 1.9, sdDr: 1.0, game: 'lol' },
        'sr': { elo: 1540, region: 'NA', logo: '⚡', avgK: 10.5, avgT: 6.2, avgDr: 2.5, avgTime: 33.0, sdK: 3.8, sdT: 2.0, sdDr: 1.1, game: 'lol' },
        // LRS 2026 Split 1
        '7d': { elo: 1530, region: 'LRS', logo: '7️⃣', avgK: 10.2, avgT: 6.0, avgDr: 2.4, avgTime: 33.5, sdK: 3.9, sdT: 2.1, sdDr: 1.1, game: 'lol' },
        'tpa': { elo: 1550, region: 'PCS', logo: '🏆', avgK: 10.8, avgT: 6.3, avgDr: 2.5, avgTime: 33.0, sdK: 3.7, sdT: 2.0, sdDr: 1.0, game: 'lol' },
        // CBLOL 2026 Split 1
        'vks': { elo: 1570, region: 'BR', logo: '🦈', avgK: 11.2, avgT: 6.6, avgDr: 2.7, avgTime: 32.0, sdK: 3.5, sdT: 1.8, sdDr: 0.9, game: 'lol' },
        'los': { elo: 1580, region: 'BR', logo: '🎯', avgK: 11.5, avgT: 6.8, avgDr: 2.8, avgTime: 31.8, sdK: 3.4, sdT: 1.7, sdDr: 0.9, game: 'lol' },

        // ===== LCK / LPL — ngày mai 15/04 =====
        'nongshim redforce': { elo: 1660, region: 'LCK', logo: '🍜', avgK: 9.8, avgT: 6.2, avgDr: 2.5, avgTime: 33.8, sdK: 3.5, sdT: 1.8, sdDr: 1.0, game: 'lol' },
        'bnk fearx': { elo: 1640, region: 'LCK', logo: '🦊', avgK: 9.5, avgT: 6.0, avgDr: 2.4, avgTime: 34.0, sdK: 3.6, sdT: 1.9, sdDr: 1.1, game: 'lol' },
        'ultra prime': { elo: 1650, region: 'LPL', logo: '🟣', avgK: 10.2, avgT: 6.2, avgDr: 2.4, avgTime: 33.5, sdK: 3.8, sdT: 2.0, sdDr: 1.1, game: 'lol' },
        'thundertalk gaming': { elo: 1630, region: 'LPL', logo: '⚡', avgK: 9.8, avgT: 6.0, avgDr: 2.3, avgTime: 34.0, sdK: 3.9, sdT: 2.1, sdDr: 1.2, game: 'lol' },
    };

    // ===== SCHEDULE — Auto-detect based on date =====
    function getTodayMatches() {
        const now = new Date();
        // Get Vietnam timezone date string
        const vnDate = new Date(now.getTime() + (7 * 3600 * 1000));
        const dateStr = vnDate.toISOString().slice(0, 10);

        const schedule = {
            '2026-04-14': [
                // === DOTA 2 — LIVE ===
                {
                    id: 'dota-l1ga-bb-0414', league: 'DreamLeague S29 EEU CQ', leagueIcon: '🏆',
                    teamA: 'l1ga', teamB: 'bb team', shortA: 'L1GA', shortB: 'BB',
                    time: '🔴 LIVE', bo: 5, game: 'dota2', status: 'live', score: '1-1'
                },
                {
                    id: 'dota-mouz-liquid-0414', league: 'DreamLeague S29 EEU CQ', leagueIcon: '🏆',
                    teamA: 'mouz', teamB: 'team liquid', shortA: 'MOUZ', shortB: 'Liquid',
                    time: '🔴 LIVE', bo: 3, game: 'dota2', status: 'live', score: '1-1'
                },
                {
                    id: 'dota-lynx-modus-0414', league: 'EPL Season 36 Playoffs', leagueIcon: '⚔️',
                    teamA: 'lynx', teamB: 'modus', shortA: 'Lynx', shortB: 'MODUS',
                    time: '🔴 LIVE', bo: 3, game: 'dota2', status: 'live', score: '0-1'
                },
                // === LOL — Sắp diễn ra ===
                {
                    id: 'lol-myth-dyn-0414', league: 'Road Of Legends 2026', leagueIcon: '🇪🇺',
                    teamA: 'myth', teamB: 'dyn', shortA: 'MYTH', shortB: 'DYN',
                    time: '23:59', bo: 3, game: 'lol', status: 'upcoming'
                },
                {
                    id: 'lol-nno-look-0414', league: 'PRM 2nd Division', leagueIcon: '🇩🇪',
                    teamA: 'nno', teamB: 'look', shortA: 'NNO', shortB: 'LOOK',
                    time: '00:15', bo: 3, game: 'lol', status: 'upcoming'
                },
                {
                    id: 'lol-glr-doc-0414', league: 'Rift Legends 2026', leagueIcon: '🇪🇺',
                    teamA: 'glr', teamB: 'doc', shortA: 'GLR', shortB: 'DOC',
                    time: '00:30', bo: 3, game: 'lol', status: 'upcoming'
                },
                {
                    id: 'lol-lyon-sr-0414', league: 'EWC 2026 NA Qualifier', leagueIcon: '🌎',
                    teamA: 'lyon', teamB: 'sr', shortA: 'LYON', shortB: 'SR',
                    time: '01:00', bo: 3, game: 'lol', status: 'upcoming'
                },
                {
                    id: 'lol-7d-tpa-0414', league: 'LRS 2026 Split 1', leagueIcon: '🌏',
                    teamA: '7d', teamB: 'tpa', shortA: '7D', shortB: 'TPA',
                    time: '03:00', bo: 3, game: 'lol', status: 'upcoming'
                },
                {
                    id: 'lol-vks-los-0414', league: 'CBLOL 2026 Split 1', leagueIcon: '🇧🇷',
                    teamA: 'vks', teamB: 'los', shortA: 'VKS', shortB: 'LOS',
                    time: '04:00', bo: 3, game: 'lol', status: 'upcoming'
                },
            ],
            '2026-04-15': [
                // === LCK + LPL — Chiều/tối ===
                {
                    id: 'lck-ns-bfx-0415', league: 'LCK 2026 Rounds 1-2', leagueIcon: '🇰🇷',
                    teamA: 'nongshim redforce', teamB: 'bnk fearx', shortA: 'NS', shortB: 'BFX',
                    time: '15:00', bo: 3, game: 'lol', status: 'upcoming'
                },
                {
                    id: 'lpl-up-tt-0415', league: 'LPL 2026 Split 2', leagueIcon: '🇨🇳',
                    teamA: 'ultra prime', teamB: 'thundertalk gaming', shortA: 'UP', shortB: 'TT',
                    time: '16:00', bo: 3, game: 'lol', status: 'upcoming'
                },
            ]
        };

        // Return today's matches, or all upcoming within 24h
        return schedule[dateStr] || Object.values(schedule).flat();
    }

    // ===== PREDICTION ENGINE =====
    function predictMatch(match) {
        const tA = TEAMS[match.teamA];
        const tB = TEAMS[match.teamB];
        if (!tA || !tB) return null;

        const gameType = match.game || tA.game || 'lol';
        const lines = LINES[gameType];
        const preds = [];

        // Combined per-game averages
        const totalK = tA.avgK + tB.avgK;
        const totalT = tA.avgT + tB.avgT;
        const totalDr = (tA.avgDr || 0) + (tB.avgDr || 0);
        const avgTime = (tA.avgTime + tB.avgTime) / 2;

        // Standard deviations combined
        const sdK = Math.sqrt(tA.sdK ** 2 + tB.sdK ** 2);
        const sdT = Math.sqrt(tA.sdT ** 2 + tB.sdT ** 2);
        const sdDr = Math.sqrt((tA.sdDr || 1) ** 2 + (tB.sdDr || 1) ** 2);

        // Monte Carlo simulation (N=1000)
        const N = 1000;
        let killOver = 0, towerOver = 0, dragonOver = 0, timeOver = 0;
        for (let i = 0; i < N; i++) {
            const simK = totalK + gaussRandom() * sdK;
            const simT = totalT + gaussRandom() * sdT;
            const simDr = totalDr + gaussRandom() * sdDr;
            const simTime = avgTime + gaussRandom() * 3;
            if (simK > lines.kill) killOver++;
            if (simT > lines.tower) towerOver++;
            if (lines.dragon && simDr > lines.dragon) dragonOver++;
            if (simTime > lines.time) timeOver++;
        }

        const pKillOver = killOver / N;
        const pTowerOver = towerOver / N;
        const pDragonOver = lines.dragon ? dragonOver / N : null;
        const pTimeOver = timeOver / N;

        // Win probability (elo-based)
        const eloDiff = tA.elo - tB.elo;
        const winProbA = 1 / (1 + Math.pow(10, -eloDiff / 400));

        // Generate bet signals
        function addBet(market, overProb, lineVal, label) {
            if (overProb === null) return;
            const isOver = overProb > 0.5;
            const prob = isOver ? overProb : (1 - overProb);
            const confidence = Math.min(0.98, prob);
            const edge = confidence - 0.5;
            if (edge >= 0.04) {
                const signal = isOver ? 'TÀI' : 'XỈU';
                preds.push({
                    market, signal, line: lineVal,
                    confidence, edge,
                    label: `${label} ${signal} ${lineVal}`,
                    expected: isOver
                        ? (market === 'kill' ? totalK.toFixed(1) : market === 'tower' ? totalT.toFixed(1) : market === 'dragon' ? totalDr.toFixed(1) : avgTime.toFixed(1))
                        : '—',
                    strength: edge > 0.2 ? 'strong' : edge > 0.1 ? 'medium' : 'normal'
                });
            }
        }

        addBet('kill', pKillOver, lines.kill, gameType === 'dota2' ? 'Kill' : 'Kill');
        addBet('tower', pTowerOver, lines.tower, gameType === 'dota2' ? 'Tower' : 'Trụ');
        if (gameType === 'lol') addBet('dragon', pDragonOver, lines.dragon, 'Rồng');
        addBet('time', pTimeOver, lines.time, 'Thời gian');

        // Sort by confidence
        preds.sort((a, b) => b.confidence - a.confidence);

        return {
            match, preds, winProbA, gameType,
            totalK: totalK.toFixed(1),
            totalT: totalT.toFixed(1),
            totalDr: totalDr.toFixed(1),
            avgTime: avgTime.toFixed(1),
            topPick: preds.length > 0 ? preds[0] : null
        };
    }

    function gaussRandom() {
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    }

    // ===== RESULTS STORAGE =====
    const RESULTS_KEY = 'betwise_predictions_results';

    function loadResults() {
        try { return JSON.parse(localStorage.getItem(RESULTS_KEY)) || {}; }
        catch { return {}; }
    }

    function saveResult(matchId, market, actual, predicted) {
        const results = loadResults();
        const key = `${matchId}_${market}`;
        results[key] = { matchId, market, actual, predicted, timestamp: Date.now() };
        localStorage.setItem(RESULTS_KEY, JSON.stringify(results));
    }

    function getWinRate() {
        const results = loadResults();
        const entries = Object.values(results);
        if (entries.length === 0) return { total: 0, wins: 0, rate: '—' };
        const wins = entries.filter(r => r.actual === r.predicted).length;
        return { total: entries.length, wins, rate: (wins / entries.length * 100).toFixed(1) + '%' };
    }

    // ===== RENDER PREDICTIONS TAB =====
    function renderPredictions() {
        const container = document.getElementById('tab-predictions');
        if (!container) return;

        const matches = getTodayMatches();
        const predictions = matches.map(m => predictMatch(m)).filter(Boolean);
        const wr = getWinRate();

        // Group by status
        const liveMatches = predictions.filter(p => p.match.status === 'live');
        const upcomingMatches = predictions.filter(p => p.match.status === 'upcoming');

        let html = '';

        // Win rate summary card
        html += `
            <section class="glass-card" style="margin-bottom:16px">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                    <div class="section-title" style="margin:0">📊 THỐNG KÊ DỰ ĐOÁN</div>
                    <span class="es-wr-badge ${wr.total > 0 ? (parseFloat(wr.rate) > 60 ? 'high' : parseFloat(wr.rate) > 50 ? 'medium' : 'low') : ''}">${wr.total > 0 ? `✅ ${wr.wins}/${wr.total} (${wr.rate})` : 'Chưa có dữ liệu'}</span>
                </div>
                <div style="font-size:0.75rem;color:var(--on-surface-variant)">
                    LoL: Dragon XỈU @5.5 (93.2%), Tower @13.5 (91.5%), Kill @20.5 (81.4%)<br>
                    Dota 2: Tower @10.5 (86%), Kill @60.5 (83%), Time @32.5 (78%)
                </div>
            </section>`;

        // Today's date header
        const now = new Date();
        const dayName = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][now.getDay()];
        const dateDisplay = `${dayName} ${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}`;

        // === LIVE SECTION ===
        if (liveMatches.length > 0) {
            html += `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ef4444;animation:pulse-live 1.5s infinite"></span>
                <h3 style="font-size:1.05rem;font-weight:700;color:var(--on-surface)">LIVE — Đang diễn ra</h3>
                <span style="font-size:0.75rem;color:var(--on-surface-variant)">${liveMatches.length} trận</span>
            </div>`;
            liveMatches.forEach(pred => { html += renderPredCard(pred, true); });
        }

        // === UPCOMING SECTION ===
        html += `
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;margin-top:${liveMatches.length > 0 ? '20' : '0'}px">
                <h3 style="font-size:1.05rem;font-weight:700;color:var(--on-surface)">🎯 Sắp thi đấu ${dateDisplay}</h3>
                <span style="font-size:0.75rem;color:var(--on-surface-variant)">${upcomingMatches.length} trận</span>
            </div>`;

        if (upcomingMatches.length === 0 && liveMatches.length === 0) {
            html += '<div class="empty-state">Không có trận đấu nào hôm nay</div>';
        } else {
            upcomingMatches.forEach(pred => { html += renderPredCard(pred, false); });
        }

        // Summary card
        const allPreds = predictions.flatMap(p => p.preds);
        const strongPicks = allPreds.filter(p => p.strength === 'strong');
        const medPicks = allPreds.filter(p => p.strength === 'medium');

        html += `
        <section class="glass-card" style="margin-top:16px">
            <div class="section-title">📋 TÓM TẮT</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">
                <div style="text-align:center;padding:12px 8px;background:var(--success-light);border-radius:10px">
                    <div style="font-size:1.3rem;font-weight:800;color:var(--success)">${strongPicks.length}</div>
                    <div style="font-size:0.65rem;color:var(--success);font-weight:600">🔥 STRONG</div>
                </div>
                <div style="text-align:center;padding:12px 8px;background:var(--primary-container);border-radius:10px">
                    <div style="font-size:1.3rem;font-weight:800;color:var(--primary)">${medPicks.length}</div>
                    <div style="font-size:0.65rem;color:var(--primary);font-weight:600">✅ MEDIUM</div>
                </div>
                <div style="text-align:center;padding:12px 8px;background:var(--surface-container);border-radius:10px">
                    <div style="font-size:1.3rem;font-weight:800;color:var(--on-surface)">${allPreds.length}</div>
                    <div style="font-size:0.65rem;color:var(--on-surface-variant);font-weight:600">TỔNG</div>
                </div>
            </div>
            <div style="font-size:0.75rem;color:var(--on-surface-variant);line-height:1.6">
                <strong>Chiến thuật:</strong> Ưu tiên kèo 🔥 STRONG (confidence ≥70%). Chỉ đặt tối đa 3 kèo/trận.
                Kelly fraction ~5% vốn mỗi lệnh. Dừng khi lỗ 15% vốn/ngày.
            </div>
        </section>`;

        // Add pulse animation
        html += `<style>@keyframes pulse-live { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }</style>`;

        container.innerHTML = html;
    }

    function renderPredCard(pred, isLive) {
        const { match, preds, winProbA, totalK, totalT, totalDr, avgTime, topPick, gameType } = pred;
        const tA = TEAMS[match.teamA];
        const tB = TEAMS[match.teamB];
        const isDota = gameType === 'dota2';
        const gameLabel = isDota ? '🎮 Dota 2' : '🎮 LoL';
        const statHeaders = isDota
            ? [{ label: 'Kill', val: totalK, line: LINES.dota2.kill }, { label: 'Tower', val: totalT, line: LINES.dota2.tower }, { label: 'Time', val: avgTime + 'm', line: LINES.dota2.time + 'm' }]
            : [{ label: 'Kill', val: totalK, line: LINES.lol.kill }, { label: 'Trụ', val: totalT, line: LINES.lol.tower }, { label: 'Rồng', val: totalDr, line: LINES.lol.dragon }, { label: 'Time', val: avgTime + 'm', line: LINES.lol.time + 'm' }];

        return `
        <div class="pred-card glass-card" style="margin-bottom:12px;padding:20px;${isLive ? 'border-left:3px solid #ef4444;' : ''}">
            <!-- Match Header -->
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                <div style="display:flex;align-items:center;gap:6px;font-size:0.72rem;font-weight:600;color:var(--on-surface-variant);text-transform:uppercase">
                    ${match.leagueIcon} ${match.league}
                </div>
                <div style="display:flex;align-items:center;gap:8px">
                    <span style="font-size:0.62rem;padding:2px 6px;border-radius:6px;background:${isDota ? 'rgba(220,38,38,0.08)' : 'rgba(74,94,229,0.08)'};color:${isDota ? '#dc2626' : 'var(--primary)'};font-weight:700">${gameLabel}</span>
                    <span style="font-size:0.72rem;color:var(--on-surface-variant)">${isLive ? match.time : '🕐 ' + match.time} • BO${match.bo}</span>
                </div>
            </div>

            <!-- Teams -->
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
                <div style="display:flex;align-items:center;gap:10px;flex:1">
                    <div class="es-team-logo">${tA?.logo || '?'}</div>
                    <div>
                        <div style="font-size:0.92rem;font-weight:700;color:var(--on-surface)">${match.shortA}</div>
                        <div style="font-size:0.65rem;color:var(--on-surface-variant)">ELO ${tA?.elo || '?'}</div>
                    </div>
                </div>
                <div style="text-align:center;padding:0 12px">
                    ${isLive && match.score ? `<div style="font-size:1.1rem;font-weight:800;color:#ef4444">${match.score}</div>` : `<div style="font-size:0.72rem;font-weight:700;color:var(--on-surface-variant)">VS</div>`}
                    <div style="font-size:0.62rem;color:var(--primary);font-weight:600;margin-top:2px">${(winProbA * 100).toFixed(0)}% — ${((1 - winProbA) * 100).toFixed(0)}%</div>
                </div>
                <div style="display:flex;align-items:center;gap:10px;flex:1;flex-direction:row-reverse">
                    <div class="es-team-logo">${tB?.logo || '?'}</div>
                    <div style="text-align:right">
                        <div style="font-size:0.92rem;font-weight:700;color:var(--on-surface)">${match.shortB}</div>
                        <div style="font-size:0.65rem;color:var(--on-surface-variant)">ELO ${tB?.elo || '?'}</div>
                    </div>
                </div>
            </div>

            <!-- Expected Stats -->
            <div style="display:grid;grid-template-columns:repeat(${statHeaders.length},1fr);gap:6px;margin-bottom:14px">
                ${statHeaders.map(s => `
                <div style="text-align:center;padding:8px 4px;background:var(--surface-container);border-radius:8px">
                    <div style="font-size:0.6rem;color:var(--on-surface-variant);text-transform:uppercase">${s.label}</div>
                    <div style="font-size:0.92rem;font-weight:800;color:var(--on-surface)">${s.val}</div>
                    <div style="font-size:0.58rem;color:var(--on-surface-variant)">line ${s.line}</div>
                </div>`).join('')}
            </div>

            <!-- Predictions -->
            ${preds.length > 0 ? `
            <div style="border-top:1px solid var(--outline-variant);padding-top:12px">
                <div style="font-size:0.68rem;font-weight:700;color:var(--on-surface-variant);letter-spacing:0.06em;margin-bottom:8px;text-transform:uppercase">🎯 Kèo đề xuất</div>
                ${preds.map(p => `
                    <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;margin-bottom:4px;border-radius:8px;background:${p.strength === 'strong' ? 'rgba(34,197,94,0.06)' : 'var(--surface-container)'};border-left:3px solid ${p.strength === 'strong' ? 'var(--success)' : p.strength === 'medium' ? 'var(--primary)' : 'var(--outline)'}">
                        <span style="font-size:0.62rem;font-weight:700;padding:2px 8px;border-radius:10px;background:${p.strength === 'strong' ? 'var(--success-light)' : 'var(--primary-container)'};color:${p.strength === 'strong' ? 'var(--success)' : 'var(--primary)'}">${p.strength === 'strong' ? '🔥 HOT' : p.strength === 'medium' ? '✅ MED' : '📊 STD'}</span>
                        <span style="flex:1;font-size:0.82rem;color:var(--on-surface);font-weight:500">${p.label}</span>
                        <span style="font-size:0.82rem;font-weight:700;color:${p.confidence > 0.7 ? 'var(--success)' : 'var(--warning)'}">${(p.confidence * 100).toFixed(0)}%</span>
                    </div>
                `).join('')}
            </div>` : '<div style="padding:12px 0;font-size:0.75rem;color:var(--on-surface-variant)">Chưa đủ dữ liệu để đề xuất kèo cho trận này</div>'}

            ${topPick ? `
            <div style="margin-top:12px;padding:10px 14px;background:linear-gradient(135deg,rgba(74,94,229,0.06),rgba(34,197,94,0.06));border-radius:10px;border:1px solid rgba(74,94,229,0.15)">
                <div style="font-size:0.68rem;font-weight:700;color:var(--primary);margin-bottom:4px">⭐ TOP PICK</div>
                <div style="font-size:0.88rem;font-weight:700;color:var(--on-surface)">${topPick.label} — Confidence ${(topPick.confidence * 100).toFixed(0)}%</div>
            </div>
            ` : ''}
        </div>`;
    }

    // ===== INIT =====
    function initPredictions() {
        renderPredictions();
    }

    window.BetWisePredictions = { initPredictions, renderPredictions, saveResult, getWinRate, getTodayMatches, predictMatch, TEAMS, LINES };
})();
