/**
 * Vercel Proxy for gol.gg Match Stats
 * 
 * Fetches per-game stats from gol.gg (Games of Legends).
 * Returns: kills, towers, dragons, barons, duration, gold per team per game.
 * 
 * IMPORTANT: gol.gg blocks server-side requests (403/connection reset).
 * This API acts as a structured data provider using Leaguepedia Cargo fallback
 * and provides the gol.gg URL for manual/browser-based access.
 * 
 * Usage: 
 *   /api/lol-results?team1=T1&team2=DK&date=2026-04-17
 *   /api/lol-results?tournament=LCK 2026 Spring&limit=10
 */
module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { team1, team2, date, tournament, limit = 10, source } = req.query;

    const results = {
        success: false,
        sources_tried: [],
        games: [],
        reference_urls: {},
    };

    // === SOURCE 1: Leaguepedia Cargo API ===
    if (!source || source === 'leaguepedia') {
        try {
            const cargoData = await fetchLeaguepediaCargo({ team1, team2, date, tournament, limit });
            if (cargoData && cargoData.length > 0) {
                results.success = true;
                results.games = cargoData;
                results.sources_tried.push('leaguepedia_cargo');
                return res.status(200).json(results);
            }
            results.sources_tried.push('leaguepedia_cargo (empty)');
        } catch (e) {
            results.sources_tried.push(`leaguepedia_cargo (${e.message})`);
        }
    }

    // === SOURCE 2: TJStats API (LPL only) ===
    if (!source || source === 'tjstats') {
        if (req.query.matchId) {
            try {
                const tjData = await fetchTJStats(req.query.matchId);
                if (tjData) {
                    results.success = true;
                    results.games = tjData;
                    results.sources_tried.push('tjstats');
                    return res.status(200).json(results);
                }
            } catch (e) {
                results.sources_tried.push(`tjstats (${e.message})`);
            }
        }
    }

    // === Reference URLs for manual lookup ===
    results.reference_urls = {
        gol_gg: `https://gol.gg/esports/home/`,
        gol_gg_note: 'Search team names manually — best source for ALL leagues. Has kills, towers, dragons, barons, gold, time, bans, picks.',
        lpl_qq: team1 ? `https://lpl.qq.com/es/stats.shtml` : null,
        lpl_qq_note: 'LPL only — search by match date. Has kills, towers, dragons, barons, gold.',
        leaguepedia: `https://lol.fandom.com/wiki/Special:CargoExport?tables=ScoreboardGames&fields=Tournament,DateTime_UTC,Team1,Team2,Team1Kills,Team2Kills,Team1Towers,Team2Towers,Team1Dragons,Team2Dragons,Gamelength&where=DateTime_UTC>"${date || '2026-04-01'}"&order_by=DateTime_UTC DESC&limit=${limit}&format=json`,
        leaguepedia_note: 'May be blocked by Cloudflare. Try in browser or fetch with cookies.',
        scoregg: 'https://www.scoregg.com/',
        scoregg_note: 'LCK/LPL — needs login for detailed stats.',
    };

    if (!results.success) {
        results.error = 'No API source returned data. Use reference_urls for manual lookup or browser scraping.';
    }

    return res.status(200).json(results);
};

// === Leaguepedia Cargo Fetcher ===
async function fetchLeaguepediaCargo({ team1, team2, date, tournament, limit }) {
    let where = '';
    const conditions = [];

    if (team1 && team2) {
        conditions.push(`(Team1="${team1}" AND Team2="${team2}") OR (Team1="${team2}" AND Team2="${team1}")`);
    } else if (team1) {
        conditions.push(`(Team1="${team1}" OR Team2="${team1}")`);
    }

    if (date) {
        conditions.push(`DateTime_UTC > "${date} 00:00:00" AND DateTime_UTC < "${date} 23:59:59"`);
    }

    if (tournament) {
        conditions.push(`Tournament="${tournament}"`);
    }

    if (conditions.length === 0) {
        conditions.push('DateTime_UTC > "2026-04-01"');
    }

    where = conditions.join(' AND ');

    const fields = [
        'Tournament', 'DateTime_UTC', 'Team1', 'Team2',
        'Team1Score', 'Team2Score',
        'Team1Kills', 'Team2Kills',
        'Team1Towers', 'Team2Towers',
        'Team1Dragons', 'Team2Dragons',
        'Team1Barons', 'Team2Barons',
        'Team1Gold', 'Team2Gold',
        'Gamelength', 'Winner',
        'Team1Bans', 'Team2Bans',
        'Team1Picks', 'Team2Picks',
    ].join(',');

    const url = `https://lol.fandom.com/api.php?action=cargoquery&tables=ScoreboardGames&fields=${fields}&where=${encodeURIComponent(where)}&order_by=DateTime_UTC DESC&limit=${limit}&format=json`;

    const resp = await fetch(url, {
        headers: {
            'User-Agent': 'BetWise/5.0 (esports-analyzer; contact@betwise.app)',
            'Accept': 'application/json',
        },
    });

    if (!resp.ok) throw new Error(`Leaguepedia ${resp.status}`);
    const data = await resp.json();

    if (!data.cargoquery || data.cargoquery.length === 0) return [];

    return data.cargoquery.map(row => {
        const g = row.title;
        return {
            tournament: g.Tournament,
            dateTime: g['DateTime UTC'],
            team1: g.Team1,
            team2: g.Team2,
            team1Score: parseInt(g.Team1Score) || 0,
            team2Score: parseInt(g.Team2Score) || 0,
            team1Kills: parseInt(g.Team1Kills) || 0,
            team2Kills: parseInt(g.Team2Kills) || 0,
            totalKills: (parseInt(g.Team1Kills) || 0) + (parseInt(g.Team2Kills) || 0),
            team1Towers: parseInt(g.Team1Towers) || 0,
            team2Towers: parseInt(g.Team2Towers) || 0,
            totalTowers: (parseInt(g.Team1Towers) || 0) + (parseInt(g.Team2Towers) || 0),
            team1Dragons: parseInt(g.Team1Dragons) || 0,
            team2Dragons: parseInt(g.Team2Dragons) || 0,
            totalDragons: (parseInt(g.Team1Dragons) || 0) + (parseInt(g.Team2Dragons) || 0),
            team1Barons: parseInt(g.Team1Barons) || 0,
            team2Barons: parseInt(g.Team2Barons) || 0,
            team1Gold: parseInt(g.Team1Gold) || 0,
            team2Gold: parseInt(g.Team2Gold) || 0,
            gamelength: g.Gamelength,
            winner: g.Winner,
            team1Bans: g.Team1Bans,
            team2Bans: g.Team2Bans,
            team1Picks: g.Team1Picks,
            team2Picks: g.Team2Picks,
        };
    });
}

// === TJStats Fetcher (LPL) ===
async function fetchTJStats(matchId) {
    const url = `https://open.tjstats.com/match-auth-app/open/v1/compound/matchDetail?matchId=${matchId}`;
    const resp = await fetch(url, {
        headers: {
            'Authorization': '7935be4c41d8760a28c05581a7b1f570',
            'Referer': 'https://lpl.qq.com/',
            'Origin': 'https://lpl.qq.com',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Accept': 'application/json',
        },
    });
    const data = await resp.json();
    if (!data || data.code !== 0) return null;

    // Parse TJStats response into standard format
    const match = data.data;
    if (!match) return null;

    return [{
        source: 'tjstats',
        matchId: parseInt(matchId),
        raw: match,
    }];
}
