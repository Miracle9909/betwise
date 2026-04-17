/**
 * BetWise Esports UI Controller v5.0 — Pro Icons + Champion Display
 */
(function () {
    'use strict';

    let esState = EsportsAnalyzer.loadState();
    let currentMatches = [];
    let isAutoRunning = false;
    let autoRunAbort = false;
    let dataSource = 'loading';
    let selectedMatches = new Set();
    let gameFilter = 'all';
    let autoSettleTimer = null;

    // ===== DATA DRAGON CDN for Champion Portraits =====
    const DD_VERSION = '14.8.1';
    const DD_CDN = `https://ddragon.leagueoflegends.com/cdn/${DD_VERSION}/img/champion`;
    // Dota 2 hero images from CDN
    const DOTA_HERO_CDN = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes';
    const DOTA_HEROES = ['anti_mage', 'axe', 'bane', 'bloodseeker', 'crystal_maiden', 'drow_ranger', 'earthshaker', 'juggernaut', 'mirana', 'morphling', 'phantom_assassin', 'pudge', 'razor', 'sand_king', 'storm_spirit', 'sven', 'tiny', 'vengeful_spirit', 'windranger', 'zeus', 'kunkka', 'lina', 'lion', 'shadow_shaman', 'slardar', 'tidehunter', 'witch_doctor', 'lich', 'riki', 'enigma', 'tinker', 'sniper', 'necrophos', 'warlock', 'beastmaster', 'queen_of_pain', 'venomancer', 'faceless_void', 'wraith_king', 'death_prophet', 'phantom_lancer', 'pugna', 'templar_assassin', 'viper', 'luna', 'dragon_knight', 'dazzle', 'clockwerk', 'leshrac', 'natures_prophet', 'lifestealer', 'dark_seer', 'clinkz', 'omniknight', 'enchantress', 'huskar', 'night_stalker', 'broodmother', 'bounty_hunter', 'weaver', 'jakiro', 'batrider', 'chen', 'spectre', 'ancient_apparition', 'doom', 'ursa', 'spirit_breaker', 'gyrocopter', 'alchemist', 'invoker', 'silencer', 'outworld_destroyer', 'lycan', 'brewmaster', 'shadow_demon', 'lone_druid', 'chaos_knight', 'meepo', 'treant_protector', 'ogre_magi', 'undying', 'rubick', 'disruptor', 'nyx_assassin', 'naga_siren', 'keeper_of_the_light', 'io', 'visage', 'slark', 'medusa', 'troll_warlord', 'centaur_warrunner', 'magnus', 'timbersaw', 'bristleback', 'tusk', 'skywrath_mage', 'abaddon', 'elder_titan', 'legion_commander', 'techies', 'ember_spirit', 'earth_spirit', 'underlord', 'terrorblade', 'phoenix', 'oracle', 'winter_wyvern', 'arc_warden', 'monkey_king', 'dark_willow', 'pangolier', 'grimstroke', 'hoodwink', 'dawnbreaker', 'marci', 'primal_beast', 'muerta'];

    // Champion ID → name mapping (LoL Esports commonly uses lowercase names)
    function champImgUrl(champId) {
        if (!champId) return '';
        // Handle both numeric IDs and string names from API
        let name = typeof champId === 'string' ? champId : '';
        // Capitalize first letter for Data Dragon URL format
        if (name) name = name.charAt(0).toUpperCase() + name.slice(1);
        return `${DD_CDN}/${name || champId}.png`;
    }

    function dotaHeroImgUrl(heroName) {
        if (!heroName) return '';
        const slug = heroName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
        return `${DOTA_HERO_CDN}/${slug}.png`;
    }

    // ===== PRO ICONS (LoLQQ / LPL Broadcast Style — Filled & Colorful) =====
    const ICON = {
        kills: `<svg class="es-stat-svg kills" viewBox="0 0 24 24"><defs><linearGradient id="gkill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ff4444"/><stop offset="100%" stop-color="#cc0000"/></linearGradient></defs><path d="M7.5 2L12 8L16.5 2L15 9L20 6L14 12L20 18L15 15L16.5 22L12 16L7.5 22L9 15L4 18L10 12L4 6L9 9Z" fill="url(#gkill)"/></svg>`,
        tower: `<svg class="es-stat-svg tower" viewBox="0 0 24 24"><defs><linearGradient id="gtwr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#8ecae6"/><stop offset="100%" stop-color="#457b9d"/></linearGradient></defs><path d="M6 22H18V20H15V12H17V8L12 3L7 8V12H9V20H6V22Z" fill="url(#gtwr)"/><rect x="10" y="8" width="4" height="3" rx="0.5" fill="#ffd60a" opacity="0.9"/><rect x="5" y="8" width="3" height="2" rx="0.3" fill="url(#gtwr)"/><rect x="16" y="8" width="3" height="2" rx="0.3" fill="url(#gtwr)"/></svg>`,
        dragon: `<svg class="es-stat-svg dragon" viewBox="0 0 24 24"><defs><linearGradient id="gdrg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ff6b35"/><stop offset="50%" stop-color="#e63946"/><stop offset="100%" stop-color="#9d0208"/></linearGradient></defs><path d="M12 2C10 3 8 4 7 6L4 5C4.5 7 5 8 6 9L3 11C4 12 5.5 12.5 7 12.5C6 14 5.5 16 6 19L8 17C8.5 19 9.5 20.5 11 22C11 19 11.5 17 12.5 15C13.5 17 14 19 14 22C15.5 20.5 16.5 19 17 17L19 19C19.5 16 19 14 18 12.5C19.5 12.5 21 12 22 11L19 9C20 8 20.5 7 21 5L18 6C17 4 15 3 12 2Z" fill="url(#gdrg)"/><circle cx="9.5" cy="8" r="1" fill="#ffd60a"/><circle cx="14.5" cy="8" r="1" fill="#ffd60a"/></svg>`,
        time: `<svg class="es-stat-svg time" viewBox="0 0 24 24"><defs><linearGradient id="gtm" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#60a5fa"/><stop offset="100%" stop-color="#2563eb"/></linearGradient></defs><circle cx="12" cy="12" r="10" fill="url(#gtm)" opacity="0.15"/><circle cx="12" cy="12" r="9" fill="none" stroke="url(#gtm)" stroke-width="2"/><path d="M12 6V12L16 14" stroke="url(#gtm)" stroke-width="2" stroke-linecap="round" fill="none"/><circle cx="12" cy="12" r="1.5" fill="url(#gtm)"/></svg>`,
        baron: `<svg class="es-stat-svg baron" viewBox="0 0 24 24"><defs><linearGradient id="gbar" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#c77dff"/><stop offset="100%" stop-color="#7b2cbf"/></linearGradient></defs><path d="M12 1L9 5L5 3.5L7 8.5L3 12L7 14L6 19.5L10 16.5L12 20L14 16.5L18 19.5L17 14L21 12L17 8.5L19 3.5L15 5L12 1Z" fill="url(#gbar)"/><circle cx="9.5" cy="9.5" r="1.2" fill="#ffd60a"/><circle cx="14.5" cy="9.5" r="1.2" fill="#ffd60a"/><path d="M9 13C9 13 10.5 15 12 15C13.5 15 15 13 15 13" stroke="#ffd60a" stroke-width="1" fill="none" stroke-linecap="round"/></svg>`,
        gold: `<svg class="es-stat-svg gold" viewBox="0 0 24 24"><defs><linearGradient id="ggld" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffd60a"/><stop offset="100%" stop-color="#e6a800"/></linearGradient></defs><circle cx="12" cy="12" r="9" fill="url(#ggld)"/><circle cx="12" cy="12" r="7" fill="none" stroke="#b8860b" stroke-width="0.8" opacity="0.4"/><text x="12" y="16" text-anchor="middle" font-size="11" font-weight="800" fill="#7c5e00" font-family="Arial">$</text></svg>`,
        roshan: `<svg class="es-stat-svg roshan" viewBox="0 0 24 24"><defs><linearGradient id="grosh" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f472b6"/><stop offset="100%" stop-color="#be185d"/></linearGradient></defs><path d="M12 2C8 2 5 5 5 9C5 11 6 13 7 14L5 18L8 17L9 20L12 17L15 20L16 17L19 18L17 14C18 13 19 11 19 9C19 5 16 2 12 2Z" fill="url(#grosh)"/><circle cx="9" cy="9" r="1.5" fill="#fde68a"/><circle cx="15" cy="9" r="1.5" fill="#fde68a"/><path d="M9 13C10 14.5 14 14.5 15 13" stroke="#fde68a" stroke-width="1.2" fill="none" stroke-linecap="round"/></svg>`,
    };

    function statIcon(type, value, label) {
        return `<div class="es-pro-stat"><span class="es-icon-wrap">${ICON[type]}</span><strong>${value}</strong>${label ? `<span class="es-stat-label">${label}</span>` : ''}</div>`;
    }

    function champRow(champions, side) {
        if (!champions || champions.length === 0) return '';
        return `<div class="es-champ-row ${side}">${champions.map(c =>
            `<img class="es-champ-img" src="${champImgUrl(c)}" alt="${c}" onerror="this.style.display='none'" loading="lazy">`
        ).join('')}</div>`;
    }

    // ===== INIT =====
    async function initEsports() {
        if (!esState.viewingDate) esState.viewingDate = EsportsAnalyzer.todayStr();
        renderDateNav();
        await loadDate(esState.viewingDate);
    }

    async function loadDate(dateStr) {
        esState.viewingDate = dateStr;
        EsportsAnalyzer.saveState(esState);

        renderDateNav();
        const container = document.getElementById('esMatchList');
        if (container) container.innerHTML = '<div class="es-loading"><div class="es-spinner"></div>Đang tải trận đấu...</div>';

        // Check cache first
        if (esState.matchCache && esState.matchCache[dateStr] && esState.matchCache[dateStr].length > 0) {
            currentMatches = esState.matchCache[dateStr];
            dataSource = currentMatches.some(m => m.isReal) ? 'live' : 'simulator';
            renderAll();
            // Re-fetch in background if viewing today
            if (dateStr === EsportsAnalyzer.todayStr()) {
                refreshMatches(dateStr, false);
            }
            return;
        }

        await refreshMatches(dateStr, true);
    }

    async function refreshMatches(dateStr, showLoading) {
        // Show skeleton loading
        const container = document.getElementById('esMatchList');
        if (container) {
            container.innerHTML = Array.from({ length: 4 }, () => `
                <div class="es-skeleton-card">
                    <div class="es-sk-line short"></div>
                    <div class="es-sk-line long"></div>
                    <div class="es-sk-line medium"></div>
                    <div class="es-sk-line xl"></div>
                </div>`).join('');
        }
        try {
            const matches = await EsportsAnalyzer.loadMatchesForDate(dateStr);
            if (matches.length > 0) {
                currentMatches = matches;
                dataSource = matches.some(m => m.isReal) ? 'live' : 'simulator';
                if (!esState.matchCache) esState.matchCache = {};
                esState.matchCache[dateStr] = matches;
                EsportsAnalyzer.saveState(esState);
                renderAll();
                checkEdgeAlerts(matches);
                startAutoSettlement();
                if (showLoading) {
                    const realCount = matches.filter(m => m.isReal).length;
                    window.showToast?.(`✅ ${matches.length} trận (${realCount} thực) — ${EsportsAnalyzer.formatDate(dateStr)}`, 'success');
                }
            } else {
                currentMatches = [];
                dataSource = 'empty';
                renderAll();
            }
        } catch (e) {
            console.error('[Esports] Load failed:', e);
            currentMatches = [];
            dataSource = 'error';
            renderAll();
        }
    }

    function renderAll() {
        trackPredictions();
        resolvePredictions();
        renderCapital();
        renderDataSource();
        renderMatchList();
        renderTimeline();
        renderStats();
        renderWeekly();
        renderAutoButton();
    }

    // ===== PREDICTION TRACKING =====
    function trackPredictions() {
        if (!esState.predictions) esState.predictions = [];
        for (const match of currentMatches) {
            if (esState.predictions.find(p => p.matchId === match.id)) continue;
            const rec = EsportsAnalyzer.generateRecommendation(match.bets, esState.capital, esState.streak || 0, esState.sessionPL || 0, esState.predictions, match.teamA, match.teamB, esState.bets);
            if (!rec.bestBet) continue;
            esState.predictions.push({
                matchId: match.id,
                matchLabel: `${match.teamA.name} vs ${match.teamB.name}`,
                game: match.game,
                league: match.league || '',
                betType: rec.betType || rec.bestBet.type,
                pick: rec.pick || rec.bestBet.pick,
                line: rec.bestBet.line,
                probability: rec.probability || rec.bestBet.pickProb,
                edge: rec.edge || 0,
                action: rec.action, // 'BET' or 'SKIP'
                hasBet: !!esState.bets.find(b => b.matchId === match.id),
                resolved: false,
                won: null,
                actual: null,
                timestamp: new Date().toISOString(),
            });
        }
        EsportsAnalyzer.saveState(esState);
    }

    function resolvePredictions() {
        if (!esState.predictions) return;
        let changed = false;
        for (const pred of esState.predictions) {
            if (pred.resolved) continue;
            const match = currentMatches.find(m => m.id === pred.matchId);
            if (!match) continue;
            const isFinished = match.status === 'finished';
            const result = match.result;
            if (!isFinished || !result) continue;
            const res = EsportsAnalyzer.resolvePrediction(pred, result);
            pred.resolved = true;
            pred.won = res.won;
            pred.actual = res.actual;
            pred.hasBet = !!esState.bets.find(b => b.matchId === pred.matchId);
            changed = true;
        }
        if (changed) EsportsAnalyzer.saveState(esState);
    }

    // ===== DATE NAVIGATOR =====
    function renderDateNav() {
        const el = document.getElementById('esDateNav');
        if (!el) return;
        const today = EsportsAnalyzer.todayStr();
        const viewing = esState.viewingDate || today;
        const isToday = viewing === today;

        const d = new Date(viewing + 'T12:00:00');
        const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
        const monthNames = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
        const dayName = dayNames[d.getDay()];
        const label = isToday ? `HÔM NAY — ${dayName} ${d.getDate()}/${monthNames[d.getMonth()]}` : `${dayName} ${d.getDate()}/${monthNames[d.getMonth()]}/${d.getFullYear()}`;

        el.innerHTML = `
            <button class="es-nav-btn" onclick="navigateDate(-1)" title="Ngày trước">◀</button>
            <div class="es-nav-date ${isToday ? 'today' : ''}">
                <span class="es-nav-label">${label}</span>
                ${!isToday ? '<button class="es-nav-today" onclick="navigateToToday()">Hôm nay</button>' : ''}
            </div>
            <button class="es-nav-btn" onclick="navigateDate(1)" title="Ngày sau" ${isToday ? 'disabled' : ''}>▶</button>
        `;
    }

    window.navigateDate = async function (offset) {
        const newDate = EsportsAnalyzer.shiftDate(esState.viewingDate, offset);
        const today = EsportsAnalyzer.todayStr();
        if (newDate > today) return;
        await loadDate(newDate);
    };
    window.navigateToToday = async function () {
        await loadDate(EsportsAnalyzer.todayStr());
    };

    // ===== DATA SOURCE =====
    function renderDataSource() {
        let el = document.getElementById('esDataSource');
        if (!el) {
            const nav = document.getElementById('esDateNav');
            if (!nav) return;
            el = document.createElement('div');
            el.id = 'esDataSource';
            nav.parentNode.insertBefore(el, nav.nextSibling);
        }
        const realCount = currentMatches.filter(m => m.isReal).length;
        const simCount = currentMatches.filter(m => !m.isReal).length;
        const dotaCount = currentMatches.filter(m => m.game === 'dota2').length;
        const lolCount = currentMatches.filter(m => m.game === 'lol').length;

        let sourceText = '';
        if (dataSource === 'live') {
            sourceText = `<span class="es-source-live">🔴 LIVE DATA</span> — ${realCount} thực${simCount > 0 ? ` + ${simCount} giả lập` : ''}`;
            el.className = 'es-data-source live';
        } else if (dataSource === 'simulator') {
            sourceText = '<span class="es-source-sim">🟡 SIMULATOR</span> — Dữ liệu giả lập';
            el.className = 'es-data-source sim';
        } else if (dataSource === 'empty') {
            sourceText = '<span class="es-source-sim">📭</span> — Không tìm thấy trận';
            el.className = 'es-data-source sim';
        } else {
            sourceText = '<span class="es-source-sim">⏳</span> Đang tải...';
            el.className = 'es-data-source sim';
        }

        // Game Filter Toggle
        el.innerHTML = sourceText + `
            <div class="es-game-filter">
                <button class="es-game-filter-btn ${gameFilter === 'all' ? 'active' : ''}" onclick="setGameFilter('all')">
                    Tất cả <span class="es-gf-count">${currentMatches.length}</span>
                </button>
                <button class="es-game-filter-btn ${gameFilter === 'dota2' ? 'active' : ''}" onclick="setGameFilter('dota2')">
                    🎮 Dota 2 <span class="es-gf-count">${dotaCount}</span>
                </button>
                <button class="es-game-filter-btn ${gameFilter === 'lol' ? 'active' : ''}" onclick="setGameFilter('lol')">
                    🐉 LoL <span class="es-gf-count">${lolCount}</span>
                </button>
            </div>`;
    }
    window.setGameFilter = function (filter) {
        gameFilter = filter;
        renderAll();
    };

    // ===== CAPITAL =====
    function renderCapital() {
        const el = id => document.getElementById(id);
        if (!el('esCapital')) return;
        el('esCapital').textContent = '₫' + EsportsAnalyzer.fmtFull(esState.capital);
        const today = EsportsAnalyzer.todayStr();
        const dpl = EsportsAnalyzer.calcDailyPL(esState.bets, today);
        const wpl = EsportsAnalyzer.calcWeeklyPL(esState.bets);
        const wr = EsportsAnalyzer.calcWinRate(esState.bets);

        const dEl = el('esDailyPL');
        dEl.textContent = (dpl >= 0 ? '+' : '') + '₫' + EsportsAnalyzer.fmtFull(Math.abs(dpl));
        dEl.className = 'es-pl-value ' + (dpl >= 0 ? 'es-win' : 'es-loss');

        const wEl = el('esWeeklyPL');
        wEl.textContent = (wpl >= 0 ? '+' : '') + '₫' + EsportsAnalyzer.fmtFull(Math.abs(wpl));
        wEl.className = 'es-pl-value ' + (wpl >= 0 ? 'es-win' : 'es-loss');

        const resolved = esState.bets.filter(b => b.result !== null);
        el('esWinRate').textContent = resolved.length > 0 ? `${(wr * 100).toFixed(0)}% (${resolved.filter(b => b.result === 'win').length}/${resolved.length})` : '—';
        if (resolved.length > 0) el('esWinRate').className = 'es-pl-value ' + (wr >= 0.5 ? 'es-win' : 'es-loss');

        // Prediction WR (all predictions including non-bet)
        const predStats = EsportsAnalyzer.calcPredictionWinRate(esState.predictions || []);
        const predEl = el('esPredWinRate');
        if (predEl) {
            if (predStats.total > 0) {
                predEl.textContent = `${(predStats.rate * 100).toFixed(0)}% (${predStats.wins}/${predStats.total})`;
                predEl.className = 'es-pl-value ' + (predStats.rate >= 0.5 ? 'es-win' : 'es-loss');
            } else {
                predEl.textContent = '—';
            }
        }

        const streakEl = el('esStreak');
        if (streakEl && resolved.length > 0) {
            let streak = 1, last = resolved[resolved.length - 1].result;
            for (let i = resolved.length - 2; i >= 0; i--) { if (resolved[i].result === last) streak++; else break; }
            streakEl.textContent = (last === 'win' ? '🔥 ' : '❄️ ') + streak + (last === 'win' ? 'W' : 'L');
            streakEl.className = 'es-pl-value ' + (last === 'win' ? 'es-win' : 'es-loss');
        }
    }

    function renderMatchCard(match, isToday) {
        const rec = EsportsAnalyzer.generateRecommendation(match.bets, esState.capital, esState.streak || 0, esState.sessionPL || 0, esState.predictions, match.teamA, match.teamB, esState.bets);
        const bet = esState.bets.find(b => b.matchId === match.id);
        const isFinished = match.status === 'finished' || bet?.result != null;
        const gameTag = match.game === 'dota2' ? 'dota2' : 'lol';
        const gameName = match.game === 'dota2' ? 'DOTA 2' : 'LOL';
        const isLive = match.status === 'live';
        const bo = match.bestOf || 1;
        const hasSeriesScore = match.scoreA != null && match.scoreB != null;
        const seriesFinished = isFinished && hasSeriesScore;
        const aWon = seriesFinished && match.scoreA > match.scoreB;
        const bWon = seriesFinished && match.scoreB > match.scoreA;
        const isSelected = selectedMatches.has(match.id);
        const isUpcoming = match.status === 'upcoming';
        const wp = EsportsAnalyzer.winProbability(match.teamA, match.teamB);

        return `
                <div class="es-match-card glass-card ${isFinished ? 'finished' : ''} ${isLive ? 'live' : ''} ${isSelected ? 'selected' : ''}" 
                     data-match-id="${match.id}">
                    <div class="es-match-header">
                        <div class="es-match-tags">
                            ${isToday && isUpcoming ? `<label class="es-checkbox" onclick="event.stopPropagation()">
                                <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleMatchSelection('${match.id}')">
                                <span class="es-checkmark"></span>
                            </label>` : ''}
                            <span class="es-game-tag ${gameTag}">${gameName}</span>
                            ${bo > 1 ? `<span class="es-bo-badge">BO${bo}</span>` : ''}
                            ${match.league ? `<span class="es-league-tag">${match.league}</span>` : ''}
                            ${match.isReal ? '<span class="es-real-badge">📡</span>' : ''}
                        </div>
                        <div class="es-match-meta" onclick="viewEsMatch('${match.id}')">
                            <span class="es-match-time">${isLive ? '🔴 LIVE' : match.time}</span>
                            ${rec.action === 'BET' && !isFinished && isToday ? `<span class="es-qualified-badge">WR ${(wp * 100).toFixed(0)}%</span>` : ''}
                        </div>
                    </div>
                    <div class="es-teams" onclick="viewEsMatch('${match.id}')">
                        <div class="es-team ${aWon ? 'es-team-winner' : ''}">
                            <span class="es-team-logo">${match.teamA.logo}</span>
                            <span class="es-team-name">${match.teamA.name}</span>
                        </div>
                        <div class="es-vs-block">
                            ${hasSeriesScore
                ? `<div class="es-series-score"><span class="es-ss ${aWon ? 'es-ss-win' : ''} ${isLive ? 'es-ss-live' : ''}">${match.scoreA}</span><span class="es-ss-sep">:</span><span class="es-ss ${bWon ? 'es-ss-win' : ''} ${isLive ? 'es-ss-live' : ''}">${match.scoreB}</span></div>`
                : `<div class="es-vs">${isLive ? '🔴' : isFinished ? '✅' : 'VS'}</div>`
            }
                            ${isFinished && match.result ? `<div class="es-score-final es-pro-stats-inline">${statIcon('kills', match.result.kills)}${statIcon('tower', match.result.towers)}${statIcon('time', match.result.duration + 'p')}${match.result.dragons != null ? statIcon('dragon', match.result.dragons) : ''}</div>` : ''}
                            ${isLive && !hasSeriesScore ? '<div class="es-live-dot">LIVE</div>' : ''}
                        </div>
                        <div class="es-team ${bWon ? 'es-team-winner' : ''}">
                            <span class="es-team-logo">${match.teamB.logo}</span>
                            <span class="es-team-name">${match.teamB.name}</span>
                        </div>
                    </div>
                    ${isFinished && bo > 1 && hasSeriesScore ? `<div class="es-series-result-bar">${aWon ? '🏆 ' + match.teamA.name : bWon ? '🏆 ' + match.teamB.name : ''} thắng BO${bo} (${match.scoreA}:${match.scoreB})</div>` : ''}
                    ${isLive && bo > 1 ? `<div class="es-series-live-bar">🔴 Đang thi đấu Game ${(match.scoreA || 0) + (match.scoreB || 0) + 1} / BO${bo} (${match.scoreA || 0}:${match.scoreB || 0})</div>` : ''}
                    ${!isFinished && !isLive && bo > 1 ? `<div class="es-series-upcoming-bar">📋 Game 1 / BO${bo}</div>` : ''}
                    ${renderMatchBadge(rec, bet, isToday, match)}
                </div>`;
    }

    function renderMatchList() {
        const container = document.getElementById('esMatchList');
        if (!container) return;
        const isToday = esState.viewingDate === EsportsAnalyzer.todayStr();

        // Apply game filter
        const filtered = gameFilter === 'all' ? currentMatches : currentMatches.filter(m => m.game === gameFilter);

        if (filtered.length === 0) {
            container.innerHTML = `<div class="empty-state">
                <div class="es-empty-icon">📭</div>
                <p>${gameFilter !== 'all' ? `Không có trận ${gameFilter === 'dota2' ? 'Dota 2' : 'LoL'}` : 'Không có trận hợp lệ'} ngày ${EsportsAnalyzer.formatDate(esState.viewingDate)}</p>
                <p style="opacity:0.5;font-size:12px;">Top 30 teams + Tier 1 leagues</p>
            </div>`;
            return;
        }

        // Split matches by status
        const liveMatches = filtered.filter(m => m.status === 'live');
        const upcomingMatches = filtered.filter(m => m.status === 'upcoming');
        const finishedMatches = filtered.filter(m => m.status === 'finished' || esState.bets.find(b => b.matchId === m.id)?.result != null);

        let html = '';

        // === SECTION 1: LIVE ===
        if (liveMatches.length > 0) {
            html += `<div class="es-section">
                <div class="es-section-header es-section-live">
                    <span class="es-section-icon">🔴</span>
                    <span class="es-section-title">Đang thi đấu</span>
                    <span class="es-section-count">${liveMatches.length}</span>
                </div>
                <div class="es-section-body">
                    ${liveMatches.map(m => renderMatchCard(m, isToday)).join('')}
                </div>
            </div>`;
        }

        // === SECTION 2: UPCOMING ===
        if (upcomingMatches.length > 0) {
            const selectControls = isToday ? `<div class="es-select-controls">
                <button class="es-select-btn" onclick="selectAllMatches()">☑ Chọn tất cả</button>
                <button class="es-select-btn" onclick="deselectAllMatches()">☐ Bỏ chọn</button>
                <span class="es-selected-count">${selectedMatches.size}/${upcomingMatches.length} đã chọn</span>
            </div>` : '';

            html += `<div class="es-section">
                <div class="es-section-header es-section-upcoming">
                    <span class="es-section-icon">⏳</span>
                    <span class="es-section-title">Sắp diễn ra</span>
                    <span class="es-section-count">${upcomingMatches.length}</span>
                </div>
                <div class="es-section-body">
                    ${selectControls}
                    ${upcomingMatches.map(m => renderMatchCard(m, isToday)).join('')}
                </div>
            </div>`;
        }

        // === SECTION 3: FINISHED (collapsible) ===
        if (finishedMatches.length > 0) {
            html += `<div class="es-section">
                <div class="es-section-header es-section-finished" onclick="toggleFinishedSection()" style="cursor:pointer">
                    <span class="es-section-icon">✅</span>
                    <span class="es-section-title">Đã kết thúc</span>
                    <span class="es-section-count">${finishedMatches.length}</span>
                    <span class="es-section-toggle" id="esFinishedToggle">▼</span>
                </div>
                <div class="es-section-body" id="esFinishedBody">
                    ${finishedMatches.map(m => renderMatchCard(m, isToday)).join('')}
                </div>
            </div>`;
        }

        // Empty active section
        if (liveMatches.length === 0 && upcomingMatches.length === 0) {
            html = `<div class="empty-state" style="margin-bottom:16px">
                <p style="opacity:0.6;font-size:13px;">Không có trận live/upcoming — Chỉ có ${finishedMatches.length} trận đã kết thúc</p>
            </div>` + html;
        }

        container.innerHTML = html;
    }

    // Toggle finished section collapse
    window.toggleFinishedSection = function () {
        const body = document.getElementById('esFinishedBody');
        const toggle = document.getElementById('esFinishedToggle');
        if (!body) return;
        const collapsed = body.style.display === 'none';
        body.style.display = collapsed ? '' : 'none';
        if (toggle) toggle.textContent = collapsed ? '▼' : '▶';
    };

    function renderMatchBadge(rec, bet, isToday, match) {
        const boInfo = match && match.bestOf > 1 ? ` │ Game ${((match.scoreA || 0) + (match.scoreB || 0)) + 1}/BO${match.bestOf}` : '';
        if (bet && bet.result != null) {
            const won = bet.result === 'win';
            return `<div class="es-rec-badge ${won ? 'es-rec-win' : 'es-rec-loss'}">
                ${won ? '✅ THẮNG' : '❌ THUA'} │ ${bet.betLabel}: ${bet.pickLabel}${boInfo} │ ${bet.pnl >= 0 ? '+' : ''}₫${EsportsAnalyzer.fmtFull(Math.abs(bet.pnl))}
            </div>`;
        }
        if (bet && bet.result === null) {
            return `<div class="es-rec-badge es-rec-pending">⏳ Đang thi đấu${boInfo}... ₫${EsportsAnalyzer.fmtFull(bet.amount)}</div>`;
        }
        if (rec.action === 'BET' && isToday) {
            const tc = rec.confTier === 'elite' ? 'es-rec-elite' : rec.confTier === 'high' ? 'es-rec-high' : 'es-rec-medium';
            return `<div class="es-rec-badge ${tc}">
                <div class="es-rec-header">🔮 ${rec.betLabel}: ${rec.pickLabel}${boInfo}</div>
                <div class="es-rec-detail">P=${(rec.probability * 100).toFixed(0)}% │ Edge=+${(rec.edge * 100).toFixed(1)}% │ ₫${EsportsAnalyzer.fmt(rec.amount)}</div>
            </div>`;
        }
        if (rec.action === 'BET') {
            return `<div class="es-rec-badge es-rec-past">📊 P=${(rec.probability * 100).toFixed(0)}% Edge=+${(rec.edge * 100).toFixed(1)}%</div>`;
        }
        return `<div class="es-rec-badge es-rec-skip">${rec.reason || 'Không đủ edge — Theo dõi'}</div>`;
    }

    // ===== MATCH SELECTION =====
    window.toggleMatchSelection = function (matchId) {
        if (selectedMatches.has(matchId)) {
            selectedMatches.delete(matchId);
        } else {
            selectedMatches.add(matchId);
        }
        renderAll();
    };
    window.selectAllMatches = function () {
        currentMatches.filter(m => m.status === 'upcoming').forEach(m => selectedMatches.add(m.id));
        renderAll();
    };
    window.deselectAllMatches = function () {
        selectedMatches.clear();
        renderAll();
    };

    // ===== AUTO-PLAY =====
    function renderAutoButton() {
        const btn = document.getElementById('esAutoBtn');
        if (!btn) return;
        const isToday = esState.viewingDate === EsportsAnalyzer.todayStr();
        if (!isToday) { btn.style.display = 'none'; return; }
        btn.style.display = 'block';

        // Use selected matches if any, otherwise all upcoming with edge
        const betCandidates = selectedMatches.size > 0
            ? currentMatches.filter(m => selectedMatches.has(m.id) && m.status === 'upcoming' && !esState.bets.find(b => b.matchId === m.id))
            : currentMatches.filter(m => {
                if (m.status !== 'upcoming') return false;
                const rec = EsportsAnalyzer.generateRecommendation(m.bets, esState.capital, esState.streak || 0, esState.sessionPL || 0, esState.predictions, m.teamA, m.teamB, esState.bets);
                return rec.action === 'BET' && !esState.bets.find(b => b.matchId === m.id);
            });

        if (isAutoRunning) {
            btn.innerHTML = '⏸ Đang thi đấu... (click để dừng)'; btn.className = 'es-auto-btn running'; btn.onclick = () => { autoRunAbort = true; };
        } else if (betCandidates.length > 0) {
            const label = selectedMatches.size > 0 ? `▶ Vào lệnh ${betCandidates.length} trận đã chọn` : `▶ Auto-bet (${betCandidates.length} trận)`;
            btn.innerHTML = label + ` <span style="font-size:10px;opacity:0.7">(max 3 cùng lúc)</span>`;
            btn.className = 'es-auto-btn ready'; btn.onclick = () => startAutoRun();
        } else {
            const tb = esState.bets.filter(b => b.timestamp?.startsWith(EsportsAnalyzer.todayStr()) && b.result !== null);
            if (tb.length > 0) {
                const pl = tb.reduce((s, b) => s + (b.pnl || 0), 0);
                btn.innerHTML = `✅ Hoàn thành — P&L: ${pl >= 0 ? '+' : ''}₫${EsportsAnalyzer.fmtFull(Math.abs(pl))}`;
                btn.className = 'es-auto-btn done ' + (pl >= 0 ? 'profit' : 'loss');
            } else {
                btn.innerHTML = '📊 Chờ trận đủ điều kiện'; btn.className = 'es-auto-btn waiting';
            }
            btn.onclick = null;
        }
    }

    async function startAutoRun() {
        if (isAutoRunning) return;
        isAutoRunning = true; autoRunAbort = false; renderAutoButton();

        // Determine candidates: selected or all upcoming with edge
        let candidates = selectedMatches.size > 0
            ? currentMatches.filter(m => selectedMatches.has(m.id) && m.status === 'upcoming' && !esState.bets.find(b => b.matchId === m.id))
            : currentMatches.filter(m => {
                if (m.status !== 'upcoming') return false;
                const rec = EsportsAnalyzer.generateRecommendation(m.bets, esState.capital, esState.streak || 0, esState.sessionPL || 0, esState.predictions, m.teamA, m.teamB, esState.bets);
                return rec.action === 'BET' && !esState.bets.find(b => b.matchId === m.id);
            });

        // Sort by win probability (highest first)
        candidates.sort((a, b) => {
            const wpA = EsportsAnalyzer.winProbability(a.teamA, a.teamB);
            const wpB = EsportsAnalyzer.winProbability(b.teamA, b.teamB);
            return Math.abs(wpB - 0.5) - Math.abs(wpA - 0.5); // Bigger edge first
        });

        if (candidates.length === 0) {
            window.showToast?.('⏳ Không có trận đủ điều kiện', 'info');
            isAutoRunning = false; renderAll();
            return;
        }

        // Max 3 concurrent bets
        const MAX_CONCURRENT = 3;
        const activeBets = esState.bets.filter(b => b.result === null).length;
        const slotsAvailable = Math.max(0, MAX_CONCURRENT - activeBets);
        candidates = candidates.slice(0, slotsAvailable);

        if (candidates.length === 0) {
            window.showToast?.('⚠️ Đã đạt giới hạn 3 kèo cùng lúc', 'warning');
            isAutoRunning = false; renderAll();
            return;
        }

        window.showToast?.(`🎯 Vào lệnh ${candidates.length} trận (ưu tiên WR cao nhất, max ${MAX_CONCURRENT})`, 'info');

        for (const match of candidates) {
            if (autoRunAbort) break;
            const rec = EsportsAnalyzer.generateRecommendation(match.bets, esState.capital, esState.streak || 0, esState.sessionPL || 0, esState.predictions, match.teamA, match.teamB, esState.bets);
            if (rec.action !== 'BET' && selectedMatches.size === 0) continue;

            // Place bet — for selected matches, force bet even if edge is marginal
            const betAmount = rec.action === 'BET' ? rec.amount : Math.round(esState.capital * 0.03 / 10000) * 10000;
            const betRecord = {
                matchId: match.id,
                betType: rec.betType || match.bets[0]?.type || 'kill_ou',
                betLabel: rec.betLabel || match.bets[0]?.label || 'Tài/Xỉu Mạng',
                pick: rec.pick || match.bets[0]?.pick || 'over',
                pickLabel: rec.pickLabel || (match.bets[0]?.pick === 'over' ? `Tài (>${match.bets[0]?.line})` : `Xỉu (<${match.bets[0]?.line})`),
                line: rec.bestBet?.line || match.bets[0]?.line || 45.5,
                amount: betAmount,
                odds: rec.odds || match.bets[0]?.odds || 1.85,
                probability: rec.probability || 0.55,
                edge: rec.edge || 0.05,
                result: null, pnl: 0, matchResult: null,
                timestamp: new Date().toISOString()
            };
            esState.bets.push(betRecord);
            EsportsAnalyzer.saveState(esState); renderAll();
            highlightCard(match.id, 'betting');
            const wp = EsportsAnalyzer.winProbability(match.teamA, match.teamB);
            window.showToast?.(`🎯 ${match.teamA.name} vs ${match.teamB.name} — ₫${EsportsAnalyzer.fmtFull(betAmount)} (WR ${(wp * 100).toFixed(0)}%)`, 'info');
            await delay(2000);
            if (autoRunAbort) break;

            // Poll for real result
            let result = null;
            result = EsportsAnalyzer.simulateResult(match);
            if (!result && match.isReal) {
                window.showToast?.('⏳ Chờ kết quả thực...', 'info');
                let pollCount = 0;
                while (!result && pollCount < 240 && !autoRunAbort) {
                    await delay(60000);
                    pollCount++;
                    result = await EsportsAnalyzer.fetchMatchResult(match);
                    if (pollCount % 5 === 0) window.showToast?.(`⏳ Đã chờ ${pollCount}p...`, 'info');
                }
                if (!result && !autoRunAbort) { window.showToast?.('⏰ Timeout — bỏ qua', 'warning'); continue; }
            } else if (!result) {
                const mc = EsportsAnalyzer.analyzeBetTypes(match.teamA, match.teamB, match.game, match.id, match.league);
                result = { kills: Math.round(mc.mc.kills.mean), towers: Math.round(mc.mc.towers.mean), duration: Math.round(mc.mc.duration.mean) };
                if (mc.mc.dragons) result.dragons = Math.round(mc.mc.dragons.mean);
            }
            if (autoRunAbort || !result) break;

            const resolution = EsportsAnalyzer.resolveBet(betRecord, result);
            betRecord.result = resolution.won ? 'win' : 'loss';
            betRecord.pnl = resolution.pnl;
            betRecord.matchResult = result;
            esState.capital += resolution.pnl;
            match.status = 'finished'; match.result = result;

            // Adaptive streak update
            esState.streak = resolution.won ? Math.max(1, (esState.streak || 0) + 1) : Math.min(-1, (esState.streak || 0) - 1);
            esState.sessionPL = (esState.sessionPL || 0) + resolution.pnl;

            EsportsAnalyzer.saveState(esState); renderAll();
            highlightCard(match.id, resolution.won ? 'win' : 'loss');
            window.showToast?.(resolution.won
                ? `✅ THẮNG +₫${EsportsAnalyzer.fmtFull(resolution.pnl)} (Streak: ${esState.streak})`
                : `❌ Thua -₫${EsportsAnalyzer.fmtFull(Math.abs(resolution.pnl))} (Streak: ${esState.streak})`,
                resolution.won ? 'success' : 'error');
            await delay(1500);
        }

        isAutoRunning = false;
        EsportsAnalyzer.saveState(esState); renderAll();
        const tb = esState.bets.filter(b => b.timestamp?.startsWith(EsportsAnalyzer.todayStr()) && b.result !== null);
        const pl = tb.reduce((s, b) => s + (b.pnl || 0), 0);
        window.showToast?.(`🏆 P&L: ${pl >= 0 ? '+' : ''}₫${EsportsAnalyzer.fmtFull(Math.abs(pl))} | Streak: ${esState.streak || 0}`, pl >= 0 ? 'success' : 'error');
    }

    function highlightCard(id, state) { const c = document.querySelector(`[data-match-id="${id}"]`); if (!c) return; c.classList.remove('betting', 'win', 'loss'); c.classList.add(state); c.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

    // ===== TIMELINE =====
    function renderTimeline() {
        const container = document.getElementById('esTodayHistory');
        const list = document.getElementById('esBetList');
        if (!container || !list) return;
        const viewing = esState.viewingDate || EsportsAnalyzer.todayStr();
        const tb = esState.bets.filter(b => b.timestamp?.startsWith(viewing));
        if (tb.length === 0) { container.style.display = 'none'; return; }
        container.style.display = 'block';
        let runPL = 0;
        list.innerHTML = tb.map((b, i) => {
            const m = currentMatches.find(x => x.id === b.matchId);
            const label = m ? `${m.teamA.name} vs ${m.teamB.name}` : b.matchId;
            const cls = b.result === 'win' ? 'es-win' : b.result === 'loss' ? 'es-loss' : 'es-pending-text';
            const icon = b.result === 'win' ? '✅' : b.result === 'loss' ? '❌' : '⏳';
            if (b.result) runPL += b.pnl;
            return `<div class="es-bet-row"><div class="es-bet-match">#${i + 1} ${label}</div><div class="es-bet-info">${b.betLabel}: ${b.pickLabel}</div><div class="es-bet-amount">₫${EsportsAnalyzer.fmt(b.amount)}</div><div class="es-bet-result ${cls}">${icon}</div><div class="es-bet-pnl ${cls}">${b.result ? ((b.pnl >= 0 ? '+' : '') + '\u20AB' + EsportsAnalyzer.fmtFull(Math.abs(b.pnl))) : '—'}</div><div class="es-bet-running ${runPL >= 0 ? 'es-win' : 'es-loss'}">${b.result ? ((runPL >= 0 ? '+' : '') + '\u20AB' + EsportsAnalyzer.fmt(Math.abs(runPL))) : '—'}</div></div>`;
        }).join('');
    }

    // ===== STATS =====
    function renderStats() {
        const s = EsportsAnalyzer.calcStats(esState.bets, esState.capital, esState.initialCapital);
        const sec = document.getElementById('esStatsSection');
        if (!sec) return;
        if (s.total === 0) { sec.style.display = 'none'; return; }
        sec.style.display = 'grid';
        document.getElementById('esTotalBets').textContent = s.total;
        document.getElementById('esTotalWins').textContent = s.wins;
        document.getElementById('esTotalLosses').textContent = s.losses;
        document.getElementById('esROI').textContent = s.roi + '%';
    }
    function renderWeekly() {
        const h = EsportsAnalyzer.getDailyHistory(esState.bets);
        const sec = document.getElementById('esWeeklySection'), list = document.getElementById('esWeeklyList');
        if (!sec || !list) return;
        if (h.length === 0) { sec.style.display = 'none'; return; }
        sec.style.display = 'block';
        list.innerHTML = `<div class="es-weekly-header"><span>Ngày</span><span>Lệnh</span><span>Thắng</span><span>P&L</span></div>${h.map(d => `<div class="es-weekly-row"><span>${d.date.slice(5)}</span><span>${d.bets}</span><span>${d.wins}/${d.bets}</span><span class="${d.pnl >= 0 ? 'es-win' : 'es-loss'}">${d.pnl >= 0 ? '+' : ''}₫${EsportsAnalyzer.fmt(Math.abs(d.pnl))}</span></div>`).join('')}`;
    }

    // ===== MATCH DETAIL MODAL =====
    window.viewEsMatch = function (matchId) {
        const match = currentMatches.find(m => m.id === matchId);
        if (!match) return;
        const h2h = EsportsAnalyzer.getH2H(match.teamA, match.teamB);
        const wp = EsportsAnalyzer.winProbability(match.teamA, match.teamB);
        const rec = EsportsAnalyzer.generateRecommendation(match.bets, esState.capital, 0, 0, esState.predictions, match.teamA, match.teamB, esState.bets);
        const bet = esState.bets.find(b => b.matchId === matchId);
        const gameName = match.game === 'dota2' ? 'DOTA 2' : 'LOL';
        const bo = match.bestOf || 1;
        const hasSeriesScore = match.scoreA != null && match.scoreB != null;
        const isFinished = match.status === 'finished';
        const aWon = isFinished && hasSeriesScore && match.scoreA > match.scoreB;
        const bWon = isFinished && hasSeriesScore && match.scoreB > match.scoreA;

        document.getElementById('esModalTitle').textContent = `${gameName} — ${match.teamA.name} vs ${match.teamB.name}`;
        const body = document.getElementById('esModalBody');

        // Generate game-by-game tabs for BO series
        const totalGames = hasSeriesScore ? (match.scoreA + match.scoreB) : 0;
        let seriesHTML = '';
        if (bo > 1) {
            seriesHTML = `
            <div class="es-modal-section es-series-section">
                <div class="es-modal-label">📋 SERIES — Best of ${bo}</div>
                <div class="es-series-overview">
                    <div class="es-series-team ${aWon ? 'es-series-winner' : ''}">
                        <span class="es-series-logo">${match.teamA.logo}</span>
                        <span class="es-series-name">${match.teamA.name}</span>
                    </div>
                    <div class="es-series-scoreboard">
                        <span class="es-series-score-num ${aWon ? 'es-series-w' : ''}">${match.scoreA ?? '—'}</span>
                        <span class="es-series-divider">:</span>
                        <span class="es-series-score-num ${bWon ? 'es-series-w' : ''}">${match.scoreB ?? '—'}</span>
                    </div>
                    <div class="es-series-team ${bWon ? 'es-series-winner' : ''}">
                        <span class="es-series-logo">${match.teamB.logo}</span>
                        <span class="es-series-name">${match.teamB.name}</span>
                    </div>
                </div>
                ${totalGames > 0 ? `
                <div class="es-game-tabs">
                    ${Array.from({ length: totalGames }, (_, i) => {
                const gNum = i + 1;
                const gameResult = match.games?.[i];
                const gWinner = gameResult?.winner || (i < (match.scoreA || 0) ? 'A' : 'B');
                return `<button class="es-game-tab ${i === 0 ? 'active' : ''}" onclick="switchGameTab(event, ${i}, '${matchId}')">
                            <span class="es-gt-label">G${gNum}</span>
                            <span class="es-gt-dot ${gWinner === 'A' ? 'es-gt-a' : 'es-gt-b'}"></span>
                        </button>`;
            }).join('')}
                </div>
                <div class="es-game-detail" id="esGameDetail_${matchId}">
                    ${renderGameDetail(match, 0)}
                </div>` : `
                <div class="es-series-status">${match.status === 'live' ? '🔴 Đang thi đấu...' : match.status === 'upcoming' ? '📅 Chưa bắt đầu' : ''}</div>`}
            </div>`;
        }

        // Generate hawk-style result section for BO1 Dota 2 matches
        let resultHTML = '';
        const isDota2 = match.game === 'dota2';
        if (isDota2 && match.result && bo <= 1) {
            // Use real result data to build hawk-style board
            const r = match.result;
            const hawkData = simDotaGame(match, 0);
            // Override with real data
            hawkData.killsA = Math.round((r.kills || 40) * 0.55);
            hawkData.killsB = r.kills - hawkData.killsA;
            hawkData.towersA = Math.round((r.towers || 8) * 0.55);
            hawkData.towersB = r.towers - hawkData.towersA;
            hawkData.dur = r.duration || 35;
            hawkData.winner = aWon ? 'A' : bWon ? 'B' : 'A';
            resultHTML = `<div class="es-modal-section"><div class="es-modal-label">📊 Match Stats ${match.isReal ? '— Real Data' : ''}</div>${renderDotaHawkDetail(match, 0, hawkData)}</div>`;
        } else if (isDota2 && bo <= 1 && !match.result) {
            // Simulated BO1 Dota 2 — show hawk-style with fully simulated data
            const hawkData = simDotaGame(match, 0);
            resultHTML = `<div class="es-modal-section"><div class="es-modal-label">📊 Match Preview</div>${renderDotaHawkDetail(match, 0, hawkData)}</div>`;
        } else if (match.result) {
            // LoL or non-Dota: keep original format
            resultHTML = `<div class="es-modal-section"><div class="es-modal-label">Kết quả ${match.isReal ? 'thực' : 'giả lập'}</div><div class="es-result-grid"><div class="es-result-item"><span>Mạng</span><strong>${match.result.kills}</strong></div><div class="es-result-item"><span>Trụ</span><strong>${match.result.towers}</strong></div><div class="es-result-item"><span>Thời gian</span><strong>${match.result.duration}p</strong></div>${match.result.dragons != null ? `<div class="es-result-item"><span>Rồng</span><strong>${match.result.dragons}</strong></div>` : ''}</div></div>`;
        }

        body.innerHTML = `
            ${match.league ? `<div class="es-modal-league">🏆 ${match.league} ${bo > 1 ? `— BO${bo}` : ''} ${match.isReal ? '— 📡 Real Data' : ''}</div>` : ''}
            <div class="es-modal-teams">
                <div class="es-modal-team ${aWon ? 'es-modal-team-winner' : ''}">
                    <span class="es-modal-logo">${match.teamA.logo}</span>
                    <span class="es-modal-name">${match.teamA.name}</span>
                    <span class="es-modal-region">${match.teamA.region} │ Elo ${match.teamA.elo}</span>
                    <span class="es-modal-form">Form: ${match.teamA.form.map(f => f ? '✅' : '❌').join('')}</span>
                </div>
                <div class="es-modal-vs-area">
                    ${hasSeriesScore
                ? `<div class="es-modal-series-score"><span class="${aWon ? 'es-series-w' : ''}">${match.scoreA}</span> : <span class="${bWon ? 'es-series-w' : ''}">${match.scoreB}</span></div>`
                : '<div class="es-modal-vs">VS</div>'
            }
                    ${bo > 1 ? `<div class="es-modal-bo">BO${bo}</div>` : ''}
                </div>
                <div class="es-modal-team ${bWon ? 'es-modal-team-winner' : ''}">
                    <span class="es-modal-logo">${match.teamB.logo}</span>
                    <span class="es-modal-name">${match.teamB.name}</span>
                    <span class="es-modal-region">${match.teamB.region} │ Elo ${match.teamB.elo}</span>
                    <span class="es-modal-form">Form: ${match.teamB.form.map(f => f ? '✅' : '❌').join('')}</span>
                </div>
            </div>
            ${seriesHTML}
            <div class="es-modal-section"><div class="es-modal-label">Win Probability</div><div class="es-wp-bar"><div class="es-wp-fill" style="width:${(wp * 100).toFixed(0)}%">${match.teamA.name} ${(wp * 100).toFixed(0)}%</div></div></div>
            <div class="es-modal-section"><div class="es-modal-label">H2H Record</div><div class="es-modal-h2h"><span>${match.teamA.name}: ${h2h.wins}W</span><span class="es-h2h-total">${h2h.total} trận</span><span>${match.teamB.name}: ${h2h.losses}W</span></div></div>
            <div class="es-modal-section"><div class="es-modal-label">Phân tích kèo</div>${match.bets.filter(b => !b.isSpecial).map(b => { const e = b.pick ? ((b.pickProb * (b.odds - 1) - (1 - b.pickProb)) * 100).toFixed(1) : '0'; return `<div class="es-bet-analysis"><span class="es-bet-type">${b.label}</span><span class="es-bet-line">Line: ${b.line}</span><span class="es-bet-odds">Odds: ${b.odds.toFixed(2)}</span><span class="es-bet-prob">Tài: ${(b.overProb * 100).toFixed(0)}% │ Xỉu: ${(b.underProb * 100).toFixed(0)}%</span>${b.pick ? `<span class="es-bet-pick ${Number(e) > 5 ? 'es-win' : ''}">→ ${b.pick === 'over' ? 'Tài' : 'Xỉu'} (Edge: +${e}%)</span>` : '<span class="es-bet-pick">Không đủ edge</span>'}</div>`; }).join('')}</div>
            ${match.bets.filter(b => b.isSpecial).length > 0 ? `<div class="es-modal-section"><div class="es-modal-label">🔮 Kèo đặc biệt</div>${match.bets.filter(b => b.isSpecial).map(b => { const cssClass = b.type === 'mega_creeps' ? 'mega-creeps' : b.type === 'dragon_soul' ? 'dragon-soul' : 'inhibitor'; const pickLabel = b.pick === 'yes' ? 'Có' : b.pick === 'no' ? 'Không' : '—'; return `<div class="es-bet-analysis"><span class="es-market-special ${cssClass}">${b.label}</span><span class="es-bet-odds">Odds: ${b.odds.toFixed(2)}</span><span class="es-bet-prob">Có: ${(b.overProb * 100).toFixed(0)}% │ Không: ${(b.underProb * 100).toFixed(0)}%</span>${b.pick ? `<span class="es-bet-pick ${b.pickProb > 0.65 ? 'es-win' : ''}">→ ${pickLabel} (P=${(b.pickProb * 100).toFixed(0)}%)</span>` : '<span class="es-bet-pick">Theo dõi</span>'}</div>`; }).join('')}</div>` : ''}
            ${rec.action === 'BET' ? `<div class="es-modal-section es-modal-rec"><div class="es-modal-label">🔮 Khuyến nghị</div><div class="es-rec-summary"><div><strong>${rec.betLabel}: ${rec.pickLabel}</strong></div><div>Mức cược: <strong>₫${EsportsAnalyzer.fmtFull(rec.amount)}</strong> (${(rec.kelly * 100).toFixed(1)}% Kelly)</div><div>${rec.reason}</div></div></div>` : ''}
            ${resultHTML}
            ${bet ? `<div class="es-modal-section"><div class="es-modal-label">Lệnh đặt</div><div class="es-bet-record ${bet.result === 'win' ? 'es-win' : bet.result === 'loss' ? 'es-loss' : ''}"><div>${bet.betLabel}: ${bet.pickLabel} @ ${bet.odds.toFixed(2)}</div><div>₫${EsportsAnalyzer.fmtFull(bet.amount)}</div>${bet.result ? `<div>${bet.result === 'win' ? '✅ Thắng' : '❌ Thua'} — ${bet.pnl >= 0 ? '+' : ''}₫${EsportsAnalyzer.fmtFull(Math.abs(bet.pnl))}</div>` : '<div>⏳ Đang thi đấu...</div>'}</div></div>` : ''}`;

        document.getElementById('esMatchModal').classList.remove('hidden');
    };

    // ===== DOTA 2 HERO CDN HELPER =====
    function dotaHeroRow(heroes, side) {
        if (!heroes || heroes.length === 0) return '';
        return `<div class="es-hawk-hero-side ${side}">${heroes.map(h =>
            `<img class="es-hawk-hero-img" src="${dotaHeroImgUrl(h)}" alt="${h}" onerror="this.style.display='none'" loading="lazy" title="${h}">`
        ).join('')}</div>`;
    }

    // Generate deterministic pseudo-random from seed
    function seededRng(seed, offset) {
        const x = Math.sin(seed + offset * 37) * 10000;
        return x - Math.floor(x);
    }

    // Generate consistent simulated game data for a Dota 2 game
    function simDotaGame(match, gameIndex) {
        const gNum = gameIndex + 1;
        const seed = EsportsAnalyzer.hashCode ? EsportsAnalyzer.hashCode(match.id + '_g' + gNum) : (gNum * 17 + 31);
        const r = (i) => seededRng(seed, i);
        const aWins = gameIndex < (match.scoreA || 0);
        const totalKills = 35 + Math.floor(r(0) * 25);
        const killSplit = aWins ? (0.55 + r(1) * 0.15) : (0.30 + r(1) * 0.15);
        const killsA = Math.round(totalKills * killSplit);
        const killsB = totalKills - killsA;
        const totalTowers = 8 + Math.floor(r(2) * 8);
        const twrSplit = aWins ? (0.55 + r(3) * 0.2) : (0.25 + r(3) * 0.2);
        const towersA = Math.round(totalTowers * twrSplit);
        const towersB = totalTowers - towersA;
        const roshTotal = 1 + Math.floor(r(4) * 3);
        const roshA = aWins ? Math.ceil(roshTotal * 0.6) : Math.floor(roshTotal * 0.4);
        const roshB = roshTotal - roshA;
        const dur = 28 + Math.floor(r(5) * 18);
        const baseGold = 25000 + dur * 400;
        const goldA = aWins ? baseGold + Math.floor(r(6) * 15000) : baseGold - Math.floor(r(6) * 5000);
        const goldB = aWins ? baseGold - Math.floor(r(7) * 5000) : baseGold + Math.floor(r(7) * 15000);
        // Pick 5 random heroes per team
        const heroPick = (offset) => {
            const picks = [];
            for (let i = 0; i < 5; i++) {
                const idx = Math.floor(r(offset + i) * DOTA_HEROES.length);
                const hero = DOTA_HEROES[idx];
                if (!picks.includes(hero)) picks.push(hero); else picks.push(DOTA_HEROES[(idx + 7) % DOTA_HEROES.length]);
            }
            return picks;
        };
        return { killsA, killsB, towersA, towersB, roshA, roshB, goldA, goldB, dur, winner: aWins ? 'A' : 'B', heroesA: heroPick(10), heroesB: heroPick(20), seed };
    }

    // Generate simulated LoL game data
    function simLolGame(match, gameIndex) {
        const gNum = gameIndex + 1;
        const seed = EsportsAnalyzer.hashCode ? EsportsAnalyzer.hashCode(match.id + '_g' + gNum) : (gNum * 17 + 31);
        const r = (i) => seededRng(seed, i);
        const aWins = gameIndex < (match.scoreA || 0);
        const kills = 18 + Math.floor(r(0) * 15);
        const towers = 8 + Math.floor(r(2) * 6);
        const dur = 26 + Math.floor(r(5) * 12);
        const dragons = 2 + Math.floor(r(3) * 3);
        const barons = Math.floor(r(4) * 2);
        const gold = Math.floor(40 + r(6) * 30);
        return { kills, towers, dur, dragons, barons, gold, winner: aWins ? match.teamA.name : match.teamB.name };
    }

    // ===== NET WORTH ADVANTAGE GRAPH (Canvas API) =====
    function renderNetWorthGraph(canvasId, seed, dur, goldA, goldB) {
        setTimeout(() => {
            const canvas = document.getElementById(canvasId);
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const W = canvas.width = canvas.offsetWidth * 2;
            const H = canvas.height = canvas.offsetHeight * 2;
            ctx.scale(2, 2);
            const w = W / 2, h = H / 2;

            // Generate gold advantage curve (deterministic from seed)
            const points = [];
            const numPoints = Math.max(20, dur);
            const finalAdv = goldA - goldB;
            const maxAdv = Math.abs(finalAdv) * 1.3;
            for (let i = 0; i <= numPoints; i++) {
                const t = i / numPoints;
                const wave1 = Math.sin(seed * 0.1 + t * Math.PI * 3) * maxAdv * 0.4;
                const wave2 = Math.sin(seed * 0.07 + t * Math.PI * 5) * maxAdv * 0.2;
                const trend = finalAdv * t * t;
                const noise = (seededRng(seed, i + 100) - 0.5) * maxAdv * 0.15;
                points.push(trend + wave1 + wave2 + noise);
            }

            // Draw
            const px = 30, py = 10;
            const gw = w - px * 2, gh = h - py * 2;
            const yMax = Math.max(...points.map(Math.abs), 1000) * 1.2;

            // Background
            ctx.fillStyle = 'rgba(0,0,0,0.1)';
            ctx.fillRect(0, 0, w, h);

            // Zero line
            const zeroY = py + gh / 2;
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(px, zeroY);
            ctx.lineTo(px + gw, zeroY);
            ctx.stroke();

            // Labels
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.font = '8px system-ui';
            ctx.textAlign = 'right';
            ctx.fillText('+' + Math.round(yMax / 1000) + 'k', px - 4, py + 8);
            ctx.fillText('-' + Math.round(yMax / 1000) + 'k', px - 4, py + gh - 2);
            ctx.textAlign = 'center';
            ctx.fillText('0', px - 8, zeroY + 3);
            // Time labels
            ctx.fillText('0m', px, h - 2);
            ctx.fillText(Math.round(dur / 2) + 'm', px + gw / 2, h - 2);
            ctx.fillText(dur + 'm', px + gw, h - 2);

            // Draw curve
            ctx.beginPath();
            for (let i = 0; i <= numPoints; i++) {
                const x = px + (i / numPoints) * gw;
                const y = zeroY - (points[i] / yMax) * (gh / 2);
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = finalAdv >= 0 ? '#4ade80' : '#f87171';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Fill area under curve
            ctx.lineTo(px + gw, zeroY);
            ctx.lineTo(px, zeroY);
            ctx.closePath();
            const grad = ctx.createLinearGradient(0, 0, 0, h);
            if (finalAdv >= 0) {
                grad.addColorStop(0, 'rgba(74, 222, 128, 0.2)');
                grad.addColorStop(1, 'rgba(74, 222, 128, 0)');
            } else {
                grad.addColorStop(0, 'rgba(248, 113, 113, 0)');
                grad.addColorStop(1, 'rgba(248, 113, 113, 0.2)');
            }
            ctx.fillStyle = grad;
            ctx.fill();

            // Team labels
            ctx.font = 'bold 9px system-ui';
            ctx.textAlign = 'right';
            ctx.fillStyle = '#4ade80';
            ctx.fillText('Radiant ▲', w - 4, 12);
            ctx.fillStyle = '#f87171';
            ctx.fillText('Dire ▼', w - 4, h - 4);
        }, 50);
    }

    // ===== TOWER MINIMAP (SVG) =====
    function renderTowerMap(towersA, towersB, totalTowers, seed) {
        // Determine which towers are destroyed based on count
        // Radiant (bottom-left) towers: Bot T1-T3, Mid T1-T3, Top T1-T3 + 2 rax + ancient
        // We simplify to: 3 lanes × 3 towers = 9 standing, destroy from outer in
        const maxPerSide = 9;
        const radiantDestroyed = Math.min(towersB, maxPerSide); // B destroyed radiant towers
        const direDestroyed = Math.min(towersA, maxPerSide); // A destroyed dire towers

        // Tower positions [cx, cy, lane, tier]
        const radiantTowers = [
            [40, 180, 'bot', 1], [70, 150, 'bot', 2], [90, 120, 'bot', 3],
            [80, 80, 'mid', 1], [65, 100, 'mid', 2], [50, 115, 'mid', 3],
            [30, 50, 'top', 1], [50, 60, 'top', 2], [60, 80, 'top', 3],
        ];
        const direTowers = [
            [180, 40, 'top', 1], [150, 70, 'top', 2], [130, 90, 'top', 3],
            [140, 140, 'mid', 1], [155, 120, 'mid', 2], [170, 105, 'mid', 3],
            [190, 170, 'bot', 1], [170, 160, 'bot', 2], [160, 140, 'bot', 3],
        ];

        const markDestroyed = (towers, count) => {
            // Destroy outer towers first (tier 1 → 2 → 3)
            const sorted = [...towers].sort((a, b) => a[3] - b[3]);
            return sorted.map((t, i) => ({ ...{ cx: t[0], cy: t[1], lane: t[2], tier: t[3] }, destroyed: i < count, critical: i === count }));
        };

        const rTowers = markDestroyed(radiantTowers, radiantDestroyed);
        const dTowers = markDestroyed(direTowers, direDestroyed);

        const towerDot = (t, color, deadColor) => {
            if (t.destroyed) {
                return `<circle cx="${t.cx}" cy="${t.cy}" r="5" fill="${deadColor}" class="es-tower-destroyed"/><line x1="${t.cx - 3}" y1="${t.cy - 3}" x2="${t.cx + 3}" y2="${t.cy + 3}" stroke="${deadColor}" stroke-width="1.5" opacity="0.4"/><line x1="${t.cx + 3}" y1="${t.cy - 3}" x2="${t.cx - 3}" y2="${t.cy + 3}" stroke="${deadColor}" stroke-width="1.5" opacity="0.4"/>`;
            }
            return `<circle cx="${t.cx}" cy="${t.cy}" r="5" fill="${color}" ${t.critical ? 'class="es-tower-critical"' : ''}/>`;
        };

        return `<svg class="es-hawk-minimap" viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg">
            <!-- Map background -->
            <rect width="220" height="220" rx="8" fill="#0a1628" opacity="0.6"/>
            <!-- Lanes -->
            <path d="M35,195 L35,35 L195,35" stroke="rgba(255,255,255,0.06)" stroke-width="12" fill="none" stroke-linecap="round"/>
            <path d="M35,195 L195,35" stroke="rgba(255,255,255,0.06)" stroke-width="12" fill="none"/>
            <path d="M35,195 L195,195 L195,35" stroke="rgba(255,255,255,0.06)" stroke-width="12" fill="none" stroke-linecap="round"/>
            <!-- River -->
            <path d="M10,210 Q110,110 210,10" stroke="#1e3a5f" stroke-width="8" fill="none" opacity="0.4" stroke-dasharray="4,4"/>
            <!-- Radiant base -->
            <rect x="15" y="185" width="25" height="25" rx="4" fill="#166534" opacity="0.3"/>
            <text x="27" y="201" text-anchor="middle" font-size="8" fill="#4ade80" font-weight="700">R</text>
            <!-- Dire base -->
            <rect x="180" y="10" width="25" height="25" rx="4" fill="#991b1b" opacity="0.3"/>
            <text x="192" y="26" text-anchor="middle" font-size="8" fill="#f87171" font-weight="700">D</text>
            <!-- Roshan pit -->
            <circle cx="140" cy="80" r="8" fill="#831843" opacity="0.3"/>
            <text x="140" y="83" text-anchor="middle" font-size="7" fill="#f472b6" font-weight="700">RS</text>
            <!-- Radiant towers -->
            ${rTowers.map(t => towerDot(t, '#4ade80', '#4ade80')).join('')}
            <!-- Dire towers -->
            ${dTowers.map(t => towerDot(t, '#f87171', '#f87171')).join('')}
        </svg>`;
    }

    // ===== HAWK-STYLE DOTA 2 GAME DETAIL =====
    function renderDotaHawkDetail(match, gameIndex, data) {
        const gNum = gameIndex + 1;
        const winnerName = data.winner === 'A' ? match.teamA.name : match.teamB.name;
        const goldDiff = data.goldA - data.goldB;
        const goldPct = data.goldA / (data.goldA + data.goldB) * 100;
        const canvasId = `nw_${match.id}_g${gNum}`;
        const durMin = Math.floor(data.dur);
        const durSec = Math.floor((data.dur - durMin) * 60);
        const durStr = `${durMin}:${String(durSec).padStart(2, '0')}`;

        // Stat row helper
        const statRow = (iconType, labelText, valA, valB) => {
            const aLead = valA > valB;
            const bLead = valB > valA;
            return `<div class="es-hawk-stat-row">
                <span class="es-hawk-stat-val left ${aLead ? 'lead' : ''}">${valA}</span>
                <div class="es-hawk-stat-icon">${ICON[iconType]}<span>${labelText}</span></div>
                <span class="es-hawk-stat-val right ${bLead ? 'lead' : ''}">${valB}</span>
            </div>`;
        };

        setTimeout(() => renderNetWorthGraph(canvasId, data.seed || 42, data.dur, data.goldA, data.goldB), 100);

        return `<div class="es-hawk-board">
            <div class="es-hawk-game-header">
                <span class="es-hawk-game-num">Game ${gNum}</span>
            </div>

            ${winnerName ? `<div class="es-hawk-winner-badge">🏆 ${winnerName} Victory</div>` : `<div class="es-hawk-live-bar"><span class="es-hawk-live-dot"></span> LIVE</div>`}

            <!-- Kill Scoreboard -->
            <div class="es-hawk-kills">
                <div class="es-hawk-kill-team">
                    <span class="es-hawk-kill-logo">${match.teamA.logo}</span>
                    <span class="es-hawk-kill-name">${match.teamA.name}</span>
                </div>
                <div class="es-hawk-kill-sep">
                    <div style="display:flex;align-items:center;gap:8px">
                        <span class="es-hawk-kill-num radiant">${data.killsA}</span>
                        <span class="es-hawk-kill-vs">${ICON.kills}</span>
                        <span class="es-hawk-kill-num dire">${data.killsB}</span>
                    </div>
                    <span class="es-hawk-timer">${ICON.time} ${durStr}</span>
                </div>
                <div class="es-hawk-kill-team">
                    <span class="es-hawk-kill-logo">${match.teamB.logo}</span>
                    <span class="es-hawk-kill-name">${match.teamB.name}</span>
                </div>
            </div>

            <!-- Stats Grid -->
            <div class="es-hawk-stats">
                ${statRow('tower', 'Towers', data.towersA, data.towersB)}
                ${statRow('roshan', 'Roshan', data.roshA, data.roshB)}
                ${statRow('gold', 'Gold', (data.goldA / 1000).toFixed(1) + 'k', (data.goldB / 1000).toFixed(1) + 'k')}
            </div>

            <!-- Gold Advantage Bar -->
            <div class="es-hawk-gold-bar">
                <div class="es-hawk-gold-label">Gold Advantage</div>
                <div class="es-hawk-gold-track">
                    <div class="es-hawk-gold-fill ${goldDiff >= 0 ? 'radiant' : 'dire'}" style="width:${goldDiff >= 0 ? goldPct : (100 - goldPct)}%;${goldDiff < 0 ? 'left:auto;right:0' : ''}"></div>
                </div>
                <div class="es-hawk-gold-diff ${goldDiff >= 0 ? 'radiant' : 'dire'}">${goldDiff >= 0 ? '+' : ''}${(goldDiff / 1000).toFixed(1)}k ${goldDiff >= 0 ? match.teamA.name : match.teamB.name}</div>
            </div>

            <!-- Net Worth Graph -->
            <div class="es-hawk-nw-wrap">
                <div class="es-hawk-nw-label">Net Worth Advantage</div>
                <canvas id="${canvasId}" class="es-hawk-nw-canvas"></canvas>
            </div>

            <!-- Tower Minimap -->
            <div class="es-hawk-minimap-wrap">
                <div class="es-hawk-minimap-label">Tower Status</div>
                ${renderTowerMap(data.towersA, data.towersB, data.towersA + data.towersB, data.seed || 42)}
            </div>

            <!-- Hero Picks -->
            ${data.heroesA?.length ? `<div class="es-hawk-heroes">
                ${dotaHeroRow(data.heroesA, 'left')}
                <span class="es-hawk-hero-vs">VS</span>
                ${dotaHeroRow(data.heroesB, 'right')}
            </div>` : ''}
        </div>`;
    }

    // Game-by-game tab switching + per-game detail with champion picks
    function renderGameDetail(match, gameIndex) {
        const g = match.games?.[gameIndex];
        const gNum = gameIndex + 1;
        const isLol = match.game === 'lol';
        const isDota = match.game === 'dota2';

        // === DOTA 2: Hawk-style (real data) ===
        if (isDota && g) {
            const data = {
                killsA: g.killsA ?? Math.round((g.kills || 30) * 0.55),
                killsB: g.killsB ?? Math.round((g.kills || 30) * 0.45),
                towersA: g.towersA ?? Math.round((g.towers || 8) * 0.55),
                towersB: g.towersB ?? Math.round((g.towers || 8) * 0.45),
                roshA: g.roshansA ?? (g.winner === 'A' ? 2 : 1),
                roshB: g.roshansB ?? (g.winner === 'B' ? 2 : 1),
                goldA: g.goldA ?? 45000,
                goldB: g.goldB ?? 38000,
                dur: g.duration ?? 35,
                winner: g.winner || '',
                heroesA: g.heroesA || g.championsA || [],
                heroesB: g.heroesB || g.championsB || [],
                seed: EsportsAnalyzer.hashCode ? EsportsAnalyzer.hashCode(match.id + '_g' + gNum) : 42,
            };
            return renderDotaHawkDetail(match, gameIndex, data);
        }

        // === DOTA 2: Hawk-style (simulated data) ===
        if (isDota && !g) {
            const data = simDotaGame(match, gameIndex);
            return renderDotaHawkDetail(match, gameIndex, data);
        }

        // === LOL: Keep existing LoL layout ===
        if (g) {
            const hasChamps = (g.championsA?.length > 0 || g.championsB?.length > 0);
            const hasPlayers = (g.playersA?.length > 0 || g.playersB?.length > 0);
            const winnerName = g.winner === 'A' ? match.teamA.name : g.winner === 'B' ? match.teamB.name : g.winner || '';
            return `<div class="es-gd-card es-gd-pro">
                <div class="es-gd-header">
                    <span class="es-gd-map">GAME ${gNum}</span>
                    ${winnerName ? `<span class="es-gd-winner">🏆 ${winnerName}</span>` : ''}
                </div>
                ${hasChamps ? `<div class="es-champs-section">
                    <div class="es-champs-team">
                        <span class="es-champs-label">${match.teamA.name}</span>
                        ${champRow(g.championsA, 'left')}
                    </div>
                    <span class="es-champs-vs">VS</span>
                    <div class="es-champs-team">
                        <span class="es-champs-label">${match.teamB.name}</span>
                        ${champRow(g.championsB, 'right')}
                    </div>
                </div>` : ''}
                <div class="es-gd-stats-pro">
                    <div class="es-gd-side es-gd-left">
                        ${g.killsA != null ? `<span class="es-gd-val">${g.killsA}</span>` : ''}
                        ${g.towersA != null ? `<span class="es-gd-val">${g.towersA}</span>` : ''}
                        ${g.dragonsA != null ? `<span class="es-gd-val">${g.dragonsA}</span>` : ''}
                        ${g.baronsA != null ? `<span class="es-gd-val">${g.baronsA}</span>` : ''}
                        ${g.goldA != null ? `<span class="es-gd-val">${(g.goldA / 1000).toFixed(1)}k</span>` : ''}
                    </div>
                    <div class="es-gd-icons">
                        ${g.kills != null || g.killsA != null ? statIcon('kills', g.kills ?? '') : ''}
                        ${g.towers != null || g.towersA != null ? statIcon('tower', g.towers ?? '') : ''}
                        ${g.dragons != null || g.dragonsA != null ? statIcon('dragon', g.dragons ?? '') : ''}
                        ${g.baronsA != null || g.barons != null ? statIcon('baron', g.barons ?? '') : ''}
                        ${g.goldA != null ? statIcon('gold', '') : ''}
                    </div>
                    <div class="es-gd-side es-gd-right">
                        ${g.killsB != null ? `<span class="es-gd-val">${g.killsB}</span>` : ''}
                        ${g.towersB != null ? `<span class="es-gd-val">${g.towersB}</span>` : ''}
                        ${g.dragonsB != null ? `<span class="es-gd-val">${g.dragonsB}</span>` : ''}
                        ${g.baronsB != null ? `<span class="es-gd-val">${g.baronsB}</span>` : ''}
                        ${g.goldB != null ? `<span class="es-gd-val">${(g.goldB / 1000).toFixed(1)}k</span>` : ''}
                    </div>
                </div>
                ${g.duration != null ? `<div class="es-gd-duration">${statIcon('time', g.duration + 'p', 'Thời gian')}</div>` : ''}
                ${hasPlayers ? renderPlayerTable(g, match) : ''}
            </div>`;
        }

        // Simulated LoL game detail
        const lol = simLolGame(match, gameIndex);
        return `<div class="es-gd-card es-gd-pro">
            <div class="es-gd-header"><span class="es-gd-map">GAME ${gNum}</span><span class="es-gd-winner">🏆 ${lol.winner}</span></div>
            <div class="es-gd-stats-pro">
                <div class="es-gd-icons">
                    ${statIcon('kills', lol.kills)}
                    ${statIcon('tower', lol.towers)}
                    ${statIcon('dragon', lol.dragons)}
                    ${statIcon('baron', lol.barons)}
                    ${statIcon('gold', lol.gold + 'k')}
                    ${statIcon('time', lol.dur + 'p')}
                </div>
            </div>
        </div>`;
    }

    // Render player stats table for a game
    function renderPlayerTable(g, match) {
        if (!g.playersA?.length && !g.playersB?.length) return '';
        const renderRow = (p, side) => {
            const kda = `${p.kills}/${p.deaths}/${p.assists}`;
            return `<div class="es-player-row ${side}">
                <img class="es-champ-img-sm" src="${champImgUrl(p.championId)}" alt="" onerror="this.style.display='none'" loading="lazy">
                <span class="es-player-name">${p.summonerName || '—'}</span>
                <span class="es-player-kda">${kda}</span>
                <span class="es-player-cs">${p.cs || '—'}</span>
            </div>`;
        };
        return `<div class="es-players-section">
            <div class="es-players-header">
                <span>Tướng</span><span>Tên</span><span>KDA</span><span>CS</span>
            </div>
            <div class="es-players-team">
                <div class="es-players-team-label">${match.teamA.logo} ${match.teamA.name}</div>
                ${(g.playersA || []).map(p => renderRow(p, 'team-a')).join('')}
            </div>
            <div class="es-players-team">
                <div class="es-players-team-label">${match.teamB.logo} ${match.teamB.name}</div>
                ${(g.playersB || []).map(p => renderRow(p, 'team-b')).join('')}
            </div>
        </div>`;
    }

    window.switchGameTab = function (event, gameIndex, matchId) {
        const match = currentMatches.find(m => m.id === matchId);
        if (!match) return;
        document.querySelectorAll('.es-game-tab').forEach(t => t.classList.remove('active'));
        event.currentTarget.classList.add('active');
        const detail = document.getElementById('esGameDetail_' + matchId);
        if (detail) detail.innerHTML = renderGameDetail(match, gameIndex);
    };
    window.closeEsMatchModal = function () { document.getElementById('esMatchModal').classList.add('hidden'); };

    // ===== SETTINGS =====
    window.openEsSettings = function () {
        document.getElementById('esSettCapital').value = EsportsAnalyzer.fmtFull(esState.initialCapital);
        document.getElementById('esSettingsModal').classList.remove('hidden');
    };
    window.closeEsSettings = function () { document.getElementById('esSettingsModal').classList.add('hidden'); };
    window.saveEsSettings = function () {
        const val = parseInt(document.getElementById('esSettCapital').value.replace(/[^\d]/g, ''), 10);
        if (!val || val < 100000) { window.showToast?.('Vốn tối thiểu 100,000₫', 'error'); return; }
        const diff = val - esState.initialCapital;
        esState.initialCapital = val;
        esState.capital += diff;
        esState.matchCache = {};
        EsportsAnalyzer.saveState(esState);
        closeEsSettings();
        initEsports();
        window.showToast?.('Đã lưu cài đặt', 'success');
    };
    window.resetEsports = function () {
        if (!confirm('Xóa toàn bộ dữ liệu?')) return;
        esState = EsportsAnalyzer.resetState();
        initEsports();
        closeEsSettings();
        window.showToast?.('Đã xóa dữ liệu', 'info');
    };

    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') EsportsAnalyzer.saveState(esState); });

    // ===== EDGE ALERT =====
    function checkEdgeAlerts(matches) {
        const isToday = esState.viewingDate === EsportsAnalyzer.todayStr();
        if (!isToday) return;
        for (const m of matches) {
            if (m.status !== 'upcoming') continue;
            const rec = EsportsAnalyzer.generateRecommendation(m.bets, esState.capital, esState.streak || 0, esState.sessionPL || 0, esState.predictions, m.teamA, m.teamB, esState.bets);
            if (rec.action === 'BET' && rec.edge > 0.20) {
                const toast = document.getElementById('toast');
                if (toast) {
                    toast.textContent = `🔥 KÈO THƠM: ${m.teamA.name} vs ${m.teamB.name} — ${rec.betLabel} Edge +${(rec.edge * 100).toFixed(0)}%`;
                    toast.className = 'toast edge-alert';
                    setTimeout(() => toast.className = 'toast hidden', 5000);
                }
                break; // Only show 1 alert
            }
        }
    }

    // ===== AUTO-SETTLEMENT =====
    function startAutoSettlement() {
        if (autoSettleTimer) clearInterval(autoSettleTimer);
        const isToday = esState.viewingDate === EsportsAnalyzer.todayStr();
        if (!isToday) return;
        autoSettleTimer = setInterval(async () => {
            const pending = currentMatches.filter(m => (m.status === 'live' || m.status === 'finished') && !m.result);
            if (pending.length === 0) return;
            let changed = false;
            for (const m of pending) {
                try {
                    const result = await EsportsAnalyzer.fetchMatchResult(m);
                    if (result) {
                        m.result = result;
                        m.status = 'finished';
                        // Resolve any bets placed on this match
                        const bet = esState.bets.find(b => b.matchId === m.id && !b.result);
                        if (bet) {
                            const resolution = EsportsAnalyzer.resolveBet(bet, result);
                            bet.result = resolution.won ? 'win' : 'loss';
                            bet.pnl = resolution.pnl;
                            bet.actual = resolution.actual;
                            esState.capital += resolution.pnl;
                            esState.streak = resolution.won ? Math.max(1, (esState.streak || 0) + 1) : Math.min(-1, (esState.streak || 0) - 1);
                            esState.sessionPL = (esState.sessionPL || 0) + resolution.pnl;
                            window.showToast?.(`${resolution.won ? '✅ Thắng' : '❌ Thua'} ${m.teamA.name} vs ${m.teamB.name}: ${resolution.won ? '+' : ''}₫${EsportsAnalyzer.fmtFull(Math.abs(resolution.pnl))}`, resolution.won ? 'success' : 'error');
                        }
                        changed = true;
                    }
                } catch { /* skip */ }
            }
            if (changed) {
                EsportsAnalyzer.saveState(esState);
                renderAll();
            }
        }, 60000); // Poll every 60s
    }

    window.EsportsUI = { initEsports, renderAll };
})();
