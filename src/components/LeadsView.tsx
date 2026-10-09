import React, { useState } from 'react';
import {
  Search,
  Filter,
  Download,
  Trash2,
  Send,
  Eye,
  CheckCircle,
  XCircle,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  AlertTriangle,
  FileSpreadsheet,
  Loader2,
  Users,
  Sparkles,
  Zap,
  Globe,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Lead, EmailValidationStatus, OutreachStatus } from '../types';

interface LeadsViewProps {
  onOpenLeadDetail?: (lead: Lead) => void;
  onNavigateToSendList?: () => void;
}

export const LeadsView: React.FC<LeadsViewProps> = ({ onOpenLeadDetail, onNavigateToSendList }) => {
  const { user, leads, deleteLead, updateLead, bulkAddToSendList, recordActivity } = useAuth();
  const [search, setSearch] = useState('');
  const [emailStatusFilter, setEmailStatusFilter] = useState<'all' | EmailValidationStatus>('all');
  const [nicheFilter, setNicheFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | OutreachStatus>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isAddingToSendList, setIsAddingToSendList] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Distinct niches
  const niches = Array.from(new Set(leads.map((l) => l.niche).filter(Boolean)));

  // Filter leads
  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      (lead.company && lead.company.toLowerCase().includes(search.toLowerCase())) ||
      (lead.fullName && lead.fullName.toLowerCase().includes(search.toLowerCase())) ||
      (lead.email && lead.email.toLowerCase().includes(search.toLowerCase())) ||
      (lead.niche && lead.niche.toLowerCase().includes(search.toLowerCase()));

    const matchesEmailStatus = emailStatusFilter === 'all' || lead.emailStatus === emailStatusFilter;
    const matchesNiche = nicheFilter === 'all' || lead.niche === nicheFilter;
    const matchesStatus = statusFilter === 'all' || lead.outreachStatus === statusFilter;

    return matchesSearch && matchesEmailStatus && matchesNiche && matchesStatus;
  });

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredLeads.length && filteredLeads.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredLeads.map((l) => l.id!).filter(Boolean));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleBulkAddToSendList = async () => {
    if (selectedIds.length === 0 || isAddingToSendList) return;
    setIsAddingToSendList(true);
    try {
      await bulkAddToSendList(selectedIds);
      setSelectedIds([]);
      if (onNavigateToSendList) onNavigateToSendList();
    } finally {
      setIsAddingToSendList(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Delete ${selectedIds.length} lead(s) permanently?`)) return;
    for (const id of selectedIds) {
      await deleteLead(id);
    }
    setSelectedIds([]);
  };

  const handleExportCSV = async () => {
    if (!user) return;
    setIsExporting(true);

    try {
      const q = query(collection(db, 'leads'), where('userId', '==', user.uid));
      const querySnapshot = await getDocs(q);
      const fetchedDocs: Lead[] = querySnapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Lead, 'id'>),
      }));

      const leadsToExport =
        selectedIds.length > 0
          ? fetchedDocs.filter((l) => l.id && selectedIds.includes(l.id))
          : filteredLeads;

      if (leadsToExport.length === 0) {
        alert('No leads available to export.');
        setIsExporting(false);
        return;
      }

      const headers = ['Lead ID', 'Full Name', 'Company', 'Email', 'Website', 'Niche', 'Status'];
      const rows = leadsToExport.map((l) => [
        l.id || '',
        `"${(l.fullName || '').replace(/"/g, '""')}"`,
        `"${(l.company || '').replace(/"/g, '""')}"`,
        l.email || '',
        l.website || '',
        l.niche || '',
        l.outreachStatus || '',
      ]);

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `scout_leads_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#182033] pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-violet-400" />
            <h1 className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
              INTELLIGENCE DATABASE
            </h1>
          </div>
          <p className="text-sm text-slate-400 font-sans">
            Verified business prospects and decision makers ({leads.length} total entries).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            disabled={isExporting || leads.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#0f1424] hover:bg-[#161e36] text-slate-300 hover:text-white border border-[#202b47] rounded-xl text-xs font-mono transition-all cursor-pointer"
          >
            {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" /> : <Download className="w-3.5 h-3.5 text-cyan-400" />}
            <span>EXPORT CSV</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Command Strip */}
      <div className="bg-[#0b0e19] border border-[#1a2338] rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-center justify-between shadow-xl">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
          <input
            type="text"
            placeholder="Search company, name, email, or niche..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#07090e] border border-[#1e273e] rounded-xl pl-10 pr-4 py-2.5 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/80 transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto text-xs font-mono">
          {/* Niche Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 text-[11px] uppercase">Niche:</span>
            <select
              value={nicheFilter}
              onChange={(e) => setNicheFilter(e.target.value)}
              className="bg-[#07090e] border border-[#1e273e] text-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Niches</option>
              {niches.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          {/* Email Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 text-[11px] uppercase">Email:</span>
            <select
              value={emailStatusFilter}
              onChange={(e) => setEmailStatusFilter(e.target.value as any)}
              className="bg-[#07090e] border border-[#1e273e] text-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Status</option>
              <option value="valid">Valid Only</option>
              <option value="unknown">Unknown</option>
              <option value="invalid">Invalid</option>
            </select>
          </div>

          {/* Outreach Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 text-[11px] uppercase">Outreach:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-[#07090e] border border-[#1e273e] text-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Stages</option>
              <option value="not_contacted">Not Contacted</option>
              <option value="queued">Queued in Send List</option>
              <option value="sent">Sent via Gmail</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Database Intelligence Table */}
      <div className="bg-[#0a0d17] border border-[#1a2238] rounded-2xl overflow-hidden shadow-2xl">
        {filteredLeads.length === 0 ? (
          <div className="p-16 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#121626] border border-[#202940] text-slate-500 flex items-center justify-center mx-auto">
              <Users className="w-6 h-6 text-slate-500" />
            </div>
            <h3 className="text-base font-bold font-mono text-slate-300">NO LEADS MATCH CRITERIA</h3>
            <p className="text-xs font-mono text-slate-500 max-w-sm mx-auto">
              {leads.length === 0
                ? 'Your intelligence database is currently empty. Use the Scout Engine to discover prospects.'
                : 'No contacts match the current query or filter tags.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono text-slate-300">
              <thead className="bg-[#0e1322] border-b border-[#182033] text-[11px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="p-4 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === filteredLeads.length && filteredLeads.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded bg-[#07090e] border-[#222b40] text-cyan-500 focus:ring-0 cursor-pointer"
                    />
                  </th>
                  <th className="p-4">Prospect / Company</th>
                  <th className="p-4">Contact Email</th>
                  <th className="p-4">Niche</th>
                  <th className="p-4">Source</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#141b2e]">
                {filteredLeads.map((lead) => {
                  const isSelected = lead.id ? selectedIds.includes(lead.id) : false;
                  return (
                    <tr
                      key={lead.id}
                      className={`hover:bg-[#11172a]/70 transition-colors ${
                        isSelected ? 'bg-cyan-950/20' : ''
                      }`}
                    >
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => lead.id && toggleSelectOne(lead.id)}
                          className="rounded bg-[#07090e] border-[#222b40] text-cyan-500 focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* Name & Company */}
                      <td className="p-4">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              lead.emailStatus === 'valid'
                                ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                                : lead.emailStatus === 'invalid'
                                ? 'bg-rose-400'
                                : 'bg-amber-400'
                            }`}
                          />
                          <div>
                            <div className="font-bold text-white text-sm">
                              {lead.company}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {lead.fullName || lead.firstName || 'Business Prospect'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="p-4">
                        {lead.email ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-cyan-300 font-semibold">{lead.email}</span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold border ${
                                lead.emailStatus === 'valid'
                                  ? 'bg-emerald-950/80 border-emerald-600/40 text-emerald-400'
                                  : 'bg-slate-900 border-slate-700 text-slate-400'
                              }`}
                            >
                              {lead.emailStatus}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-600 italic">No email</span>
                        )}
                      </td>

                      {/* Niche */}
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-violet-950/60 border border-violet-700/40 text-violet-300">
                          {lead.niche}
                        </span>
                      </td>

                      {/* Source */}
                      <td className="p-4">
                        <div className="text-slate-400 text-[11px] truncate max-w-[140px]" title={lead.sourceUrl || ''}>
                          {lead.sourceUrl ? (
                            <span className="text-slate-400 hover:text-cyan-400 truncate">
                              {lead.sourceUrl.replace(/^https?:\/\//, '').split('/')[0]}
                            </span>
                          ) : (
                            <span>{lead.sourceType || 'Direct Source'}</span>
                          )}
                        </div>
                      </td>

                      {/* Outreach Status */}
                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            lead.outreachStatus === 'sent'
                              ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-400'
                              : lead.inSendList
                              ? 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300'
                              : 'bg-slate-900 border-slate-700 text-slate-400'
                          }`}
                        >
                          {lead.inSendList ? 'READY TO SEND' : lead.outreachStatus.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {onOpenLeadDetail && (
                            <button
                              onClick={() => onOpenLeadDetail(lead)}
                              title="Inspect Prospect Details"
                              className="p-1.5 text-slate-400 hover:text-white hover:bg-[#1a233a] rounded-lg transition-colors cursor-pointer"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            onClick={async () => {
                              if (!lead.id) return;
                              const newState = !lead.inSendList;
                              await updateLead(lead.id, {
                                inSendList: newState,
                                outreachStatus: newState ? 'queued' : 'not_contacted',
                              });
                            }}
                            title={lead.inSendList ? 'Remove from Send List' : 'Add to Send List'}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              lead.inSendList
                                ? 'text-cyan-400 hover:bg-cyan-950/50'
                                : 'text-slate-500 hover:text-cyan-400 hover:bg-[#1a233a]'
                            }`}
                          >
                            <Send className="w-4 h-4" />
                          </button>

                          <button
                            onClick={async () => {
                              if (!lead.id) return;
                              if (confirm(`Delete lead "${lead.company}"?`)) {
                                await deleteLead(lead.id);
                              }
                            }}
                            title="Delete Lead"
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Floating Command Bar when leads are selected */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#0d1222]/95 border border-cyan-500/60 rounded-2xl px-6 py-3.5 shadow-[0_0_35px_rgba(6,182,212,0.35)] backdrop-blur-xl flex items-center gap-6 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-bold text-white tracking-wider">
              {selectedIds.length} LEADS SELECTED
            </span>
          </div>

          <div className="h-4 w-px bg-[#222f4d]" />

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleBulkAddToSendList}
              disabled={isAddingToSendList}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-bold rounded-xl shadow-[0_0_15px_rgba(139,92,246,0.4)] cursor-pointer"
            >
              {isAddingToSendList ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5 text-cyan-200" />
              )}
              <span>ADD TO SEND LIST</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#12182b] hover:bg-[#1a233d] border border-[#273454] text-slate-200 rounded-xl cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>EXPORT</span>
            </button>

            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 px-3 py-2 bg-rose-950/60 hover:bg-rose-900/60 border border-rose-500/40 text-rose-300 rounded-xl cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>REMOVE</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
