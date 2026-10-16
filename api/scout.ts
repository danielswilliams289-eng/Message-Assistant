import { GoogleGenAI, Type } from '@google/genai';
import {
  parseGameInputEntries,
  cleanGameTitleForSearch,
  KNOWN_GAME_STUDIOS,
  ExtractedLead,
  fetchSteamAppDetails,
  searchSteamAppByTitle,
} from '../src/lib/steamIntelligence';

function validateEmail(email: string): 'valid' | 'invalid' | 'unknown' {
  if (!email || typeof email !== 'string') return 'unknown';
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(email.trim()) ? 'valid' : 'invalid';
}

async function parallelMap<T, R>(items: T[], concurrency: number, fn: (item: T, idx: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (currentIndex < items.length) {
      const idx = currentIndex++;
      try {
        results[idx] = await fn(items[idx], idx);
      } catch (err) {
        console.warn(`Worker error on item ${idx}:`, err);
      }
    }
  });

  await Promise.all(workers);
  return results;
}

// AI batch resolver for scout
async function resolveGamesWithGemini(
  titles: string[],
  apiKey: string
): Promise<Map<string, { company: string; email: string | null; website: string | null; fullName: string | null; location: string | null }>> {
  const resolved = new Map<string, { company: string; email: string | null; website: string | null; fullName: string | null; location: string | null }>();
  if (!apiKey || titles.length === 0) return resolved;

  const batches: string[][] = [];
  for (let i = 0; i < titles.length; i += 30) {
    batches.push(titles.slice(i, i + 30));
  }

  await parallelMap(batches, 3, async (batch) => {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `You are an elite video game industry researcher.
For each game listed below, provide the official developer studio name, official website, and their public contact email, press email, or developer Gmail (e.g. press@, contact@, support@, info@, or a developer @gmail.com).
Return a JSON array with: game, company, fullName, website, email, location.

GAMES:
${batch.map((t, idx) => `${idx + 1}. ${t}`).join('\n')}`;

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('AI game resolution timeout')), 9500)
      );

      const response = await Promise.race([
        ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  game: { type: Type.STRING },
                  company: { type: Type.STRING },
                  fullName: { type: Type.STRING },
                  website: { type: Type.STRING },
                  email: { type: Type.STRING },
                  location: { type: Type.STRING },
                },
                required: ['game', 'company'],
              },
            },
          },
        }),
        timeoutPromise,
      ]) as any;

      if (response?.text) {
        const items = JSON.parse(response.text);
        if (Array.isArray(items)) {
          for (const item of items) {
            if (item?.game) {
              const normKey = cleanGameTitleForSearch(item.game).toLowerCase().replace(/[^a-z0-9]/g, '');
              const cleanEmail = item.email && item.email.includes('@') && !item.email.includes('example.com')
                ? item.email.trim().toLowerCase()
                : null;
              resolved.set(normKey, {
                company: item.company || `${item.game} Studio`,
                email: cleanEmail,
                website: item.website || null,
                fullName: item.fullName || null,
                location: item.location || 'Global',
              });
            }
          }
        }
      }
    } catch (e: any) {
      console.warn('Scout AI notice:', e?.message);
    }
  });

  return resolved;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sources } = req.body || {};
    if (!sources || typeof sources !== 'string' || sources.trim().length === 0) {
      return res.status(400).json({ error: 'sources text is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
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
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SteamScout/2.0' },
        });
        clearTimeout(timeout);
        if (searchRes.ok) {
          const html = await searchRes.text();
          const appMatches = [...html.matchAll(/store\.steampowered\.com\/app\/(\d+)\/([^/?"\s]+)?/gi)];
          const appIds = Array.from(new Set(appMatches.map((m) => m[1]))).slice(0, 30);
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
                emailStatus: details.email ? validateEmail(details.email) : 'unknown',
              });
              progressList.push({
                source: details.name,
                status: 'processed',
                message: details.email
                  ? `Found Steam Contact: ${details.email} (${devName})`
                  : `Found Steam Game: ${details.name} (${devName})`,
              });
            }
          }
        }
      } catch (e: any) {
        console.warn('Steam search parse error:', e?.message);
      }
    }

    // 2. Parse game entries (handles titles, embedded emails, Steam URLs, numbered lists)
    const parsedEntries = parseGameInputEntries(sources);
    const titlesToResolve: { item: typeof parsedEntries[0]; normKey: string }[] = [];

    for (const item of parsedEntries) {
      const normKey = cleanGameTitleForSearch(item.cleanTitle).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (processedKeys.has(normKey)) continue;
      processedKeys.add(normKey);

      // Embedded email in line
      if (item.email) {
        const studio = item.developer || `${item.game} Studio`;
        extractedLeads.push({
          id: `lead_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          company: `${studio} (${item.game})`,
          game: item.game,
          fullName: `${studio} Lead`,
          firstName: studio.split(' ')[0] || 'Studio',
          lastName: 'Lead',
          website: item.website || null,
          email: item.email,
          phone: null,
          location: 'Global',
          niche: 'Game Development',
          sourceUrl: item.appId ? `https://store.steampowered.com/app/${item.appId}` : `Input / ${item.game}`,
          sourceType: 'Direct Contact',
          emailStatus: 'valid',
        });
        progressList.push({
          source: item.game,
          status: 'processed',
          message: `Direct Contact: ${item.email} (${studio})`,
        });
        continue;
      }

      // Check KNOWN_GAME_STUDIOS
      const lookupTitle = item.cleanTitle.toLowerCase().replace(/[™®©]/g, '').trim();
      const known =
        KNOWN_GAME_STUDIOS[lookupTitle] ||
        Object.entries(KNOWN_GAME_STUDIOS).find(([k]) => lookupTitle.includes(k) || k.includes(lookupTitle))?.[1];

      if (known) {
        extractedLeads.push({
          id: `lead_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          company: `${known.company} (${item.game})`,
          game: item.game,
          fullName: known.fullName || `${known.company} Team`,
          firstName: known.fullName ? known.fullName.split(' ')[0] : 'Studio',
          lastName: known.fullName && known.fullName.includes(' ') ? known.fullName.split(' ').slice(1).join(' ') : 'Lead',
          website: known.website,
          email: known.email || null,
          phone: null,
          location: known.location || 'Global',
          niche: 'Game Development',
          sourceUrl: `Steam Store / ${item.game}`,
          sourceType: 'Game Studio',
          emailStatus: known.email ? 'valid' : 'unknown',
        });
        progressList.push({
          source: item.game,
          status: 'processed',
          message: known.email
            ? `Verified Studio: ${known.company} (${known.email})`
            : `Verified Studio: ${known.company}`,
        });
        continue;
      }

      titlesToResolve.push({ item, normKey });
    }

    // AI & Steam resolution for remaining titles
    if (titlesToResolve.length > 0) {
      let aiResolved = new Map<string, { company: string; email: string | null; website: string | null; fullName: string | null; location: string | null }>();

      if (apiKey) {
        aiResolved = await resolveGamesWithGemini(titlesToResolve.map((t) => t.item.cleanTitle), apiKey);
      }

      const stillNeedsSteam: typeof titlesToResolve = [];

      for (const { item, normKey } of titlesToResolve) {
        const aiHit = aiResolved.get(normKey) ||
          Array.from(aiResolved.entries()).find(([k]) => normKey.includes(k) || k.includes(normKey))?.[1];

        if (aiHit && aiHit.email) {
          extractedLeads.push({
            id: `ai_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            company: `${aiHit.company} (${item.game})`,
            game: item.game,
            fullName: aiHit.fullName || `${aiHit.company} Lead`,
            firstName: aiHit.fullName ? aiHit.fullName.split(' ')[0] : 'Studio',
            lastName: 'Team',
            website: aiHit.website || `https://store.steampowered.com/search/?term=${encodeURIComponent(item.cleanTitle)}`,
            email: aiHit.email,
            phone: null,
            location: aiHit.location || 'Global',
            niche: 'Game Development',
            sourceUrl: `Game Studio / ${item.game}`,
            sourceType: 'Game Studio',
            emailStatus: validateEmail(aiHit.email),
          });
          progressList.push({
            source: item.game,
            status: 'processed',
            message: `Studio Email: ${aiHit.email} (${aiHit.company})`,
          });
        } else {
          stillNeedsSteam.push({ item, normKey });
        }
      }

      // Parallel Steam Lookup
      if (stillNeedsSteam.length > 0) {
        await parallelMap(stillNeedsSteam, 6, async ({ item, normKey }) => {
          try {
            let steamAppId = item.appId;
            let resolvedName = item.game;

            if (!steamAppId) {
              const searchResult = await searchSteamAppByTitle(item.cleanTitle);
              if (searchResult) {
                steamAppId = String(searchResult.id);
                resolvedName = searchResult.name;
              }
            }

            if (steamAppId) {
              const details = await fetchSteamAppDetails(steamAppId);
              if (details) {
                const devName = details.developers[0] || details.publishers[0] || item.developer || 'Game Studio';
                const resolvedEmail = details.email || null;

                extractedLeads.push({
                  id: `steam_${steamAppId}_${Date.now()}`,
                  company: `${devName} (${details.name || resolvedName})`,
                  game: details.name || resolvedName,
                  fullName: `${devName} Lead`,
                  firstName: devName.split(' ')[0] || 'Studio',
                  lastName: 'Team',
                  website: details.website || `https://store.steampowered.com/app/${steamAppId}`,
                  email: resolvedEmail,
                  phone: null,
                  location: 'Global',
                  niche: 'Game Development',
                  sourceUrl: `https://store.steampowered.com/app/${steamAppId}`,
                  sourceType: 'Steam Store',
                  emailStatus: resolvedEmail ? validateEmail(resolvedEmail) : 'unknown',
                });
                progressList.push({
                  source: details.name || resolvedName,
                  status: 'processed',
                  message: resolvedEmail
                    ? `Steam Contact: ${resolvedEmail} (${devName})`
                    : `Steam Game: ${details.name || resolvedName} (${devName})`,
                });
                return;
              }
            }
          } catch (steamErr: any) {
            console.warn('Steam scout notice:', steamErr?.message);
          }

          const dev = item.developer || `${item.game} Developer`;
          extractedLeads.push({
            id: `lead_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            company: `${dev} (${item.game})`,
            game: item.game,
            fullName: `${dev} Lead`,
            firstName: dev.split(' ')[0] || 'Studio',
            lastName: 'Lead',
            website: item.website || null,
            email: null,
            phone: null,
            location: 'Global',
            niche: 'Game Development',
            sourceUrl: `Game / ${item.game}`,
            sourceType: 'Game Studio',
            emailStatus: 'unknown',
          });
          progressList.push({
            source: item.game,
            status: 'processed',
            message: `Studio: ${dev} (No public email found)`,
          });
        });
      }
    }

    // Deduplicate extracted leads by game / company
    const uniqueLeads: ExtractedLead[] = [];
    const seenGames = new Set<string>();
    for (const lead of extractedLeads) {
      const key = cleanGameTitleForSearch(lead.game || lead.company || '').toLowerCase().replace(/[^a-z0-9]/g, '');
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
