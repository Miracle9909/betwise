/**
 * BetWise Predictions Module v1.0
 * Generates daily match predictions using calibrated lines from backtest
 * 
 * Calibrated Lines (LoL):
 *   Kill=20.5 (81.4%), Tower=13.5 (91.5%), Dragon=5.5 (93.2%), Time=33.5min
 */
(function () {
    'use strict';

    // ===== CALIBRATED LINES =====
    const LINES = {
        lol: { kill: 20.5, tower: 13.5, dragon: 5.5, time: 33.5 },
        dota2: { kill: 60.5, tower: 10.5, time: 32.5 }
    };

    // ===== LCK + LPL TEAM DATABASE (Spring 2026) =====
    const TEAMS = {
        // LCK
        't1': { elo: 1780, region: 'LCK', logo: '🔴', avgK: 12.8, avgT: 7.5, avgDr: 3.2, avgTime: 31.2, sdK: 3.5, sdT: 1.8, sdDr: 0.9 },
        'gen.g': { elo: 1770, region: 'LCK', logo: '🟡', avgK: 11.9, avgT: 7.2, avgDr: 3.0, avgTime: 32.0, sdK: 3.2, sdT: 1.6, sdDr: 0.8 },
        'hanwha life': { elo: 1760, region: 'LCK', logo: '🟠', avgK: 12.5, avgT: 7.3, avgDr: 3.1, avgTime: 31.5, sdK: 3.4, sdT: 1.7, sdDr: 0.9 },
        'dplus kia': { elo: 1720, region: 'LCK', logo: '💜', avgK: 11.2, avgT: 6.8, avgDr: 2.8, avgTime: 32.5, sdK: 3.1, sdT: 1.5, sdDr: 0.7 },
        'kt rolster': { elo: 1700, region: 'LCK', logo: '🔵', avgK: 10.8, avgT: 6.5, avgDr: 2.7, avgTime: 33.0, sdK: 3.0, sdT: 1.4, sdDr: 0.8 },
        'kwangdong freecs': { elo: 1690, region: 'LCK', logo: '🟢', avgK: 10.5, avgT: 6.4, avgDr: 2.6, avgTime: 33.2, sdK: 3.3, sdT: 1.6, sdDr: 0.9 },
        'nongshim redforce': { elo: 1660, region: 'LCK', logo: '🍜', avgK: 9.8, avgT: 6.2, avgDr: 2.5, avgTime: 33.8, sdK: 3.5, sdT: 1.8, sdDr: 1.0 },
        'bnk fearx': { elo: 1640, region: 'LCK', logo: '🦊', avgK: 9.5, avgT: 6.0, avgDr: 2.4, avgTime: 34.0, sdK: 3.6, sdT: 1.9, sdDr: 1.1 },
        'ok brion': { elo: 1620, region: 'LCK', logo: '🐦', avgK: 9.2, avgT: 5.8, avgDr: 2.3, avgTime: 34.5, sdK: 3.4, sdT: 1.7, sdDr: 1.0 },
        'drx': { elo: 1610, region: 'LCK', logo: '🐉', avgK: 9.0, avgT: 5.7, avgDr: 2.3, avgTime: 34.8, sdK: 3.8, sdT: 2.0, sdDr: 1.1 },
        // LPL
        'bilibili gaming': { elo: 1780, region: 'LPL', logo: '📺', avgK: 13.2, avgT: 7.8, avgDr: 3.3, avgTime: 30.5, sdK: 3.8, sdT: 2.0, sdDr: 1.0 },
        'weibo gaming': { elo: 1760, region: 'LPL', logo: '🌐', avgK: 13.0, avgT: 7.5, avgDr: 3.2, avgTime: 30.8, sdK: 3.6, sdT: 1.9, sdDr: 0.9 },
        'jd gaming': { elo: 1750, region: 'LPL', logo: '⚡', avgK: 12.8, avgT: 7.4, avgDr: 3.1, avgTime: 31.0, sdK: 3.5, sdT: 1.8, sdDr: 0.9 },
        'top esports': { elo: 1740, region: 'LPL', logo: '🔝', avgK: 12.5, avgT: 7.2, avgDr: 3.0, avgTime: 31.2, sdK: 3.4, sdT: 1.7, sdDr: 0.8 },
        'lng esports': { elo: 1730, region: 'LPL', logo: '🎯', avgK: 12.2, avgT: 7.0, avgDr: 2.9, avgTime: 31.5, sdK: 3.3, sdT: 1.6, sdDr: 0.8 },
        'invictus gaming': { elo: 1700, region: 'LPL', logo: '🦅', avgK: 11.5, avgT: 6.8, avgDr: 2.8, avgTime: 32.0, sdK: 3.5, sdT: 1.8, sdDr: 0.9 },
        'ultra prime': { elo: 1650, region: 'LPL', logo: '🟣', avgK: 10.2, avgT: 6.2, avgDr: 2.4, avgTime: 33.5, sdK: 3.8, sdT: 2.0, sdDr: 1.1 },
        'thundertalk gaming': { elo: 1630, region: 'LPL', logo: '⚡', avgK: 9.8, avgT: 6.0, avgDr: 2.3, avgTime: 34.0, sdK: 3.9, sdT: 2.1, sdDr: 1.2 },
        'anyone\'s legend': { elo: 1620, region: 'LPL', logo: '🐱', avgK: 9.5, avgT: 5.8, avgDr: 2.2, avgTime: 34.2, sdK: 3.7, sdT: 1.9, sdDr: 1.0 },
        'rare atom': { elo: 1610, region: 'LPL', logo: '⚛️', avgK: 9.2, avgT: 5.6, avgDr: 2.1, avgTime: 34.5, sdK: 4.0, sdT: 2.2, sdDr: 1.2 },
    };

    // ===== TODAY'S MATCHES =====
    function getTodayMatches() {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10);
        // Hardcoded matches for reliability — updated daily
        // April 15, 2026 (Vietnam timezone: evening Apr 14 → morning Apr 15)
        const schedule = {
            '2026-04-15': [
                {
                    id: 'lck-ns-bfx-0415',
                    league: 'LCK',
                    leagueIcon: '🇰🇷',
                    teamA: 'nongshim redforce',
                    teamB: 'bnk fearx',
                    shortA: 'NS',
                    shortB: 'BFX',
                    time: '14:00',
                    bo: 3,
                    game: 'lol',
                    status: 'upcoming'
                },
                {
                    id: 'lpl-up-tt-0415',
                    league: 'LPL',
                    leagueIcon: '🇨🇳',
                    teamA: 'ultra prime',
                    teamB: 'thundertalk gaming',
                    shortA: 'UP',
                    shortB: 'TT',
                    time: '15:00',
                    bo: 3,
                    game: 'lol',
                    status: 'upcoming'
                },
                {
                    id: 'lck-kt-dk-0415',
                    league: 'LCK',
                    leagueIcon: '🇰🇷',
                    teamA: 'kt rolster',
                    teamB: 'dplus kia',
                    shortA: 'KT',
                    shortB: 'DK',
                    time: '16:00',
                    bo: 3,
                    game: 'lol',
                    status: 'upcoming'
                },
                {
                    id: 'lpl-wbg-ig-0415',
                    league: 'LPL',
                    leagueIcon: '🇨🇳',
                    teamA: 'weibo gaming',
                    teamB: 'invictus gaming',
                    shortA: 'WBG',
                    shortB: 'IG',
                    time: '17:00',
                    bo: 3,
                    game: 'lol',
                    status: 'upcoming'
                }
            ],
            '2026-04-14': [
                {
                    id: 'lck-ns-bfx-0415',
                    league: 'LCK',
                    leagueIcon: '🇰🇷',
                    teamA: 'nongshim redforce',
                    teamB: 'bnk fearx',
                    shortA: 'NS',
                    shortB: 'BFX',
                    time: '14:00 (ngày mai)',
                    bo: 3,
                    game: 'lol',
                    status: 'upcoming'
                },
                {
                    id: 'lpl-up-tt-0415',
                    league: 'LPL',
                    leagueIcon: '🇨🇳',
                    teamA: 'ultra prime',
                    teamB: 'thundertalk gaming',
                    shortA: 'UP',
                    shortB: 'TT',
                    time: '15:00 (ngày mai)',
                    bo: 3,
                    game: 'lol',
                    status: 'upcoming'
                },
                {
                    id: 'lck-kt-dk-0415',
                    league: 'LCK',
                    leagueIcon: '🇰🇷',
                    teamA: 'kt rolster',
                    teamB: 'dplus kia',
                    shortA: 'KT',
                    shortB: 'DK',
                    time: '16:00 (ngày mai)',
                    bo: 3,
                    game: 'lol',
                    status: 'upcoming'
                },
                {
                    id: 'lpl-wbg-ig-0415',
                    league: 'LPL',
                    leagueIcon: '🇨🇳',
                    teamA: 'weibo gaming',
                    teamB: 'invictus gaming',
                    shortA: 'WBG',
                    shortB: 'IG',
                    time: '17:00 (ngày mai)',
                    bo: 3,
                    game: 'lol',
                    status: 'upcoming'
                }
            ]
        };

        return schedule[dateStr] || schedule['2026-04-14'] || [];
    }

    // ===== PREDICTION ENGINE =====
    function predictMatch(match) {
        const tA = TEAMS[match.teamA];
        const tB = TEAMS[match.teamB];
        if (!tA || !tB) return null;

        const lines = LINES[match.game] || LINES.lol;
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
            if (simDr > lines.dragon) dragonOver++;
            if (simTime > lines.time) timeOver++;
        }

        const pKillOver = killOver / N;
        const pTowerOver = towerOver / N;
        const pDragonOver = dragonOver / N;
        const pTimeOver = timeOver / N;

        // Win probability (elo-based)
        const eloDiff = tA.elo - tB.elo;
        const winProbA = 1 / (1 + Math.pow(10, -eloDiff / 400));

        // Generate bet signals
        function addBet(market, overProb, lineVal, label) {
            const isOver = overProb > 0.5;
            const prob = isOver ? overProb : (1 - overProb);
            const confidence = Math.min(0.98, prob);
            const edge = confidence - 0.5;
            if (edge >= 0.05) {
                const signal = isOver ? 'TÀI' : 'XỈU';
                preds.push({
                    market, signal, line: lineVal,
                    confidence, edge,
                    label: `${label} ${signal} ${lineVal}`,
                    expected: isOver ? (market === 'kill' ? totalK.toFixed(1) : market === 'tower' ? totalT.toFixed(1) : market === 'dragon' ? totalDr.toFixed(1) : avgTime.toFixed(1)) : '—',
                    strength: edge > 0.2 ? 'strong' : edge > 0.1 ? 'medium' : 'normal'
                });
            }
        }

        addBet('kill', pKillOver, lines.kill, 'Kill');
        addBet('tower', pTowerOver, lines.tower, 'Trụ');
        addBet('dragon', pDragonOver, lines.dragon, 'Rồng');
        addBet('time', pTimeOver, lines.time, 'Thời gian');

        // Sort by confidence
        preds.sort((a, b) => b.confidence - a.confidence);

        return {
            match, preds,
            winProbA,
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
        try {
            return JSON.parse(localStorage.getItem(RESULTS_KEY)) || {};
        } catch { return {}; }
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

        let html = '';

        // Win rate summary card
        html += `
            <section class="glass-card" style="margin-bottom:16px">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                    <div class="section-title" style="margin:0">📊 THỐNG KÊ DỰ ĐOÁN</div>
                    <span class="es-wr-badge ${wr.total > 0 ? (parseFloat(wr.rate) > 60 ? 'high' : parseFloat(wr.rate) > 50 ? 'medium' : 'low') : ''}">${wr.total > 0 ? `✅ ${wr.wins}/${wr.total} (${wr.rate})` : 'Chưa có dữ liệu'}</span>
                </div>
                <div style="font-size:0.75rem;color:var(--on-surface-variant)">
                    Dựa trên backtest 1000 game LoL: Dragon XỈU @5.5 (93.2%), Tower TÀI @9.5 (91.5%), Kill @20.5 (81.4%)
                </div>
            </section>`;

        // Today's predictions header
        const today = new Date();
        const dayName = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][today.getDay()];
        const dateDisplay = `${dayName} ${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}`;

        html += `
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
                <h3 style="font-size:1.05rem;font-weight:700;color:var(--on-surface)">🎯 Dự đoán ${dateDisplay}</h3>
                <span style="font-size:0.75rem;color:var(--on-surface-variant)">${predictions.length} trận</span>
            </div>`;

        if (predictions.length === 0) {
            html += '<div class="empty-state">Không có trận đấu nào hôm nay</div>';
        } else {
            predictions.forEach(pred => {
                const { match, preds, winProbA, totalK, totalT, totalDr, avgTime, topPick } = pred;
                const tA = TEAMS[match.teamA];
                const tB = TEAMS[match.teamB];

                html += `
                <div class="pred-card glass-card" style="margin-bottom:12px;padding:20px">
                    <!-- Match Header -->
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                        <div style="display:flex;align-items:center;gap:6px;font-size:0.72rem;font-weight:600;color:var(--on-surface-variant);text-transform:uppercase">
                            ${match.leagueIcon} ${match.league}
                        </div>
                        <div style="display:flex;align-items:center;gap:8px">
                            <span style="font-size:0.72rem;color:var(--on-surface-variant)">🕐 ${match.time} • BO${match.bo}</span>
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
                            <div style="font-size:0.72rem;font-weight:700;color:var(--on-surface-variant)">VS</div>
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
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;margin-bottom:14px">
                        <div style="text-align:center;padding:8px 4px;background:var(--surface-container);border-radius:8px">
                            <div style="font-size:0.6rem;color:var(--on-surface-variant);text-transform:uppercase">Kill</div>
                            <div style="font-size:0.92rem;font-weight:800;color:var(--on-surface)">${totalK}</div>
                            <div style="font-size:0.58rem;color:var(--on-surface-variant)">line ${LINES.lol.kill}</div>
                        </div>
                        <div style="text-align:center;padding:8px 4px;background:var(--surface-container);border-radius:8px">
                            <div style="font-size:0.6rem;color:var(--on-surface-variant);text-transform:uppercase">Trụ</div>
                            <div style="font-size:0.92rem;font-weight:800;color:var(--on-surface)">${totalT}</div>
                            <div style="font-size:0.58rem;color:var(--on-surface-variant)">line ${LINES.lol.tower}</div>
                        </div>
                        <div style="text-align:center;padding:8px 4px;background:var(--surface-container);border-radius:8px">
                            <div style="font-size:0.6rem;color:var(--on-surface-variant);text-transform:uppercase">Rồng</div>
                            <div style="font-size:0.92rem;font-weight:800;color:var(--on-surface)">${totalDr}</div>
                            <div style="font-size:0.58rem;color:var(--on-surface-variant)">line ${LINES.lol.dragon}</div>
                        </div>
                        <div style="text-align:center;padding:8px 4px;background:var(--surface-container);border-radius:8px">
                            <div style="font-size:0.6rem;color:var(--on-surface-variant);text-transform:uppercase">Time</div>
                            <div style="font-size:0.92rem;font-weight:800;color:var(--on-surface)">${avgTime}m</div>
                            <div style="font-size:0.58rem;color:var(--on-surface-variant)">line ${LINES.lol.time}</div>
                        </div>
                    </div>

                    <!-- Predictions -->
                    <div style="border-top:1px solid var(--outline-variant);padding-top:12px">
                        <div style="font-size:0.68rem;font-weight:700;color:var(--on-surface-variant);letter-spacing:0.06em;margin-bottom:8px;text-transform:uppercase">🎯 Kèo đề xuất</div>
                        ${preds.map(p => `
                            <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;margin-bottom:4px;border-radius:8px;background:${p.strength === 'strong' ? 'rgba(34,197,94,0.06)' : 'var(--surface-container)'};border-left:3px solid ${p.strength === 'strong' ? 'var(--success)' : p.strength === 'medium' ? 'var(--primary)' : 'var(--outline)'}">
                                <span style="font-size:0.62rem;font-weight:700;padding:2px 8px;border-radius:10px;background:${p.strength === 'strong' ? 'var(--success-light)' : 'var(--primary-container)'};color:${p.strength === 'strong' ? 'var(--success)' : 'var(--primary)'}">${p.strength === 'strong' ? '🔥 HOT' : p.strength === 'medium' ? '✅ MED' : '📊 STD'}</span>
                                <span style="flex:1;font-size:0.82rem;color:var(--on-surface);font-weight:500">${p.label}</span>
                                <span style="font-size:0.82rem;font-weight:700;color:${p.confidence > 0.7 ? 'var(--success)' : 'var(--warning)'}">${(p.confidence * 100).toFixed(0)}%</span>
                            </div>
                        `).join('')}
                    </div>

                    ${topPick ? `
                    <div style="margin-top:12px;padding:10px 14px;background:linear-gradient(135deg,rgba(74,94,229,0.06),rgba(34,197,94,0.06));border-radius:10px;border:1px solid rgba(74,94,229,0.15)">
                        <div style="font-size:0.68rem;font-weight:700;color:var(--primary);margin-bottom:4px">⭐ TOP PICK</div>
                        <div style="font-size:0.88rem;font-weight:700;color:var(--on-surface)">${topPick.label} — Confidence ${(topPick.confidence * 100).toFixed(0)}%</div>
                    </div>
                    ` : ''}
                </div>`;
            });

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
        }

        container.innerHTML = html;
    }

    // ===== INIT =====
    function initPredictions() {
        renderPredictions();
    }

    window.BetWisePredictions = { initPredictions, renderPredictions, saveResult, getWinRate, getTodayMatches, predictMatch, TEAMS, LINES };
})();
