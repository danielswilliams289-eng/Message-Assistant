import React, { useState } from 'react';
import {
  Send,
  Trash2,
  Search,
  Filter,
  Eye,
  CheckCircle,
  Clock,
  AlertCircle,
  MailCheck,
  PlusCircle,
  Download,
  Zap,
  ArrowRight,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { Lead } from '../types';

interface SendListViewProps {
  onOpenCreateCampaign: (preselectedLeads?: Lead[]) => void;
  onOpenLeadDetail?: (lead: Lead) => void;
  onNavigateToLeads?: () => void;
}

export const SendListView: React.FC<SendListViewProps> = ({
  onOpenCreateCampaign,
  onOpenLeadDetail,
  onNavigateToLeads,
}) => {
  const { leads, bulkRemoveFromSendList, accessToken } = useAuth();
  const [search, setSearch] = useState('');
  const [nicheFilter, setNicheFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Send List items are leads with inSendList == true
  const sendListLeads = leads.filter((l) => Boolean(l.inSendList));

  const niches = Array.from(new Set(sendListLeads.map((l) => l.niche).filter(Boolean)));

  const filteredLeads = sendListLeads.filter((lead) => {
    const matchesSearch =
      !search.trim() ||
      (lead.company && lead.company.toLowerCase().includes(search.toLowerCase())) ||
      (lead.fullName && lead.fullName.toLowerCase().includes(search.toLowerCase())) ||
      (lead.email && lead.email.toLowerCase().includes(search.toLowerCase()));

    const matchesNiche = nicheFilter === 'all' || lead.niche === nicheFilter;
    return matchesSearch && matchesNiche;
  });

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredLeads.length && filteredLeads.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredLeads.map((l) => l.id!).filter(Boolean));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const handleRemoveSelected = async () => {
    if (selectedIds.length === 0) return;
    await bulkRemoveFromSendList(selectedIds);
    setSelectedIds([]);
  };

  const handleLaunchCampaign = () => {
    const targetLeads =
      selectedIds.length > 0
        ? sendListLeads.filter((l) => l.id && selectedIds.includes(l.id))
        : sendListLeads;
    onOpenCreateCampaign(targetLeads);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#182033] pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-cyan-400" />
            <h1 className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
              SEND QUEUE
            </h1>
          </div>
          <p className="text-sm text-slate-400 font-sans">
            {sendListLeads.length} prospects ready for outreach staging.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {onNavigateToLeads && (
            <button
              onClick={onNavigateToLeads}
              className="px-4 py-2.5 bg-[#0f1424] hover:bg-[#161e36] text-slate-300 hover:text-white border border-[#202b47] rounded-xl text-xs font-mono transition-all cursor-pointer"
            >
              + Add More From Intelligence Base
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Queue on Left, Persistent Campaign Control Panel on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Send Queue List (Span 2) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filter & Selection Bar */}
          <div className="bg-[#0b0e19] border border-[#1a2338] rounded-2xl p-4 flex flex-col sm:flex-row gap-3 items-center justify-between shadow-xl">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Filter queue..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#07090e] border border-[#1e273e] rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto text-xs font-mono justify-between sm:justify-end">
              {niches.length > 0 && (
                <select
                  value={nicheFilter}
                  onChange={(e) => setNicheFilter(e.target.value)}
                  className="bg-[#07090e] border border-[#1e273e] text-slate-300 rounded-xl px-2.5 py-1.5 focus:outline-none"
                >
                  <option value="all">All Niches ({niches.length})</option>
                  {niches.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              )}

              {selectedIds.length > 0 && (
                <button
                  onClick={handleRemoveSelected}
                  className="px-3 py-1.5 bg-rose-950/60 border border-rose-500/40 text-rose-300 rounded-xl hover:bg-rose-900/60 transition-colors cursor-pointer"
                >
                  Remove ({selectedIds.length})
                </button>
              )}
            </div>
          </div>

          {/* Queue List Cards */}
          {filteredLeads.length === 0 ? (
            <div className="bg-[#090d17] border border-[#1a2238] rounded-2xl p-16 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#121626] border border-[#202940] text-slate-500 flex items-center justify-center mx-auto">
                <Send className="w-6 h-6 text-slate-500" />
              </div>
              <h3 className="text-base font-bold font-mono text-slate-300">SEND QUEUE IS EMPTY</h3>
              <p className="text-xs font-mono text-slate-500 max-w-sm mx-auto">
                Go to the Intelligence Base and select contacts to add them to your launch queue.
              </p>
              {onNavigateToLeads && (
                <button
                  onClick={onNavigateToLeads}
                  className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-cyan-600 text-white font-bold text-xs font-mono rounded-xl cursor-pointer"
                >
                  Open Intelligence Base →
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLeads.map((lead) => {
                const isSelected = lead.id ? selectedIds.includes(lead.id) : false;
                return (
                  <div
                    key={lead.id}
                    className={`bg-[#0a0e1a] border rounded-2xl p-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      isSelected
                        ? 'border-cyan-500 bg-cyan-950/20'
                        : 'border-[#1b233a] hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => lead.id && toggleSelectOne(lead.id)}
                        className="rounded bg-[#07090e] border-[#222b40] text-cyan-500 focus:ring-0 cursor-pointer"
                      />

                      <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] shrink-0" />

                      <div className="space-y-0.5">
                        <div className="font-bold text-white text-sm font-mono flex items-center gap-2">
                          <span>{lead.fullName || lead.firstName || 'Contact'}</span>
                          <span className="text-slate-500 font-normal">/</span>
                          <span className="text-cyan-300">{lead.company}</span>
                        </div>
                        <div className="text-xs font-mono text-slate-400">
                          {lead.email}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 pl-7 sm:pl-0">
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono uppercase tracking-wider bg-violet-950/60 border border-violet-700/40 text-violet-300">
                        {lead.niche}
                      </span>

                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold font-mono uppercase tracking-wider bg-emerald-950/80 border border-emerald-500/50 text-emerald-400">
                        READY TO SEND
                      </span>

                      <button
                        onClick={async () => {
                          if (lead.id) {
                            await bulkRemoveFromSendList([lead.id]);
                          }
                        }}
                        title="Remove from queue"
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Persistent Campaign Launch Control Panel */}
        <div className="space-y-5">
          <div className="bg-[#0c101d] border border-[#1d263e] rounded-3xl p-6 space-y-6 shadow-2xl sticky top-20">
            <div className="flex items-center justify-between border-b border-[#182033] pb-4">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-mono font-bold tracking-widest text-white uppercase">
                  CAMPAIGN CONTROL
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-violet-950 text-violet-300 border border-violet-800">
                READY
              </span>
            </div>

            {/* Staged stats */}
            <div className="space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#07090e] border border-[#161e33]">
                <span className="text-slate-400">STAGED RECIPIENTS</span>
                <span className="text-lg font-bold text-cyan-300">
                  {selectedIds.length > 0 ? `${selectedIds.length} (Selected)` : sendListLeads.length}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-[#07090e] border border-[#161e33]">
                <span className="text-slate-400">GMAIL CONNECTION</span>
                <span className={accessToken ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                  {accessToken ? 'AUTHORIZED ●' : 'NEEDS OAUTH ○'}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-[#07090e] border border-[#161e33]">
                <span className="text-slate-400">DELIVERABILITY SHIELD</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> INBOX PRIMARY
                </span>
              </div>
            </div>

            {/* Launch CTA */}
            <div className="space-y-2 pt-2">
              <button
                onClick={handleLaunchCampaign}
                disabled={sendListLeads.length === 0}
                className="w-full flex items-center justify-center gap-2.5 py-4 px-6 bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 disabled:opacity-40 text-white font-bold text-xs font-mono uppercase tracking-wider rounded-2xl transition-all shadow-[0_0_25px_rgba(6,182,212,0.35)] cursor-pointer active:scale-98"
              >
                <Sparkles className="w-4 h-4 text-cyan-200" />
                <span>BUILD & LAUNCH CAMPAIGN →</span>
              </button>

              <p className="text-[11px] font-mono text-slate-500 text-center leading-relaxed">
                Opens split-screen campaign builder with live email preview and anti-spam deliverability check.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
