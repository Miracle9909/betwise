/**
 * Vercel Serverless Proxy for LoL Esports GraphQL API
 * 
 * Proxies requests to lolesports.com/api/gql to bypass CORS.
 * No API key needed — uses persisted query hashes from the public site.
 */
module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

    const { start, end, hl = 'en-US' } = req.query;

    // Default: today +/- 1 day
    const now = new Date();
    const startDate = start || new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
    const endDate = end || new Date(now.getTime() + 48 * 3600 * 1000).toISOString();

    // LoL Esports GraphQL persisted query — homeEvents
    const variables = JSON.stringify({
        hl,
        sport: 'lol',
        eventDateStart: startDate,
        eventDateEnd: endDate,
        pageSize: 50,
    });

    const extensions = JSON.stringify({
        persistedQuery: {
            version: 1,
            sha256Hash: '7246add6f577cf30b304e651bf9e25fc6a41fe49aeafb0754c16b5778060fc0a',
        },
    });

    const url = `https://lolesports.com/api/gql?operationName=homeEvents&variables=${encodeURIComponent(variables)}&extensions=${encodeURIComponent(extensions)}`;

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'BetWise/4.1 (esports-analyzer)',
                'Accept': 'application/json',
                'Referer': 'https://lolesports.com/',
                'Origin': 'https://lolesports.com',
            },
        });

        if (!response.ok) {
            // Fallback: try the older REST endpoint
            return await tryLegacyEndpoint(req, res, hl);
        }

        const data = await response.json();

        // Parse and normalize the GraphQL response
        const matches = parseGraphQLResponse(data);

        res.status(200).json({
            success: true,
            source: 'lolesports-graphql',
            matches,
            raw_count: matches.length,
        });
    } catch (err) {
        // Try legacy endpoint as fallback
        try {
            return await tryLegacyEndpoint(req, res, hl);
        } catch (e2) {
            res.status(200).json({
                success: false,
                source: 'error',
                matches: [],
                error: err.message,
            });
        }
    }
};

async function tryLegacyEndpoint(req, res, hl) {
    // Legacy LoL Esports REST API (with well-known public x-api-key)
    const url = `https://esports-api.lolesports.com/persisted/gw/getSchedule?hl=${hl}`;
    const response = await fetch(url, {
        headers: {
            'x-api-key': '0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z',
            'User-Agent': 'BetWise/4.1',
        },
    });

    if (!response.ok) {
        throw new Error(`Legacy API returned ${response.status}`);
    }

    const data = await response.json();
    const matches = parseLegacyResponse(data);

    res.status(200).json({
        success: true,
        source: 'lolesports-legacy',
        matches,
        raw_count: matches.length,
    });
}

function parseGraphQLResponse(data) {
    const matches = [];
    try {
        const events = data?.data?.homeEvents?.events || data?.data?.esports?.homeEvents?.events || [];
        for (const event of events) {
            if (!event.match) continue;
            const m = event.match;
            const teams = m.teams || [];
            if (teams.length < 2) continue;

            matches.push({
                id: m.id || event.id,
                startTime: event.startTime || m.startTime,
                state: event.state || m.state || 'unstarted',
                league: event.league?.name || m.league?.name || '',
                leagueSlug: event.league?.slug || '',
                teamA: {
                    name: teams[0].name || teams[0].code || 'Team A',
                    code: teams[0].code || '',
                    image: teams[0].image || teams[0].imageUrl || '',
                    score: teams[0].result?.gameWins ?? teams[0].score ?? null,
                    outcome: teams[0].result?.outcome || null,
                },
                teamB: {
                    name: teams[1].name || teams[1].code || 'Team B',
                    code: teams[1].code || '',
                    image: teams[1].image || teams[1].imageUrl || '',
                    score: teams[1].result?.gameWins ?? teams[1].score ?? null,
                    outcome: teams[1].result?.outcome || null,
                },
                bestOf: m.strategy?.count || m.bestOf || 3,
            });
        }
    } catch (e) {
        console.error('Parse error:', e);
    }
    return matches;
}

function parseLegacyResponse(data) {
    const matches = [];
    try {
        const events = data?.data?.schedule?.events || [];
        for (const event of events) {
            if (event.type !== 'match' || !event.match) continue;
            const m = event.match;
            const teams = m.teams || [];
            if (teams.length < 2) continue;

            matches.push({
                id: m.id,
                startTime: event.startTime,
                state: event.state,
                league: event.league?.name || '',
                leagueSlug: event.league?.slug || '',
                teamA: {
                    name: teams[0].name,
                    code: teams[0].code,
                    image: teams[0].image || '',
                    score: teams[0].result?.gameWins ?? null,
                    outcome: teams[0].result?.outcome || null,
                },
                teamB: {
                    name: teams[1].name,
                    code: teams[1].code,
                    image: teams[1].image || '',
                    score: teams[1].result?.gameWins ?? null,
                    outcome: teams[1].result?.outcome || null,
                },
                bestOf: m.strategy?.count || 3,
            });
        }
    } catch (e) {
        console.error('Legacy parse error:', e);
    }
    return matches;
}
