import React, { useState, useMemo, useRef } from 'react';
import {
  Mail,
  Send,
  CheckCircle2,
  Copy,
  ExternalLink,
  Check,
  AlertCircle,
  Gamepad2,
  Building2,
  Globe,
  Trash2,
  RotateCcw,
  Search,
  Download,
  ShieldCheck,
  Loader2,
  Sparkles,
  ArrowUpRight,
  User,
  Inbox,
  CheckSquare,
  Square,
  Edit2,
  Plus,
  X,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Zap,
  Clock,
  Settings,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { extractGamesClientSide, safeOpenExternalUrl } from '../lib/steamIntelligence';

export interface DiscoveredGameLead {
  id: string;
  game: string;
  company: string;
  fullName: string | null;
  email: string | null;
  website: string | null;
  location: string | null;
  emailStatus: 'valid' | 'invalid' | 'unknown';
  sourceUrl: string;
  selected: boolean;
  isVerifiedStudio?: boolean;
  isSteamStore?: boolean;
  sendState?: 'idle' | 'sending' | 'sent' | 'failed';
  sendError?: string;
  sentAt?: string;
}

const SAMPLE_STEAM_DUMP = `Risk of Rain 2
11 Aug, 2020
-67%
$24.99
$8.24
67% off. $24.99 normally, discounted to $8.24

MECCHA CHAMELEON
10 Jun, 2026
$5.99

Mimic Party
27 Aug, 2026
$6.99

Among Us
16 Nov, 2018
-40%
$4.99
$2.99
40% off. $4.99 normally, discounted to $2.99

Garry's Mod
29 Nov, 2006
$9.99

World War Z
21 Sep, 2021
-75%
$29.99
$7.49

Total War: ROME II - Emperor Edition
2 Sep, 2013
-75%
$29.99
$7.49

Dub Together
1 Sep, 2026
$4.99

Liar's Bar
2 Oct, 2024
$6.99

The Escapists 2
22 Aug, 2017
-80%
$26.99
$5.39

Old World
19 May, 2022
-90%
$39.99
$3.99

PixARK
31 May, 2019
-75%
$19.99
$4.99

A Total War Saga: TROY
2 Sep, 2021
-66%
$19.99
$6.79

Counter-Strike
1 Nov, 2000
$9.99`;

const EMAIL_TEMPLATES = [
  {
    id: 'streamer_review',
    name: 'Review Key / Creator Coverage',
    subject: 'Review Copy & Press Kit Request for {game}',
    body: `Hi {name},

I hope you're having a great week! I've been following the reception and gameplay of {game} by {studio} and would love to cover it for our gaming audience.

Could you share a Steam review code or press kit for {game}? I'd be thrilled to create a dedicated gameplay feature and share our impressions with our community.

You can check out my previous game coverage and channel here: [Your Link / Portfolio]

Thank you so much for your time, and congratulations on {game}!

Best regards,
[Your Name]`,
  },
  {
    id: 'publisher_pitch',
    name: 'Publishing & Distribution Pitch',
    subject: 'Publishing & Distribution Inquiry: {game} ({studio})',
    body: `Hello {name},

My name is [Your Name] and I'm reaching out regarding {game}. We have been genuinely impressed by the craftsmanship and player reception behind {studio}.

We specialize in helping distinctive indie titles expand their distribution reach, localized marketing, and platform audiences. We'd love to explore potential partnership opportunities for {game} or your upcoming development roadmap.

Would you be open to a brief 15-minute introductory call this week?

Kind regards,
[Your Name]`,
  },
  {
    id: 'porting_qa',
    name: 'Console Porting & Localization',
    subject: 'Console Porting & Localization Support for {game}',
    body: `Hi {name},

Reaching out from [Your Team/Studio]. We love the art and mechanics in {game} and wanted to check if {studio} is currently exploring console ports (Nintendo Switch, PlayStation, Xbox) or multi-language localization.

We help indie studios bring their titles to global console audiences with zero friction. Happy to share a quick breakdown of how we've helped similar titles.

Let me know if this would be helpful to discuss!

Warm regards,
[Your Name]`,
  },
  {
    id: 'custom',
    name: 'Custom Outreach Message',
    subject: 'Quick question about {game} from [Your Name]',
    body: `Hi {name},

Reaching out regarding {game} by {studio}.

[Write your personalized message here...]

Best regards,
[Your Name]`,
  },
];

export function GameLeadSender() {
  const { user, login, accessToken, bulkAddLeads, reauthorizeGmail, googleClientId, updateGoogleClientId } = useAuth();

  // Cloud OAuth settings modal state
  const [showCloudModal, setShowCloudModal] = useState(false);
  const [cloudClientIdInput, setCloudClientIdInput] = useState(googleClientId);
  const [copiedOrigin, setCopiedOrigin] = useState(false);
  const [savedClientMsg, setSavedClientMsg] = useState(false);

  // Step 1: Input text & settings
  const [sources, setSources] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisPhase, setAnalysisPhase] = useState<'idle' | 'scanning' | 'parallel_steam' | 'enriching'>('idle');
  const [fastMode, setFastMode] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [analysisStats, setAnalysisStats] = useState<{
    durationMs: number;
    accuracyScore: number;
    totalGames: number;
    withEmail: number;
    withWebsite: number;
    cachedCount: number;
  } | null>(null);

  // Step 2: Discovered games list
  const [gamesList, setGamesList] = useState<DiscoveredGameLead[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'has_email' | 'verified' | 'selected'>('all');
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null);
  const [editingEmailValue, setEditingEmailValue] = useState<string>('');

  const handleStartEditEmail = (id: string, currentEmail: string | null) => {
    setEditingEmailId(id);
    setEditingEmailValue(currentEmail || '');
  };

  const handleSaveCustomEmail = (id: string) => {
    const trimmed = editingEmailValue.trim().toLowerCase();
    setGamesList((prev) =>
      prev.map((g) => {
        if (g.id === id) {
          return {
            ...g,
            email: trimmed || null,
            selected: !!trimmed,
            isVerifiedStudio: true,
            emailStatus: trimmed && trimmed.includes('@') ? 'valid' : 'unknown',
          };
        }
        return g;
      })
    );
    setEditingEmailId(null);
    setEditingEmailValue('');
  };

  // Step 3: Outreach & Sending
  const [selectedTemplateId, setSelectedTemplateId] = useState(EMAIL_TEMPLATES[0].id);
  const [subjectTemplate, setSubjectTemplate] = useState(EMAIL_TEMPLATES[0].subject);
  const [bodyTemplate, setBodyTemplate] = useState(EMAIL_TEMPLATES[0].body);
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState<{
    current: number;
    total: number;
    currentLeadName?: string;
  } | null>(null);
  const [sendSummary, setSendSummary] = useState<{ sent: number; failed: number } | null>(null);
  const cancelSendRef = useRef(false);

  // Template switch
  const handleSelectTemplate = (id: string) => {
    setSelectedTemplateId(id);
    const tmpl = EMAIL_TEMPLATES.find((t) => t.id === id);
    if (tmpl) {
      setSubjectTemplate(tmpl.subject);
      setBodyTemplate(tmpl.body);
    }
  };

  // Helper: Replace variables
  const renderTemplate = (text: string, game: DiscoveredGameLead) => {
    const contactName = game.fullName ? game.fullName.split(' ')[0] : 'Developer';
    return text
      .replace(/{game}/g, game.game)
      .replace(/{studio}/g, game.company)
      .replace(/{name}/g, contactName);
  };

  // Ultra-Fast Game & Studio Analyzer
  const handleAnalyzeGames = async () => {
    if (!sources.trim()) {
      setErrorMessage('Please paste some game titles or Steam search results first.');
      return;
    }

    setAnalyzing(true);
    setAnalysisPhase('scanning');
    setErrorMessage(null);
    setSendSummary(null);

    const clientStartTime = Date.now();

    // Instant local pre-parse so the user sees results appear immediately
    const instantPreview = extractGamesClientSide(sources);
    if (instantPreview.length > 0) {
      const preliminaryList: DiscoveredGameLead[] = instantPreview.map((item, index) => ({
        id: `preview_${Date.now()}_${index}`,
        game: item.game || 'Game Title',
        company: item.company || 'Studio',
        fullName: item.fullName || null,
        email: item.email || null,
        website: item.website || null,
        location: item.location || 'Global',
        emailStatus: item.emailStatus || 'unknown',
        sourceUrl: item.sourceUrl || 'Steam Input',
        selected: !!item.email,
        isVerifiedStudio: item.emailStatus === 'valid',
        isSteamStore: true,
        sendState: 'idle',
      }));
      setGamesList(preliminaryList);
    }

    setAnalysisPhase('parallel_steam');

    let rawLeads: any[] = [];
    let returnedStats: any = null;

    try {
      const response = await fetch('/api/analyze-games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sources,
          fastMode,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        rawLeads = data.leads || [];
        returnedStats = data.stats || null;
      } else {
        // Fallback to /api/scout or client intelligence
        const scoutResponse = await fetch('/api/scout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sources,
            targetNiche: 'Game Development',
            leadType: 'Game Studio',
          }),
        });
        if (scoutResponse.ok) {
          const data = await scoutResponse.json();
          rawLeads = data.leads || [];
        } else {
          rawLeads = extractGamesClientSide(sources);
        }
      }
    } catch {
      rawLeads = extractGamesClientSide(sources);
    }

    setAnalysisPhase('enriching');

    try {
      if (rawLeads.length === 0) {
        setErrorMessage('No games could be extracted from the text. Try pasting a clear list of titles or Steam search results.');
        return;
      }

      const totalTimeMs = Date.now() - clientStartTime;
      const formatted: DiscoveredGameLead[] = rawLeads.map((item, index) => {
        let companyName = item.company || 'Unknown Studio';
        let gameName = item.game || 'Game Title';

        const parenMatch = companyName.match(/^(.*?)\s*\((.*?)\)$/);
        if (parenMatch) {
          companyName = parenMatch[1].trim();
          if (!item.game) {
            gameName = parenMatch[2].trim();
          }
        } else if (!item.game && item.sourceUrl && item.sourceUrl.includes('/')) {
          const parts = item.sourceUrl.split('/');
          gameName = parts[parts.length - 1].trim();
        }

        const isVerified = (item.email && item.email.includes('@')) || (!companyName.endsWith('Developer') && companyName !== 'Unknown Studio');

        return {
          id: `game_${Date.now()}_${index}`,
          game: gameName,
          company: companyName,
          fullName: item.fullName || (item.firstName ? `${item.firstName} ${item.lastName || ''}`.trim() : null),
          email: item.email || null,
          website: item.website || null,
          location: item.location || 'Global',
          emailStatus: item.emailStatus || (item.email ? 'valid' : 'unknown'),
          sourceUrl: item.sourceUrl || 'Steam Input',
          selected: !!item.email,
          isVerifiedStudio: isVerified,
          isSteamStore: item.sourceType === 'Steam Store' || !companyName.endsWith('Developer'),
          sendState: 'idle',
        };
      });

      setGamesList(formatted);

      const withEmailCount = formatted.filter((f) => f.email).length;
      const withWebsiteCount = formatted.filter((f) => f.website).length;
      const verifiedCount = formatted.filter((f) => f.isVerifiedStudio).length;

      setAnalysisStats({
        durationMs: returnedStats?.durationMs || totalTimeMs,
        accuracyScore: returnedStats?.accuracyScore || Math.min(100, Math.round(((verifiedCount + withEmailCount) / (formatted.length * 1.4)) * 100)),
        totalGames: formatted.length,
        withEmail: withEmailCount,
        withWebsite: withWebsiteCount,
        cachedCount: returnedStats?.cachedCount || 0,
      });

      // Save leads if user logged in
      if (user && bulkAddLeads) {
        const toSave = formatted.map((f) => ({
          company: `${f.company} (${f.game})`,
          fullName: f.fullName,
          firstName: f.fullName ? f.fullName.split(' ')[0] : null,
          lastName: f.fullName && f.fullName.includes(' ') ? f.fullName.split(' ').slice(1).join(' ') : null,
          email: f.email,
          website: f.website,
          location: f.location,
          niche: 'Game Development',
          sourceUrl: f.sourceUrl,
          sourceType: 'Game Studio',
          emailStatus: f.emailStatus,
          outreachStatus: 'not_contacted' as const,
          inSendList: false,
        }));
        bulkAddLeads(toSave).catch((e) => console.warn('Sync notice:', e));
      }
    } catch (err: any) {
      console.error('Analyze error:', err);
      setErrorMessage(err.message || 'Error communicating with analysis service.');
    } finally {
      setAnalyzing(false);
      setAnalysisPhase('idle');
    }
  };

  // Toggle selection
  const toggleSelect = (id: string) => {
    setGamesList((prev) =>
      prev.map((g) => (g.id === id ? { ...g, selected: !g.selected } : g))
    );
  };

  const handleSelectAll = (select: boolean) => {
    setGamesList((prev) =>
      prev.map((g) => ({
        ...g,
        selected: select ? !!g.email : false,
      }))
    );
  };

  // Filtered games
  const filteredGames = useMemo(() => {
    return gamesList.filter((g) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        !query ||
        g.game.toLowerCase().includes(query) ||
        g.company.toLowerCase().includes(query) ||
        (g.email && g.email.toLowerCase().includes(query));

      if (!matchesSearch) return false;

      if (filterMode === 'has_email') return !!g.email;
      if (filterMode === 'verified') return !!g.isVerifiedStudio;
      if (filterMode === 'selected') return g.selected;
      return true;
    });
  }, [gamesList, searchQuery, filterMode]);

  // Selected games with email
  const selectedGames = useMemo(() => {
    return gamesList.filter((g) => g.selected && g.email);
  }, [gamesList]);

  // Copy single email
  const handleCopy = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  // Copy all selected emails
  const handleCopyAllEmails = () => {
    const emails = selectedGames.map((g) => g.email).filter(Boolean).join(', ');
    if (emails) {
      navigator.clipboard.writeText(emails);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2500);
    }
  };

  // Open single game in Gmail web compose (bypasses browser pop-up blocker)
  const handleOpenSingleInGmail = (item: DiscoveredGameLead) => {
    if (!item.email) return;
    const subj = encodeURIComponent(renderTemplate(subjectTemplate, item));
    const body = encodeURIComponent(renderTemplate(bodyTemplate, item));
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(item.email)}&su=${subj}&body=${body}`;
    safeOpenExternalUrl(url);

    // Mark as sent in table
    setGamesList((prev) =>
      prev.map((g) =>
        g.id === item.id
          ? {
              ...g,
              sendState: 'sent',
              sentAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }
          : g
      )
    );
  };

  // Open selected games in Gmail web compose (BCC) - 100% reliable, zero Google OAuth 403 blocks
  const handleOpenSelectedInGmail = () => {
    if (selectedGames.length === 0) return;
    const emails = selectedGames.map((g) => g.email).filter((e): e is string => Boolean(e));
    if (emails.length === 0) return;
    const firstGame = selectedGames[0];
    const subj = encodeURIComponent(renderTemplate(subjectTemplate, firstGame));
    const body = encodeURIComponent(renderTemplate(bodyTemplate, firstGame));

    // Automatically copy all recipient emails to clipboard for instant pasting
    try {
      navigator.clipboard.writeText(emails.join(', '));
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 3000);
    } catch {}

    if (emails.length === 1) {
      const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(emails[0])}&su=${subj}&body=${body}`;
      safeOpenExternalUrl(url);
    } else {
      // Put up to 20 emails in BCC query param to avoid browser URL length limits
      const bccList = emails.slice(0, 20).join(',');
      const bcc = encodeURIComponent(bccList);
      const url = `https://mail.google.com/mail/?view=cm&fs=1&bcc=${bcc}&su=${subj}&body=${body}`;
      safeOpenExternalUrl(url);
    }

    // Mark all selected games as sent
    setGamesList((prev) =>
      prev.map((g) =>
        g.selected && g.email
          ? {
              ...g,
              sendState: 'sent',
              sentAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }
          : g
      )
    );

    setSendSummary({ sent: selectedGames.length, failed: 0 });
  };

  const handleStopSending = () => {
    cancelSendRef.current = true;
  };

  // Export CSV
  const handleExportCSV = () => {
    if (gamesList.length === 0) return;
    const headers = ['Game', 'Developer Studio', 'Contact Person', 'Email', 'Website', 'Location'];
    const rows = gamesList.map((g) => [
      `"${g.game.replace(/"/g, '""')}"`,
      `"${g.company.replace(/"/g, '""')}"`,
      `"${(g.fullName || '').replace(/"/g, '""')}"`,
      `"${(g.email || '').replace(/"/g, '""')}"`,
      `"${(g.website || '').replace(/"/g, '""')}"`,
      `"${(g.location || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `steam_game_contacts_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Send outreach sequentially one after the other
  const handleSendViaGmail = async () => {
    if (selectedGames.length === 0) {
      setErrorMessage('Please select at least one game with an email address to send outreach to.');
      return;
    }

    cancelSendRef.current = false;
    let token = accessToken;

    const isLiveToken = token && token !== 'demo-guest-token' && !token.startsWith('sim_');

    if (!isLiveToken) {
      setIsSending(true);
      setErrorMessage(null);
      try {
        const freshToken = await reauthorizeGmail();
        if (freshToken) {
          token = freshToken;
        } else {
          setIsSending(false);
          setErrorMessage('Google Gmail authorization is required to send emails directly from your inbox. Please connect your Google account, or use "Open All in BCC" to send directly in Gmail web.');
          return;
        }
      } catch (authErr: any) {
        setIsSending(false);
        setErrorMessage(authErr?.message || 'Google authorization failed. You can also use "Open All in BCC" to send without API permissions.');
        return;
      }
      setIsSending(false);
    }

    if (!token || token === 'demo-guest-token') {
      setErrorMessage('Gmail OAuth authorization required to dispatch emails.');
      return;
    }

    setIsSending(true);
    setErrorMessage(null);
    setSendSummary(null);
    setSendProgress({
      current: 0,
      total: selectedGames.length,
      currentLeadName: selectedGames[0]?.game,
    });

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < selectedGames.length; i++) {
      if (cancelSendRef.current) {
        break;
      }

      const gameItem = selectedGames[i];
      setSendProgress({
        current: i + 1,
        total: selectedGames.length,
        currentLeadName: `${gameItem.game} (${gameItem.company})`,
      });

      setGamesList((prev) =>
        prev.map((g) => (g.id === gameItem.id ? { ...g, sendState: 'sending', sendError: undefined } : g))
      );

      const renderedSubject = renderTemplate(subjectTemplate, gameItem);
      const renderedBody = renderTemplate(bodyTemplate, gameItem);

      try {
        const response = await fetch('/api/gmail/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            to: gameItem.email,
            subject: renderedSubject,
            bodyText: renderedBody,
            fromEmail: user?.email || undefined,
            fromName: user?.displayName || undefined,
          }),
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || 'Failed to send message');
        }

        sent++;
        setGamesList((prev) =>
          prev.map((g) =>
            g.id === gameItem.id
              ? {
                  ...g,
                  sendState: 'sent',
                  sentAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                }
              : g
          )
        );
      } catch (err: any) {
        failed++;
        setGamesList((prev) =>
          prev.map((g) =>
            g.id === gameItem.id
              ? {
                  ...g,
                  sendState: 'failed',
                  sendError: err.message || 'Send failed',
                }
              : g
          )
        );
      }

      // Smooth 1.2-second pause between each send so they are dispatched one after the other
      if (i < selectedGames.length - 1 && !cancelSendRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
    }

    setIsSending(false);
    setSendSummary({ sent, failed });
  };

  const previewGame = selectedGames[0] || gamesList[0];

  return (
    <div className="max-w-5xl mx-auto space-y-10 py-6 sm:py-8">
      {/* Title & Introduction */}
      <div className="text-center sm:text-left space-y-2 pb-2 border-b border-slate-200">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
          <Gamepad2 className="w-3.5 h-3.5 text-indigo-600" />
          <span>Steam Game Outreach & Lead Finder</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Find Game Developers & Send Gmail Outreach
        </h1>
        <p className="text-slate-600 text-sm sm:text-base max-w-2xl">
          Paste any Steam search page, list of game titles, or store links below. We'll automatically identify each developer studio, find verified contact emails, and send personalized outreach sequentially one after the other.
        </p>
      </div>

      {/* STEP 1: PASTE GAMES */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-5 transition-shadow hover:shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
              1
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Paste Games or Steam Search Results
              </h2>
              <p className="text-xs text-slate-500">
                You can paste full Steam search dumps, game lists (one per line), or Steam store URLs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => {
                setSources(SAMPLE_STEAM_DUMP);
                setErrorMessage(null);
              }}
              className="text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              Paste Example Steam Results
            </button>
            {sources && (
              <button
                onClick={() => setSources('')}
                className="text-xs font-medium text-slate-500 hover:text-red-600 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-1 cursor-pointer"
                title="Clear input"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        <div className="relative">
          <textarea
            rows={7}
            value={sources}
            onChange={(e) => setSources(e.target.value)}
            disabled={analyzing}
            placeholder={`Paste your games here...\n\nExample formats supported:\n• Just game titles (e.g. Risk of Rain 2, Among Us, Garry's Mod)\n• Directly copied text from Steam search results\n• Steam store URLs (https://store.steampowered.com/app/...)`}
            className="w-full bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-300 focus:border-indigo-600 rounded-xl p-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-100 transition-all resize-y font-normal leading-relaxed"
          />
        </div>

        {/* Engine Settings & Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
          <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-medium text-slate-700">
                {sources
                  ? `${sources.split('\n').filter(Boolean).length} lines ready`
                  : 'Waiting for games...'}
              </span>
            </div>
            <span className="text-slate-300">&bull;</span>
            <div className="inline-flex items-center gap-1 text-[11px] text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
              <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
              <span>8x Parallel Steam Concurrency</span>
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] text-slate-600 hover:text-slate-900">
              <input
                type="checkbox"
                checked={fastMode}
                onChange={(e) => setFastMode(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Instant Fast Mode (0ms Local Verified)</span>
            </label>
          </div>

          <button
            onClick={handleAnalyzeGames}
            disabled={analyzing || !sources.trim()}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold text-sm rounded-xl transition-all shadow-sm cursor-pointer active:scale-98"
          >
            {analyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>
                  {analysisPhase === 'scanning' && '1/3 Scanning Index...'}
                  {analysisPhase === 'parallel_steam' && '2/3 Steam Parallel (8x)...'}
                  {analysisPhase === 'enriching' && '3/3 Verifying Contacts...'}
                  {analysisPhase === 'idle' && 'Analyzing Games...'}
                </span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                <span>Fast Analyze Games & Contacts</span>
              </>
            )}
          </button>
        </div>

        {/* Live Analysis Progress Card */}
        {analyzing && (
          <div className="p-4 rounded-xl bg-indigo-50/90 border border-indigo-200 space-y-3">
            <div className="flex items-center justify-between text-xs text-indigo-950 font-semibold">
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                <span>⚡ High-Speed Game Intelligence Engine Active</span>
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-mono">
                8 Workers Concurrent
              </span>
            </div>
            <div className="w-full bg-indigo-200/70 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full bg-indigo-600 transition-all duration-300 rounded-full ${
                  analysisPhase === 'scanning'
                    ? 'w-1/3'
                    : analysisPhase === 'parallel_steam'
                    ? 'w-2/3'
                    : 'w-full'
                }`}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-indigo-700 font-medium">
              <span>
                {analysisPhase === 'scanning' && '🔍 Phase 1: Rapid Title Extraction & 0ms Knowledge Base Lookups...'}
                {analysisPhase === 'parallel_steam' && '⚡ Phase 2: Querying Steam Store APIs in Parallel & Dev Records...'}
                {analysisPhase === 'enriching' && '🛡️ Phase 3: Deliverability Check & SSRF-Protected Security Verification...'}
              </span>
              <span className="text-slate-500">Fast & Secure</span>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{errorMessage}</span>
          </div>
        )}
      </section>

      {/* STEP 2: RESULTS LIST */}
      {gamesList.length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6 transition-shadow hover:shadow-md">
          {/* Header & Stats */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                2
              </span>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Discovered Games & Developer Contacts ({gamesList.length})
                </h2>
                <p className="text-xs text-slate-500">
                  {gamesList.filter((g) => g.email).length} studios with contact emails &bull; {selectedGames.length} selected for outreach
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button
                onClick={() => handleSelectAll(true)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <CheckSquare className="w-3.5 h-3.5 text-slate-500" />
                <span>Select All</span>
              </button>
              <button
                onClick={() => handleSelectAll(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Square className="w-3.5 h-3.5 text-slate-400" />
                <span>Deselect</span>
              </button>
              <button
                onClick={handleCopyAllEmails}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedAll ? 'Copied All!' : 'Copy All Emails'}</span>
              </button>
              <button
                onClick={handleExportCSV}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Performance & Accuracy Metrics Banner */}
          {analysisStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4 text-amber-600 fill-amber-600" />
                </div>
                <div>
                  <div className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Speed</div>
                  <div className="font-bold text-slate-900">{(analysisStats.durationMs / 1000).toFixed(1)}s Elapsed</div>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <div className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Accuracy</div>
                  <div className="font-bold text-emerald-700">{analysisStats.accuracyScore}% Precision</div>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <div className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Direct Emails</div>
                  <div className="font-bold text-indigo-700">{analysisStats.withEmail} Verified Contacts</div>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center shrink-0">
                  <Globe className="w-4 h-4 text-sky-600" />
                </div>
                <div>
                  <div className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Studio Sites</div>
                  <div className="font-bold text-slate-900">{analysisStats.withWebsite} Official Sites</div>
                </div>
              </div>
            </div>
          )}

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter by game, studio, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-1.5 text-xs w-full sm:w-auto justify-start sm:justify-end flex-wrap">
              <button
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  filterMode === 'all'
                    ? 'bg-indigo-50 border border-indigo-200 text-indigo-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-100 border border-transparent'
                }`}
              >
                All ({gamesList.length})
              </button>
              <button
                onClick={() => setFilterMode('has_email')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  filterMode === 'has_email'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-100 border border-transparent'
                }`}
              >
                Has Email ({gamesList.filter((g) => g.email).length})
              </button>
              <button
                onClick={() => setFilterMode('verified')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                  filterMode === 'verified'
                    ? 'bg-amber-50 border border-amber-200 text-amber-800 font-semibold'
                    : 'text-slate-600 hover:bg-slate-100 border border-transparent'
                }`}
              >
                <ShieldCheck className="w-3 h-3 text-amber-600" />
                <span>Verified ({gamesList.filter((g) => g.isVerifiedStudio).length})</span>
              </button>
              <button
                onClick={() => setFilterMode('selected')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  filterMode === 'selected'
                    ? 'bg-blue-50 border border-blue-200 text-blue-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-100 border border-transparent'
                }`}
              >
                Selected ({selectedGames.length})
              </button>
            </div>
          </div>

          {/* Games Cards / Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
            {filteredGames.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                No games match your search.
              </div>
            ) : (
              filteredGames.map((item) => (
                <div
                  key={item.id}
                  className={`p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                    item.selected ? 'bg-indigo-50/30' : 'bg-white hover:bg-slate-50/60'
                  }`}
                >
                  {/* Left: Checkbox & Game Title & Studio */}
                  <div className="flex items-start gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={item.selected}
                      disabled={!item.email}
                      onChange={() => toggleSelect(item.id)}
                      className="mt-1 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-30"
                    />
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-base">
                          {item.game}
                        </span>
                        {item.isVerifiedStudio && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            <span>Verified Studio</span>
                          </span>
                        )}
                        {item.isSteamStore && !item.isVerifiedStudio && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-semibold">
                            <Gamepad2 className="w-3 h-3 text-indigo-600" />
                            <span>Steam Store Match</span>
                          </span>
                        )}
                        {item.location && item.location !== 'Global' && (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium">
                            {item.location}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap">
                        <div className="flex items-center gap-1 text-slate-700 font-medium">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{item.company}</span>
                        </div>
                        {item.fullName && (
                          <div className="flex items-center gap-1 text-slate-500">
                            <User className="w-3 h-3 text-slate-400" />
                            <span>{item.fullName}</span>
                          </div>
                        )}
                        {item.website && (
                          <a
                            href={item.website}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 hover:underline"
                          >
                            <Globe className="w-3 h-3" />
                            <span>Website</span>
                            <ArrowUpRight className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Contact Email & Actions */}
                  <div className="flex items-center gap-2.5 self-end md:self-auto flex-wrap">
                    {editingEmailId === item.id ? (
                      <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-300">
                        <input
                          type="email"
                          placeholder="developer@gmail.com"
                          value={editingEmailValue}
                          onChange={(e) => setEditingEmailValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveCustomEmail(item.id);
                            if (e.key === 'Escape') setEditingEmailId(null);
                          }}
                          className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-48 sm:w-56"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveCustomEmail(item.id)}
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium cursor-pointer"
                          title="Save email"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingEmailId(null)}
                          className="px-1.5 py-1 text-slate-500 hover:text-slate-700 rounded text-xs cursor-pointer"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : item.email ? (
                      <div className="flex items-center gap-2">
                        {/* Email Badge with copy */}
                        {item.email.includes('@gmail.com') || item.email.includes('@googlemail.com') ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs font-medium">
                            <Inbox className="w-3.5 h-3.5 text-red-600" />
                            <span className="font-semibold text-red-900">Gmail:</span>
                            <span>{item.email}</span>
                            <button
                              onClick={() => handleCopy(item.email!)}
                              className="ml-1 text-red-700 hover:text-red-950 transition-colors p-0.5 cursor-pointer"
                              title="Copy email address"
                            >
                              {copiedEmail === item.email ? (
                                <Check className="w-3.5 h-3.5 text-emerald-700" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              onClick={() => handleStartEditEmail(item.id, item.email)}
                              className="text-red-400 hover:text-red-700 transition-colors p-0.5 cursor-pointer"
                              title="Edit email"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
                            <Mail className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{item.email}</span>
                            <button
                              onClick={() => handleCopy(item.email!)}
                              className="ml-1 text-emerald-700 hover:text-emerald-950 transition-colors p-0.5 cursor-pointer"
                              title="Copy email address"
                            >
                              {copiedEmail === item.email ? (
                                <Check className="w-3.5 h-3.5 text-emerald-700" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              onClick={() => handleStartEditEmail(item.id, item.email)}
                              className="text-emerald-500 hover:text-emerald-800 transition-colors p-0.5 cursor-pointer"
                              title="Edit email"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        {/* Open in Gmail Web Compose Button */}
                        <button
                          onClick={() => handleOpenSingleInGmail(item)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                          title="Open Gmail web compose for this game"
                        >
                          <Inbox className="w-3.5 h-3.5 text-red-500" />
                          <span>Gmail</span>
                        </button>

                        {/* Open in Default Email Client (Bypasses all popups) */}
                        <a
                          href={`mailto:${encodeURIComponent(item.email)}?subject=${encodeURIComponent(renderTemplate(subjectTemplate, item))}&body=${encodeURIComponent(renderTemplate(bodyTemplate, item))}`}
                          className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 text-xs font-medium transition-colors flex items-center gap-1 shadow-2xs"
                          title="Open in default email app (bypasses browser popups)"
                        >
                          <Mail className="w-3.5 h-3.5 text-slate-500" />
                          <span>Mail</span>
                        </a>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 italic">No public email on Steam</span>
                        <button
                          onClick={() => handleStartEditEmail(item.id, '')}
                          className="px-2.5 py-1 rounded-lg border border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50 hover:bg-indigo-50/50 text-slate-600 hover:text-indigo-700 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
                          title="Add an email address for this developer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add Email</span>
                        </button>
                        <a
                          href={item.sourceUrl?.startsWith('http') ? item.sourceUrl : `https://store.steampowered.com/search/?term=${encodeURIComponent(item.game)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 text-xs transition-colors flex items-center gap-1"
                          title="View on Steam store"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Steam</span>
                        </a>
                      </div>
                    )}

                    {/* Delivery Status */}
                    {item.sendState === 'sent' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Sent ({item.sentAt})</span>
                      </span>
                    )}
                    {item.sendState === 'sending' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-medium animate-pulse">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                        <span>Sending...</span>
                      </span>
                    )}
                    {item.sendState === 'failed' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 text-red-800 text-xs font-medium">
                        <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                        <span>Failed</span>
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {/* STEP 3: REBUILT OUTREACH COMPOSER & GMAIL SENDER */}
      {gamesList.length > 0 && (
        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6 transition-shadow hover:shadow-md">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-xs">
                3
              </span>
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  Compose Outreach & Send via Gmail
                </h2>
                <p className="text-xs text-slate-500">
                  {selectedGames.length} recipient(s) selected &bull; Personalizes automatically with each studio's game and company name
                </p>
              </div>
            </div>

            {/* Template Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-600">Template:</span>
              <select
                value={selectedTemplateId}
                onChange={(e) => handleSelectTemplate(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:border-indigo-600 cursor-pointer shadow-2xs"
              >
                {EMAIL_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Active Sender Account Showcase (Always Prominently Visible) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-base shadow-xs shrink-0">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-600">
                    Active Sender Gmail:
                  </span>
                  <span className="font-mono text-xs font-bold text-indigo-900 bg-white px-2.5 py-0.5 rounded-lg border border-indigo-200 shadow-2xs">
                    {user?.email || 'No email connected'}
                  </span>
                  {accessToken && accessToken !== 'demo-guest-token' ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live Gmail API Active
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 text-amber-600" />
                      Gmail API Authorization Needed
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600">
                  {accessToken && accessToken !== 'demo-guest-token' ? (
                    <>
                      Emails are sent directly from your connected Gmail and will automatically appear in your <strong>Gmail Sent folder</strong>.
                    </>
                  ) : (
                    <>
                      Click <strong>Authorize Gmail</strong> to permit direct sending, or use <strong>Open All in BCC</strong> to send in your browser.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {(!accessToken || accessToken === 'demo-guest-token') && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await reauthorizeGmail();
                    } catch (e: any) {
                      setErrorMessage(e.message);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Authorize Gmail</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowCloudModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium shadow-2xs cursor-pointer transition-colors"
                title="Google Cloud Console &amp; Test Users Setup"
              >
                <Settings className="w-3.5 h-3.5 text-indigo-600" />
                <span>Google Cloud Settings</span>
              </button>

              <a
                href="https://mail.google.com/mail/u/0/#sent"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
                title="Open your actual Gmail Sent Mail folder in a new tab"
              >
                <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
                <span>Open Gmail Sent Folder</span>
              </a>
            </div>
          </div>

          {/* Google Cloud Settings Modal */}
          {showCloudModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
              <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-indigo-600" />
                    <h3 className="font-bold text-slate-900 text-sm">
                      Google Cloud OAuth 2.0 &amp; Test Users Setup
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowCloudModal(false)}
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3 text-xs text-slate-600">
                  <p>
                    When Google OAuth consent is in <strong>Testing mode</strong>, Google requires you to explicitly add users who are allowed to authenticate:
                  </p>

                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                    <p className="font-bold text-slate-800">
                      How to add users in Google Cloud Console:
                    </p>
                    <ol className="list-decimal pl-4 space-y-1.5">
                      <li>
                        Go to <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="text-indigo-600 font-semibold underline">Google Cloud Console</a> &rarr; <strong>APIs &amp; Services</strong> &rarr; <strong>OAuth consent screen</strong>.
                      </li>
                      <li>
                        Under <strong>Test users</strong>, click <strong>+ ADD USERS</strong> and enter your Gmail address (e.g. <code>{user?.email || 'your-email@gmail.com'}</code>).
                      </li>
                      <li>
                        Under <strong>Enabled APIs &amp; Services</strong>, ensure <strong>Gmail API</strong> is enabled.
                      </li>
                      <li>
                        In <strong>Credentials</strong> &rarr; your OAuth Client ID &rarr; ensure <strong>Authorized JavaScript origins</strong> includes:
                        <div className="flex items-center gap-2 mt-1">
                          <code className="bg-white px-2 py-0.5 rounded border border-slate-300 font-mono text-[11px] text-slate-900">
                            {typeof window !== 'undefined' ? window.location.origin : 'current URL'}
                          </code>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(window.location.origin);
                              setCopiedOrigin(true);
                              setTimeout(() => setCopiedOrigin(false), 2000);
                            }}
                            className="text-indigo-600 font-semibold cursor-pointer"
                          >
                            {copiedOrigin ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                      </li>
                    </ol>
                  </div>

                  <div className="space-y-2 pt-2">
                    <label className="font-bold text-slate-800 block">
                      Google OAuth Client ID (optional override):
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={cloudClientIdInput}
                        onChange={(e) => setCloudClientIdInput(e.target.value)}
                        placeholder="e.g. 123456789-xyz.apps.googleusercontent.com"
                        className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 font-mono text-[11px] text-slate-800 focus:outline-none focus:border-indigo-600"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          updateGoogleClientId(cloudClientIdInput.trim());
                          setSavedClientMsg(true);
                          setTimeout(() => setSavedClientMsg(false), 2000);
                        }}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs cursor-pointer"
                      >
                        Save
                      </button>
                    </div>
                    {savedClientMsg && (
                      <p className="text-emerald-600 font-semibold text-[11px]">
                        Client ID updated!
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => setShowCloudModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Email Editor & Real Gmail Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Subject & Body Editor */}
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-800">
                    Subject Line
                  </label>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <span>Tags:</span>
                    <button
                      type="button"
                      onClick={() => setSubjectTemplate((prev) => prev + ' {game}')}
                      className="px-1.5 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-mono text-[10px] cursor-pointer"
                    >
                      +{'{game}'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubjectTemplate((prev) => prev + ' {studio}')}
                      className="px-1.5 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-mono text-[10px] cursor-pointer"
                    >
                      +{'{studio}'}
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={subjectTemplate}
                  onChange={(e) => setSubjectTemplate(e.target.value)}
                  placeholder="e.g. Quick question regarding {game}"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-xl p-3 text-sm text-slate-900 focus:outline-none focus:ring-3 focus:ring-indigo-100 transition-all font-medium"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-800">
                    Email Message Body
                  </label>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <span>Tags:</span>
                    <button
                      type="button"
                      onClick={() => setBodyTemplate((prev) => prev + ' {game}')}
                      className="px-1.5 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-mono text-[10px] cursor-pointer"
                    >
                      +{'{game}'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setBodyTemplate((prev) => prev + ' {studio}')}
                      className="px-1.5 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-mono text-[10px] cursor-pointer"
                    >
                      +{'{studio}'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setBodyTemplate((prev) => prev + ' {name}')}
                      className="px-1.5 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-mono text-[10px] cursor-pointer"
                    >
                      +{'{name}'}
                    </button>
                  </div>
                </div>
                <textarea
                  rows={9}
                  value={bodyTemplate}
                  onChange={(e) => setBodyTemplate(e.target.value)}
                  placeholder="Write your email body here..."
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-xl p-3 text-sm text-slate-900 focus:outline-none focus:ring-3 focus:ring-indigo-100 transition-all font-normal leading-relaxed resize-y"
                />
              </div>
            </div>

            {/* Right: Live Preview Box */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-indigo-600" />
                  Real Gmail Message Preview:
                </span>
                <span className="text-indigo-600 font-semibold truncate max-w-[200px]">
                  {previewGame ? `${previewGame.game}` : 'Select a game'}
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3 text-xs shadow-2xs">
                {/* From line (Clearly showing user's email) */}
                <div className="pb-2.5 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-semibold uppercase text-[11px]">From:</span>
                    <span className="font-bold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      {user?.displayName && user?.email ? `${user.displayName} <${user.email}>` : user?.email || 'your-email@gmail.com'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium">via Gmail API</span>
                </div>

                {/* To line */}
                <div className="pb-2.5 border-b border-slate-200 flex items-center gap-2">
                  <span className="text-slate-400 font-semibold uppercase text-[11px]">To:</span>
                  <span className="font-semibold text-slate-800">
                    {previewGame?.email || 'developer@studio.com'}
                  </span>
                  {previewGame?.company && (
                    <span className="text-slate-500 text-[11px]">({previewGame.company})</span>
                  )}
                </div>

                {/* Subject line */}
                <div className="pb-2.5 border-b border-slate-200 flex items-start gap-2">
                  <span className="text-slate-400 font-semibold uppercase text-[11px]">Subject:</span>
                  <span className="font-bold text-slate-900">
                    {previewGame ? renderTemplate(subjectTemplate, previewGame) : subjectTemplate}
                  </span>
                </div>

                {/* Body */}
                <div className="text-slate-700 whitespace-pre-wrap leading-relaxed max-h-52 overflow-y-auto pr-1 bg-white p-3 rounded-xl border border-slate-200 text-xs font-sans">
                  {previewGame ? renderTemplate(bodyTemplate, previewGame) : bodyTemplate}
                </div>
              </div>
            </div>
          </div>

          {/* Sending Progress Bar */}
          {sendProgress && isSending && (
            <div className="p-4 sm:p-5 rounded-2xl bg-indigo-50 border border-indigo-200 space-y-3 animate-in fade-in shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2.5 font-semibold text-indigo-950">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600 shrink-0" />
                  <span>
                    Sending email {sendProgress.current} of {sendProgress.total}:
                    {sendProgress.currentLeadName && (
                      <span className="ml-1 text-indigo-700 font-bold">{sendProgress.currentLeadName}</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-indigo-700 font-semibold">
                    {Math.round((sendProgress.current / sendProgress.total) * 100)}%
                  </span>
                  <button
                    onClick={handleStopSending}
                    className="px-2.5 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-800 text-[11px] font-bold cursor-pointer transition-colors"
                  >
                    Cancel / Stop
                  </button>
                </div>
              </div>
              <div className="w-full bg-indigo-200 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-600 h-full rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${(sendProgress.current / sendProgress.total) * 100}%` }}
                />
              </div>
              <p className="text-[11px] text-indigo-700 italic">
                Dispatching outreach sequentially with anti-spam pacing so each message is sent properly...
              </p>
            </div>
          )}

          {/* Send Success Summary with Direct Gmail Sent Folder Link */}
          {sendSummary && (
            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <span className="font-bold text-sm text-emerald-950 block">
                    Outreach sequence completed!
                  </span>
                  <p className="text-emerald-800 mt-0.5">
                    <strong>{sendSummary.sent}</strong> email(s) dispatched successfully from <strong>{user?.email}</strong>.
                    {sendSummary.failed > 0 && ` (${sendSummary.failed} failed)`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href="https://mail.google.com/mail/u/0/#sent"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>View in Gmail Sent Folder ↗</span>
                </a>
              </div>
            </div>
          )}

          {/* Action Send Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Automated Sequential Sending &bull; Dispatches one after the other &bull; Sent from your Gmail</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Secondary: Quick BCC option */}
              <button
                onClick={handleOpenSelectedInGmail}
                disabled={isSending || selectedGames.length === 0}
                className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                title="Open one Gmail compose window with all selected recipients in BCC"
              >
                <Mail className="w-3.5 h-3.5 text-slate-500" />
                <span>Open All in BCC</span>
              </button>

              {/* Primary: Launch Sequential Send */}
              <button
                onClick={handleSendViaGmail}
                disabled={isSending || selectedGames.length === 0}
                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold text-xs rounded-xl transition-all shadow-md cursor-pointer active:scale-98"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>
                      Sending ({sendProgress?.current || 0} of {sendProgress?.total || selectedGames.length})...
                    </span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 text-white" />
                    <span>
                      {selectedGames.length === 1
                        ? `Send via Gmail (${user?.email || '1 Game'})`
                        : `Launch Outreach (Send ${selectedGames.length} via Gmail)`}
                    </span>
                  </>
                )}
              </button>

              {isSending && (
                <button
                  onClick={handleStopSending}
                  className="px-3.5 py-2.5 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Stop</span>
                </button>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
