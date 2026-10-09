import React, { useState } from 'react';
import { Mail, Plus, Clock, CheckCircle2, AlertCircle, ChevronRight, Eye, Radio, Sparkles } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { Campaign } from '../types';

interface CampaignsListViewProps {
  onOpenCreateModal: () => void;
  onSelectCampaign: (campaignId: string) => void;
}

export const CampaignsListView: React.FC<CampaignsListViewProps> = ({
  onOpenCreateModal,
  onSelectCampaign,
}) => {
  const { campaigns } = useAuth();
  const [filter, setFilter] = useState<'all' | 'running' | 'completed'>('all');

  const filtered = campaigns.filter((c) => {
    if (filter === 'all') return true;
    return c.status === filter;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#182033] pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-violet-400" />
            <h1 className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
              CAMPAIGN CONTROL
            </h1>
          </div>
          <p className="text-sm text-slate-400 font-sans">
            Manage and dispatch personalized email outreach campaigns via authenticated Gmail API.
          </p>
        </div>

        <button
          onClick={onOpenCreateModal}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-bold text-xs font-mono uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(139,92,246,0.35)] cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>CREATE CAMPAIGN</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 text-xs font-mono">
        <button
          onClick={() => setFilter('all')}
          className={`px-3.5 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${
            filter === 'all'
              ? 'bg-violet-950/80 text-violet-300 border border-violet-700/60 shadow-[0_0_10px_rgba(139,92,246,0.2)]'
              : 'text-slate-400 hover:text-white bg-[#0e1322] border border-[#1b2338]'
          }`}
        >
          All ({campaigns.length})
        </button>
        <button
          onClick={() => setFilter('running')}
          className={`px-3.5 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${
            filter === 'running'
              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/60 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
              : 'text-slate-400 hover:text-white bg-[#0e1322] border border-[#1b2338]'
          }`}
        >
          Active / Running ({campaigns.filter((c) => c.status === 'running').length})
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={`px-3.5 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${
            filter === 'completed'
              ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/60 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
              : 'text-slate-400 hover:text-white bg-[#0e1322] border border-[#1b2338]'
          }`}
        >
          Completed ({campaigns.filter((c) => c.status === 'completed').length})
        </button>
      </div>

      {/* Campaigns Table */}
      <div className="bg-[#0b0e1a] border border-[#1b233a] rounded-2xl overflow-hidden shadow-2xl">
        {filtered.length === 0 ? (
          <div className="p-16 text-center space-y-4 font-mono">
            <div className="w-12 h-12 rounded-2xl bg-[#121626] border border-[#202940] text-slate-500 flex items-center justify-center mx-auto">
              <Mail className="w-6 h-6 text-slate-500" />
            </div>
            <h3 className="text-base font-bold text-slate-300">NO CAMPAIGNS FOUND</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {campaigns.length === 0
                ? 'You have not launched any email campaigns yet. Click "CREATE CAMPAIGN" to begin.'
                : 'No campaigns match the selected filter category.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono text-slate-300">
              <thead className="bg-[#0e1322] text-[11px] uppercase tracking-wider text-slate-400 border-b border-[#182033]">
                <tr>
                  <th className="p-4">Campaign Name</th>
                  <th className="p-4">Target Niche</th>
                  <th className="p-4">Sender Email</th>
                  <th className="p-4">Recipients</th>
                  <th className="p-4">Sent</th>
                  <th className="p-4">Pending</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Dispatch Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#141b2e]">
                {filtered.map((camp) => (
                  <tr
                    key={camp.id}
                    onClick={() => camp.id && onSelectCampaign(camp.id)}
                    className="hover:bg-[#11172a]/70 transition-colors cursor-pointer"
                  >
                    <td className="p-4 font-bold text-white whitespace-nowrap">
                      {camp.name}
                    </td>
                    <td className="p-4">
                      <span className="bg-violet-950/60 border border-violet-700/40 text-violet-300 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase">
                        {camp.niche}
                      </span>
                    </td>
                    <td className="p-4 text-slate-400">{camp.senderEmail}</td>
                    <td className="p-4 font-semibold text-white">{camp.totalRecipients}</td>
                    <td className="p-4 text-emerald-400 font-bold">{camp.sentCount}</td>
                    <td className="p-4 text-cyan-300">{camp.pendingCount}</td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          camp.status === 'running'
                            ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300 animate-pulse'
                            : camp.status === 'paused'
                            ? 'bg-amber-950/80 border-amber-500/60 text-amber-300'
                            : camp.status === 'completed'
                            ? 'bg-cyan-950/80 border-cyan-500/60 text-cyan-300'
                            : 'bg-slate-900 border-slate-700 text-slate-400'
                        }`}
                      >
                        {camp.status} ◉
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {camp.status === 'running' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 rounded-lg text-[10px] font-bold">
                          <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                          <span>LIVE SENDING</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300">
                          <span>View Detail</span>
                          <ChevronRight className="w-4 h-4" />
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
