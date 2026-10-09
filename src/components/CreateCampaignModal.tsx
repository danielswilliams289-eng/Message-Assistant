import React, { useState } from 'react';
import {
  Mail,
  Play,
  CheckCircle2,
  AlertCircle,
  Eye,
  ShieldCheck,
  Sparkles,
  Zap,
  Key,
  Info,
  ChevronLeft,
  ChevronRight,
  Send,
  Loader2,
  Sliders,
  Check,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { Lead } from '../types';
import {
  analyzeEmailDeliverability,
  cleanSpamTriggers,
  appendOptOutFooter,
} from '../lib/spamFilter';

interface CreateCampaignModalProps {
  initialLeads?: Lead[];
  onClose: () => void;
  onCampaignCreated: (newCampaignId: string) => void;
}

export const CreateCampaignModal: React.FC<CreateCampaignModalProps> = ({
  initialLeads,
  onClose,
  onCampaignCreated,
}) => {
  const { user, accessToken, profile, leads, createCampaign, reauthorizeGmail } = useAuth();

  const eligibleLeads = initialLeads ? initialLeads : leads.filter((l) => l.inSendList);

  const [campaignName, setCampaignName] = useState('Outreach Campaign - ' + new Date().toLocaleDateString());
  const [niche, setNiche] = useState(eligibleLeads[0]?.niche || profile?.defaultNiche || 'Game Developers');
  const [subject, setSubject] = useState('A quick idea for {{company}}');
  const [body, setBody] = useState(`Hi {{first_name}},

I took a look at {{company}} and wanted to reach out regarding your current operations.

We work with teams in the {{niche}} space to accelerate growth, improve client acquisition, and deliver reliable results.

Would you be open to a brief 5-minute chat sometime this week?

Best regards,
{{sender_name}}`);

  const [senderName, setSenderName] = useState(profile?.defaultSenderName || profile?.displayName || 'Scout Operator');
  const [paceSeconds, setPaceSeconds] = useState(profile?.sendingPaceSeconds || 4);
  const [inboxSafeguardEnabled, setInboxSafeguardEnabled] = useState(true);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [testEmail, setTestEmail] = useState(user?.email || '');
  const [testSending, setTestSending] = useState(false);
  const [testStatus, setTestStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Targets
  const targetRecipients = eligibleLeads.filter((l) => Boolean(l.email));
  const currentPreviewLead = targetRecipients[previewIndex] || targetRecipients[0];

  // Anti-spam deliverability analysis
  const deliverability = analyzeEmailDeliverability(subject, body);

  const getPersonalizedSubject = (lead?: Lead) => {
    if (!lead) return subject;
    return subject
      .replace(/\{\{first_name\}\}/gi, lead.firstName || lead.fullName?.split(' ')[0] || 'there')
      .replace(/\{\{last_name\}\}/gi, lead.lastName || '')
      .replace(/\{\{company\}\}/gi, lead.company || 'your team')
      .replace(/\{\{website\}\}/gi, lead.website || '')
      .replace(/\{\{niche\}\}/gi, lead.niche || niche);
  };

  const getPersonalizedBody = (lead?: Lead) => {
    if (!lead) return body;
    const base = body
      .replace(/\{\{first_name\}\}/gi, lead.firstName || lead.fullName?.split(' ')[0] || 'there')
      .replace(/\{\{last_name\}\}/gi, lead.lastName || '')
      .replace(/\{\{company\}\}/gi, lead.company || 'your team')
      .replace(/\{\{website\}\}/gi, lead.website || '')
      .replace(/\{\{niche\}\}/gi, lead.niche || niche)
      .replace(/\{\{sender_name\}\}/gi, senderName);
    return inboxSafeguardEnabled ? appendOptOutFooter(base) : base;
  };

  const handleCleanSpam = () => {
    setSubject(cleanSpamTriggers(subject));
    setBody(cleanSpamTriggers(body));
  };

  const handleInsertTag = (tag: string) => {
    setBody((prev) => `${prev} {{${tag}}}`);
  };

  const handleSendTestEmail = async () => {
    if (!testEmail.trim()) {
      setTestStatus({ success: false, message: 'Please enter a test email address.' });
      return;
    }

    let token = accessToken;
    if (!token) {
      try {
        token = await reauthorizeGmail();
        if (!token) {
          setTestStatus({ success: false, message: 'Gmail authorization required.' });
          return;
        }
      } catch (e: any) {
        setTestStatus({ success: false, message: e.message || 'Authorization failed' });
        return;
      }
    }

    setTestSending(true);
    setTestStatus(null);

    try {
      const res = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          to: testEmail,
          subject: '[TEST] ' + getPersonalizedSubject(currentPreviewLead),
          bodyText: getPersonalizedBody(currentPreviewLead),
          fromEmail: user?.email,
          fromName: senderName,
          includeUnsubscribe: inboxSafeguardEnabled,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch test email');

      setTestStatus({
        success: true,
        message: `Test email sent successfully via Gmail API! Message ID: ${data.messageId}`,
      });
    } catch (err: any) {
      setTestStatus({ success: false, message: err.message || 'Send failed' });
    } finally {
      setTestSending(false);
    }
  };

  const handleLaunchCampaign = async () => {
    if (!campaignName.trim() || !subject.trim() || !body.trim()) {
      alert('Please fill in all campaign fields.');
      return;
    }

    if (targetRecipients.length === 0) {
      alert('No recipients with valid email addresses found in the current selection.');
      return;
    }

    setLoading(true);

    try {
      const newCampId = await createCampaign({
        name: campaignName,
        niche,
        subject,
        body,
        senderEmail: user?.email || '',
        senderName,
        status: 'draft',
        totalRecipients: targetRecipients.length,
        sentCount: 0,
        pendingCount: targetRecipients.length,
        failedCount: 0,
        paceSeconds,
        deliverabilityScore: deliverability.score,
        inboxSafeguardEnabled,
      }, targetRecipients);

      onCampaignCreated(newCampId);
    } catch (err: any) {
      console.error('Failed to create campaign:', err);
      alert('Campaign creation failed: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-[#0b0e1a] border border-[#222c44] rounded-3xl max-w-6xl w-full max-h-[92vh] flex flex-col shadow-[0_0_60px_rgba(0,0,0,0.9)] overflow-hidden">
        {/* Header */}
        <div className="p-5 sm:px-8 border-b border-[#182033] flex items-center justify-between bg-[#0e1222]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-cyan-500 flex items-center justify-center text-white">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold font-mono text-white tracking-wide">
                CAMPAIGN CONTROL BUILDER
              </h2>
              <p className="text-xs font-mono text-slate-400">
                Staged for {targetRecipients.length} real prospect(s)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-[#182033] transition-colors font-mono cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Split Screen Workspace */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#182033] overflow-y-auto">
          {/* LEFT: Campaign Settings & Controls */}
          <div className="p-6 sm:p-8 space-y-5 overflow-y-auto">
            <div className="space-y-4 text-xs font-mono">
              <div>
                <label className="text-slate-300 font-bold uppercase tracking-wider block mb-1.5">
                  Campaign Name
                </label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  className="w-full bg-[#07090e] border border-[#1e273e] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold uppercase tracking-wider block mb-1.5">
                    Target Niche
                  </label>
                  <input
                    type="text"
                    value={niche}
                    onChange={(e) => setNiche(e.target.value)}
                    className="w-full bg-[#07090e] border border-[#1e273e] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-bold uppercase tracking-wider block mb-1.5">
                    Sender Name
                  </label>
                  <input
                    type="text"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    className="w-full bg-[#07090e] border border-[#1e273e] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Subject with Tag chips */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-slate-300 font-bold uppercase tracking-wider">
                    Subject Line
                  </label>
                  <span className="text-[10px] text-slate-500">Insert tag into subject</span>
                </div>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-[#07090e] border border-[#1e273e] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Variable Injector Chips */}
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                  Available Dynamic Tags:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {['company', 'first_name', 'last_name', 'niche', 'website', 'sender_name'].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleInsertTag(tag)}
                      className="px-2 py-1 rounded bg-[#121729] hover:bg-[#1a223d] border border-[#1f2840] text-cyan-300 text-[10px] font-mono cursor-pointer"
                    >
                      + {`{{${tag}}}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Email Body */}
              <div>
                <label className="text-slate-300 font-bold uppercase tracking-wider block mb-1.5">
                  Email Body
                </label>
                <textarea
                  rows={8}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full bg-[#07090e] border border-[#1e273e] rounded-xl p-3.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 leading-relaxed font-mono resize-y"
                />
              </div>

              {/* Deliverability & Anti-Spam Panel */}
              <div className="p-4 rounded-2xl bg-[#090d17] border border-[#182033] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    ANTI-SPAM DELIVERABILITY RATING
                  </span>
                  <span
                    className={`font-bold text-sm ${
                      deliverability.score >= 80
                        ? 'text-emerald-400'
                        : deliverability.score >= 60
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {deliverability.score}% / 100%
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Humanized Anti-Spam Pacing Delay:</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={2}
                      max={30}
                      value={paceSeconds}
                      onChange={(e) => setPaceSeconds(parseInt(e.target.value) || 4)}
                      className="w-14 bg-[#07090e] border border-[#1e273e] rounded-lg px-2 py-1 text-center text-cyan-400 font-bold"
                    />
                    <span>sec delay</span>
                  </div>
                </div>

                {deliverability.triggers.length > 0 && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-amber-400">
                      Spam triggers found: {deliverability.triggers.map((t) => t.word).join(', ')}
                    </span>
                    <button
                      type="button"
                      onClick={handleCleanSpam}
                      className="px-2 py-0.5 rounded bg-amber-950/70 border border-amber-500/40 text-amber-300 text-[10px] cursor-pointer"
                    >
                      Clean triggers
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: Live Dynamic Email Preview */}
          <div className="p-6 sm:p-8 space-y-5 bg-[#090c15] flex flex-col justify-between overflow-y-auto">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-mono font-bold tracking-widest text-slate-300 uppercase">
                    LIVE EMAIL PREVIEW
                  </span>
                </div>

                {targetRecipients.length > 1 && (
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-slate-500 text-[11px]">
                      Lead {previewIndex + 1} of {targetRecipients.length}
                    </span>
                    <button
                      onClick={() => setPreviewIndex((prev) => Math.max(0, prev - 1))}
                      disabled={previewIndex === 0}
                      className="p-1 rounded bg-[#121626] border border-[#202940] disabled:opacity-30 cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5 text-slate-300" />
                    </button>
                    <button
                      onClick={() => setPreviewIndex((prev) => Math.min(targetRecipients.length - 1, prev + 1))}
                      disabled={previewIndex >= targetRecipients.length - 1}
                      className="p-1 rounded bg-[#121626] border border-[#202940] disabled:opacity-30 cursor-pointer"
                    >
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                    </button>
                  </div>
                )}
              </div>

              {/* Rendered Mail Mockup */}
              <div className="bg-[#0e121f] border border-[#1e273e] rounded-2xl p-5 space-y-4 shadow-xl font-mono text-xs">
                <div className="space-y-1.5 border-b border-[#182033] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 text-[11px] w-12">From:</span>
                    <span className="text-slate-300 font-semibold">{senderName} &lt;{user?.email}&gt;</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 text-[11px] w-12">To:</span>
                    <span className="text-cyan-400 font-semibold">
                      {currentPreviewLead ? `${currentPreviewLead.fullName || currentPreviewLead.company} <${currentPreviewLead.email}>` : 'john@example.com'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 text-[11px] w-12">Subject:</span>
                    <span className="text-white font-bold">{getPersonalizedSubject(currentPreviewLead)}</span>
                  </div>
                </div>

                <div className="text-slate-300 leading-relaxed whitespace-pre-wrap pt-1 font-sans text-xs">
                  {getPersonalizedBody(currentPreviewLead)}
                </div>
              </div>

              {/* Live Test Email Tool */}
              <div className="p-4 rounded-2xl bg-[#0e121f] border border-[#1e273e] space-y-2.5 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 uppercase font-bold">
                    Test Dispatch via Gmail API
                  </span>
                  <span className="text-[10px] text-cyan-400">Verifies Deliverability</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    placeholder="your-email@example.com"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    className="flex-1 bg-[#07090e] border border-[#1e273e] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSendTestEmail}
                    disabled={testSending}
                    className="px-3 py-1.5 bg-[#182138] hover:bg-[#202c4b] border border-[#273559] text-cyan-300 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    {testSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Send Test'}
                  </button>
                </div>
                {testStatus && (
                  <p className={`text-[11px] ${testStatus.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {testStatus.message}
                  </p>
                )}
              </div>
            </div>

            {/* Launch Campaign Bar */}
            <div className="pt-4 border-t border-[#182033] flex items-center justify-between">
              <span className="text-xs font-mono text-slate-400">
                Total Queue: <strong className="text-white">{targetRecipients.length} emails</strong>
              </span>

              <button
                type="button"
                onClick={handleLaunchCampaign}
                disabled={loading || targetRecipients.length === 0}
                className="flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 disabled:opacity-40 text-white font-bold text-xs font-mono uppercase tracking-wider rounded-xl transition-all shadow-[0_0_25px_rgba(6,182,212,0.4)] cursor-pointer active:scale-98"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-200" />
                ) : (
                  <Play className="w-4 h-4 fill-white" />
                )}
                <span>CONFIRM & LAUNCH CAMPAIGN →</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
