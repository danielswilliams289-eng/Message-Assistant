import React, { useState } from 'react';
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Compass,
  Zap,
  Globe,
  Sliders,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Check,
  ExternalLink,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { Lead } from '../types';

interface ScoutViewProps {
  onLeadsScouted?: () => void;
}

const PRESET_NICHES = [
  'Game Developers',
  'SaaS',
  'YouTubers',
  'Agencies',
  'Ecommerce',
  'Coaches',
  'Web3 / Crypto',
  'Healthcare',
];

export const ScoutView: React.FC<ScoutViewProps> = ({ onLeadsScouted }) => {
  const { bulkAddLeads, addLead, leads } = useAuth();
  const [sources, setSources] = useState('');
  const [selectedNiches, setSelectedNiches] = useState<string[]>(['Game Developers']);
  const [customNiche, setCustomNiche] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Advanced targeting filters
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [targetLocation, setTargetLocation] = useState('');
  const [companySize, setCompanySize] = useState('any');
  const [requireWebsite, setRequireWebsite] = useState(false);
  const [requireEmail, setRequireEmail] = useState(true);
  const [leadType, setLeadType] = useState('Business');
  const [customKeywords, setCustomKeywords] = useState('');

  // Processing state
  const [loading, setLoading] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [backendProgress, setBackendProgress] = useState<{ source: string; status: 'processed' | 'skipped' | 'failed'; message?: string }[]>([]);
  const [extractedLeads, setExtractedLeads] = useState<any[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Complete stats
  const [scoutCompleted, setScoutCompleted] = useState(false);
  const [discoveredCount, setDiscoveredCount] = useState(0);
  const [validEmailCount, setValidEmailCount] = useState(0);
  const [duplicatesCount, setDuplicatesCount] = useState(0);
  const [needReviewCount, setNeedReviewCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);

  const toggleNiche = (niche: string) => {
    if (selectedNiches.includes(niche)) {
      if (selectedNiches.length > 1) {
        setSelectedNiches(selectedNiches.filter((n) => n !== niche));
      }
    } else {
      setSelectedNiches([...selectedNiches, niche]);
    }
  };

  const handleAddCustomNiche = () => {
    if (customNiche.trim() && !selectedNiches.includes(customNiche.trim())) {
      setSelectedNiches([...selectedNiches, customNiche.trim()]);
      setCustomNiche('');
      setShowCustomInput(false);
    }
  };

  const activeNicheString = selectedNiches.join(', ');

  const handleScout = async () => {
    if (!sources.trim()) {
      setErrorMessage('Please paste at least one lead source (URLs, directories, or business listings).');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setScoutCompleted(false);
    setProgressPercent(15);
    setBackendProgress([]);
    setExtractedLeads([]);

    // Progress simulation step
    const timer = setInterval(() => {
      setProgressPercent((prev) => (prev < 88 ? prev + 12 : prev));
    }, 400);

    try {
      const response = await fetch('/api/scout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sources,
          targetNiche: activeNicheString,
          leadType,
          advanced: {
            location: targetLocation || null,
            companySize: companySize !== 'any' ? companySize : null,
            requireWebsite,
            requireEmail,
            customKeywords: customKeywords || null,
          },
        }),
      });

      clearInterval(timer);
      setProgressPercent(100);

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Scout extraction failed');
      }

      const newLeads = data.leads || [];
      setBackendProgress(data.progress || []);
      setExtractedLeads(newLeads);

      // Deduplicate against existing Firestore leads
      let dupes = 0;
      let validEmails = 0;
      let review = 0;
      const leadsToSave: Omit<Lead, 'id' | 'userId' | 'createdAt'>[] = [];
      const seenBatchEmails = new Set<string>();
      const seenBatchCompanies = new Set<string>();

      for (const item of newLeads) {
        const itemEmail = item.email ? item.email.toLowerCase().trim() : null;
        const itemCompany = item.company ? item.company.toLowerCase().trim() : null;

        if (item.emailStatus === 'valid') validEmails++;
        if (!item.email || item.emailStatus === 'unknown') review++;

        const existsByEmail = itemEmail && leads.some((l) => l.email && l.email.toLowerCase().trim() === itemEmail);
        const existsByCompany = itemCompany && !itemEmail && leads.some((l) => l.company && l.company.toLowerCase().trim() === itemCompany);
        const existsInCurrentBatch = (itemEmail && seenBatchEmails.has(itemEmail)) || (itemCompany && !itemEmail && seenBatchCompanies.has(itemCompany));

        if (existsByEmail || existsByCompany || existsInCurrentBatch) {
          dupes++;
        } else {
          if (itemEmail) seenBatchEmails.add(itemEmail);
          if (itemCompany) seenBatchCompanies.add(itemCompany);

          leadsToSave.push({
            fullName: item.fullName || null,
            firstName: item.firstName || null,
            lastName: item.lastName || null,
            company: item.company || 'Unknown Company',
            email: item.email || null,
            phone: item.phone || null,
            website: item.website || null,
            location: item.location || targetLocation || null,
            niche: item.niche || selectedNiches[0] || 'Business',
            sourceUrl: item.sourceUrl,
            sourceType: item.sourceType || leadType,
            emailStatus: item.emailStatus || 'unknown',
            outreachStatus: 'not_contacted',
            inSendList: false,
          });
        }
      }

      let saved = 0;
      if (leadsToSave.length > 0) {
        if (bulkAddLeads) {
          saved = await bulkAddLeads(leadsToSave);
        } else {
          for (const l of leadsToSave) {
            await addLead(l);
            saved++;
          }
        }
      }

      setDiscoveredCount(newLeads.length);
      setValidEmailCount(validEmails);
      setDuplicatesCount(dupes);
      setNeedReviewCount(review);
      setSavedCount(saved);
      setScoutCompleted(true);
    } catch (err: any) {
      clearInterval(timer);
      console.error('Scout error:', err);
      setErrorMessage(err.message || 'Scout extraction failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-cyan-400" />
          <h1 className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
            SCOUT ENGINE
          </h1>
        </div>
        <p className="text-sm text-slate-400 font-sans">
          Find the right people from the sources you provide.
        </p>
      </div>

      {/* Main Command-Style Input Workspace */}
      <div className="relative rounded-3xl bg-[#0d111c] border border-[#1f2840] p-6 sm:p-8 shadow-2xl focus-within:border-cyan-500/60 transition-all">
        <div className="flex items-center justify-between mb-3 text-xs font-mono">
          <span className="font-bold tracking-widest text-slate-300 uppercase flex items-center gap-2">
            <Compass className="w-4 h-4 text-violet-400" />
            PASTE YOUR LEAD SOURCES
          </span>
          <span className="text-slate-500 text-[11px]">
            URLs, directories, company websites, public contact text
          </span>
        </div>

        <textarea
          rows={7}
          value={sources}
          onChange={(e) => setSources(e.target.value)}
          disabled={loading}
          placeholder="Drop URLs, public source text, directories, websites, or other authorized lead sources here...&#10;&#10;e.g.:&#10;https://example.com&#10;John Smith, CEO at Apex Games, contact@apexgames.io&#10;Studio XYZ | studioxyz.com | dev@studioxyz.com | San Francisco"
          className="w-full bg-[#080b13] border border-[#182033] rounded-2xl p-4 text-xs sm:text-sm text-slate-200 placeholder-slate-600 font-mono focus:outline-none focus:border-cyan-500/80 transition-all resize-y"
        />

        {/* Action Button inside workspace */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 mt-2 border-t border-[#182033]">
          <div className="text-[11px] font-mono text-slate-500 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            <span>Multiple lines parsed concurrently • Auto-deduplicated</span>
          </div>

          <button
            onClick={handleScout}
            disabled={loading || !sources.trim()}
            className="flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 disabled:opacity-40 text-white font-bold text-xs font-mono uppercase tracking-wider rounded-xl transition-all shadow-[0_0_25px_rgba(6,182,212,0.3)] cursor-pointer active:scale-98"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-cyan-200" />
                <span>PROCESSING SOURCES...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-cyan-200" />
                <span>SCOUT LEADS →</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Target Niche Selector */}
      <div className="bg-[#0b0f1a] border border-[#1a2236] rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-bold tracking-widest text-slate-300 uppercase">
            TARGET NICHE
          </span>
          <span className="text-[11px] font-mono text-slate-500">
            Selected: <strong className="text-cyan-400">{activeNicheString}</strong>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {PRESET_NICHES.map((niche) => {
            const isSelected = selectedNiches.includes(niche);
            return (
              <button
                key={niche}
                onClick={() => toggleNiche(niche)}
                className={`px-3.5 py-2 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-violet-950/80 border border-cyan-400/80 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                    : 'bg-[#101424] border border-[#1e273e] text-slate-400 hover:text-white hover:border-slate-600'
                }`}
              >
                {isSelected ? '✓ ' : ''}{niche}
              </button>
            );
          })}

          {!showCustomInput ? (
            <button
              onClick={() => setShowCustomInput(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-mono font-semibold bg-[#101424] border border-dashed border-slate-600 text-slate-400 hover:text-cyan-400 hover:border-cyan-400 transition-colors cursor-pointer"
            >
              + Custom niche
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Enter custom niche..."
                value={customNiche}
                onChange={(e) => setCustomNiche(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomNiche()}
                className="bg-[#080b13] border border-cyan-500/60 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none"
                autoFocus
              />
              <button
                onClick={handleAddCustomNiche}
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs rounded-xl font-mono cursor-pointer"
              >
                Add
              </button>
              <button
                onClick={() => setShowCustomInput(false)}
                className="text-slate-500 hover:text-slate-300 text-xs font-mono p-1 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Advanced Targeting (Accordion) */}
      <div className="bg-[#0b0f1a] border border-[#1a2236] rounded-2xl overflow-hidden">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between p-5 text-left text-xs font-mono font-bold tracking-widest text-slate-300 uppercase hover:bg-white/[0.02] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <Sliders className="w-4 h-4 text-violet-400" />
            <span>ADVANCED TARGETING</span>
          </div>
          <div className="flex items-center gap-2 text-slate-500 text-[11px]">
            <span>Location, Company Size, Keyword Filters</span>
            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {showAdvanced && (
          <div className="p-6 pt-2 border-t border-[#182033] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs font-mono">
            <div className="space-y-1.5">
              <label className="text-slate-400 text-[11px] uppercase tracking-wider block">
                Target Location
              </label>
              <input
                type="text"
                placeholder="e.g. United States, Europe, Remote"
                value={targetLocation}
                onChange={(e) => setTargetLocation(e.target.value)}
                className="w-full bg-[#080b13] border border-[#1e273e] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-400 text-[11px] uppercase tracking-wider block">
                Company Size
              </label>
              <select
                value={companySize}
                onChange={(e) => setCompanySize(e.target.value)}
                className="w-full bg-[#080b13] border border-[#1e273e] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="any">Any Company Size</option>
                <option value="1-10">1-10 (Seed / Boutique)</option>
                <option value="11-50">11-50 (Growth)</option>
                <option value="51-200">51-200 (Mid-Market)</option>
                <option value="200+">200+ (Enterprise)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-400 text-[11px] uppercase tracking-wider block">
                Lead Type
              </label>
              <select
                value={leadType}
                onChange={(e) => setLeadType(e.target.value)}
                className="w-full bg-[#080b13] border border-[#1e273e] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="Business">Business / Company</option>
                <option value="Developer">Game / Software Developer</option>
                <option value="Creator">Content Creator / YouTuber</option>
                <option value="Agency">Agency / Studio</option>
                <option value="Executive">Founder / Decision Maker</option>
              </select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-slate-400 text-[11px] uppercase tracking-wider block">
                Custom Keywords
              </label>
              <input
                type="text"
                placeholder="e.g. Unity, Unreal Engine, SaaS, Indie, B2B"
                value={customKeywords}
                onChange={(e) => setCustomKeywords(e.target.value)}
                className="w-full bg-[#080b13] border border-[#1e273e] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center gap-4 pt-4 sm:col-span-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={requireEmail}
                  onChange={(e) => setRequireEmail(e.target.checked)}
                  className="rounded bg-[#080b13] border-[#1e273e] text-cyan-500 focus:ring-0"
                />
                <span className="text-[11px]">Email Required</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-xs font-mono text-rose-300 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* SCOUTING ANIMATION (Real Processing Interface) */}
      {loading && (
        <div className="bg-[#0b0e19] border border-cyan-500/50 rounded-3xl p-6 sm:p-8 space-y-6 shadow-[0_0_35px_rgba(6,182,212,0.2)]">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                <h3 className="text-sm font-bold font-mono tracking-widest text-cyan-300 uppercase">
                  SCOUT ENGINE ACTIVE
                </h3>
              </div>
              <p className="text-xs font-mono text-slate-400">SOURCE ANALYSIS IN PROGRESS</p>
            </div>
            <span className="text-lg font-mono font-black text-cyan-400">
              {progressPercent}%
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-[#080b13] h-3 rounded-full overflow-hidden border border-[#1a2338]">
            <div
              className="bg-gradient-to-r from-violet-600 via-indigo-500 to-cyan-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Checkpoints */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
            <div className="flex items-center gap-2 text-emerald-400">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Source inputs discovered</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Metadata & websites analyzed</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Businesses & decision-makers identified</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Contact email validation check complete</span>
            </div>
            <div className="flex items-center gap-2 text-cyan-300 animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
              <span>Processing live streams & deduplication...</span>
            </div>
          </div>
        </div>
      )}

      {/* SCOUT COMPLETE REPORT */}
      {scoutCompleted && (
        <div className="bg-[#0b101f] border border-emerald-500/50 rounded-3xl p-6 sm:p-8 space-y-6 shadow-[0_0_35px_rgba(16,185,129,0.2)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 text-xs font-mono font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                SCOUT COMPLETE
              </div>
              <h3 className="text-xl font-bold font-mono text-white">
                Intelligence Extraction Finished
              </h3>
            </div>

            {onLeadsScouted && (
              <button
                onClick={onLeadsScouted}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] cursor-pointer"
              >
                <span>VIEW LEADS IN DATABASE →</span>
              </button>
            )}
          </div>

          {/* Metrics summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center font-mono">
            <div className="p-3 rounded-xl bg-[#0e1424] border border-[#1f2840]">
              <span className="text-[10px] text-slate-400 block uppercase">Discovered</span>
              <span className="text-2xl font-bold text-white">{discoveredCount}</span>
            </div>
            <div className="p-3 rounded-xl bg-[#0e1424] border border-[#1f2840]">
              <span className="text-[10px] text-emerald-400 block uppercase">Valid Emails</span>
              <span className="text-2xl font-bold text-emerald-400">{validEmailCount}</span>
            </div>
            <div className="p-3 rounded-xl bg-[#0e1424] border border-[#1f2840]">
              <span className="text-[10px] text-amber-400 block uppercase">Duplicates Filtered</span>
              <span className="text-2xl font-bold text-amber-400">{duplicatesCount}</span>
            </div>
            <div className="p-3 rounded-xl bg-[#0e1424] border border-[#1f2840]">
              <span className="text-[10px] text-cyan-400 block uppercase">Saved to Base</span>
              <span className="text-2xl font-bold text-cyan-400">{savedCount}</span>
            </div>
          </div>

          {/* Quick list preview of new leads */}
          {extractedLeads.length > 0 && (
            <div className="space-y-2 pt-2">
              <span className="text-[11px] font-mono text-slate-400 block uppercase">
                Extracted Prospect Preview
              </span>
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {extractedLeads.slice(0, 10).map((l, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-[#080b13] border border-[#182033] text-xs font-mono"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <strong className="text-white">{l.company}</strong>
                      {l.fullName && <span className="text-slate-400">({l.fullName})</span>}
                    </div>
                    <span className="text-cyan-400 truncate max-w-xs">{l.email || 'No email listed'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
