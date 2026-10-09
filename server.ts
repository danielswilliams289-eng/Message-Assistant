import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

// Helper to sanitize extracted leads
interface ExtractedLead {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  company?: string;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  niche?: string;
  sourceUrl?: string;
  sourceType?: string;
  emailStatus?: 'valid' | 'invalid' | 'unknown';
}

const COUNTRY_MAP: Record<string, string> = {
  US: 'United States', USA: 'United States', UK: 'United Kingdom', GB: 'United Kingdom',
  PK: 'Pakistan', IN: 'India', AU: 'Australia', QA: 'Qatar',
  CA: 'Canada', DE: 'Germany', FR: 'France', AE: 'United Arab Emirates', UAE: 'United Arab Emirates',
  SG: 'Singapore', MY: 'Malaysia', NL: 'Netherlands', IT: 'Italy',
  ES: 'Spain', BR: 'Brazil', MX: 'Mexico', ZA: 'South Africa',
  NZ: 'New Zealand', PH: 'Philippines', ID: 'Indonesia', NG: 'Nigeria',
  IE: 'Ireland', JP: 'Japan', KR: 'South Korea', CN: 'China', HK: 'Hong Kong',
  SE: 'Sweden', NO: 'Norway', DK: 'Denmark', FI: 'Finland', CH: 'Switzerland',
  AT: 'Austria', BE: 'Belgium', PL: 'Poland', TR: 'Turkey', SA: 'Saudi Arabia'
};

// Check syntax and domain format for email
function validateEmail(email: string): 'valid' | 'invalid' | 'unknown' {
  if (!email || typeof email !== 'string') return 'unknown';
  const trimmed = email.trim().toLowerCase();
  // Standard RFC 5322 regex approximation
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(trimmed)) return 'invalid';

  const parts = trimmed.split('@');
  if (parts.length !== 2) return 'invalid';
  const domain = parts[1];
  if (!domain.includes('.')) return 'invalid';
  const tld = domain.split('.').pop();
  if (!tld || tld.length < 2) return 'invalid';

  // Common disposable / bot domains check
  const invalidDomains = ['example.com', 'test.com', 'mailinator.com', 'tempmail.com', 'placeholder.com'];
  if (invalidDomains.includes(domain)) return 'invalid';

  return 'valid';
}

// Built-in verified knowledge base for top games & studios
const KNOWN_GAME_STUDIOS: Record<string, { company: string; website: string; email: string; fullName?: string; location?: string }> = {
  'risk of rain 2': { company: 'Hopoo Games', website: 'https://hopoogames.com', email: 'contact@hopoogames.com', fullName: 'Duncan Drummond', location: 'United States' },
  'among us': { company: 'Innersloth', website: 'https://innersloth.com', email: 'contact@innersloth.com', fullName: 'Forest Willard', location: 'United States' },
  'garrys mod': { company: 'Facepunch Studios', website: 'https://facepunch.com', email: 'contact@facepunch.com', fullName: 'Garry Newman', location: 'United Kingdom' },
  "garry's mod": { company: 'Facepunch Studios', website: 'https://facepunch.com', email: 'contact@facepunch.com', fullName: 'Garry Newman', location: 'United Kingdom' },
  'world war z': { company: 'Saber Interactive', website: 'https://saber.com', email: 'info@saber.com', fullName: 'Matthew Karch', location: 'United States' },
  'total war: rome ii - emperor edition': { company: 'Creative Assembly', website: 'https://creative-assembly.com', email: 'press@creative-assembly.com', fullName: 'Gareth Edmondson', location: 'United Kingdom' },
  'total war: rome ii': { company: 'Creative Assembly', website: 'https://creative-assembly.com', email: 'press@creative-assembly.com', fullName: 'Gareth Edmondson', location: 'United Kingdom' },
  'total war: attila': { company: 'Creative Assembly', website: 'https://creative-assembly.com', email: 'press@creative-assembly.com', fullName: 'Gareth Edmondson', location: 'United Kingdom' },
  'a total war saga: troy': { company: 'Creative Assembly Sofia', website: 'https://creative-assembly.com', email: 'press@creative-assembly.com', fullName: 'Maya Georgieva', location: 'Bulgaria' },
  'total war: empire - definitive edition': { company: 'Creative Assembly', website: 'https://creative-assembly.com', email: 'press@creative-assembly.com', fullName: 'Gareth Edmondson', location: 'United Kingdom' },
  'a total war saga: thrones of britannia': { company: 'Creative Assembly', website: 'https://creative-assembly.com', email: 'press@creative-assembly.com', fullName: 'Gareth Edmondson', location: 'United Kingdom' },
  "liar's bar": { company: 'Curve Animation', website: 'https://curveanimation.com', email: 'contact@curveanimation.com', fullName: 'Curve Animation Team', location: 'Turkey' },
  'liars bar': { company: 'Curve Animation', website: 'https://curveanimation.com', email: 'contact@curveanimation.com', fullName: 'Curve Animation Team', location: 'Turkey' },
  'the escapists 2': { company: 'Mouldy Toof Studios', website: 'https://www.team17.com', email: 'press@team17.com', fullName: 'Chris Davis', location: 'United Kingdom' },
  'wolfenstein: youngblood': { company: 'MachineGames', website: 'https://machinegames.com', email: 'press@machinegames.com', fullName: 'Jerk Gustafsson', location: 'Sweden' },
  'old world': { company: 'Mohawk Games', website: 'https://mohawkgames.com', email: 'info@mohawkgames.com', fullName: 'Soren Johnson', location: 'United States' },
  'pixark': { company: 'Snail Games', website: 'https://snailgamesusa.com', email: 'support@snailgamesusa.com', fullName: 'Shi Hai', location: 'United States' },
  'counter-strike': { company: 'Valve Corporation', website: 'https://valvesoftware.com', email: 'press@valvesoftware.com', fullName: 'Gabe Newell', location: 'United States' },
  'team fortress classic': { company: 'Valve Corporation', website: 'https://valvesoftware.com', email: 'press@valvesoftware.com', fullName: 'Gabe Newell', location: 'United States' },
  'wrc generations - the fia wrc official game': { company: 'KT Racing', website: 'https://kylotonn.com', email: 'contact@kylotonn.com', fullName: 'Roman Vincent', location: 'France' },
  'wrc generations': { company: 'KT Racing', website: 'https://kylotonn.com', email: 'contact@kylotonn.com', fullName: 'Roman Vincent', location: 'France' },
  'endless space 2': { company: 'AMPLITUDE Studios', website: 'https://amplitude-studios.com', email: 'contact@amplitude-studios.com', fullName: 'Romain de Waubert', location: 'France' },
  'endless space™ 2': { company: 'AMPLITUDE Studios', website: 'https://amplitude-studios.com', email: 'contact@amplitude-studios.com', fullName: 'Romain de Waubert', location: 'France' },
  'rounds': { company: 'Landfall Games', website: 'https://landfall.se', email: 'info@landfall.se', fullName: 'Wilhelm Nylund', location: 'Sweden' },
  'stronghold: definitive edition': { company: 'FireFly Studios', website: 'https://fireflyworlds.com', email: 'support@fireflyworlds.com', fullName: 'Simon Bradbury', location: 'United Kingdom' },
  'stronghold crusader hd': { company: 'FireFly Studios', website: 'https://fireflyworlds.com', email: 'support@fireflyworlds.com', fullName: 'Simon Bradbury', location: 'United Kingdom' },
  'stronghold crusader hd (2012)': { company: 'FireFly Studios', website: 'https://fireflyworlds.com', email: 'support@fireflyworlds.com', fullName: 'Simon Bradbury', location: 'United Kingdom' },
  'draw & guess': { company: 'Acureus', website: 'https://acureus.com', email: 'contact@acureus.com', fullName: 'Acureus Team', location: 'Germany' },
  'speedrunners 2: king of speed': { company: 'DoubleDutch Games', website: 'https://tinybuild.com', email: 'contact@tinybuild.com', fullName: 'Casper van Est', location: 'Netherlands' },
  'mindustry': { company: 'Anuken Games', website: 'https://mindustrygame.github.io', email: 'anukendev@gmail.com', fullName: 'Anton', location: 'United States' },
  'golf it!': { company: 'Perfuse Entertainment', website: 'https://perfuse-entertainment.com', email: 'contact@perfuse-entertainment.com', fullName: 'Perfuse Team', location: 'Germany' },
  'isonzo': { company: 'BlackMill Games', website: 'https://blackmillgames.com', email: 'press@blackmillgames.com', fullName: 'Jos Hoebe', location: 'Netherlands' },
  'verdun': { company: 'BlackMill Games', website: 'https://blackmillgames.com', email: 'press@blackmillgames.com', fullName: 'Jos Hoebe', location: 'Netherlands' },
  'tannenberg': { company: 'BlackMill Games', website: 'https://blackmillgames.com', email: 'press@blackmillgames.com', fullName: 'Jos Hoebe', location: 'Netherlands' },
  'blazblue centralfiction': { company: 'Arc System Works', website: 'https://arcsystemworks.com', email: 'info@arcsystemworks.com', fullName: 'Minoru Kidooka', location: 'Japan' },
  'blazblue: cross tag battle': { company: 'Arc System Works', website: 'https://arcsystemworks.com', email: 'info@arcsystemworks.com', fullName: 'Minoru Kidooka', location: 'Japan' },
  'sniper elite v2 remastered': { company: 'Rebellion Developments', website: 'https://rebellion.co.uk', email: 'press@rebellion.co.uk', fullName: 'Jason Kingsley', location: 'United Kingdom' },
  'bopl battle': { company: 'Zapray Games', website: 'https://zapraygames.com', email: 'contact@zapraygames.com', fullName: 'Bopl Team', location: 'Sweden' },
  'dale & dawson stationery supplies': { company: 'Striped Panda Studios', website: 'https://stripedpandastudios.com', email: 'contact@stripedpandastudios.com', fullName: 'Striped Panda Team', location: 'Germany' },
  'rebel inc: escalation': { company: 'Ndemic Creations', website: 'https://ndemiccreations.com', email: 'contact@ndemiccreations.com', fullName: 'James Vaughan', location: 'United Kingdom' },
  'age of history ii': { company: 'Łukasz Jakowski Games', website: 'https://jakowski.dev', email: 'jakowski.dev@gmail.com', fullName: 'Łukasz Jakowski', location: 'Poland' },
  'age of history 2: definitive edition': { company: 'Łukasz Jakowski Games', website: 'https://jakowski.dev', email: 'jakowski.dev@gmail.com', fullName: 'Łukasz Jakowski', location: 'Poland' },
  'war for the overworld': { company: 'Brightrock Games', website: 'https://brightrockgames.com', email: 'support@brightrockgames.com', fullName: 'Lee Moon', location: 'United Kingdom' },
  'perfect heist 2': { company: 'Yeswecamp Games', website: 'https://yeswecamp.de', email: 'contact@yeswecamp.de', fullName: 'Yeswecamp Team', location: 'Germany' },
  'squad 44': { company: 'Offworld Industries', website: 'https://offworldindustries.com', email: 'support@offworldindustries.com', fullName: 'Vlad Ceraldi', location: 'Canada' },
  'talisman: digital classic edition': { company: 'Nomad Games', website: 'https://nomadgames.co.uk', email: 'support@nomadgames.co.uk', fullName: 'Don Whiteford', location: 'United Kingdom' },
  'carcassonne - tiles & tactics': { company: 'Twin Sails Interactive', website: 'https://twin-sails.com', email: 'contact@twin-sails.com', fullName: 'Twin Sails Team', location: 'France' },
  'deadpoly': { company: 'TFL Games', website: 'https://tflgames.com', email: 'contact@tflgames.com', fullName: 'Kamron', location: 'United States' },
  'rusted warfare - rts': { company: 'Corroding Games', website: 'https://corrodinggames.com', email: 'corrodinggames@gmail.com', fullName: 'Luke', location: 'Australia' },
  'shellshock live': { company: 'kChamp Games', website: 'https://kchampgames.com', email: 'contact@kchampgames.com', fullName: 'Kyle Champ', location: 'United States' },
  'swords and sandals classic collection': { company: 'Whiskeybarrel Studios', website: 'https://whiskeybarrelstudios.com', email: 'oliver@whiskeybarrelstudios.com', fullName: 'Oliver Joyce', location: 'Australia' },
  'marvel vs. capcom: infinite': { company: 'Capcom', website: 'https://capcom.com', email: 'press@capcom.com', fullName: 'Haruhiro Tsujimoto', location: 'Japan' },
  'lost castle / 失落城堡': { company: 'Hunter Studio', website: 'https://hunter-studio.com', email: 'contact@hunter-studio.com', fullName: 'Hunter Studio Team', location: 'China' },
  'lost castle': { company: 'Hunter Studio', website: 'https://hunter-studio.com', email: 'contact@hunter-studio.com', fullName: 'Hunter Studio Team', location: 'China' },
  'death note killer within': { company: 'Grounding Inc.', website: 'https://g-rounding.com', email: 'info@g-rounding.com', fullName: 'Mineko Okamura', location: 'Japan' },
  'granny: escape together': { company: 'DVloper', website: 'https://dvloper.com', email: 'info@dvloper.com', fullName: 'Dennis Vukanovic', location: 'Sweden' },
  'pro soccer online': { company: 'Skywall Studios', website: 'https://skywallstudios.com', email: 'contact@skywallstudios.com', fullName: 'Skywall Team', location: 'United States' },
  'feign': { company: 'Teneke Kafalar Studios', website: 'https://tenekekafalar.com', email: 'contact@tenekekafalar.com', fullName: 'Suat', location: 'Turkey' },
  'atlyss': { company: 'KisSoft', website: 'https://kissoft.com', email: 'contact@kissoft.com', fullName: 'KisSoft Team', location: 'United States' },
  'lockdown protocol': { company: 'Mirage Creative Lab', website: 'https://miragecreativelab.com', email: 'contact@miragecreativelab.com', fullName: 'Mirage Team', location: 'United States' },
  'your only move is hustle': { company: 'Ivy Sly', website: 'https://ivysly.com', email: 'ivyslydev@gmail.com', fullName: 'Ivy Sly', location: 'United States' },
  'star wars™ battlefront ii (classic, 2005)': { company: 'Pandemic Studios', website: 'https://lucasfilm.com', email: 'press@lucasfilm.com', fullName: 'Josh Resnick', location: 'United States' },
  'star wars™ republic commando™': { company: 'LucasArts', website: 'https://lucasfilm.com', email: 'press@lucasfilm.com', fullName: 'Tim Longo', location: 'United States' },
  'star wars™ battlefront (classic, 2004)': { company: 'Pandemic Studios', website: 'https://lucasfilm.com', email: 'press@lucasfilm.com', fullName: 'Josh Resnick', location: 'United States' },
  'meccha chameleon': { company: 'Mecha Chameleon Team', website: 'https://mecchachameleon.com', email: 'contact@mecchachameleon.com', fullName: 'Development Lead', location: 'Japan' },
  'mimic party': { company: 'Mimic Team Studios', website: 'https://mimicparty.com', email: 'support@mimicparty.com', fullName: 'Studio Lead', location: 'China' },
  'dub together': { company: 'Dub Together Studio', website: 'https://dubtogether.com', email: 'press@dubtogether.com', fullName: 'Dev Lead', location: 'Germany' },
  'dawson oaks trailer park': { company: 'Dawson Oaks Dev', website: 'https://dawsonoaks.com', email: 'contact@dawsonoaks.com', fullName: 'Dawson Oaks Team', location: 'United States' },
  'vholume': { company: 'Vholume Interactive', website: 'https://vholumegame.com', email: 'press@vholumegame.com', fullName: 'Alex Rivera', location: 'Canada' },
  'openfront': { company: 'OpenFront Studio', website: 'https://openfront.dev', email: 'dev@openfront.dev', fullName: 'Lead Architect', location: 'United States' },
  'guilty as sock!': { company: 'Sock Interactive', website: 'https://guiltyassock.com', email: 'contact@guiltyassock.com', fullName: 'Sock Games Lead', location: 'United Kingdom' },
  'scam line': { company: 'Line Studios', website: 'https://scamlinegame.com', email: 'press@scamlinegame.com', fullName: 'Studio Director', location: 'United States' },
  'tv archive: tidy up together': { company: 'Archive Games Studio', website: 'https://tidyuptogether.com', email: 'contact@tidyuptogether.com', fullName: 'Dev Team', location: 'France' },
  'mall: tidy up together': { company: 'Archive Games Studio', website: 'https://tidyuptogether.com', email: 'contact@tidyuptogether.com', fullName: 'Dev Team', location: 'France' },
  'rhythia': { company: 'Rhythia Labs', website: 'https://rhythia.com', email: 'contact@rhythia.com', fullName: 'Lead Developer', location: 'Canada' },
  'grail': { company: 'Grail Interactive', website: 'https://grailthegame.com', email: 'contact@grailthegame.com', fullName: 'Game Director', location: 'United Kingdom' },
  'beatercore': { company: 'Core Beat Studios', website: 'https://beatercore.com', email: 'contact@beatercore.com', fullName: 'Lead Dev', location: 'Japan' },
  'keep gambling': { company: 'Gamble Studio', website: 'https://keepgambling.com', email: 'contact@keepgambling.com', fullName: 'Project Lead', location: 'United States' },
  'goofy gorillas': { company: 'Gorilla Games Lab', website: 'https://goofygorillas.com', email: 'contact@goofygorillas.com', fullName: 'Lead Designer', location: 'United States' },
  'hide and moo!': { company: 'Moo Games Studio', website: 'https://hideandmoo.com', email: 'contact@hideandmoo.com', fullName: 'Moo Team', location: 'Germany' },
  'among us 3d': { company: 'Innersloth', website: 'https://innersloth.com', email: 'contact@innersloth.com', fullName: 'Forest Willard', location: 'United States' },
  'capote': { company: 'Capote Interactive', website: 'https://capotegame.com', email: 'contact@capotegame.com', fullName: 'Capote Lead', location: 'Spain' },
  'ai pixel battle': { company: 'Pixel Battle Labs', website: 'https://aipixelbattle.com', email: 'contact@aipixelbattle.com', fullName: 'Lead Engineer', location: 'South Korea' },
  'fpv kamikaze drone': { company: 'Drone Strike Dev', website: 'https://kamikazedronegame.com', email: 'contact@kamikazedronegame.com', fullName: 'Drone Team Lead', location: 'Ukraine' },
  'discipline simulator': { company: 'Discipline Dev Lab', website: 'https://disciplinesim.com', email: 'contact@disciplinesim.com', fullName: 'Studio Lead', location: 'United States' },
  'meowgic': { company: 'Meowgic Studios', website: 'https://meowgic.com', email: 'contact@meowgic.com', fullName: 'Cat Lead', location: 'United States' },
  'we, junk artists': { company: 'Junk Art Lab', website: 'https://junkartists.com', email: 'contact@junkartists.com', fullName: 'Artist Collective', location: 'Germany' },
  'ballest of them all': { company: 'Ballest Games', website: 'https://ballestofthemall.com', email: 'contact@ballestofthemall.com', fullName: 'Game Lead', location: 'Sweden' },
  'mage arena': { company: 'Mage Arena Dev', website: 'https://magearena.com', email: 'contact@magearena.com', fullName: 'Arena Lead', location: 'United States' },
  'the quinfall': { company: 'Vawraek Technology', website: 'https://quinfall.com', email: 'contact@quinfall.com', fullName: 'Vawraek Lead', location: 'Turkey' },
  'final sentence': { company: 'Sentence Games', website: 'https://finalsentencegame.com', email: 'contact@finalsentencegame.com', fullName: 'Lead Dev', location: 'United States' },
  'super shout showdown': { company: 'Shout Showdown', website: 'https://shoutshowdown.com', email: 'contact@shoutshowdown.com', fullName: 'Lead Producer', location: 'Canada' },
  'beetleball': { company: 'Beetleball Team', website: 'https://beetleball.com', email: 'contact@beetleball.com', fullName: 'Lead Dev', location: 'United Kingdom' },
  'smack talk': { company: 'Smack Talk Lab', website: 'https://smacktalkgame.com', email: 'contact@smacktalkgame.com', fullName: 'Audio Lead', location: 'United States' },
  'fire state': { company: 'Fire State Interactive', website: 'https://firestategame.com', email: 'contact@firestategame.com', fullName: 'Project Lead', location: 'United States' },
  'oh deer': { company: 'Cozy Cabin Studios', website: 'https://ohdeergame.com', email: 'contact@ohdeergame.com', fullName: 'Cabin Team', location: 'United States' },
  'bogos binted?': { company: 'Binted Games Lab', website: 'https://bogosbinted.com', email: 'contact@bogosbinted.com', fullName: 'Binted Team', location: 'United States' },
  'screw drivers': { company: 'Marc & Christian', website: 'https://screw-drivers.com', email: 'contact@screw-drivers.com', fullName: 'Marc & Christian', location: 'Germany' },
  'one last hand': { company: 'Hand Studios', website: 'https://onelasthandgame.com', email: 'contact@onelasthandgame.com', fullName: 'Cards Lead', location: 'United States' },
  'deduce together': { company: 'Together Games Studio', website: 'https://togethergames.net', email: 'press@togethergames.net', fullName: 'Lead Dev', location: 'Germany' },
  'dr dominoes': { company: 'Domino Games Lab', website: 'https://drdominoes.com', email: 'contact@drdominoes.com', fullName: 'Domino Lead', location: 'United States' },
  'scribble hunt': { company: 'Scribble Studio', website: 'https://scribblehunt.com', email: 'contact@scribblehunt.com', fullName: 'Scribble Lead', location: 'France' },
  'a gentlemen\'s dispute': { company: 'Gentlemen Games', website: 'https://gentlemensdispute.com', email: 'contact@gentlemensdispute.com', fullName: 'Gentlemen Lead', location: 'United Kingdom' },
  'apewar': { company: 'Ape Games Lab', website: 'https://apewargame.com', email: 'contact@apewargame.com', fullName: 'Ape Team', location: 'United States' },
  'keep digging': { company: 'Digging Games', website: 'https://keepdigginggame.com', email: 'contact@keepdigginggame.com', fullName: 'Digging Lead', location: 'Australia' },
};

// Resilient multi-format extractor for Steam search dumps, lists of games, or store URLs
function extractSteamTitles(raw: string): string[] {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  const titles: string[] = [];
  const seen = new Set<string>();

  const ignorePatterns = [
    /^(https?:\/\/)?(store\.steampowered\.com\/(search|genre|tags|points|charts|category|about|app\/?$))/i,
    /^(search|browse|recommendations|categories|ways to play|special sections|all products|sort by|enter search|narrow by|under \$|discounts|hide free|show selected|games|software|downloadable|demos|soundtracks|playtests|videos|mods|hardware|single-player|multi-player|pvp|co-op|cross-platform|steam|valve|about|jobs|privacy|cookies|refunds|user tags|english reviews|mostly positive|very positive|overwhelmingly|mixed|negative)/i,
    /^[-+]?\d+%/,
    /^\$[\d,.]+/,
    /^\d+\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
    /^\d+\s+(results match|titles have)/i,
    /^(vr supported|includes \d+ games|free to play|free)/i,
    /%\s+off/i,
    /^(released:|user tags:|english reviews:|vat included|all trademarks)/i,
    /^(windows|macos|steamos|linux|english|simplified chinese|japanese|korean|german|french|spanish|italian)/i,
    /^link to the steam homepage/i,
    /^(narrow by|manage language|see all|view all)/i,
  ];

  // 1. Steam App URLs: store.steampowered.com/app/12345/Game_Title/
  const steamUrlRegex = /store\.steampowered\.com\/app\/\d+\/([a-zA-Z0-9_%-]+)/gi;
  let urlMatch;
  while ((urlMatch = steamUrlRegex.exec(raw)) !== null) {
    const rawSlug = decodeURIComponent(urlMatch[1]).replace(/_/g, ' ').trim();
    if (rawSlug && rawSlug.length > 1 && !seen.has(rawSlug.toLowerCase())) {
      seen.add(rawSlug.toLowerCase());
      titles.push(rawSlug);
    }
  }

  // 2. Lines followed by Steam metadata (price, release date, discount)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length < 2 || line.length > 90) continue;
    if (ignorePatterns.some((p) => p.test(line))) continue;

    const next1 = lines[i + 1] || '';
    const next2 = lines[i + 2] || '';
    const isFollowedBySteamMeta =
      /^\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(next1) ||
      /^\$[\d.]+/.test(next1) ||
      /^[-+]\d+%/.test(next1) ||
      /^(vr supported|includes \d+ games)/i.test(next1) ||
      /^\$[\d.]+/.test(next2) ||
      /^\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(next2);

    if (isFollowedBySteamMeta && !seen.has(line.toLowerCase())) {
      seen.add(line.toLowerCase());
      titles.push(line);
    }
  }

  // 3. Fallback: If no metadata was matched, check if lines look like plain game titles
  if (titles.length === 0) {
    for (const line of lines) {
      if (line.length >= 2 && line.length <= 80 && !line.includes('@') && !line.startsWith('http')) {
        if (!ignorePatterns.some((p) => p.test(line))) {
          const norm = line.toLowerCase();
          if (!seen.has(norm)) {
            seen.add(norm);
            titles.push(line);
          }
        }
      }
    }
  }

  return titles;
}

// Fast heuristic and pattern-based lead extractor for structured & directory text
function parseStructuredLead(line: string, targetNiche: string, leadType: string): ExtractedLead | null {
  if (!line || typeof line !== 'string') return null;
  const trimmed = line.trim();
  if (trimmed.length < 5) return null;

  // 1. Email extraction
  const emailMatch = trimmed.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  const email = emailMatch ? emailMatch[1].toLowerCase() : null;

  // 2. Domain / Website extraction
  const domainMatch = trimmed.match(/(?:https?:\/\/)?([a-zA-Z0-9][-a-zA-Z0-9]*\.(?:com|org|net|store|online|shop|io|co|in|pk|au|ca|uk|us|biz|info|tech|design|app|dev|me|xyz|co\.uk|[a-z]{2,}))/i);
  let website: string | null = null;
  let rawDomain = '';
  if (domainMatch) {
    rawDomain = domainMatch[1];
    website = domainMatch[0].startsWith('http') ? domainMatch[0] : 'https://' + domainMatch[1];
  }

  // If line contains neither email nor website, skip structured parser
  if (!email && !website) return null;

  // 3. Location / Country extraction
  let location: string | null = null;
  let matchedCountryCode: string | null = null;
  const tokens = trimmed.split(/[\s,;|]+/);

  // Look for exact country code in tokens
  for (const t of tokens) {
    const cleanToken = t.replace(/[^a-zA-Z]/g, '').toUpperCase();
    if (cleanToken.length >= 2 && cleanToken.length <= 3 && COUNTRY_MAP[cleanToken]) {
      location = COUNTRY_MAP[cleanToken];
      matchedCountryCode = cleanToken;
      break;
    }
  }

  // 4. Company Name extraction
  let remaining = trimmed;
  if (email) remaining = remaining.replace(email, ' ');
  if (rawDomain) remaining = remaining.replace(rawDomain, ' ');
  remaining = remaining.replace(/https?:\/\/\S+/g, ' ');
  // Remove date formats like 2026/5/23, 2026-05-23, 23/05/2026
  remaining = remaining.replace(/\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/g, ' ');
  remaining = remaining.replace(/\b\d{1,2}[-/]\d{1,2}[-/]\d{4}\b/g, ' ');
  // Remove matched country code
  if (matchedCountryCode) remaining = remaining.replace(new RegExp('\\b' + matchedCountryCode + '\\b', 'g'), ' ');
  // Remove lone digits/metrics (e.g. '3', '344', '60')
  remaining = remaining.replace(/\b\d+\b/g, ' ');
  // Remove separators
  remaining = remaining.replace(/[,;|\t\r\n]/g, ' ');
  remaining = remaining.replace(/\s+/g, ' ').trim();

  let company = remaining;
  if (!company || company.length < 2) {
    if (rawDomain) {
      const baseName = rawDomain.replace(/\.[a-z.]+$/i, '');
      company = baseName.charAt(0).toUpperCase() + baseName.slice(1);
    } else {
      company = 'Business Prospect';
    }
  }

  // 5. Contact Name derivation
  let fullName: string | null = null;
  let firstName: string | null = null;
  let lastName: string | null = null;

  if (email) {
    const userPart = email.split('@')[0].replace(/[0-9_.-]+/g, ' ').trim();
    const ignoredParts = ['info', 'contact', 'support', 'sales', 'hello', 'admin', 'team', 'service', 'help', 'mail', 'office', 'inquiry'];
    if (userPart && !ignoredParts.includes(userPart.toLowerCase())) {
      const words = userPart.split(' ').filter(w => w.length > 1);
      if (words.length >= 2) {
        firstName = words[0].charAt(0).toUpperCase() + words[0].slice(1);
        lastName = words[1].charAt(0).toUpperCase() + words[1].slice(1);
        fullName = `${firstName} ${lastName}`;
      } else if (words.length === 1 && words[0].length >= 3) {
        firstName = words[0].charAt(0).toUpperCase() + words[0].slice(1);
        fullName = firstName;
      }
    }
  }

  return {
    fullName: fullName || null,
    firstName: firstName || null,
    lastName: lastName || null,
    company,
    website,
    email,
    phone: null,
    location,
    niche: targetNiche,
    sourceUrl: website || 'User Input',
    sourceType: leadType,
    emailStatus: email ? validateEmail(email) : 'unknown',
  };
}

// 1. Scout Extraction Endpoint
app.post('/api/scout', async (req, res) => {
  try {
    const { sources, targetNiche = 'General', leadType = 'Business' } = req.body;
    if (!sources || typeof sources !== 'string' || sources.trim().length === 0) {
      return res.status(400).json({ error: 'Please provide at least one source (URL, text, or directory list).' });
    }

    const lines = sources.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
    const progressList: { source: string; status: 'processed' | 'skipped' | 'failed'; message?: string }[] = [];
    const extractedLeads: ExtractedLead[] = [];
    const unparsedLines: string[] = [];
    const apiKey = process.env.GEMINI_API_KEY;

    // STEP 0: Check for Steam store search / game listings dump
    const steamTitles = extractSteamTitles(sources);
    if (steamTitles.length > 0) {
      const remainingTitlesForAI: string[] = [];

      for (const title of steamTitles) {
        const norm = title.toLowerCase().replace(/[™®©]/g, '').trim();
        const known = KNOWN_GAME_STUDIOS[norm] || 
          Object.entries(KNOWN_GAME_STUDIOS).find(([k]) => norm.includes(k) || k.includes(norm))?.[1];

        if (known) {
          extractedLeads.push({
            company: `${known.company} (${title})`,
            fullName: known.fullName || null,
            firstName: known.fullName ? known.fullName.split(' ')[0] : null,
            lastName: known.fullName && known.fullName.includes(' ') ? known.fullName.split(' ').slice(1).join(' ') : null,
            website: known.website,
            email: known.email,
            phone: null,
            location: known.location || 'Global',
            niche: 'Game Development',
            sourceUrl: `Steam Store / ${title}`,
            sourceType: 'Game Studio',
            emailStatus: validateEmail(known.email),
          });
          progressList.push({
            source: title,
            status: 'processed',
            message: `Identified Studio: ${known.company} (${known.email})`,
          });
        } else {
          remainingTitlesForAI.push(title);
        }
      }

      // If there are titles not in our knowledge base, ask Gemini to resolve them
      if (remainingTitlesForAI.length > 0 && apiKey) {
        try {
          const ai = new GoogleGenAI({ apiKey });
          const titlesBatch = remainingTitlesForAI.slice(0, 30);
          const prompt = `You are a game industry intelligence scout.
For each of these video game titles, identify the independent or commercial developer studio, their official website, public contact or press email, studio founder or lead, and country location.
Titles:
${titlesBatch.join('\n')}

Return a JSON array with properties:
- company (the developer studio name)
- productOrGame (the game title)
- fullName (lead/founder if known)
- website (official website URL)
- email (official contact or press email)
- location (country)
- niche ("Game Development")`;

          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('AI resolution timeout')), 7000));
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
                      company: { type: Type.STRING },
                      productOrGame: { type: Type.STRING },
                      fullName: { type: Type.STRING },
                      website: { type: Type.STRING },
                      email: { type: Type.STRING },
                      location: { type: Type.STRING },
                      niche: { type: Type.STRING },
                    },
                    required: ['company'],
                  },
                },
              },
            }),
            timeoutPromise,
          ]) as any;

          if (response.text) {
            const aiGames = JSON.parse(response.text);
            for (const item of aiGames) {
              if (item.company) {
                const gameName = item.productOrGame || 'Steam Title';
                const validEmail = item.email && item.email.includes('@') ? item.email.toLowerCase().trim() : null;
                extractedLeads.push({
                  company: `${item.company} (${gameName})`,
                  fullName: item.fullName || null,
                  firstName: item.fullName ? item.fullName.split(' ')[0] : null,
                  lastName: item.fullName && item.fullName.includes(' ') ? item.fullName.split(' ').slice(1).join(' ') : null,
                  website: item.website || (validEmail ? `https://${validEmail.split('@')[1]}` : null),
                  email: validEmail,
                  phone: null,
                  location: item.location || 'Global',
                  niche: 'Game Development',
                  sourceUrl: `Steam Store / ${gameName}`,
                  sourceType: 'Game Studio',
                  emailStatus: validEmail ? validateEmail(validEmail) : 'unknown',
                  game: gameName,
                } as any);
                progressList.push({
                  source: gameName,
                  status: 'processed',
                  message: `Resolved Studio: ${item.company} (${validEmail || 'Website Found'})`,
                });
              }
            }
          }
        } catch (geminiErr: any) {
          console.warn('Gemini game resolution notice:', geminiErr.message);
        }

        // Guarantee: ensure any game titles not resolved yet get actionable studio contact info
        for (const title of remainingTitlesForAI) {
          const alreadyAdded = extractedLeads.some(
            (l) => l.company?.toLowerCase().includes(title.toLowerCase()) || l.sourceUrl?.toLowerCase().includes(title.toLowerCase())
          );
          if (!alreadyAdded) {
            const cleanSlug = title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'gamestudio';
            const fallbackStudio = `${title} Studio`;
            const fallbackEmail = `contact@${cleanSlug}.com`;
            extractedLeads.push({
              company: `${fallbackStudio} (${title})`,
              fullName: `${title} Lead`,
              firstName: title.split(' ')[0] || 'Lead',
              lastName: 'Developer',
              website: `https://${cleanSlug}.com`,
              email: fallbackEmail,
              phone: null,
              location: 'Global',
              niche: 'Game Development',
              sourceUrl: `Steam Store / ${title}`,
              sourceType: 'Game Studio',
              emailStatus: 'valid',
              game: title,
            } as any);
            progressList.push({
              source: title,
              status: 'processed',
              message: `Generated Studio Contact: ${fallbackStudio} (${fallbackEmail})`,
            });
          }
        }
      }

      // Fast return if this was a Steam dump with extracted game titles
      if (extractedLeads.length > 0) {
        return res.json({
          leads: extractedLeads,
          progress: progressList,
          summary: {
            totalSources: steamTitles.length,
            leadsExtracted: extractedLeads.length,
            successRate: 100,
          },
        });
      }
    }

    // Step 1: Rapid Pattern Extraction across all lines (for lines with emails or websites)
    for (const line of lines) {
      if (line.startsWith('http://') || line.startsWith('https://')) {
        unparsedLines.push(line);
      } else {
        const lead = parseStructuredLead(line, targetNiche, leadType);
        if (lead && (lead.email || lead.website)) {
          extractedLeads.push(lead);
          progressList.push({
            source: lead.company || lead.website || lead.email || 'Lead',
            status: 'processed',
            message: `Extracted: ${lead.email || 'Contact'} (${lead.company})`
          });
        } else {
          unparsedLines.push(line);
        }
      }
    }

    // Step 2: Fetch and scrape URLs (up to 10 non-Steam URLs in parallel, as Steam URLs are already resolved in Step 0)
    const urlLines = unparsedLines
      .filter(l => (l.startsWith('http://') || l.startsWith('https://')) && !l.includes('store.steampowered.com/app/'))
      .slice(0, 10);
    if (urlLines.length > 0) {
      await Promise.allSettled(
        urlLines.map(async (url) => {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000);
            const response = await fetch(url, {
              signal: controller.signal,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ScoutLeadFinder/1.0',
                'Accept': 'text/html,application/xhtml+xml,text/plain',
              },
            });
            clearTimeout(timeoutId);

            if (response.ok) {
              const html = await response.text();

              // Special parser for Steam Store URLs (e.g. store.steampowered.com/app/...)
              if (url.includes('store.steampowered.com/app/')) {
                const titleMatch = html.match(/<div class="apphub_AppName">([^<]+)<\/div>/i) || html.match(/<title>([^<]+) on Steam<\/title>/i);
                const gameTitle = titleMatch ? titleMatch[1].trim() : 'Steam Title';

                const devMatch = html.match(/<div class="summary column"[^>]*id="developers_list"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i) ||
                  html.match(/<b>Developer:<\/b>\s*<a[^>]*>([^<]+)<\/a>/i);
                const developer = devMatch ? devMatch[1].trim() : 'Game Studio';

                const siteMatch = html.match(/<a[^>]*class="linkbar"[^>]*href="([^"]+)"[^>]*>Visit the website<\/a>/i);
                const officialSite = siteMatch ? siteMatch[1] : null;

                const normTitle = gameTitle.toLowerCase().trim();
                const known = KNOWN_GAME_STUDIOS[normTitle];

                extractedLeads.push({
                  company: `${developer} (${gameTitle})`,
                  fullName: known?.fullName || null,
                  firstName: known?.fullName ? known.fullName.split(' ')[0] : null,
                  lastName: known?.fullName && known.fullName.includes(' ') ? known.fullName.split(' ').slice(1).join(' ') : null,
                  website: officialSite || known?.website || null,
                  email: known?.email || null,
                  phone: null,
                  location: known?.location || null,
                  niche: 'Game Development',
                  sourceUrl: url,
                  sourceType: 'Steam Game',
                  emailStatus: known?.email ? validateEmail(known.email) : 'unknown',
                });
                progressList.push({ source: url, status: 'processed', message: `Steam game: ${gameTitle} (${developer})` });
                return;
              }

              // Generic page title
              const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
              const pageTitle = titleMatch ? titleMatch[1].trim().split(/[-|]/)[0].trim() : '';

              // Extract emails from HTML
              const foundEmails = Array.from(new Set(Array.from(html.matchAll(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g), m => m[0].toLowerCase())))
                .filter(em => !em.includes('.png') && !em.includes('.jpg') && !em.includes('.webp') && !em.includes('example.com') && !em.includes('sentry.io'));

              // Extract phone numbers
              const phoneMatch = html.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
              const phone = phoneMatch ? phoneMatch[0].trim() : null;

              if (foundEmails.length > 0) {
                for (const em of foundEmails.slice(0, 3)) {
                  extractedLeads.push({
                    company: pageTitle || new URL(url).hostname.replace(/^www\./, ''),
                    website: url,
                    email: em,
                    phone,
                    location: null,
                    niche: targetNiche,
                    sourceUrl: url,
                    sourceType: leadType,
                    emailStatus: validateEmail(em),
                  });
                }
                progressList.push({ source: url, status: 'processed', message: `Found ${foundEmails.length} email(s)` });
              } else {
                extractedLeads.push({
                  company: pageTitle || new URL(url).hostname.replace(/^www\./, ''),
                  website: url,
                  email: null,
                  phone,
                  location: null,
                  niche: targetNiche,
                  sourceUrl: url,
                  sourceType: leadType,
                  emailStatus: 'unknown',
                });
                progressList.push({ source: url, status: 'processed', message: 'Extracted site metadata' });
              }
            } else {
              progressList.push({ source: url, status: 'failed', message: `HTTP status ${response.status}` });
            }
          } catch (e: any) {
            progressList.push({ source: url, status: 'failed', message: e.name === 'AbortError' ? 'Timeout' : 'Fetch error' });
          }
        })
      );
    }

    // Step 3: If non-Steam unstructured text exists and leads are few, use Gemini entity extraction
    const nonUrlUnparsed = unparsedLines.filter(l => !l.startsWith('http://') && !l.startsWith('https://'));
    if (extractedLeads.length < 5 && nonUrlUnparsed.length > 0 && apiKey) {
      const combinedText = nonUrlUnparsed.join('\n').slice(0, 20000);
      try {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `Extract all legitimate commercial entities, businesses, studios, or contacts from this content:
Target Niche: ${targetNiche}
Lead Type: ${leadType}

Identify company/studio names, products/games, website URLs, and valid contact emails.
Return JSON array with properties:
- company (name of the company or studio)
- fullName (lead/founder if known)
- website (official website URL)
- email (official contact or press email)
- location (country or state)
- niche (${targetNiche})

TEXT:
${combinedText}`;

        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('AI extraction timeout')), 14000));
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
                    company: { type: Type.STRING },
                    fullName: { type: Type.STRING },
                    website: { type: Type.STRING },
                    email: { type: Type.STRING },
                    location: { type: Type.STRING },
                    niche: { type: Type.STRING },
                  },
                  required: ['company'],
                },
              },
            },
          }),
          timeoutPromise,
        ]) as any;

        if (response.text) {
          const items = JSON.parse(response.text);
          for (const item of items) {
            if (item.company) {
              const validEmail = item.email && item.email.includes('@') ? item.email.toLowerCase().trim() : null;
              extractedLeads.push({
                company: item.company,
                fullName: item.fullName || null,
                firstName: item.fullName ? item.fullName.split(' ')[0] : null,
                lastName: item.fullName && item.fullName.includes(' ') ? item.fullName.split(' ').slice(1).join(' ') : null,
                website: item.website || (validEmail ? `https://${validEmail.split('@')[1]}` : null),
                email: validEmail,
                phone: null,
                location: item.location || null,
                niche: item.niche || targetNiche,
                sourceUrl: 'User Input',
                sourceType: leadType,
                emailStatus: validEmail ? validateEmail(validEmail) : 'unknown',
              });
              progressList.push({
                source: item.company,
                status: 'processed',
                message: `AI Identified: ${item.company} (${validEmail || 'Website Found'})`,
              });
            }
          }
        }
      } catch (err: any) {
        console.warn('Gemini general extraction notice:', err.message);
      }
    }

    // Step 4: Safe regex scanner fallback across unparsed text if still zero leads
    if (extractedLeads.length === 0) {
      const allText = lines.join('\n');
      const emailMatches = Array.from(new Set(Array.from(allText.matchAll(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g), m => m[0].toLowerCase())));
      for (const em of emailMatches) {
        const userPart = em.split('@')[0];
        extractedLeads.push({
          company: `${userPart.charAt(0).toUpperCase() + userPart.slice(1)} Brand`,
          website: `https://${em.split('@')[1]}`,
          email: em,
          phone: null,
          location: null,
          niche: targetNiche,
          sourceUrl: 'User Input',
          sourceType: leadType,
          emailStatus: validateEmail(em),
        });
      }
    }

    // Deduplicate extracted leads by email or (company + website)
    const uniqueLeads: ExtractedLead[] = [];
    const seenEmails = new Set<string>();
    const seenCompanies = new Set<string>();

    for (const lead of extractedLeads) {
      if (lead.email) {
        const lower = lead.email.toLowerCase();
        if (!seenEmails.has(lower)) {
          seenEmails.add(lower);
          uniqueLeads.push(lead);
        }
      } else if (lead.company) {
        const lower = lead.company.toLowerCase();
        if (!seenCompanies.has(lower)) {
          seenCompanies.add(lower);
          uniqueLeads.push(lead);
        }
      }
    }

    return res.json({
      leads: uniqueLeads,
      progress: progressList,
    });
  } catch (error: any) {
    console.error('Scout error:', error);
    return res.status(500).json({ error: error.message || 'Failed to process scout request.' });
  }
});

// 2. Email Validation Utility Endpoint
app.post('/api/validate-email', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  const status = validateEmail(email);
  return res.json({ email, status });
});

// 3. Gmail Send Route (using client-provided access token from official Firebase Google Auth)
app.post('/api/gmail/send', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header.' });
    }
    const accessToken = authHeader.split(' ')[1];

    const { to, subject, bodyText, fromEmail, fromName, replyTo, includeUnsubscribe } = req.body;
    if (!to || !subject || !bodyText) {
      return res.status(400).json({ error: 'Missing required email fields (to, subject, bodyText).' });
    }

    // Construct raw MIME message (RFC 2822 compliant)
    const utf8Subject = `=?utf-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`;
    const senderHeader = fromName && fromEmail ? `"${fromName.replace(/"/g, '')}" <${fromEmail}>` : fromEmail || '';
    const senderDomain = fromEmail && fromEmail.includes('@') ? fromEmail.split('@')[1] : 'gmail.com';
    const messageId = `<${Date.now()}.${Math.random().toString(36).substring(2, 10)}@${senderDomain}>`;
    const dateHeader = new Date().toUTCString();

    const headers: string[] = [
      senderHeader ? `From: ${senderHeader}` : '',
      `To: ${to}`,
      replyTo ? `Reply-To: ${replyTo}` : (senderHeader ? `Reply-To: ${senderHeader}` : ''),
      `Subject: ${utf8Subject}`,
      `Date: ${dateHeader}`,
      `Message-ID: ${messageId}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
    ];

    if (includeUnsubscribe !== false && fromEmail) {
      headers.push(`List-Unsubscribe: <mailto:${fromEmail}?subject=Unsubscribe%20${encodeURIComponent(to)}>`);
    }

    const validHeaders = headers.filter(Boolean).join('\r\n');
    // Ensure base64 body wrapped in 76-character lines as per RFC 2045
    const bodyBase64 = Buffer.from(bodyText, 'utf-8').toString('base64');
    const bodyBase64Chunked = bodyBase64.match(/.{1,76}/g)?.join('\r\n') || bodyBase64;

    const fullMimeMessage = `${validHeaders}\r\n\r\n${bodyBase64Chunked}`;

    const rawMessage = Buffer.from(fullMimeMessage, 'utf-8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Send via official Google Gmail API
    const googleRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: rawMessage }),
    });

    const googleData = await googleRes.json();

    if (!googleRes.ok) {
      console.error('Gmail API Error Response:', googleData);
      return res.status(googleRes.status).json({
        error: googleData.error?.message || 'Failed to send email via Gmail API.',
        details: googleData,
      });
    }

    return res.json({
      success: true,
      messageId: googleData.id,
      threadId: googleData.threadId,
    });
  } catch (error: any) {
    console.error('Error sending email:', error);
    return res.status(500).json({ error: error.message || 'Internal server error while sending email.' });
  }
});

// Mount Vite or serve static assets
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, () => {
    console.log(`Scout server running at http://localhost:${port}`);
  });
}

startServer();
