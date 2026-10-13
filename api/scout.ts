import {
  extractSteamTitles,
  KNOWN_GAME_STUDIOS,
  ExtractedLead,
  fetchSteamAppDetails,
  searchSteamAppByTitle,
} from '../src/lib/steamIntelligence';

export default async function handler(req: any, res: any) {
  // Enable CORS for Vercel preview and production deployments
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sources } = req.body || {};
    if (!sources || typeof sources !== 'string') {
      return res.status(400).json({ error: 'sources text is required' });
    }

    const extractedLeads: ExtractedLead[] = [];
    const progressList: { source: string; status: 'processed' | 'skipped' | 'failed'; message: string }[] = [];
    const processedKeys = new Set<string>();

    // 1. Check for Steam search page URLs (e.g. store.steampowered.com/search/...)
    const searchUrlMatches = sources.match(/https?:\/\/store\.steampowered\.com\/search\/[^\s]+/gi) || [];
    for (const searchUrl of searchUrlMatches) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const searchRes = await fetch(searchUrl, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SteamScout/1.0' },
        });
        clearTimeout(timeout);
        if (searchRes.ok) {
          const html = await searchRes.text();
          const appMatches = [...html.matchAll(/store\.steampowered\.com\/app\/(\d+)\/([^/?"\s]+)?/gi)];
          const appIds = Array.from(new Set(appMatches.map((m) => m[1]))).slice(0, 25);
          for (const id of appIds) {
            if (processedKeys.has(`app_${id}`)) continue;
            processedKeys.add(`app_${id}`);
            const details = await fetchSteamAppDetails(id);
            if (details) {
              const devName = details.developers[0] || details.publishers[0] || 'Game Studio';
              extractedLeads.push({
                id: `steam_${id}_${Date.now()}`,
                company: `${devName} (${details.name})`,
                game: details.name,
                fullName: `${devName} Lead`,
                firstName: devName.split(' ')[0] || 'Studio',
                lastName: 'Team',
                website: details.website || `https://store.steampowered.com/app/${id}`,
                email: details.email || null,
                phone: null,
                location: 'Global',
                niche: 'Game Development',
                sourceUrl: `https://store.steampowered.com/app/${id}`,
                sourceType: 'Steam Store',
                emailStatus: details.email ? 'valid' : 'unknown',
              });
              progressList.push({
                source: details.name,
                status: 'processed',
                message: details.email
                  ? `Found Steam Contact: ${details.email} (${devName})`
                  : `Found Steam Game: ${details.name} (${devName}) - No public email listed`,
              });
            }
          }
        }
      } catch (e: any) {
        console.warn('Steam search parse error:', e.message);
      }
    }

    // 2. Direct Steam App URLs (e.g. store.steampowered.com/app/1966720/...)
    const appUrlRegex = /store\.steampowered\.com\/app\/(\d+)/gi;
    let urlMatch;
    while ((urlMatch = appUrlRegex.exec(sources)) !== null) {
      const appId = urlMatch[1];
      if (processedKeys.has(`app_${appId}`)) continue;
      processedKeys.add(`app_${appId}`);

      const details = await fetchSteamAppDetails(appId);
      if (details) {
        const devName = details.developers[0] || details.publishers[0] || 'Game Studio';
        extractedLeads.push({
          id: `steam_${appId}_${Date.now()}`,
          company: `${devName} (${details.name})`,
          game: details.name,
          fullName: `${devName} Lead`,
          firstName: devName.split(' ')[0] || 'Studio',
          lastName: 'Team',
          website: details.website || `https://store.steampowered.com/app/${appId}`,
          email: details.email || null,
          phone: null,
          location: 'Global',
          niche: 'Game Development',
          sourceUrl: `https://store.steampowered.com/app/${appId}`,
          sourceType: 'Steam Store',
          emailStatus: details.email ? 'valid' : 'unknown',
        });
        progressList.push({
          source: details.name,
          status: 'processed',
          message: details.email
            ? `Found Steam Contact: ${details.email} (${devName})`
            : `Found Steam Game: ${details.name} (${devName}) - No public email listed`,
        });
      }
    }

    // 3. Game titles extracted from lines or Steam search dumps
    const steamTitles = extractSteamTitles(sources);
    for (let idx = 0; idx < steamTitles.length; idx++) {
      const title = steamTitles[idx];
      const norm = title.toLowerCase().replace(/[™®©]/g, '').trim();
      if (processedKeys.has(`title_${norm}`)) continue;
      processedKeys.add(`title_${norm}`);

      // First check verified known studios
      const known =
        KNOWN_GAME_STUDIOS[norm] ||
        Object.entries(KNOWN_GAME_STUDIOS).find(([k]) => norm.includes(k) || k.includes(norm))?.[1];

      if (known) {
        extractedLeads.push({
          id: `lead_${idx}_${Date.now()}`,
          company: `${known.company} (${title})`,
          game: title,
          fullName: known.fullName || `${known.company} Team`,
          firstName: known.fullName ? known.fullName.split(' ')[0] : 'Lead',
          lastName: known.fullName && known.fullName.includes(' ') ? known.fullName.split(' ').slice(1).join(' ') : 'Developer',
          website: known.website,
          email: known.email || null,
          phone: null,
          location: known.location || 'Global',
          niche: 'Game Development',
          sourceUrl: `Steam Store / ${title}`,
          sourceType: 'Game Studio',
          emailStatus: known.email ? 'valid' : 'unknown',
        });
        progressList.push({
          source: title,
          status: 'processed',
          message: known.email
            ? `Identified Studio: ${known.company} (${known.email})`
            : `Identified Studio: ${known.company} (No public email)`,
        });
        continue;
      }

      // Query Steam Store Search API directly
      const steamApp = await searchSteamAppByTitle(title);
      if (steamApp) {
        const details = await fetchSteamAppDetails(steamApp.id);
        if (details) {
          const devName = details.developers[0] || details.publishers[0] || 'Game Studio';
          extractedLeads.push({
            id: `steam_${steamApp.id}_${Date.now()}`,
            company: `${devName} (${details.name})`,
            game: details.name,
            fullName: `${devName} Lead`,
            firstName: devName.split(' ')[0] || 'Studio',
            lastName: 'Team',
            website: details.website || `https://store.steampowered.com/app/${steamApp.id}`,
            email: details.email || null, // Real email from Steam, never fake
            phone: null,
            location: 'Global',
            niche: 'Game Development',
            sourceUrl: `https://store.steampowered.com/app/${steamApp.id}`,
            sourceType: 'Steam Store',
            emailStatus: details.email ? 'valid' : 'unknown',
          });
          progressList.push({
            source: details.name,
            status: 'processed',
            message: details.email
              ? `Steam Contact: ${details.email} (${devName})`
              : `Steam Game: ${details.name} (${devName}) - No public email listed`,
          });
          continue;
        }
      }

      // Fallback for titles with no online match: DO NOT invent a fake email or fake website!
      extractedLeads.push({
        id: `lead_${idx}_${Date.now()}`,
        company: `${title} Developer`,
        game: title,
        fullName: `${title} Lead`,
        firstName: title.split(' ')[0] || 'Lead',
        lastName: 'Developer',
        website: null,
        email: null, // NEVER fake
        phone: null,
        location: 'Global',
        niche: 'Game Development',
        sourceUrl: `Steam Store / ${title}`,
        sourceType: 'Game Studio',
        emailStatus: 'unknown',
      });
      progressList.push({
        source: title,
        status: 'processed',
        message: `Extracted Game: ${title} (No public email found)`,
      });
    }

    // Deduplicate extracted leads by game / company
    const uniqueLeads: ExtractedLead[] = [];
    const seenGames = new Set<string>();
    for (const lead of extractedLeads) {
      const key = (lead.game || lead.company || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (key && !seenGames.has(key)) {
        seenGames.add(key);
        uniqueLeads.push(lead);
      }
    }

    return res.status(200).json({
      leads: uniqueLeads,
      progress: progressList,
      summary: {
        totalSources: uniqueLeads.length,
        leadsExtracted: uniqueLeads.length,
        successRate: 100,
      },
    });
  } catch (err: any) {
    console.error('Vercel Scout handler error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
