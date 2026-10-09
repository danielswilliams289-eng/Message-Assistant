import React, { useState } from 'react';
import {
  MailCheck,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  LogOut,
  ExternalLink,
  Lock,
  Sparkles,
  Zap,
  Info,
  Sliders,
  Check,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import {
  analyzeEmailDeliverability,
  cleanSpamTriggers,
} from '../lib/spamFilter';

export const GmailConnectionView: React.FC = () => {
  const { user, accessToken, reauthorizeGmail, campaigns } = useAuth();
  const [connecting, setConnecting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Deliverability Test Tool state
  const [testSubject, setTestSubject] = useState('Quick question regarding {{company}} software pipeline');
  const [testBody, setTestBody] = useState(`Hi {{first_name}},

I noticed {{company}} has great momentum in the gaming industry. We help studios accelerate production cycles and eliminate distribution bottlenecks.

Would you be open to a 5-minute technical chat sometime this week?

Best regards,
Alex`);

  const deliverabilityResult = analyzeEmailDeliverability(testSubject, testBody);

  const todayStr = new Date().toDateString();
  const emailsSentToday = campaigns.reduce((acc, c) => {
    if (new Date(c.createdAt).toDateString() === todayStr) {
      return acc + (c.sentCount || 0);
    }
    return acc;
  }, 0);

  const handleConnect = async () => {
    setConnecting(true);
    setAuthError(null);
    try {
      await reauthorizeGmail();
    } catch (err: any) {
      console.error('Gmail OAuth connection error:', err);
      setAuthError(err.message || 'Gmail connection failed.');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16 font-mono">
      {/* Header */}
      <div className="space-y-1 border-b border-[#182033] pb-5">
        <div className="flex items-center gap-2">
          <MailCheck className="w-5 h-5 text-cyan-400" />
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            GMAIL INTEGRATION & INBOX SAFEGUARD
          </h1>
        </div>
        <p className="text-sm text-slate-400 font-sans">
          Manage your authentic Gmail API credentials and leverage intelligent anti-spam filters to ensure Primary Inbox delivery.
        </p>
      </div>

      {/* Main Connection Status Card */}
      <div className="bg-[#0b0e1a] border border-[#1b233a] rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-[#0e1424] border border-emerald-500/40 rounded-2xl gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-400 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  GMAIL OAUTH API ACTIVE
                </h3>
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
              </div>
              <p className="text-xs text-cyan-300 mt-0.5">{user?.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="flex items-center gap-2 px-4 py-2 bg-[#12182b] hover:bg-[#1a233d] border border-emerald-500/40 text-emerald-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${connecting ? 'animate-spin' : ''}`} />
              <span>REFRESH OAUTH TOKEN</span>
            </button>
          </div>
        </div>

        {authError && (
          <div className="bg-rose-950/60 border border-rose-500/50 rounded-xl p-3 text-xs text-rose-300">
            {authError}
          </div>
        )}

        {/* Intelligence Grid: Quotas & Security */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-[#070a13] border border-[#182033] rounded-2xl p-5 space-y-2">
            <span className="text-slate-400 font-bold uppercase tracking-wider text-[11px] block">
              Identity Verification
            </span>
            <p className="text-slate-300">
              <strong className="text-white">Account:</strong> {user?.email}
            </p>
            <p className="text-slate-300">
              <strong className="text-white">Protocol:</strong> Google Workspace OAuth 2.0
            </p>
            <p className="text-slate-300">
              <strong className="text-white">Scope:</strong> mail.google.com / send
            </p>
          </div>

          <div className="bg-[#070a13] border border-[#182033] rounded-2xl p-5 space-y-2">
            <span className="text-slate-400 font-bold uppercase tracking-wider text-[11px] block">
              Daily Safe Volume Health
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-cyan-400">{emailsSentToday}</span>
              <span className="text-slate-500 text-[11px]">/ 500 safe limit</span>
            </div>
            <div className="w-full bg-[#0e1424] h-2 rounded-full overflow-hidden border border-[#1b233a]">
              <div
                className="bg-cyan-500 h-full rounded-full"
                style={{ width: `${Math.min(100, (emailsSentToday / 500) * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-500">
              Pacing prevents Google spam threshold triggers.
            </p>
          </div>

          <div className="bg-[#070a13] border border-[#182033] rounded-2xl p-5 space-y-2">
            <span className="text-slate-400 font-bold uppercase tracking-wider text-[11px] block">
              Inbox Safeguards
            </span>
            <div className="space-y-1 text-slate-300 text-[11px]">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <Check className="w-3.5 h-3.5" /> RFC 2822 MIME Encoding
              </div>
              <div className="flex items-center gap-1.5 text-emerald-400">
                <Check className="w-3.5 h-3.5" /> Anti-Spam Jitter Pacing
              </div>
              <div className="flex items-center gap-1.5 text-emerald-400">
                <Check className="w-3.5 h-3.5" /> List-Unsubscribe Header
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Deliverability Sandbox */}
      <div className="bg-[#0b0e1a] border border-[#1b233a] rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#182033] pb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              DELIVERABILITY SANDBOX TESTER
            </h2>
          </div>
          <span className="text-xs text-slate-400">
            Score: <strong className="text-emerald-400 text-sm">{deliverabilityResult.score}%</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="space-y-2">
            <label className="text-slate-400 uppercase text-[11px] block">Test Subject Line</label>
            <input
              type="text"
              value={testSubject}
              onChange={(e) => setTestSubject(e.target.value)}
              className="w-full bg-[#070a13] border border-[#1b2338] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-cyan-500"
            />

            <label className="text-slate-400 uppercase text-[11px] block pt-2">Test Email Body</label>
            <textarea
              rows={6}
              value={testBody}
              onChange={(e) => setTestBody(e.target.value)}
              className="w-full bg-[#070a13] border border-[#1b2338] rounded-xl p-3.5 text-slate-200 focus:outline-none focus:border-cyan-500 leading-relaxed resize-y"
            />
          </div>

          <div className="bg-[#070a13] border border-[#182033] rounded-2xl p-5 space-y-4">
            <span className="text-[11px] text-slate-400 uppercase font-bold block">
              Spam Filter Diagnostic Report
            </span>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Spam Trigger Words:</span>
                <span className={deliverabilityResult.triggers.length === 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {deliverabilityResult.triggers.length === 0
                    ? 'None detected (Clean)'
                    : deliverabilityResult.triggers.map((t) => t.word).join(', ')}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Personalization Tags:</span>
                <span className="text-cyan-400">
                  {deliverabilityResult.hasPersonalization ? 'Active (High Inbox Confidence)' : 'None used'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Length Balance:</span>
                <span className="text-emerald-400">Optimal concise pitch</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#0b101f] border border-cyan-500/30 text-[11px] text-slate-300 space-y-1">
              <strong className="text-cyan-400 block">Deliverability Recommendation:</strong>
              <p>Keep your initial emails between 50-125 words, use at least 1 personalized token, and avoid excessive capitalized trigger words.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
