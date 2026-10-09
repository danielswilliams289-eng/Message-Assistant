import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

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
  const { user, login, accessToken, bulkAddLeads } = useAuth();

  // Step 1: Input text
  const [sources, setSources] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Step 2: Discovered games list
  const [gamesList, setGamesList] = useState<DiscoveredGameLead[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'has_email' | 'selected'>('all');
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // Step 3: Outreach & Sending
  const [selectedTemplateId, setSelectedTemplateId] = useState(EMAIL_TEMPLATES[0].id);
  const [subjectTemplate, setSubjectTemplate] = useState(EMAIL_TEMPLATES[0].subject);
  const [bodyTemplate, setBodyTemplate] = useState(EMAIL_TEMPLATES[0].body);
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState<{ current: number; total: number } | null>(null);
  const [sendSummary, setSendSummary] = useState<{ sent: number; failed: number } | null>(null);

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

  // Analyze games
  const handleAnalyzeGames = async () => {
    if (!sources.trim()) {
      setErrorMessage('Please paste some game titles or Steam search results first.');
      return;
    }

    setAnalyzing(true);
    setErrorMessage(null);
    setSendSummary(null);

    try {
      const response = await fetch('/api/scout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sources,
          targetNiche: 'Game Development',
          leadType: 'Game Studio',
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze games');
      }

      const rawLeads: any[] = data.leads || [];
      if (rawLeads.length === 0) {
        setErrorMessage('No games could be extracted from the text. Try pasting a clear list of titles or Steam search results.');
        return;
      }

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

        return {
          id: `game_${Date.now()}_${index}`,
          game: gameName,
          company: companyName,
          fullName: item.fullName || (item.firstName ? `${item.firstName} ${item.lastName || ''}`.trim() : null),
          email: item.email || null,
          website: item.website || null,
          location: item.location || 'Global',
          emailStatus: item.emailStatus || 'unknown',
          sourceUrl: item.sourceUrl || 'Steam Input',
          selected: !!item.email, // preselect items that have an email
          sendState: 'idle',
        };
      });

      setGamesList(formatted);

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

  // Open single game in Gmail web compose
  const handleOpenSingleInGmail = (item: DiscoveredGameLead) => {
    if (!item.email) return;
    const subj = encodeURIComponent(renderTemplate(subjectTemplate, item));
    const body = encodeURIComponent(renderTemplate(bodyTemplate, item));
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(item.email)}&su=${subj}&body=${body}`;
    window.open(url, '_blank');
  };

  // Open selected games in Gmail web compose (BCC)
  const handleOpenSelectedInGmail = () => {
    if (selectedGames.length === 0) return;
    const emails = selectedGames.map((g) => g.email).filter((e): e is string => Boolean(e));
    if (emails.length === 0) return;
    const firstGame = selectedGames[0];
    const subj = encodeURIComponent(renderTemplate(subjectTemplate, firstGame));
    const body = encodeURIComponent(renderTemplate(bodyTemplate, firstGame));

    if (emails.length === 1) {
      const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(emails[0])}&su=${subj}&body=${body}`;
      window.open(url, '_blank');
    } else {
      const bcc = encodeURIComponent(emails.join(','));
      const url = `https://mail.google.com/mail/?view=cm&fs=1&bcc=${bcc}&su=${subj}&body=${body}`;
      window.open(url, '_blank');
    }
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

  // Direct send via connected Gmail API
  const handleSendViaGmail = async () => {
    if (selectedGames.length === 0) {
      setErrorMessage('Please select at least one game with an email address to send outreach to.');
      return;
    }

    if (!accessToken) {
      try {
        await login();
      } catch (err: any) {
        setErrorMessage('Please connect your Google account to send emails directly via Gmail.');
        return;
      }
    }

    setIsSending(true);
    setErrorMessage(null);
    setSendSummary(null);
    setSendProgress({ current: 0, total: selectedGames.length });

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < selectedGames.length; i++) {
      const gameItem = selectedGames[i];
      setSendProgress({ current: i + 1, total: selectedGames.length });

      setGamesList((prev) =>
        prev.map((g) => (g.id === gameItem.id ? { ...g, sendState: 'sending' } : g))
      );

      const renderedSubject = renderTemplate(subjectTemplate, gameItem);
      const renderedBody = renderTemplate(bodyTemplate, gameItem);

      try {
        const response = await fetch('/api/gmail/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
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

      await new Promise((resolve) => setTimeout(resolve, 400));
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
          Paste any Steam search page, list of game titles, or store links below. We'll automatically identify each developer studio, find verified contact emails, and let you reach out in one click.
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

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>
              {sources
                ? `${sources.split('\n').filter(Boolean).length} lines ready to analyze`
                : 'Waiting for games...'}
            </span>
          </div>

          <button
            onClick={handleAnalyzeGames}
            disabled={analyzing || !sources.trim()}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold text-sm rounded-xl transition-all shadow-sm cursor-pointer active:scale-98"
          >
            {analyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Finding Game Developers & Contacts...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Analyze Games & Find Contacts</span>
              </>
            )}
          </button>
        </div>

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

            <div className="flex items-center gap-1.5 text-xs w-full sm:w-auto justify-start sm:justify-end">
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
                  <div className="flex items-center gap-3 self-end md:self-auto flex-wrap">
                    {item.email ? (
                      <div className="flex items-center gap-2">
                        {/* Email Badge with copy */}
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
                        </div>

                        {/* Open in Gmail Web Compose Button */}
                        <button
                          onClick={() => handleOpenSingleInGmail(item)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                          title="Open Gmail web compose for this game"
                        >
                          <Inbox className="w-3.5 h-3.5 text-red-500" />
                          <span>Gmail</span>
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">No email available</span>
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

      {/* STEP 3: OUTREACH COMPOSER & SENDER */}
      {gamesList.length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6 transition-shadow hover:shadow-md">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                3
              </span>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Compose Outreach & Send via Gmail
                </h2>
                <p className="text-xs text-slate-500">
                  {selectedGames.length} recipients selected &bull; Personalizes automatically with game and studio name
                </p>
              </div>
            </div>

            {/* Template selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-600">Template:</span>
              <select
                value={selectedTemplateId}
                onChange={(e) => handleSelectTemplate(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:border-indigo-600 cursor-pointer"
              >
                {EMAIL_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Email Form & Dynamic Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Subject & Body Editor */}
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Subject Line
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Tags: <code className="text-indigo-600 font-medium">{'{game}'}</code>, <code className="text-indigo-600 font-medium">{'{studio}'}</code>
                  </span>
                </div>
                <input
                  type="text"
                  value={subjectTemplate}
                  onChange={(e) => setSubjectTemplate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-xl p-3 text-sm text-slate-900 focus:outline-none focus:ring-3 focus:ring-indigo-100 transition-all font-normal"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Email Message Body
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Tags: <code className="text-indigo-600 font-medium">{'{name}'}</code>, <code className="text-indigo-600 font-medium">{'{game}'}</code>, <code className="text-indigo-600 font-medium">{'{studio}'}</code>
                  </span>
                </div>
                <textarea
                  rows={9}
                  value={bodyTemplate}
                  onChange={(e) => setBodyTemplate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-xl p-3 text-sm text-slate-900 focus:outline-none focus:ring-3 focus:ring-indigo-100 transition-all font-normal leading-relaxed resize-y"
                />
              </div>
            </div>

            {/* Right: Live Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold text-slate-700">Live Preview:</span>
                <span className="text-indigo-600 font-medium truncate max-w-[220px]">
                  {previewGame ? `${previewGame.game} (${previewGame.company})` : 'Select a game'}
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3 text-xs">
                <div className="pb-2 border-b border-slate-200 flex items-center gap-2">
                  <span className="text-slate-400 font-medium">To:</span>
                  <span className="font-semibold text-slate-800">
                    {previewGame?.email || 'developer@studio.com'}
                  </span>
                </div>
                <div className="pb-2 border-b border-slate-200 flex items-start gap-2">
                  <span className="text-slate-400 font-medium">Subject:</span>
                  <span className="font-semibold text-slate-900">
                    {previewGame ? renderTemplate(subjectTemplate, previewGame) : subjectTemplate}
                  </span>
                </div>
                <div className="text-slate-700 whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto pr-1">
                  {previewGame ? renderTemplate(bodyTemplate, previewGame) : bodyTemplate}
                </div>
              </div>
            </div>
          </div>

          {/* Sending Progress Bar */}
          {sendProgress && isSending && (
            <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100 space-y-2">
              <div className="flex items-center justify-between text-xs text-indigo-900 font-medium">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                  Sending via Gmail... ({sendProgress.current} of {sendProgress.total})
                </span>
                <span>
                  {Math.round((sendProgress.current / sendProgress.total) * 100)}%
                </span>
              </div>
              <div className="w-full bg-indigo-200 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${(sendProgress.current / sendProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Send Success Summary */}
          {sendSummary && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Outreach complete! <strong>{sendSummary.sent}</strong> email(s) sent successfully
                  {sendSummary.failed > 0 && ` (${sendSummary.failed} failed)`}.
                </span>
              </div>
            </div>
          )}

          {/* Action Send Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Direct outreach via Gmail &bull; Real sender address</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Fallback 1: Open in Gmail Web Compose */}
              <button
                onClick={handleOpenSelectedInGmail}
                disabled={selectedGames.length === 0}
                className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                title="Open Gmail web compose with selected recipients"
              >
                <Inbox className="w-3.5 h-3.5 text-red-500" />
                <span>Open in Gmail (Web)</span>
              </button>

              {/* Primary 2: Send via connected Gmail account */}
              <button
                onClick={handleSendViaGmail}
                disabled={isSending || selectedGames.length === 0}
                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold text-xs rounded-xl transition-all shadow-sm cursor-pointer active:scale-98"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 text-white" />
                    <span>Send to {selectedGames.length} Games via Gmail</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
