/**
 * Vercel Proxy for TJStats API (LoL LPL match data)
 * Proxies requests to open.tjstats.com with proper auth headers
 * 
 * Usage: /api/lol-stats?matchId=13213
 * Returns: Full match data including kills, towers, dragons, duration per game
 */

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { matchId, from, to } = req.query;

    // Single match mode
    if (matchId) {
        try {
            const data = await fetchMatch(parseInt(matchId));
            return res.status(200).json({ success: true, matchId: parseInt(matchId), data });
        } catch (e) {
            return res.status(500).json({ success: false, error: e.message });
        }
    }

    // Batch mode: fetch range of matchIds
    if (from && to) {
        const fromId = parseInt(from), toId = parseInt(to);
        if (toId - fromId > 50) return res.status(400).json({ success: false, error: 'Max 50 matches per batch' });

        const results = [];
        for (let id = fromId; id <= toId; id++) {
            try {
                const data = await fetchMatch(id);
                if (data && data.success !== false) {
                    results.push({ matchId: id, data });
                }
            } catch (e) { /* skip failed */ }
            await new Promise(r => setTimeout(r, 200)); // rate limit
        }
        return res.status(200).json({ success: true, count: results.length, matches: results });
    }

    return res.status(400).json({ success: false, error: 'Provide matchId or from/to range' });
}

async function fetchMatch(matchId) {
    const url = `https://open.tjstats.com/match-auth-app/open/v1/compound/matchDetail?matchId=${matchId}`;
    const resp = await fetch(url, {
        headers: {
            'Authorization': '7935be4c41d8760a28c05581a7b1f570',
            'Referer': 'https://lpl.qq.com/',
            'Origin': 'https://lpl.qq.com',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
        }
    });
    return resp.json();
}
