/**
 * BetWise Predictions Module v2.0
 * Real-time daily predictions powered by EsportsAnalyzer APIs
 *
 * BOOKMAKER LINES (user-calibrated):
 *   Dota 2: Tower=12.5, Time=40m, Kill=60.5
 *   LoL:    Tower=11.5, Dragon=4.5, Time=31m, Kill=28.5
 */
(function () {
    'use strict';

    // ===== CORRECT BOOKMAKER LINES =====
    const BK_LINES = {
        dota2: { kill: 60.5, tower: 12.5, time: 40 },
        lol: { kill: 28.5, tower: 11.5, dragon: 4.5, time: 31 }
    };

    // ===== TEAM LOGO RENDERING =====
    function teamLogoHtml(team, size = 36) {
        if (team.imageUrl) {
            return `<img src="${team.imageUrl}" alt="${team.name}" class="team-logo-img" style="width:${size}px;height:${size}px" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span class="es-team-logo" style="display:none;width:${size}px;height:${size}px;min-width:${size}px;font-size:${Math.round(size * 0.45)}px">${team.logo || '🎮'}</span>`;
        }
        return `<span class="es-team-logo" style="width:${size}px;height:${size}px;min-width:${size}px;font-size:${Math.round(size * 0.45)}px">${team.logo || '🎮'}</span>`;
    }

    // ===== RESULTS STORAGE =====
    const STORAGE_KEY = 'betwise_pred_results_v2';
    const HISTORY_KEY = 'betwise_pred_history_v2';

    function loadResults() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
    }
    function saveResults(r) { localStorage.setItem(STORAGE_KEY, JSON.stringify(r)); }

    function loadHistory() {
        try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; }
    }
    function saveHistory(h) { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); }

    function saveResult(matchId, market, predictedSignal, actualValue) {
        const results = loadResults();
        const line = results[matchId]?.line || 0;
        const isOver = actualValue > line;
        const actualSignal = isOver ? 'TÀI' : 'XỈU';
        const won = actualSignal === predictedSignal;
        results[`${matchId}_${market}`] = {
            matchId, market, predictedSignal, actualValue, actualSignal, won,
            timestamp: Date.now()
        };
        saveResults(results);
    }

    function getWinRate() {
        const results = loadResults();
        const entries = Object.values(results).filter(r => r.won !== undefined);
        if (entries.length === 0) return { total: 0, wins: 0, rate: '—' };
        const wins = entries.filter(r => r.won).length;
        return { total: entries.length, wins, rate: (wins / entries.length * 100).toFixed(1) + '%' };
    }

    // ===== PREDICTION ENGINE =====
    function gaussRandom() {
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    }

    function predictFromMatch(match, game) {
        // Use dynamic league-aware lines from EsportsAnalyzer when available
        const league = match.league || match.leagueName || '';
        const lines = (typeof EsportsAnalyzer !== 'undefined' && EsportsAnalyzer.getLines)
            ? EsportsAnalyzer.getLines(game, league)
            : (BK_LINES[game] || BK_LINES.lol);
        const preds = [];

        // Get team stats from EsportsAnalyzer
        const tA = match.teamA || {};
        const tB = match.teamB || {};
        const avgKA = tA.avgKills || (game === 'dota2' ? 25 : 11);
        const avgKB = tB.avgKills || (game === 'dota2' ? 25 : 11);
        const avgTA = tA.avgTowers || (game === 'dota2' ? 6 : 5.5);
        const avgTB = tB.avgTowers || (game === 'dota2' ? 6 : 5.5);
        const avgDA = tA.avgDuration || (game === 'dota2' ? 38 : 30);
        const avgDB = tB.avgDuration || (game === 'dota2' ? 38 : 30);
        const avgDrA = tA.avgDragon || (game === 'lol' ? 2.2 : 0);
        const avgDrB = tB.avgDragon || (game === 'lol' ? 2.2 : 0);
        const sdKA = tA.sdKills || (game === 'dota2' ? 6 : 3.5);
        const sdKB = tB.sdKills || (game === 'dota2' ? 6 : 3.5);
        const sdTA = tA.sdTowers || 1.5;
        const sdTB = tB.sdTowers || 1.5;
        const sdDrA = tA.sdDragon || 0.9;
        const sdDrB = tB.sdDragon || 0.9;

        const totalK = avgKA + avgKB;
        const totalT = avgTA + avgTB;
        const totalDr = avgDrA + avgDrB;
        const avgTime = (avgDA + avgDB) / 2;
        const sdK = Math.sqrt(sdKA ** 2 + sdKB ** 2);
        const sdT = Math.sqrt(sdTA ** 2 + sdTB ** 2);
        const sdDr = Math.sqrt(sdDrA ** 2 + sdDrB ** 2);

        // Monte Carlo (N=800)
        const N = 800;
        let killO = 0, towerO = 0, dragonO = 0, timeO = 0;
        for (let i = 0; i < N; i++) {
            if (totalK + gaussRandom() * sdK > lines.kill) killO++;
            if (totalT + gaussRandom() * sdT > lines.tower) towerO++;
            if (game === 'lol' && totalDr + gaussRandom() * sdDr > lines.dragon) dragonO++;
            if (avgTime + gaussRandom() * 4 > lines.time) timeO++;
        }

        function addBet(market, overCount, lineVal, label, expected) {
            const overProb = overCount / N;
            const isOver = overProb > 0.5;
            const prob = isOver ? overProb : (1 - overProb);
            const confidence = Math.min(0.95, prob);
            const edge = confidence - 0.5;
            if (edge >= 0.03) {
                const signal = isOver ? 'TÀI' : 'XỈU';
                preds.push({
                    market, signal, line: lineVal, confidence, edge,
                    label: `${label} ${signal} ${lineVal}`,
                    expected: expected,
                    strength: edge > 0.2 ? 'strong' : edge > 0.1 ? 'medium' : 'normal'
                });
            }
        }

        addBet('kill', killO, lines.kill, 'Kill', totalK.toFixed(1));
        addBet('tower', towerO, lines.tower, game === 'dota2' ? 'Tower' : 'Trụ', totalT.toFixed(1));
        if (game === 'lol') addBet('dragon', dragonO, lines.dragon, 'Rồng', totalDr.toFixed(1));
        addBet('time', timeO, lines.time, 'TG(phút)', avgTime.toFixed(1));

        preds.sort((a, b) => b.confidence - a.confidence);

        // Win probability
        const eloA = tA.elo || 1400;
        const eloB = tB.elo || 1400;
        const winProbA = 1 / (1 + Math.pow(10, -(eloA - eloB) / 400));

        return {
            preds, winProbA, game,
            totalK: totalK.toFixed(1), totalT: totalT.toFixed(1),
            totalDr: totalDr.toFixed(1), avgTime: avgTime.toFixed(1),
            topPick: preds[0] || null
        };
    }

    // ===== RENDER =====
    async function renderPredictions() {
        const container = document.getElementById('tab-predictions');
        if (!container) return;

        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--on-surface-variant)">⏳ Đang tải trận đấu từ API...</div>';

        // Fetch real matches from EsportsAnalyzer
        const dateStr = typeof EsportsAnalyzer !== 'undefined' ? EsportsAnalyzer.todayStr() : new Date().toISOString().slice(0, 10);
        let matches = [];
        try {
            if (typeof EsportsAnalyzer !== 'undefined') {
                matches = await EsportsAnalyzer.loadMatchesForDate(dateStr);
            }
        } catch (e) {
            console.warn('[Predictions] API fetch failed:', e);
        }

        // Filter matches to today only (GMT+7) — exclude cross-midnight matches from tomorrow
        const todayDateStr = dateStr; // Already in GMT+7
        matches = matches.filter(m => {
            // Always keep live matches
            if (m.status === 'live' || m.status === 'inProgress') return true;
            // If we have the raw start time, check GMT+7 date
            if (m.rawStartTime) {
                const matchDate = new Date(m.rawStartTime);
                const gmt7 = new Date(matchDate.getTime() + 7 * 60 * 60 * 1000);
                const matchDateStr = `${gmt7.getUTCFullYear()}-${String(gmt7.getUTCMonth() + 1).padStart(2, '0')}-${String(gmt7.getUTCDate()).padStart(2, '0')}`;
                return matchDateStr === todayDateStr;
            }
            return true; // Keep if no start time info
        });
        console.log(`[Predictions] Filtered to ${matches.length} matches for ${todayDateStr}`);

        const wr = getWinRate();
        let html = '';

        // Header stats
        html += `
        <section class="glass-card" style="margin-bottom:16px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                <div class="section-title" style="margin:0">📊 TỈ LỆ DỰ ĐOÁN</div>
                <span style="font-size:0.78rem;font-weight:700;padding:4px 10px;border-radius:10px;background:${wr.total > 0 ? (parseFloat(wr.rate) > 60 ? 'var(--success-light)' : 'var(--primary-container)') : 'var(--surface-container)'};color:${wr.total > 0 ? (parseFloat(wr.rate) > 60 ? 'var(--success)' : 'var(--primary)') : 'var(--on-surface-variant)'}">${wr.total > 0 ? `✅ ${wr.wins}/${wr.total} (${wr.rate})` : 'Chưa có kết quả'}</span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.72rem;color:var(--on-surface-variant);line-height:1.6">
                <div><strong>Dota 2:</strong> Tower ${BK_LINES.dota2.tower} • Time ${BK_LINES.dota2.time}m • Kill ${BK_LINES.dota2.kill}</div>
                <div><strong>LoL:</strong> Tower ${BK_LINES.lol.tower} • Dragon ${BK_LINES.lol.dragon} • Kill 27.5~29.5 • Time 31~33m</div>
            </div>
        </section>`;

        // Date header
        const now = new Date();
        const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
        const dateDisplay = `${dayNames[now.getDay()]} ${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}`;

        if (matches.length === 0) {
            html += `
            <div style="text-align:center;padding:30px 16px;color:var(--on-surface-variant)">
                <div style="font-size:2rem;margin-bottom:8px">📭</div>
                <div style="font-size:0.88rem;font-weight:600">Không có trận đấu hôm nay (${dateDisplay})</div>
                <div style="font-size:0.72rem;margin-top:6px">Hệ thống tự động tải trận từ OpenDota + LoL Esports API</div>
            </div>`;
            container.innerHTML = html;
            return;
        }

        // Group by status
        const liveMatches = matches.filter(m => m.status === 'live' || m.status === 'inProgress');
        const upcomingMatches = matches.filter(m => m.status === 'upcoming' || m.status === 'unstarted' || m.status === 'notStarted' || !m.status);
        const finishedMatches = matches.filter(m => m.status === 'completed' || m.status === 'finished');

        // Auto-select tab: live > upcoming > finished
        if (!window._predFilter) {
            window._predFilter = liveMatches.length > 0 ? 'live' : upcomingMatches.length > 0 ? 'upcoming' : 'finished';
        }
        const activeFilter = window._predFilter;

        // === FILTER TABS ===
        const tabs = [
            { key: 'live', label: '🔴 Live', count: liveMatches.length },
            { key: 'upcoming', label: '🎯 Sắp tới', count: upcomingMatches.length },
            { key: 'finished', label: '✅ Kết thúc', count: finishedMatches.length },
        ];

        html += `<div style="display:flex;gap:6px;margin-bottom:14px;overflow-x:auto;padding-bottom:4px">`;
        tabs.forEach(tab => {
            const isActive = activeFilter === tab.key;
            html += `<button onclick="window._predFilter='${tab.key}';BetWisePredictions.renderPredictions()" style="
                display:flex;align-items:center;gap:6px;
                padding:8px 16px;border-radius:24px;
                border:1px solid ${isActive ? 'var(--primary)' : 'var(--outline)'};
                background:${isActive ? 'var(--primary)' : 'var(--surface)'};
                color:${isActive ? 'white' : 'var(--on-surface-variant)'};
                font-size:0.78rem;font-weight:${isActive ? '700' : '500'};
                cursor:pointer;white-space:nowrap;transition:all 0.2s;
                font-family:var(--font-body)">
                ${tab.label}
                <span style="
                    font-size:0.62rem;font-weight:700;
                    padding:1px 7px;border-radius:10px;
                    background:${isActive ? 'rgba(255,255,255,0.25)' : 'var(--surface-container)'};
                    color:${isActive ? 'white' : 'var(--on-surface-variant)'}">${tab.count}</span>
            </button>`;
        });
        html += `</div>`;

        // Date indicator
        html += `<div style="font-size:0.65rem;color:var(--on-surface-variant);margin-bottom:10px;display:flex;align-items:center;gap:4px">
            📅 <strong>${dateDisplay}</strong> • ${matches.length} trận hôm nay
        </div>`;

        // === RENDER SELECTED SECTION ===
        if (activeFilter === 'live') {
            if (liveMatches.length > 0) {
                liveMatches.forEach(m => { html += renderMatchPred(m); });
            } else {
                html += `<div style="text-align:center;padding:24px 16px;color:var(--on-surface-variant)">
                    <div style="font-size:1.5rem;margin-bottom:6px">📡</div>
                    <div style="font-size:0.82rem">Không có trận nào đang diễn ra</div>
                </div>`;
            }
        } else if (activeFilter === 'upcoming') {
            if (upcomingMatches.length > 0) {
                upcomingMatches.forEach(m => { html += renderMatchPred(m); });
            } else {
                html += `<div style="text-align:center;padding:24px 16px;color:var(--on-surface-variant)">
                    <div style="font-size:1.5rem;margin-bottom:6px">🏁</div>
                    <div style="font-size:0.82rem">Tất cả trận hôm nay đã bắt đầu hoặc kết thúc</div>
                </div>`;
            }
        } else if (activeFilter === 'finished') {
            if (finishedMatches.length > 0) {
                html += renderFinishedSummary(finishedMatches);
            } else {
                html += `<div style="text-align:center;padding:24px 16px;color:var(--on-surface-variant)">
                    <div style="font-size:1.5rem;margin-bottom:6px">⏳</div>
                    <div style="font-size:0.82rem">Chưa có trận nào kết thúc hôm nay</div>
                </div>`;
            }
        }

        // Summary
        const activeMatches = activeFilter === 'live' ? liveMatches : activeFilter === 'upcoming' ? upcomingMatches : finishedMatches;
        const allPreds = activeMatches.map(m => {
            const game = m.game || 'lol';
            const pred = predictFromMatch(m, game);
            return pred.preds;
        }).flat();
        const strong = allPreds.filter(p => p.strength === 'strong').length;
        const med = allPreds.filter(p => p.strength === 'medium').length;

        html += `
        <section class="glass-card" style="margin-top:16px">
            <div class="section-title">📋 TÓM TẮT NGÀY</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:12px">
                <div style="text-align:center;padding:10px 4px;background:var(--surface-container);border-radius:10px">
                    <div style="font-size:1.2rem;font-weight:800;color:var(--on-surface)">${matches.length}</div>
                    <div style="font-size:0.6rem;color:var(--on-surface-variant)">Tổng trận</div>
                </div>
                <div style="text-align:center;padding:10px 4px;background:var(--success-light);border-radius:10px">
                    <div style="font-size:1.2rem;font-weight:800;color:var(--success)">${strong}</div>
                    <div style="font-size:0.6rem;color:var(--success)">🔥 HOT</div>
                </div>
                <div style="text-align:center;padding:10px 4px;background:var(--primary-container);border-radius:10px">
                    <div style="font-size:1.2rem;font-weight:800;color:var(--primary)">${med}</div>
                    <div style="font-size:0.6rem;color:var(--primary)">✅ MED</div>
                </div>
                <div style="text-align:center;padding:10px 4px;background:var(--surface-container);border-radius:10px">
                    <div style="font-size:1.2rem;font-weight:800;color:var(--on-surface)">${allPreds.length}</div>
                    <div style="font-size:0.6rem;color:var(--on-surface-variant)">Tổng kèo</div>
                </div>
            </div>
        </section>`;

        container.innerHTML = html;
    }

    function sectionHeader(title, count, isLive) {
        return `
        <div style="display:flex;align-items:center;gap:8px;margin:16px 0 12px 0">
            ${isLive ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ef4444;animation:pulse-live 1.5s infinite"></span>' : ''}
            <h3 style="font-size:1rem;font-weight:700;color:var(--on-surface);flex:1">${title}</h3>
            <span style="font-size:0.72rem;color:var(--on-surface-variant)">${count} trận</span>
        </div>
        <style>@keyframes pulse-live { 0%,100% { opacity:1 } 50% { opacity:0.3 } }</style>`;
    }

    function renderMatchPred(match) {
        const game = match.game || 'lol';
        const pred = predictFromMatch(match, game);
        const { preds, winProbA, totalK, totalT, totalDr, avgTime, topPick } = pred;
        const tA = match.teamA || {};
        const tB = match.teamB || {};
        const lines = BK_LINES[game];
        const isDota = game === 'dota2';
        const isLive = match.status === 'live' || match.status === 'inProgress';
        const league = match.league || match.leagueName || '—';
        const time = match.time || match.scheduledTime || '—';

        const statItems = isDota
            ? [
                { label: 'Kill', val: totalK, line: lines.kill },
                { label: 'Tower', val: totalT, line: lines.tower },
                { label: 'Time', val: avgTime + 'm', line: lines.time + 'm' }
            ]
            : [
                { label: 'Kill', val: totalK, line: lines.kill },
                { label: 'Trụ', val: totalT, line: lines.tower },
                { label: 'Rồng', val: totalDr, line: lines.dragon },
                { label: 'Time', val: avgTime + 'm', line: lines.time + 'm' }
            ];

        return `
        <div class="glass-card" style="margin-bottom:12px;padding:18px;${isLive ? 'border-left:3px solid #ef4444;' : ''}">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
                <div style="display:flex;align-items:center;gap:6px">
                    <span style="font-size:0.7rem;font-weight:600;color:var(--on-surface-variant);text-transform:uppercase">${league}</span>
                    ${match.bestOf > 1 ? `<span style="font-size:0.55rem;padding:1px 5px;border-radius:4px;background:rgba(74,94,229,0.08);color:var(--primary);font-weight:700">BO${match.bestOf}${match.scoreA != null ? ' (' + match.scoreA + ':' + match.scoreB + ')' : ''}</span>` : ''}
                </div>
                <div style="display:flex;align-items:center;gap:6px">
                    <span style="font-size:0.6rem;padding:2px 6px;border-radius:6px;background:${isDota ? 'rgba(220,38,38,0.08)' : 'rgba(74,94,229,0.08)'};color:${isDota ? '#dc2626' : 'var(--primary)'};font-weight:700">${isDota ? 'Dota 2' : 'LoL'}</span>
                    <span style="font-size:0.7rem;color:var(--on-surface-variant)">${isLive ? '🔴 LIVE' : '🕐 ' + time}</span>
                </div>
            </div>

            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
                <div style="display:flex;align-items:center;gap:8px;flex:1">
                    ${teamLogoHtml(tA, 36)}
                    <div>
                        <div style="font-size:0.88rem;font-weight:700;color:var(--on-surface)">${tA.name || '?'}</div>
                    </div>
                </div>
                <div style="text-align:center;padding:0 10px">
                    <div style="font-size:0.7rem;font-weight:700;color:var(--on-surface-variant)">VS</div>
                    <div style="font-size:0.6rem;color:var(--primary);font-weight:600">${(winProbA * 100).toFixed(0)}%—${((1 - winProbA) * 100).toFixed(0)}%</div>
                </div>
                <div style="display:flex;align-items:center;gap:8px;flex:1;flex-direction:row-reverse">
                    ${teamLogoHtml(tB, 36)}
                    <div style="text-align:right">
                        <div style="font-size:0.88rem;font-weight:700;color:var(--on-surface)">${tB.name || '?'}</div>
                    </div>
                </div>
            </div>

            <div style="display:grid;grid-template-columns:repeat(${statItems.length},1fr);gap:5px;margin-bottom:12px">
                ${statItems.map(s => `
                <div style="text-align:center;padding:7px 3px;background:var(--surface-container);border-radius:8px">
                    <div style="font-size:0.58rem;color:var(--on-surface-variant);text-transform:uppercase">${s.label}</div>
                    <div style="font-size:0.88rem;font-weight:800;color:var(--on-surface)">${s.val}</div>
                    <div style="font-size:0.55rem;color:var(--on-surface-variant)">line ${s.line}</div>
                </div>`).join('')}
            </div>

            ${preds.length > 0 ? `
            <div style="border-top:1px solid var(--outline-variant);padding-top:10px">
                <div style="font-size:0.65rem;font-weight:700;color:var(--on-surface-variant);letter-spacing:0.05em;margin-bottom:6px;text-transform:uppercase">🎯 Kèo đề xuất</div>
                ${preds.map(p => `
                <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;margin-bottom:3px;border-radius:8px;background:${p.strength === 'strong' ? 'rgba(34,197,94,0.06)' : 'var(--surface-container)'};border-left:3px solid ${p.strength === 'strong' ? 'var(--success)' : p.strength === 'medium' ? 'var(--primary)' : 'var(--outline)'}">
                    <span style="font-size:0.6rem;font-weight:700;padding:2px 6px;border-radius:8px;background:${p.strength === 'strong' ? 'var(--success-light)' : 'var(--primary-container)'};color:${p.strength === 'strong' ? 'var(--success)' : 'var(--primary)'}">${p.strength === 'strong' ? '🔥 HOT' : p.strength === 'medium' ? '✅ MED' : '📊 STD'}</span>
                    <span style="flex:1;font-size:0.78rem;color:var(--on-surface);font-weight:500">${p.label}</span>
                    <span style="font-size:0.78rem;font-weight:700;color:${p.confidence > 0.7 ? 'var(--success)' : 'var(--warning)'}">${(p.confidence * 100).toFixed(0)}%</span>
                </div>`).join('')}
            </div>` : ''}

            ${topPick ? `
            <div style="margin-top:10px;padding:8px 12px;background:linear-gradient(135deg,rgba(74,94,229,0.05),rgba(34,197,94,0.05));border-radius:10px;border:1px solid rgba(74,94,229,0.12)">
                <div style="font-size:0.62rem;font-weight:700;color:var(--primary);margin-bottom:2px">⭐ TOP PICK</div>
                <div style="font-size:0.82rem;font-weight:700;color:var(--on-surface)">${topPick.label} — ${(topPick.confidence * 100).toFixed(0)}%</div>
            </div>` : ''}
        </div>`;
    }

    function renderFinishedSummary(matches) {
        let html = '<div style="display:flex;flex-direction:column;gap:10px">';
        matches.forEach(m => {
            const game = m.game || 'lol';
            const pred = predictFromMatch(m, game);
            const tA = m.teamA || {};
            const tB = m.teamB || {};
            const result = m.result || {};
            const hasResult = result.kills != null || result.towers != null;
            const bo = m.bestOf || 1;
            const hasSeriesScore = m.scoreA != null && m.scoreB != null;
            const isDota = game === 'dota2';
            const isWinnerA = m.winnerA || (hasSeriesScore && m.scoreA > m.scoreB);
            const isWinnerB = m.winnerB || (hasSeriesScore && m.scoreB > m.scoreA);

            // Check each prediction against actual result
            let predResults = [];
            if (hasResult && pred.preds.length > 0) {
                pred.preds.forEach(p => {
                    let actual = null;
                    let line = p.line;
                    if (p.market === 'kill' && result.kills != null) actual = result.kills;
                    else if (p.market === 'tower' && result.towers != null) actual = result.towers;
                    else if (p.market === 'dragon' && result.dragons != null) actual = result.dragons;
                    else if (p.market === 'time' && result.duration != null) actual = result.duration;

                    if (actual != null) {
                        const actualSignal = actual > line ? 'TÀI' : 'XỈU';
                        const won = actualSignal === p.signal;
                        predResults.push({ ...p, actual, won });
                    }
                });
            }

            const totalPreds = predResults.length;
            const totalWins = predResults.filter(r => r.won).length;

            // LPL-style card with both team logos
            html += `
        <div class="glass-card" style="padding:16px">
            <!-- League + Status -->
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                <div style="font-size:0.65rem;color:var(--on-surface-variant);display:flex;align-items:center;gap:4px">
                    <span style="font-size:0.55rem;padding:1px 5px;border-radius:4px;background:${isDota ? 'rgba(220,38,38,0.08)' : 'rgba(74,94,229,0.08)'};color:${isDota ? '#dc2626' : 'var(--primary)'};font-weight:700">${isDota ? 'Dota 2' : 'LoL'}</span>
                    ${m.league || ''}${bo > 1 ? ` • BO${bo}` : ''}
                </div>
                ${totalPreds > 0 ? `<span style="font-size:0.68rem;font-weight:700;padding:2px 8px;border-radius:8px;background:${totalWins === totalPreds ? 'var(--success-light)' : totalWins > 0 ? 'rgba(251,191,36,0.12)' : 'rgba(239,68,68,0.08)'};color:${totalWins === totalPreds ? 'var(--success)' : totalWins > 0 ? '#d97706' : '#ef4444'}">${totalWins}/${totalPreds} ✅</span>` : ''}
            </div>

            <!-- Team VS Team (LPL Style) -->
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                <div style="display:flex;flex-direction:column;align-items:center;flex:1;gap:4px">
                    ${teamLogoHtml(tA, 40)}
                    <div style="font-size:0.78rem;font-weight:700;color:${isWinnerA ? 'var(--primary)' : 'var(--on-surface)'}; text-align:center">${tA.name || '?'}</div>
                </div>
                <div style="text-align:center;padding:0 12px">
                    ${hasSeriesScore ? `<div style="font-size:1.3rem;font-weight:800;color:var(--on-surface)">${m.scoreA} <span style="font-size:0.8rem;color:var(--on-surface-variant)">:</span> ${m.scoreB}</div>` : '<div style="font-size:0.78rem;font-weight:700;color:var(--on-surface-variant)">VS</div>'}
                    <div style="font-size:0.55rem;color:var(--on-surface-variant)">KẾT THÚC</div>
                </div>
                <div style="display:flex;flex-direction:column;align-items:center;flex:1;gap:4px">
                    ${teamLogoHtml(tB, 40)}
                    <div style="font-size:0.78rem;font-weight:700;color:${isWinnerB ? 'var(--primary)' : 'var(--on-surface)'}; text-align:center">${tB.name || '?'}</div>
                </div>
            </div>

            ${hasResult ? `<!-- Average Stats -->
            <div style="display:grid;grid-template-columns:repeat(${isDota ? 3 : 4},1fr);gap:4px;margin-bottom:10px">
                <div style="text-align:center;padding:5px 3px;background:var(--surface-container);border-radius:6px">
                    <div style="font-size:0.55rem;color:var(--on-surface-variant)">KILL</div>
                    <div style="font-size:0.82rem;font-weight:700">${result.kills ?? '—'}</div>
                </div>
                <div style="text-align:center;padding:5px 3px;background:var(--surface-container);border-radius:6px">
                    <div style="font-size:0.55rem;color:var(--on-surface-variant)">${isDota ? 'TOWER' : 'TRỤ'}</div>
                    <div style="font-size:0.82rem;font-weight:700">${result.towers ?? '—'}</div>
                </div>
                ${!isDota ? `<div style="text-align:center;padding:5px 3px;background:var(--surface-container);border-radius:6px">
                    <div style="font-size:0.55rem;color:var(--on-surface-variant)">RỒNG</div>
                    <div style="font-size:0.82rem;font-weight:700">${result.dragons ?? '—'}</div>
                </div>` : ''}
                <div style="text-align:center;padding:5px 3px;background:var(--surface-container);border-radius:6px">
                    <div style="font-size:0.55rem;color:var(--on-surface-variant)">TIME</div>
                    <div style="font-size:0.82rem;font-weight:700">${result.duration ?? '—'}m</div>
                </div>
            </div>` : ''}

            ${predResults.length > 0 ? `<!-- Prediction Results -->
            <div style="display:flex;flex-direction:column;gap:3px;margin-bottom:8px">
                ${predResults.map(r => `<div style="display:flex;align-items:center;gap:6px;padding:4px 8px;border-radius:6px;background:${r.won ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)'};border-left:3px solid ${r.won ? 'var(--success)' : '#ef4444'}">
                    <span style="font-size:0.72rem;font-weight:700">${r.won ? '✅' : '❌'}</span>
                    <span style="font-size:0.7rem;flex:1">${r.label}</span>
                    <span style="font-size:0.65rem;color:var(--on-surface-variant)">Thực: ${r.actual}</span>
                </div>`).join('')}
            </div>` : (!hasResult ? `<div style="font-size:0.65rem;color:var(--on-surface-variant);text-align:center;padding:6px;background:var(--surface-container);border-radius:6px">
                ⏳ Đang cập nhật kết quả chi tiết...
            </div>` : '')}

            ${bo > 1 && m.games && m.games.length > 0 ? `<!-- BO3/5 Per-Game Breakdown (LPL Style) -->
            <div style="margin-top:8px;border-top:1px solid var(--outline-variant);padding-top:10px">
                <div style="font-size:0.62rem;font-weight:700;color:var(--on-surface-variant);text-transform:uppercase;margin-bottom:8px;letter-spacing:0.05em">🎮 CHI TIẾT TỪNG GAME (${m.games.length} ván)</div>
                <div style="display:flex;flex-direction:column;gap:4px">
                ${m.games.map((g, i) => {
                const isWinA = g.winner && tA.name && g.winner.toLowerCase().includes(tA.name.toLowerCase().substring(0, 4));
                return `<div style="padding:8px 10px;border-radius:8px;background:var(--surface-container);border-left:3px solid ${isWinA ? 'var(--primary)' : 'var(--error)'}">
                        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
                            <span style="font-size:0.68rem;font-weight:700;color:var(--primary)">Game ${g.gameNumber || (i + 1)}</span>
                            <span style="font-size:0.62rem;font-weight:600;color:${isWinA ? 'var(--primary)' : 'var(--error)'}">${g.winner || '?'} thắng</span>
                        </div>
                        <div style="display:grid;grid-template-columns:repeat(${isDota ? 3 : 4},1fr);gap:4px">
                            <div style="text-align:center">
                                <div style="font-size:0.5rem;color:var(--on-surface-variant)">KILL</div>
                                <div style="font-size:0.72rem;font-weight:700">${g.kills ?? '—'}</div>
                            </div>
                            <div style="text-align:center">
                                <div style="font-size:0.5rem;color:var(--on-surface-variant)">${isDota ? 'TOWER' : 'TRỤ'}</div>
                                <div style="font-size:0.72rem;font-weight:700">${g.towers ?? '—'}</div>
                            </div>
                            ${!isDota ? `<div style="text-align:center">
                                <div style="font-size:0.5rem;color:var(--on-surface-variant)">RỒNG</div>
                                <div style="font-size:0.72rem;font-weight:700">${g.dragons ?? '—'}</div>
                            </div>` : ''}
                            <div style="text-align:center">
                                <div style="font-size:0.5rem;color:var(--on-surface-variant)">TIME</div>
                                <div style="font-size:0.72rem;font-weight:700">${g.duration ?? '—'}m</div>
                            </div>
                        </div>
                    </div>`;
            }).join('')}
                </div>
            </div>` : ''}
        </div>`;
        });
        html += '</div>';
        return html;
    }

    // ===== INIT =====
    async function initPredictions() {
        await renderPredictions();
    }

    window.BetWisePredictions = { initPredictions, renderPredictions, saveResult, getWinRate, BK_LINES };
})();
