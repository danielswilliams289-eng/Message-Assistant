import React, { useEffect, useState, useRef } from 'react';
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
  RotateCcw,
  RefreshCw,
  HelpCircle,
  AlertTriangle,
  X,
} from 'lucide-react';
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
  const {
    user,
    accessToken,
    campaigns,
    updateCampaign,
    getCampaignRecipients,
    setCampaignRecipients,
    updateCampaignRecipient,
    updateLead,
    reauthorizeGmail,
    authorizeGmailWithRedirect,
    enableSandboxMode,
    recordActivity,
  } = useAuth();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [recipients, setRecipients] = useState<CampaignRecipient[]>([]);
  const [recipientsLoaded, setRecipientsLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeRecipient, setActiveRecipient] = useState<CampaignRecipient | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const [dispatchLogs, setDispatchLogs] = useState<DispatchLogEntry[]>([]);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const countdownIntervalRef = useRef<any>(null);

  // Sync campaign and recipients from state & persistent storage
  useEffect(() => {
    if (!campaignId) return;
    const camp = campaigns.find((c) => c.id === campaignId) || null;
    setCampaign(camp);
    const recips = getCampaignRecipients(campaignId);
    setRecipients(recips);
    setRecipientsLoaded(true);
  }, [campaignId, campaigns]);

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
        setShowLaunchModal(true);
      } else {
        // Automatically start the campaign if it was paused or draft!
        if (campaign?.id && campaign.status !== 'running') {
          await updateCampaign(campaign.id, {
            status: 'running',
            startedAt: campaign.startedAt || new Date().toISOString(),
          });
          recordActivity('campaign_launched', `Started outreach campaign: ${campaign.name}`);
        }
      }
    } catch (err: any) {
      setAuthError(err.message || 'Failed to authenticate Gmail');
      setShowLaunchModal(true);
    } finally {
      setIsAuthorizing(false);
    }
  };

  const handleRedirectAuth = async () => {
    setIsRedirecting(true);
    try {
      await authorizeGmailWithRedirect();
    } catch (err: any) {
      console.error('Redirect auth error:', err);
      setIsRedirecting(false);
      setAuthError('Redirect authorization could not be started: ' + (err.message || 'Unknown error'));
    }
  };

  // Real Email Sending Engine with live sequential progress & humanized anti-spam pacing
  useEffect(() => {
    if (!campaign || campaign.status !== 'running' || isProcessing || !recipientsLoaded) return;

    // Find the next queued recipient
    const nextRecipient = recipients.find((r) => r.status === 'queued');
    if (!nextRecipient) {
      const pendingRemain = recipients.some((r) => r.status === 'queued' || r.status === 'sending');
      if (!pendingRemain && recipients.length > 0 && campaign.status === 'running') {
        updateCampaign(campaign.id!, {
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

      const effectiveToken = accessToken || 'demo-guest-token';

      try {
        setRecipients((prev) =>
          prev.map((r) => (r.id === nextRecipient.id ? { ...r, status: 'sending' } : r))
        );
        updateCampaignRecipient(nextRecipient.id!, {
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
            'Authorization': `Bearer ${effectiveToken}`,
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
        setRecipients((prev) =>
          prev.map((r) =>
            r.id === nextRecipient.id
              ? {
                  ...r,
                  status: 'sent',
                  gmailMessageId: data.messageId || null,
                  sentAt: new Date().toISOString(),
                  errorMessage: null,
                }
              : r
          )
        );
        updateCampaignRecipient(nextRecipient.id!, {
          status: 'sent',
          gmailMessageId: data.messageId || null,
          sentAt: new Date().toISOString(),
          errorMessage: null,
        });

        if (nextRecipient.leadId) {
          await updateLead(nextRecipient.leadId, {
            outreachStatus: 'sent',
            lastContactedAt: new Date().toISOString(),
            lastContactedCampaign: campaign.name,
          });
        }

        await updateCampaign(campaign.id!, {
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

        setRecipients((prev) =>
          prev.map((r) =>
            r.id === nextRecipient.id
              ? {
                  ...r,
                  status: 'failed',
                  errorMessage: err.message || 'Sending failed',
                }
              : r
          )
        );
        updateCampaignRecipient(nextRecipient.id!, {
          status: 'failed',
          errorMessage: err.message || 'Sending failed',
        });

        if (nextRecipient.leadId) {
          await updateLead(nextRecipient.leadId, {
            outreachStatus: 'failed',
          });
        }

        await updateCampaign(campaign.id!, {
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
  }, [campaign?.status, recipients, accessToken, isProcessing, campaign?.id, recipientsLoaded]);

  const handleStartCampaign = async (forceSandbox = false) => {
    if (!campaign?.id) return;

    if (forceSandbox) {
      enableSandboxMode();
      await updateCampaign(campaign.id, {
        status: 'running',
        startedAt: campaign.startedAt || new Date().toISOString(),
      });
      recordActivity('campaign_launched', `Started outreach campaign (Sandbox Dispatch): ${campaign.name}`);
      setShowLaunchModal(false);
      setAuthError(null);
      return;
    }

    if (accessToken) {
      await updateCampaign(campaign.id, {
        status: 'running',
        startedAt: campaign.startedAt || new Date().toISOString(),
      });
      recordActivity('campaign_launched', `Started outreach campaign: ${campaign.name}`);
      setShowLaunchModal(false);
      return;
    }

    // Try authorization
    setIsAuthorizing(true);
    setAuthError(null);
    try {
      const token = await reauthorizeGmail();
      if (token) {
        await updateCampaign(campaign.id, {
          status: 'running',
          startedAt: campaign.startedAt || new Date().toISOString(),
        });
        recordActivity('campaign_launched', `Started outreach campaign: ${campaign.name}`);
        setShowLaunchModal(false);
      } else {
        setShowLaunchModal(true);
      }
    } catch (err: any) {
      console.warn('Authorization attempt notice:', err);
      setShowLaunchModal(true);
    } finally {
      setIsAuthorizing(false);
    }
  };

  const handleResetCampaign = async () => {
    if (!campaign?.id) return;
    if (!confirm('Restart campaign? All recipients will be reset to queued status so you can run the sequential dispatch again.')) return;

    const resetRecips = recipients.map((r) => ({
      ...r,
      status: 'queued' as const,
      errorMessage: null,
      gmailMessageId: null,
      sentAt: null,
    }));
    setRecipients(resetRecips);
    setCampaignRecipients(campaign.id, resetRecips);

    await updateCampaign(campaign.id, {
      status: 'draft',
      sentCount: 0,
      failedCount: 0,
      pendingCount: recipients.length,
      completedAt: null,
    });
    setDispatchLogs([]);
    setActiveRecipient(null);
    setCountdownSeconds(null);
    recordActivity('campaign_created', `Reset campaign "${campaign.name}" for fresh outreach run`);
  };

  const handleRetryFailed = async () => {
    if (!campaign?.id) return;
    const failedList = recipients.filter((r) => r.status === 'failed');
    if (failedList.length === 0) return;

    const retriedRecips = recipients.map((r) =>
      r.status === 'failed' ? { ...r, status: 'queued' as const, errorMessage: null } : r
    );
    setRecipients(retriedRecips);
    setCampaignRecipients(campaign.id, retriedRecips);

    await updateCampaign(campaign.id, {
      status: 'running',
      failedCount: 0,
      pendingCount: failedList.length,
    });
    recordActivity('campaign_launched', `Retrying ${failedList.length} failed leads in campaign: ${campaign.name}`);
  };

  const handleOpenAllInGmailWeb = () => {
    const emails = recipients.map((r) => r.recipientEmail).filter(Boolean);
    if (emails.length === 0) return;
    const bccList = emails.slice(0, 50).join(',');
    const subject = encodeURIComponent(campaign?.subject || 'Outreach Inquiry');
    const body = encodeURIComponent(campaign?.body || '');
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&bcc=${encodeURIComponent(bccList)}&su=${subject}&body=${body}`;
    window.open(gmailUrl, '_blank', 'noopener,noreferrer');
  };

  const handlePauseCampaign = async () => {
    if (!campaign?.id) return;
    await updateCampaign(campaign.id, { status: 'paused' });
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setIsProcessing(false);
    setCountdownSeconds(null);
    recordActivity('campaign_paused', `Paused campaign: ${campaign.name}`);
  };

  const handleCancelCampaign = async () => {
    if (!campaign?.id) return;
    if (confirm('Cancel this campaign? Unsent emails will be aborted.')) {
      await updateCampaign(campaign.id, { status: 'cancelled' });
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

  const hasFailedLeads = (campaign.failedCount || 0) > 0;
  const isSandboxActive = accessToken === 'demo-guest-token' || !accessToken;

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

              {isSandboxActive && (
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-mono">
                  Sandbox Simulation Mode
                </span>
              )}
            </div>
            <p className="text-xs font-mono text-slate-400 mt-0.5">
              Niche: <strong className="text-cyan-400">{campaign.niche}</strong> • From: {campaign.senderName} ({campaign.senderEmail})
            </p>
          </div>
        </div>

        {/* Campaign Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* 1. When Running */}
          {campaign.status === 'running' && (
            <button
              onClick={handlePauseCampaign}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-950/80 hover:bg-amber-900/80 border border-amber-500/50 text-amber-300 font-bold text-xs font-mono rounded-xl transition-all cursor-pointer"
            >
              <Pause className="w-4 h-4" />
              <span>PAUSE DISPATCH</span>
            </button>
          )}

          {/* 2. When Completed: Clear Re-run, Retry, and Web Options */}
          {campaign.status === 'completed' && (
            <>
              <button
                onClick={handleResetCampaign}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs font-mono uppercase tracking-wider rounded-xl transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] cursor-pointer"
                title="Reset all recipients to queued and restart dispatch"
              >
                <RotateCcw className="w-4 h-4" />
                <span>RESTART / RE-RUN DISPATCH</span>
              </button>

              {hasFailedLeads && (
                <button
                  onClick={handleRetryFailed}
                  className="flex items-center gap-2 px-3.5 py-2.5 bg-rose-950/80 hover:bg-rose-900/80 border border-rose-500/60 text-rose-300 font-bold text-xs font-mono rounded-xl transition-all cursor-pointer"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>RETRY {campaign.failedCount} FAILED</span>
                </button>
              )}

              <button
                onClick={handleOpenAllInGmailWeb}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-[#0e1324] hover:bg-[#18223d] border border-[#223055] text-slate-300 font-medium text-xs font-mono rounded-xl transition-all cursor-pointer"
                title="Open one Gmail compose window with all recipients in BCC"
              >
                <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                <span>Open in Gmail (BCC)</span>
              </button>
            </>
          )}

          {/* 3. When Draft or Paused */}
          {campaign.status !== 'running' && campaign.status !== 'completed' && (
            <>
              <button
                onClick={() => handleStartCampaign(false)}
                disabled={isAuthorizing}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-bold text-xs font-mono uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)] cursor-pointer active:scale-98"
              >
                {isAuthorizing ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                ) : (
                  <Play className="w-4 h-4 fill-slate-950" />
                )}
                <span>START DISPATCH</span>
              </button>

              <button
                onClick={() => handleStartCampaign(true)}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-[#10162a] hover:bg-[#18223d] border border-[#223055] text-cyan-300 font-bold text-xs font-mono rounded-xl transition-all cursor-pointer shadow-sm"
                title="Launch instantly with simulated delivery and real-time logs, bypassing Google permissions"
              >
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                <span>INSTANT LAUNCH (SANDBOX)</span>
              </button>

              <button
                onClick={() => setShowLaunchModal(true)}
                className="p-2.5 text-slate-400 hover:text-white bg-[#0e1324] hover:bg-[#18223d] border border-[#223055] rounded-xl transition-colors cursor-pointer"
                title="Launch & Authorization Help"
              >
                <HelpCircle className="w-4 h-4 text-cyan-400" />
              </button>
            </>
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

      {/* Gmail Authorization Status Card */}
      {!accessToken ? (
        <div className="bg-gradient-to-r from-amber-950/70 via-[#181a28] to-[#0f1424] border border-amber-500/50 rounded-2xl p-5 space-y-3 font-mono text-xs shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Key className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-amber-300 text-sm">Launch & Authorization Control</h4>
                <p className="text-slate-300 text-[11px] mt-0.5 max-w-2xl leading-relaxed">
                  You can send pitches in <strong>Sandbox Mode</strong> right now with full sequential logs and anti-spam pacing, or connect your real Google Account to dispatch directly from your personal Gmail inbox.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={() => handleStartCampaign(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold rounded-xl transition-colors cursor-pointer text-xs shadow-md"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>LAUNCH IN SANDBOX NOW</span>
              </button>

              <button
                onClick={handleAuthorizeGmail}
                disabled={isAuthorizing}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition-colors cursor-pointer text-xs"
              >
                {isAuthorizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                <span>CONNECT GMAIL (POPUP)</span>
              </button>

              <button
                onClick={handleRedirectAuth}
                disabled={isRedirecting}
                className="px-3 py-2 bg-[#1b2238] hover:bg-[#253050] text-slate-300 hover:text-white border border-[#2e3b5e] font-medium rounded-xl transition-colors cursor-pointer text-xs"
                title="Bypass popup blockers by redirecting directly to Google login"
              >
                {isRedirecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>CONNECT VIA REDIRECT</span>}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[#0b1424] border border-emerald-500/40 rounded-2xl p-3.5 flex items-center justify-between font-mono text-xs">
          <div className="flex items-center gap-2.5 text-emerald-400">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="font-bold">
              {accessToken === 'demo-guest-token'
                ? 'Sandbox Outreach Mode Active (RFC-2822 Dispatch Simulation Enabled)'
                : 'Gmail API Connected — Dispatches will be sent from your authentic Gmail Inbox'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenAllInGmailWeb}
              className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Preview in Gmail Web</span>
            </button>
          </div>
        </div>
      )}

      {authError && (
        <div className="p-4 bg-rose-950/60 border border-rose-500/50 rounded-xl text-xs font-mono text-rose-300 flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="font-bold">Authorization Notice</p>
            <p className="text-[11px] text-rose-200">{authError}</p>
          </div>
          <button
            onClick={() => handleStartCampaign(true)}
            className="px-3 py-1.5 bg-rose-900/60 hover:bg-rose-800 border border-rose-400/50 text-white rounded-lg text-xs font-bold cursor-pointer shrink-0"
          >
            Launch in Sandbox Instead →
          </button>
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
            <span className="text-slate-400">Pacing Delay:</span>
            <span className="text-cyan-400 font-bold">{campaign.paceSeconds || 4}s between sends</span>
          </div>
        </div>

        {/* Active Outbound Card (Sequential Dispatch Focus) */}
        {activeRecipient ? (
          <div className="space-y-4 relative z-10">
            <div className="p-5 rounded-2xl bg-[#090d18] border border-cyan-500/40 space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-cyan-400 animate-ping" />
                  <span className="text-xs font-bold font-mono text-cyan-300 uppercase tracking-wide">
                    NOW TRANSMITTING VIA GMAIL API
                  </span>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  Target: <strong className="text-white">{activeRecipient.recipientCompany}</strong>
                </span>
              </div>

              <div className="space-y-1 font-mono">
                <div className="text-xs text-slate-400">
                  To: <span className="text-white font-bold">{activeRecipient.recipientEmail}</span> ({activeRecipient.recipientName})
                </div>
                <div className="text-xs text-slate-400 truncate">
                  Subject: <span className="text-cyan-300">{activeRecipient.personalizedSubject || campaign.subject}</span>
                </div>
                {activeRecipient.personalizedBody && (
                  <div className="text-[11px] text-slate-500 bg-[#060810] p-3 rounded-xl border border-[#161e30] max-h-24 overflow-y-auto mt-2 whitespace-pre-wrap">
                    {activeRecipient.personalizedBody}
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
          <div className="p-8 text-center rounded-2xl bg-[#090c16] border border-[#182033] font-mono text-xs text-slate-400 space-y-3">
            <Radio className="w-6 h-6 text-slate-500 mx-auto" />
            <p>
              {campaign.status === 'completed'
                ? 'All prospects in this campaign have been contacted.'
                : 'Click "START DISPATCH" or "INSTANT LAUNCH (SANDBOX)" to begin sequential sending one lead after the other.'}
            </p>

            {campaign.status === 'completed' && (
              <div className="pt-2 flex items-center justify-center gap-3">
                <button
                  onClick={handleResetCampaign}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-md"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restart Dispatch</span>
                </button>
                <button
                  onClick={handleOpenAllInGmailWeb}
                  className="px-4 py-2 bg-[#151c30] hover:bg-[#1e2844] text-slate-300 hover:text-white rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1.5 border border-[#253255]"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in Gmail (BCC)</span>
                </button>
              </div>
            )}
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

      {/* Launch & Authorization Assistant Modal */}
      {showLaunchModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0b0e1a] border border-[#222c44] rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative">
            <button
              onClick={() => setShowLaunchModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-2 rounded-xl hover:bg-[#182033] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-xs font-mono font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>LAUNCH ASSISTANT</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold font-mono text-white tracking-tight">
                How to Complete the Launch Process
              </h2>
              <p className="text-sm font-sans text-slate-400">
                Choose the outreach execution method that suits your workflow best:
              </p>
            </div>

            <div className="space-y-4">
              {/* Option 1: Sandbox Simulation */}
              <div className="p-4 rounded-2xl bg-[#0f1424] border border-cyan-500/40 hover:border-cyan-400 transition-colors space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold font-mono text-white">
                        Option 1: Launch in Sandbox Mode (Instant Dispatch)
                      </h4>
                      <p className="text-xs text-slate-400">
                        No Google OAuth approval needed. Immediately starts live sequential outreach with realistic pacing and full log streams.
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleStartCampaign(true)}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs font-mono uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md"
                >
                  START INSTANT DISPATCH NOW →
                </button>
              </div>

              {/* Option 2: Real Gmail API (Popup) */}
              <div className="p-4 rounded-2xl bg-[#0f1424] border border-[#1f2940] hover:border-amber-500/50 transition-colors space-y-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold font-mono text-white">
                      Option 2: Connect Personal Gmail Account
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                      Opens Google authorization window. Select your Google account and click <strong>"Allow"</strong> to grant permission to dispatch from your authentic personal Gmail inbox.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    onClick={handleAuthorizeGmail}
                    disabled={isAuthorizing}
                    className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-mono uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                  >
                    {isAuthorizing ? 'Opening Google Window...' : 'AUTHORIZE GOOGLE ACCOUNT (POPUP)'}
                  </button>
                  <button
                    onClick={handleRedirectAuth}
                    disabled={isRedirecting}
                    className="py-2.5 px-4 bg-[#1a2236] hover:bg-[#25304c] border border-[#2b3958] text-slate-300 hover:text-white font-mono text-xs rounded-xl transition-colors cursor-pointer"
                    title="Avoids browser pop-up blockers"
                  >
                    VIA REDIRECT (NO POPUPS)
                  </button>
                </div>
              </div>

              {/* Option 3: Gmail Web Direct */}
              <div className="p-4 rounded-2xl bg-[#0f1424] border border-[#1f2940] hover:border-slate-600 transition-colors space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-700/40 text-slate-300 flex items-center justify-center font-bold">
                      <ExternalLink className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold font-mono text-white">
                        Option 3: Open All in Gmail Web (BCC)
                      </h4>
                      <p className="text-xs text-slate-400">
                        Opens official Gmail Web with all campaign contacts pre-filled in BCC.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      handleOpenAllInGmailWeb();
                      setShowLaunchModal(false);
                    }}
                    className="py-2 px-3 bg-[#171f34] hover:bg-[#202b48] border border-[#28365a] text-slate-200 text-xs font-mono rounded-xl cursor-pointer"
                  >
                    Open Webmail
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
