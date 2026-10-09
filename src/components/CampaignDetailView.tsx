import React, { useEffect, useState, useRef } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
} from 'firebase/firestore';
import {
  Mail,
  Play,
  Pause,
  XOctagon,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowLeft,
  Loader2,
  ExternalLink,
  ShieldCheck,
  Zap,
  Sparkles,
  Key,
  Radio,
  Send,
  Eye,
  Check,
} from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Campaign, CampaignRecipient } from '../types';

interface CampaignDetailViewProps {
  campaignId: string;
  onBack: () => void;
}

interface DispatchLogEntry {
  email: string;
  name: string;
  status: 'sent' | 'failed';
  time: string;
  messageId?: string;
  error?: string;
}

export const CampaignDetailView: React.FC<CampaignDetailViewProps> = ({ campaignId, onBack }) => {
  const { user, accessToken, reauthorizeGmail, recordActivity } = useAuth();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [recipients, setRecipients] = useState<CampaignRecipient[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeRecipient, setActiveRecipient] = useState<CampaignRecipient | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const [dispatchLogs, setDispatchLogs] = useState<DispatchLogEntry[]>([]);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const countdownIntervalRef = useRef<any>(null);

  // Subscribe to campaign
  useEffect(() => {
    if (!campaignId) return;
    const unsub = onSnapshot(doc(db, 'campaigns', campaignId), (snapshot) => {
      if (snapshot.exists()) {
        const camp = { id: snapshot.id, ...snapshot.data() } as Campaign;
        setCampaign(camp);
      }
    });
    return () => unsub();
  }, [campaignId]);

  // Subscribe to recipients
  useEffect(() => {
    if (!campaignId || !user) return;
    const q = query(
      collection(db, 'campaign_recipients'),
      where('campaignId', '==', campaignId)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as CampaignRecipient));
      setRecipients(list);
    });
    return () => unsub();
  }, [campaignId, user]);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  const handleAuthorizeGmail = async () => {
    setIsAuthorizing(true);
    setAuthError(null);
    try {
      const token = await reauthorizeGmail();
      if (!token) {
        setAuthError('Gmail authorization was not completed. Please approve permissions in the popup.');
      }
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user') {
        setAuthError('Authorization window was closed. Click again to connect Gmail.');
      } else {
        setAuthError(err.message || 'Failed to authenticate Gmail');
      }
    } finally {
      setIsAuthorizing(false);
    }
  };

  // Real Email Sending Engine with live sequential progress & humanized anti-spam pacing
  useEffect(() => {
    if (!campaign || campaign.status !== 'running' || !accessToken || isProcessing) return;

    // Find the next queued recipient
    const nextRecipient = recipients.find((r) => r.status === 'queued');
    if (!nextRecipient) {
      const pendingRemain = recipients.some((r) => r.status === 'queued' || r.status === 'sending');
      if (!pendingRemain && recipients.length > 0 && campaign.status === 'running') {
        updateDoc(doc(db, 'campaigns', campaign.id!), {
          status: 'completed',
          completedAt: new Date().toISOString(),
        });
        recordActivity('campaign_completed', `Campaign "${campaign.name}" completed successfully`);
        setActiveRecipient(null);
        setCountdownSeconds(null);
      }
      return;
    }

    const processRecipient = async () => {
      setIsProcessing(true);
      setActiveRecipient(nextRecipient);
      setCountdownSeconds(null);

      try {
        await updateDoc(doc(db, 'campaign_recipients', nextRecipient.id!), {
          status: 'sending',
        });

        const subjectRaw = nextRecipient.personalizedSubject || campaign.subject;
        const bodyRaw = nextRecipient.personalizedBody || campaign.body;

        const cleanSubject = subjectRaw.replace(/\{\{[a-zA-Z0-9_]+\}\}/g, '').trim();
        const cleanBody = bodyRaw.replace(/\{\{[a-zA-Z0-9_]+\}\}/g, '').trim();

        // Call backend Gmail API endpoint with Bearer token
        const res = await fetch('/api/gmail/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            to: nextRecipient.recipientEmail,
            subject: cleanSubject,
            bodyText: cleanBody,
            fromEmail: campaign.senderEmail,
            fromName: campaign.senderName,
            includeUnsubscribe: campaign.inboxSafeguardEnabled ?? true,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Gmail API delivery failed.');
        }

        // Successfully sent via Gmail API
        await updateDoc(doc(db, 'campaign_recipients', nextRecipient.id!), {
          status: 'sent',
          gmailMessageId: data.messageId || null,
          sentAt: new Date().toISOString(),
          errorMessage: null,
        });

        if (nextRecipient.leadId) {
          await updateDoc(doc(db, 'leads', nextRecipient.leadId), {
            outreachStatus: 'sent',
            lastContactedAt: new Date().toISOString(),
            lastContactedCampaign: campaign.name,
          });
        }

        await updateDoc(doc(db, 'campaigns', campaign.id!), {
          sentCount: (campaign.sentCount || 0) + 1,
          pendingCount: Math.max(0, (campaign.pendingCount || 1) - 1),
        });

        setDispatchLogs((prev) => [
          {
            email: nextRecipient.recipientEmail,
            name: nextRecipient.recipientName,
            status: 'sent',
            time: new Date().toLocaleTimeString(),
            messageId: data.messageId,
          },
          ...prev.slice(0, 19),
        ]);

        await recordActivity('email_sent', `Dispatched outreach to ${nextRecipient.recipientEmail} (${campaign.name})`);
      } catch (err: any) {
        console.error('Failed to send email to', nextRecipient.recipientEmail, err);

        await updateDoc(doc(db, 'campaign_recipients', nextRecipient.id!), {
          status: 'failed',
          errorMessage: err.message || 'Sending failed',
        });

        if (nextRecipient.leadId) {
          await updateDoc(doc(db, 'leads', nextRecipient.leadId), {
            outreachStatus: 'failed',
          });
        }

        await updateDoc(doc(db, 'campaigns', campaign.id!), {
          failedCount: (campaign.failedCount || 0) + 1,
          pendingCount: Math.max(0, (campaign.pendingCount || 1) - 1),
        });

        setDispatchLogs((prev) => [
          {
            email: nextRecipient.recipientEmail,
            name: nextRecipient.recipientName,
            status: 'failed',
            time: new Date().toLocaleTimeString(),
            error: err.message || 'Send error',
          },
          ...prev.slice(0, 19),
        ]);
      } finally {
        // Humanized Anti-Spam Pacing Delay with random jitter (+/- 1-2s)
        const basePace = campaign.paceSeconds || 4;
        const jitter = Math.floor(Math.random() * 3) - 1;
        const delayDuration = Math.max(2, basePace + jitter);

        setCountdownSeconds(delayDuration);

        let remaining = delayDuration;
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

        countdownIntervalRef.current = setInterval(() => {
          remaining -= 1;
          setCountdownSeconds(remaining > 0 ? remaining : null);
          if (remaining <= 0) {
            clearInterval(countdownIntervalRef.current);
            setIsProcessing(false);
          }
        }, 1000);
      }
    };

    processRecipient();
  }, [campaign?.status, recipients, accessToken, isProcessing, campaign?.id]);

  const handleStartCampaign = async () => {
    if (!campaign?.id) return;
    if (!accessToken) {
      await handleAuthorizeGmail();
      return;
    }
    await updateDoc(doc(db, 'campaigns', campaign.id), {
      status: 'running',
      startedAt: campaign.startedAt || new Date().toISOString(),
    });
    recordActivity('campaign_launched', `Started outreach campaign: ${campaign.name}`);
  };

  const handlePauseCampaign = async () => {
    if (!campaign?.id) return;
    await updateDoc(doc(db, 'campaigns', campaign.id), { status: 'paused' });
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setIsProcessing(false);
    setCountdownSeconds(null);
    recordActivity('campaign_paused', `Paused campaign: ${campaign.name}`);
  };

  const handleCancelCampaign = async () => {
    if (!campaign?.id) return;
    if (confirm('Cancel this campaign? Unsent emails will be aborted.')) {
      await updateDoc(doc(db, 'campaigns', campaign.id), { status: 'cancelled' });
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      setIsProcessing(false);
      setCountdownSeconds(null);
    }
  };

  if (!campaign) {
    return (
      <div className="flex items-center justify-center p-20 text-slate-400 font-mono text-xs">
        <Loader2 className="w-5 h-5 animate-spin text-cyan-400 mr-2" />
        Loading campaign parameters...
      </div>
    );
  }

  const progressPercent = Math.round(
    ((campaign.sentCount || 0) / (campaign.totalRecipients || 1)) * 100
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Navigation & Status Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#182033] pb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-[#0f1424] hover:bg-[#182035] border border-[#202940] text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight">
                {campaign.name}
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase tracking-wider border ${
                  campaign.status === 'running'
                    ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)] animate-pulse'
                    : campaign.status === 'paused'
                    ? 'bg-amber-950/80 border-amber-500/60 text-amber-300'
                    : campaign.status === 'completed'
                    ? 'bg-cyan-950/80 border-cyan-500/60 text-cyan-300'
                    : 'bg-slate-900 border-slate-700 text-slate-400'
                }`}
              >
                {campaign.status} ◉
              </span>
            </div>
            <p className="text-xs font-mono text-slate-400 mt-0.5">
              Niche: <strong className="text-cyan-400">{campaign.niche}</strong> • From: {campaign.senderName} ({campaign.senderEmail})
            </p>
          </div>
        </div>

        {/* Campaign Action Buttons */}
        <div className="flex items-center gap-2.5">
          {campaign.status !== 'running' && campaign.status !== 'completed' && (
            <button
              onClick={handleStartCampaign}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-bold text-xs font-mono uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)] cursor-pointer active:scale-98"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>START DISPATCH</span>
            </button>
          )}

          {campaign.status === 'running' && (
            <button
              onClick={handlePauseCampaign}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-950/80 hover:bg-amber-900/80 border border-amber-500/50 text-amber-300 font-bold text-xs font-mono rounded-xl transition-all cursor-pointer"
            >
              <Pause className="w-4 h-4" />
              <span>PAUSE DISPATCH</span>
            </button>
          )}

          {campaign.status !== 'completed' && campaign.status !== 'cancelled' && (
            <button
              onClick={handleCancelCampaign}
              className="p-2.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
              title="Cancel Campaign"
            >
              <XOctagon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Auth Warning if Gmail Token is missing */}
      {!accessToken && (
        <div className="bg-amber-950/60 border border-amber-500/50 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono text-xs shadow-xl">
          <div className="flex items-center gap-3">
            <Key className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <h4 className="font-bold text-amber-300">Gmail API Authorization Required</h4>
              <p className="text-slate-400 text-[11px] mt-0.5">
                Grant OAuth permission to begin sending real emails from your Gmail account.
              </p>
            </div>
          </div>
          <button
            onClick={handleAuthorizeGmail}
            disabled={isAuthorizing}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition-colors cursor-pointer shrink-0"
          >
            {isAuthorizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            <span>AUTHORIZE GMAIL API</span>
          </button>
        </div>
      )}

      {authError && (
        <div className="p-3 bg-rose-950/60 border border-rose-500/50 rounded-xl text-xs font-mono text-rose-300">
          {authError}
        </div>
      )}

      {/* Progress Metric Bar */}
      <div className="bg-[#0b0e1a] border border-[#1b233a] rounded-2xl p-5 space-y-3 shadow-xl">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-slate-400">DISPATCH COMPLETION</span>
          <span className="text-cyan-400 font-bold">
            {campaign.sentCount || 0} OF {campaign.totalRecipients} SENT ({progressPercent}%)
          </span>
        </div>

        <div className="w-full bg-[#07090e] h-3 rounded-full overflow-hidden border border-[#172033]">
          <div
            className="bg-gradient-to-r from-violet-600 via-cyan-400 to-emerald-400 h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, progressPercent)}%` }}
          />
        </div>

        <div className="grid grid-cols-4 gap-2 pt-1 text-center font-mono text-[11px]">
          <div className="p-2 rounded-lg bg-[#07090e] border border-[#151d30]">
            <span className="text-slate-500 block uppercase">Total</span>
            <span className="font-bold text-white">{campaign.totalRecipients}</span>
          </div>
          <div className="p-2 rounded-lg bg-[#07090e] border border-[#151d30]">
            <span className="text-emerald-400 block uppercase">Sent</span>
            <span className="font-bold text-emerald-400">{campaign.sentCount}</span>
          </div>
          <div className="p-2 rounded-lg bg-[#07090e] border border-[#151d30]">
            <span className="text-cyan-400 block uppercase">Pending</span>
            <span className="font-bold text-cyan-300">{campaign.pendingCount}</span>
          </div>
          <div className="p-2 rounded-lg bg-[#07090e] border border-[#151d30]">
            <span className="text-rose-400 block uppercase">Failed</span>
            <span className="font-bold text-rose-400">{campaign.failedCount || 0}</span>
          </div>
        </div>
      </div>

      {/* LIVE DISPATCH SPOTLIGHT (The Crown Feature: One Gmail Showing Send, Then Moves to Next) */}
      <div className="bg-[#0e1324] border border-cyan-500/50 rounded-3xl p-6 sm:p-8 space-y-6 shadow-[0_0_35px_rgba(6,182,212,0.18)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-violet-600/10 via-cyan-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1c263e] pb-4 relative z-10">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-cyan-400 animate-pulse" />
            <h3 className="text-sm font-bold font-mono tracking-widest text-white uppercase">
              LIVE DISPATCH STAGE
            </h3>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            {campaign.status === 'running' ? (
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/60 text-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                ACTIVE DISPATCH ENGINE
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#121729] border border-[#202940] text-slate-400">
                ENGINE STANDBY
              </span>
            )}
          </div>
        </div>

        {/* Current Active In-Flight Recipient Card */}
        {activeRecipient ? (
          <div className="bg-[#090c16] border border-cyan-500/70 rounded-2xl p-5 space-y-4 shadow-[0_0_20px_rgba(6,182,212,0.25)] relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-violet-600 to-cyan-500 text-white flex items-center justify-center font-bold text-base font-mono shadow-[0_0_12px_rgba(6,182,212,0.4)]">
                  {activeRecipient.recipientCompany.charAt(0)}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-base font-mono">
                      {activeRecipient.recipientCompany}
                    </span>
                    <span className="text-slate-400 text-xs font-mono">
                      ({activeRecipient.recipientName})
                    </span>
                  </div>
                  <div className="text-xs font-mono text-cyan-300 mt-0.5">
                    {activeRecipient.recipientEmail}
                  </div>
                </div>
              </div>

              {/* Status Indicator */}
              <div className="text-right space-y-1">
                {activeRecipient.status === 'sending' && (
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-cyan-950 border border-cyan-500/60 text-cyan-300 text-xs font-mono font-bold">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                    <span>DELIVERING VIA GMAIL API...</span>
                  </div>
                )}
                {activeRecipient.status === 'sent' && (
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-950 border border-emerald-500/60 text-emerald-300 text-xs font-mono font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>DELIVERED (GMAIL MSG ID: {activeRecipient.gmailMessageId || 'OK'})</span>
                  </div>
                )}
              </div>
            </div>

            {/* Countdown ticker for pacing */}
            {countdownSeconds !== null && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-violet-950/40 border border-violet-700/40 text-xs font-mono text-violet-300">
                <span className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Humanized Anti-Spam Pacing (Protecting Gmail Reputation)</span>
                </span>
                <span className="font-bold text-cyan-400">
                  Next recipient in: {countdownSeconds}s...
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 text-center rounded-2xl bg-[#090c16] border border-[#182033] font-mono text-xs text-slate-400 space-y-2">
            <Radio className="w-6 h-6 text-slate-500 mx-auto" />
            <p>
              {campaign.status === 'completed'
                ? 'All prospects in this campaign have been contacted.'
                : 'Click "START DISPATCH" to begin sequential sending through your authenticated Gmail API.'}
            </p>
          </div>
        )}

        {/* Live Event Dispatch Stream (Terminal View) */}
        <div className="space-y-2 relative z-10">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>REAL-TIME DISPATCH LOG STREAM</span>
            <span>GMAIL API RFC-2822 ENCODED</span>
          </div>

          <div className="bg-[#060810] border border-[#161d2e] rounded-xl p-3.5 font-mono text-xs space-y-1.5 max-h-44 overflow-y-auto">
            {dispatchLogs.length === 0 ? (
              <p className="text-slate-600 text-[11px]">
                No dispatch events logged yet. Active calls will appear here.
              </p>
            ) : (
              dispatchLogs.map((log, i) => (
                <div key={i} className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        log.status === 'sent' ? 'bg-emerald-400' : 'bg-rose-400'
                      }`}
                    />
                    <span className="text-slate-300 font-semibold">{log.email}</span>
                    <span className="text-slate-500">({log.name})</span>
                    {log.messageId && (
                      <span className="text-cyan-400 text-[10px]">
                        ID: {log.messageId.slice(0, 14)}...
                      </span>
                    )}
                  </div>
                  <span className="text-slate-500 text-[10px]">{log.time}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recipient Queue Table */}
      <div className="bg-[#0b0e1a] border border-[#1b233a] rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-4 bg-[#0e1322] border-b border-[#182033] flex items-center justify-between text-xs font-mono">
          <span className="font-bold text-white uppercase tracking-wider">
            ALL CAMPAIGN RECIPIENTS ({recipients.length})
          </span>
          <span className="text-slate-500 text-[11px]">Auto-updated via Firestore</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono text-slate-300">
            <thead className="bg-[#090c16] text-[11px] uppercase tracking-wider text-slate-400 border-b border-[#182033]">
              <tr>
                <th className="p-3.5">Recipient</th>
                <th className="p-3.5">Company</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Delivered At</th>
                <th className="p-3.5 text-right">Gmail Message ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#141b2e]">
              {recipients.map((rec) => (
                <tr key={rec.id} className="hover:bg-[#11172a]/60 transition-colors">
                  <td className="p-3.5 font-bold text-white">{rec.recipientEmail}</td>
                  <td className="p-3.5 text-slate-300">{rec.recipientCompany}</td>
                  <td className="p-3.5">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        rec.status === 'sent'
                          ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-400'
                          : rec.status === 'sending'
                          ? 'bg-cyan-950/80 border-cyan-500/60 text-cyan-300 animate-pulse'
                          : rec.status === 'failed'
                          ? 'bg-rose-950/80 border-rose-500/60 text-rose-400'
                          : 'bg-slate-900 border-slate-700 text-slate-400'
                      }`}
                    >
                      {rec.status}
                    </span>
                  </td>
                  <td className="p-3.5 text-slate-400 text-[11px]">
                    {rec.sentAt ? new Date(rec.sentAt).toLocaleTimeString() : '—'}
                  </td>
                  <td className="p-3.5 text-right text-cyan-400 text-[11px]">
                    {rec.gmailMessageId ? `${rec.gmailMessageId.slice(0, 16)}...` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
