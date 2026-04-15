/**
 * Vercel Proxy for LoL Esports Event Details
 * 
 * Fetches per-game stats for a completed LoL match using getEventDetails.
 * Returns: kills, towers, dragons, duration, winner per game in a series.
 * 
 * Usage: /api/lol-match-detail?matchId=<lolesports_match_id>
 */
module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { matchId, hl = 'en-US' } = req.query;
    if (!matchId) {
        return res.status(400).json({ success: false, error: 'matchId required' });
    }

    try {
        // Try GraphQL endpoint first (newer)
        const gqlData = await fetchGraphQL(matchId, hl);
        if (gqlData) {
            return res.status(200).json({ success: true, source: 'graphql', ...gqlData });
        }
    } catch (e) {
        console.warn('[lol-match-detail] GraphQL failed:', e.message);
    }

    try {
        // Fallback: legacy REST getEventDetails
        const legacyData = await fetchLegacy(matchId, hl);
        if (legacyData) {
            return res.status(200).json({ success: true, source: 'legacy', ...legacyData });
        }
    } catch (e) {
        console.warn('[lol-match-detail] Legacy failed:', e.message);
    }

    return res.status(200).json({ success: false, games: [], error: 'Could not fetch match details' });
};

async function fetchGraphQL(matchId, hl) {
    const variables = JSON.stringify({ id: matchId, hl });
    const extensions = JSON.stringify({
        persistedQuery: {
            version: 1,
            sha256Hash: 'b1cbde15f24a0ee085ba4262e7daa5297ac917e516940a5c1b1ed119a40f5668',
        }
    });
    const url = `https://lolesports.com/api/gql?operationName=eventDetails&variables=${encodeURIComponent(variables)}&extensions=${encodeURIComponent(extensions)}`;

    const resp = await fetch(url, {
        headers: {
            'User-Agent': 'BetWise/5.0 (esports-analyzer)',
            'Accept': 'application/json',
            'Referer': 'https://lolesports.com/',
            'Origin': 'https://lolesports.com',
        },
    });

    if (!resp.ok) return null;
    const data = await resp.json();
    return parseEventDetails(data?.data?.eventDetails || data?.data?.esports?.eventDetails);
}

async function fetchLegacy(matchId, hl) {
    const url = `https://esports-api.lolesports.com/persisted/gw/getEventDetails?hl=${hl}&id=${matchId}`;
    const resp = await fetch(url, {
        headers: {
            'x-api-key': '0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z',
            'User-Agent': 'BetWise/5.0',
        },
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const event = data?.data?.event;
    if (!event?.match) return null;

    return parseEventMatch(event.match);
}

function parseEventDetails(eventDetails) {
    if (!eventDetails?.match) return null;
    return parseEventMatch(eventDetails.match);
}

function parseEventMatch(match) {
    if (!match?.games) return null;

    const games = [];
    for (const g of match.games) {
        if (g.state !== 'completed') continue;

        const teams = g.teams || [];
        if (teams.length < 2) continue;

        const tA = teams[0];
        const tB = teams[1];
        const killsA = tA.kills ?? tA.totalKills ?? 0;
        const killsB = tB.kills ?? tB.totalKills ?? 0;
        const towersA = tA.towers ?? tA.towerKills ?? 0;
        const towersB = tB.towers ?? tB.towerKills ?? 0;
        const dragonsA = tA.dragons ?? tA.dragonKills ?? 0;
        const dragonsB = tB.dragons ?? tB.dragonKills ?? 0;

        // Duration: may be in seconds or "PT35M12S" format
        let durationMin = 0;
        if (g.duration) {
            if (typeof g.duration === 'number') {
                durationMin = Math.round(g.duration / 60);
            } else if (typeof g.duration === 'string') {
                const ptMatch = g.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
                if (ptMatch) {
                    durationMin = (parseInt(ptMatch[1] || 0) * 60) + parseInt(ptMatch[2] || 0) + (parseInt(ptMatch[3] || 0) > 30 ? 1 : 0);
                } else {
                    durationMin = parseInt(g.duration) || 0;
                }
            }
        }

        const winner = tA.outcome === 'win' ? tA.name || tA.code || 'Team A'
            : tB.outcome === 'win' ? tB.name || tB.code || 'Team B'
                : '—';

        // Extract champion picks per team
        const championsA = (tA.players || []).map(p => p.championId || p.champion?.id || p.champion || null).filter(Boolean);
        const championsB = (tB.players || []).map(p => p.championId || p.champion?.id || p.champion || null).filter(Boolean);
        // Extract bans if available
        const bansA = (tA.bans || []).map(b => b.championId || b.champion?.id || b);
        const bansB = (tB.bans || []).map(b => b.championId || b.champion?.id || b);
        // Extract per-player details
        const playersA = (tA.players || []).map(p => ({
            summonerName: p.summonerName || p.name || '',
            role: p.role || '',
            championId: p.championId || p.champion?.id || p.champion || null,
            kills: p.kills ?? 0,
            deaths: p.deaths ?? 0,
            assists: p.assists ?? 0,
            cs: p.creepScore ?? p.cs ?? 0,
            gold: p.totalGold ?? p.gold ?? 0,
        }));
        const playersB = (tB.players || []).map(p => ({
            summonerName: p.summonerName || p.name || '',
            role: p.role || '',
            championId: p.championId || p.champion?.id || p.champion || null,
            kills: p.kills ?? 0,
            deaths: p.deaths ?? 0,
            assists: p.assists ?? 0,
            cs: p.creepScore ?? p.cs ?? 0,
            gold: p.totalGold ?? p.gold ?? 0,
        }));

        games.push({
            gameNumber: g.number || (games.length + 1),
            winner,
            kills: killsA + killsB,
            killsA, killsB,
            towers: towersA + towersB,
            towersA, towersB,
            dragons: dragonsA + dragonsB,
            dragonsA, dragonsB,
            duration: durationMin,
            state: g.state,
            championsA,
            championsB,
            bansA,
            bansB,
            playersA,
            playersB,
        });
    }

    // Aggregate result from all completed games
    const result = games.length > 0 ? {
        kills: Math.round(games.reduce((s, g) => s + g.kills, 0) / games.length),
        towers: Math.round(games.reduce((s, g) => s + g.towers, 0) / games.length),
        dragons: Math.round(games.reduce((s, g) => s + g.dragons, 0) / games.length),
        duration: Math.round(games.reduce((s, g) => s + g.duration, 0) / games.length),
    } : null;

    return { games, result, gameCount: games.length };
}
