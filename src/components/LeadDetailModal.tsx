import React, { useState } from 'react';
import {
  User,
  Building,
  Mail,
  Phone,
  Globe,
  Compass,
  Calendar,
  Clock,
  History,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Send,
  Trash2,
  Zap,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { Lead } from '../types';

interface LeadDetailModalProps {
  lead: Lead;
  onClose: () => void;
  onNavigateToSendList?: () => void;
}

export const LeadDetailModal: React.FC<LeadDetailModalProps> = ({ lead, onClose, onNavigateToSendList }) => {
  const { updateLead, deleteLead, campaigns } = useAuth();
  const [inSendList, setInSendList] = useState(lead.inSendList || false);

  const toggleSendList = async () => {
    if (!lead.id) return;
    const newState = !inSendList;
    setInSendList(newState);
    await updateLead(lead.id, {
      inSendList: newState,
      outreachStatus: newState ? 'queued' : 'not_contacted',
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto font-mono">
      <div className="bg-[#0b0e1a] border border-[#222c44] rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-[0_0_50px_rgba(0,0,0,0.9)] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#182033] pb-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-cyan-500 text-white flex items-center justify-center font-bold text-lg shadow-[0_0_15px_rgba(139,92,246,0.3)]">
              {lead.company ? lead.company.charAt(0) : 'L'}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                {lead.company}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {lead.fullName || lead.firstName || 'Lead Contact'} • {lead.niche}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-[#182033] transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Lead Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="bg-[#070a13] border border-[#182033] rounded-2xl p-4 space-y-1.5">
            <span className="text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
              <Mail className="w-3.5 h-3.5 text-cyan-400" /> Email Address
            </span>
            <p className="text-cyan-300 font-bold text-sm">
              {lead.email || <span className="text-slate-500 italic font-normal">None listed</span>}
            </p>
            <div className="pt-1">
              <span
                className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                  lead.emailStatus === 'valid'
                    ? 'bg-emerald-950/80 text-emerald-400 border-emerald-600/40'
                    : lead.emailStatus === 'invalid'
                    ? 'bg-rose-950/80 text-rose-400 border-rose-600/40'
                    : 'bg-slate-900 text-slate-400 border-slate-700'
                }`}
              >
                {lead.emailStatus}
              </span>
            </div>
          </div>

          <div className="bg-[#070a13] border border-[#182033] rounded-2xl p-4 space-y-1.5">
            <span className="text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
              <Globe className="w-3.5 h-3.5 text-violet-400" /> Website
            </span>
            <p className="text-slate-300 font-medium truncate">
              {lead.website ? (
                <a
                  href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:underline flex items-center gap-1 truncate"
                >
                  <span className="truncate">{lead.website}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              ) : (
                <span className="text-slate-500">None publicly listed</span>
              )}
            </p>
          </div>

          <div className="bg-[#070a13] border border-[#182033] rounded-2xl p-4 space-y-1.5">
            <span className="text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
              <Compass className="w-3.5 h-3.5 text-cyan-400" /> Target Niche
            </span>
            <p className="text-slate-300">{lead.niche}</p>
          </div>

          <div className="bg-[#070a13] border border-[#182033] rounded-2xl p-4 space-y-1.5">
            <span className="text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
              <Clock className="w-3.5 h-3.5 text-amber-400" /> Outreach Stage
            </span>
            <span
              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                lead.outreachStatus === 'sent'
                  ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-400'
                  : inSendList
                  ? 'bg-cyan-950/80 border-cyan-500/60 text-cyan-300'
                  : 'bg-slate-900 border-slate-700 text-slate-400'
              }`}
            >
              {inSendList ? 'QUEUED IN SEND LIST' : lead.outreachStatus.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Source info */}
        <div className="p-4 rounded-2xl bg-[#070a13] border border-[#182033] text-xs space-y-1">
          <span className="text-slate-500 uppercase text-[11px] block">Extracted Source</span>
          <p className="text-slate-300 break-all">{lead.sourceUrl || lead.sourceType || 'User provided directory text'}</p>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-[#182033]">
          <button
            onClick={async () => {
              if (lead.id && confirm(`Delete ${lead.company}?`)) {
                await deleteLead(lead.id);
                onClose();
              }
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-rose-400 hover:bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Lead</span>
          </button>

          <button
            onClick={toggleSendList}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              inSendList
                ? 'bg-[#141b2e] border border-cyan-500 text-cyan-300'
                : 'bg-gradient-to-r from-violet-600 to-cyan-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.3)]'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>{inSendList ? 'Remove from Send Queue' : 'Stage in Send Queue'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
