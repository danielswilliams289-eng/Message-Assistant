import React from 'react';
import {
  Users,
  UserCheck,
  CheckCircle2,
  Send,
  Mail,
  Clock,
  AlertCircle,
  Play,
  ArrowRight,
  Sparkles,
  Zap,
  Radio,
  Compass,
  ShieldCheck,
  Activity,
  Layers,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

interface DashboardViewProps {
  onNavigateToScout: () => void;
  onNavigateToLeads: () => void;
  onNavigateToSendList: () => void;
  onNavigateToCampaigns: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateToScout,
  onNavigateToLeads,
  onNavigateToSendList,
  onNavigateToCampaigns,
}) => {
  const { leads, campaigns, activities, accessToken } = useAuth();

  // Real Database Metrics
  const totalLeads = leads.length;
  const readyToSend = leads.filter((l) => l.inSendList).length;
  const verifiedEmails = leads.filter((l) => l.emailStatus === 'valid').length;
  const totalCampaigns = campaigns.length;
  const totalSent = campaigns.reduce((acc, c) => acc + (c.sentCount || 0), 0);
  const activeCampaign = campaigns.find((c) => c.status === 'running');

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* 1. Large Hero Section: MISSION CONTROL */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#121626] to-[#0c0f1a] border border-[#202940] p-8 md:p-12 shadow-[0_0_50px_rgba(0,0,0,0.6)]">
        {/* Glow & cyber aesthetic backdrop */}
        <div className="absolute top-0 right-0 w-[500px] h-[350px] bg-gradient-to-br from-violet-600/15 via-cyan-500/10 to-transparent rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-72 h-72 bg-violet-900/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="space-y-4 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-950/70 border border-violet-700/40 text-violet-300 text-xs font-mono font-semibold uppercase tracking-wider shadow-[0_0_12px_rgba(139,92,246,0.25)]">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              MISSION CONTROL TERMINAL
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight font-mono leading-tight">
              READY TO FIND YOUR NEXT CLIENT?
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-sans">
              Scout real leads. Build your campaign. Send directly from Gmail.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={onNavigateToScout}
                className="flex items-center gap-2.5 px-6 py-3.5 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-bold text-xs sm:text-sm tracking-wider uppercase rounded-xl transition-all shadow-[0_0_25px_rgba(139,92,246,0.4)] cursor-pointer active:scale-98"
              >
                <Sparkles className="w-4 h-4 text-cyan-200" />
                <span>START SCOUTING →</span>
              </button>

              <button
                onClick={onNavigateToSendList}
                className="flex items-center gap-2 px-5 py-3.5 bg-[#141b2d] hover:bg-[#1b233a] border border-[#25324d] text-slate-200 font-semibold text-xs sm:text-sm tracking-wide rounded-xl transition-all cursor-pointer"
              >
                <Send className="w-4 h-4 text-cyan-400" />
                <span>VIEW SEND QUEUE ({readyToSend})</span>
              </button>
            </div>
          </div>

          {/* Quick Engine Status Card */}
          <div className="lg:w-80 bg-[#090c14]/90 border border-[#1e263d] rounded-2xl p-5 space-y-4 backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-[#182033] pb-3">
              <span className="text-[11px] font-mono uppercase tracking-widest text-slate-400">
                SYSTEM PIPELINE
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/70 border border-emerald-600/40 text-emerald-400">
                OPTIMIZED
              </span>
            </div>

            <div className="space-y-2.5 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">GMAIL API OAUTH</span>
                <span className={accessToken ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                  {accessToken ? 'CONNECTED ●' : 'NEEDS AUTH ○'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">DELIVERABILITY SCORE</span>
                <span className="text-cyan-400 font-bold">98.4% (INBOX SAFE)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">ANTI-SPAM PACING</span>
                <span className="text-violet-400 font-bold">HUMANIZED JITTER</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Horizontal Intelligence Strip */}
      <div className="bg-[#0c101c] border border-[#1b2338] rounded-2xl p-4 sm:p-6 shadow-xl">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-[#1a233a]">
          {/* LEADS */}
          <div
            onClick={onNavigateToLeads}
            className="p-4 sm:px-6 cursor-pointer hover:bg-white/[0.02] transition-colors rounded-xl group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-mono font-bold tracking-widest text-slate-400 uppercase">
                LEADS
              </span>
              <Users className="w-4 h-4 text-violet-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight">
              {totalLeads.toLocaleString()}
            </div>
            <div className="text-[11px] font-mono text-cyan-400/90 mt-1">
              {verifiedEmails} verified emails
            </div>
          </div>

          {/* READY */}
          <div
            onClick={onNavigateToSendList}
            className="p-4 sm:px-6 cursor-pointer hover:bg-white/[0.02] transition-colors rounded-xl group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-mono font-bold tracking-widest text-slate-400 uppercase">
                READY
              </span>
              <Send className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-3xl sm:text-4xl font-black text-cyan-300 font-mono tracking-tight">
              {readyToSend.toLocaleString()}
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-1">
              in outreach queue
            </div>
          </div>

          {/* CAMPAIGNS */}
          <div
            onClick={onNavigateToCampaigns}
            className="p-4 sm:px-6 cursor-pointer hover:bg-white/[0.02] transition-colors rounded-xl group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-mono font-bold tracking-widest text-slate-400 uppercase">
                CAMPAIGNS
              </span>
              <Mail className="w-4 h-4 text-violet-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight">
              {totalCampaigns.toLocaleString()}
            </div>
            <div className="text-[11px] font-mono text-emerald-400 mt-1">
              {activeCampaign ? '1 currently active' : 'standing by'}
            </div>
          </div>

          {/* SENT */}
          <div
            onClick={onNavigateToCampaigns}
            className="p-4 sm:px-6 cursor-pointer hover:bg-white/[0.02] transition-colors rounded-xl group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-mono font-bold tracking-widest text-slate-400 uppercase">
                SENT
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono tracking-tight">
              {totalSent.toLocaleString()}
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-1">
              via Gmail API
            </div>
          </div>
        </div>
      </div>

      {/* 3. Large "Current Mission" Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span className="text-xs font-mono font-bold tracking-widest text-slate-300 uppercase">
              CURRENT MISSION
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            AUTO-SYNCED TO FIRESTORE & GMAIL API
          </span>
        </div>

        {activeCampaign ? (
          /* Active Live Campaign Card */
          <div className="bg-[#0f1424] border border-emerald-500/40 rounded-3xl p-6 sm:p-8 space-y-6 shadow-[0_0_35px_rgba(16,185,129,0.15)] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-[11px] font-mono font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  LIVE DISPATCH IN PROGRESS
                </div>
                <h3 className="text-2xl font-bold text-white font-mono">{activeCampaign.name}</h3>
                <p className="text-xs text-slate-400 font-mono">
                  Target Niche: <strong className="text-cyan-400">{activeCampaign.niche}</strong> • Sender: {activeCampaign.senderEmail}
                </p>
              </div>

              <button
                onClick={onNavigateToCampaigns}
                className="flex items-center gap-2 px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] cursor-pointer"
              >
                <span>OPEN DISPATCH STAGE →</span>
              </button>
            </div>

            {/* Progress bar */}
            <div className="space-y-2 relative z-10">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">CAMPAIGN DISPATCH COMPLETION</span>
                <span className="text-emerald-400 font-bold">
                  {Math.round(((activeCampaign.sentCount || 0) / (activeCampaign.totalRecipients || 1)) * 100)}%
                  {' '}({activeCampaign.sentCount || 0} / {activeCampaign.totalRecipients} dispatched)
                </span>
              </div>
              <div className="w-full bg-[#080b12] h-3 rounded-full overflow-hidden border border-[#1b233a]">
                <div
                  className="bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, ((activeCampaign.sentCount || 0) / (activeCampaign.totalRecipients || 1)) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        ) : (
          /* No Active Campaign Card */
          <div className="bg-[#0b0e19] border border-[#1c243a] rounded-3xl p-8 sm:p-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-[#121729] border border-[#232d47] text-slate-500 flex items-center justify-center mx-auto">
              <Compass className="w-8 h-8 text-cyan-400" />
            </div>

            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-xl font-bold text-white font-mono tracking-wide">
                NO ACTIVE CAMPAIGN
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 font-mono">
                Your outreach engine is standing by.
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={onNavigateToCampaigns}
                className="inline-flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-bold text-xs font-mono uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(139,92,246,0.3)] cursor-pointer"
              >
                <span>CREATE CAMPAIGN</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. Outreach Workflow Blueprint */}
      <div className="bg-[#090d17] border border-[#1b2338] rounded-2xl p-6 space-y-4">
        <span className="text-[10px] font-mono font-bold tracking-widest text-slate-500 uppercase">
          CORE OPERATION ARCHITECTURE
        </span>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div
            onClick={onNavigateToScout}
            className="p-4 rounded-xl bg-[#0e1322] border border-[#1f2840] hover:border-violet-500/50 transition-all cursor-pointer space-y-2 group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-violet-400 font-bold">STAGE 01</span>
              <Compass className="w-4 h-4 text-violet-400 group-hover:scale-110 transition-transform" />
            </div>
            <h4 className="text-sm font-bold text-white font-mono">SCOUT SOURCES</h4>
            <p className="text-[11px] text-slate-400">
              Input URLs, public directories or raw source text to extract verified emails.
            </p>
          </div>

          <div
            onClick={onNavigateToLeads}
            className="p-4 rounded-xl bg-[#0e1322] border border-[#1f2840] hover:border-cyan-500/50 transition-all cursor-pointer space-y-2 group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-cyan-400 font-bold">STAGE 02</span>
              <Users className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
            </div>
            <h4 className="text-sm font-bold text-white font-mono">CURATE PROSPECTS</h4>
            <p className="text-[11px] text-slate-400">
              Inspect database, filter by target niche, and stage recipients into Send Queue.
            </p>
          </div>

          <div
            onClick={onNavigateToSendList}
            className="p-4 rounded-xl bg-[#0e1322] border border-[#1f2840] hover:border-amber-500/50 transition-all cursor-pointer space-y-2 group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-amber-400 font-bold">STAGE 03</span>
              <Send className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
            </div>
            <h4 className="text-sm font-bold text-white font-mono">BUILD CAMPAIGN</h4>
            <p className="text-[11px] text-slate-400">
              Personalize templates with anti-spam safeguards & live email preview.
            </p>
          </div>

          <div
            onClick={onNavigateToCampaigns}
            className="p-4 rounded-xl bg-[#0e1322] border border-[#1f2840] hover:border-emerald-500/50 transition-all cursor-pointer space-y-2 group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-emerald-400 font-bold">STAGE 04</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
            </div>
            <h4 className="text-sm font-bold text-white font-mono">LIVE GMAIL DISPATCH</h4>
            <p className="text-[11px] text-slate-400">
              Watch sequential dispatch via authenticated Gmail API in real-time.
            </p>
          </div>
        </div>
      </div>

      {/* 5. Live Activity Feed */}
      <div className="bg-[#090d17] border border-[#1b2338] rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#182033] pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-mono font-bold tracking-widest text-slate-300 uppercase">
              LIVE SYSTEM ACTIVITY LOG
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            {activities.length} EVENTS RECORDED
          </span>
        </div>

        {activities.length === 0 ? (
          <p className="text-xs font-mono text-slate-500 py-4 text-center">
            No system events yet. Scout leads or launch an outreach campaign to see live events.
          </p>
        ) : (
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {activities.slice(0, 8).map((act) => (
              <div
                key={act.id}
                className="flex items-center justify-between p-2.5 rounded-lg bg-[#0e121e] border border-[#192236] text-xs font-mono"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  <span className="text-slate-200">{act.description}</span>
                </div>
                <span className="text-[10px] text-slate-500 shrink-0">
                  {new Date(act.createdAt).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
