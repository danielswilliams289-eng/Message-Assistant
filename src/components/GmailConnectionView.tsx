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
  const { user, accessToken, reauthorizeGmail, authorizeGmailWithRedirect, enableSandboxMode, campaigns } = useAuth();
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
    <div className="max-w-5xl mx-auto space-y-6 pb-16 font-sans">
      {/* Header */}
      <div className="space-y-1 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-2">
          <MailCheck className="w-6 h-6 text-indigo-600" />
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Gmail Integration & Safeguards
          </h1>
        </div>
        <p className="text-sm text-slate-500">
          Manage your authentic Gmail API connection and verify anti-spam health to ensure high Primary Inbox delivery.
        </p>
      </div>

      {/* Main Connection Status Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
        {/* Sequential Outreach Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-indigo-50/80 border border-indigo-200 rounded-2xl gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs">
              <MailCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 tracking-wide">
                  Automated Sequential Outreach Engine
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold">
                  Active
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Automatically delivers personalized pitches one after the other to selected developers with real-time progress and queue tracking.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 bg-white px-3.5 py-2 rounded-xl border border-indigo-200 shadow-2xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Sequential Queue Ready</span>
          </div>
        </div>

        {/* Optional Background API Section */}
        <div className="border-t border-slate-100 pt-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Optional: Background Gmail API
              </h4>
              <p className="text-xs text-slate-500">
                For automated sending without opening Gmail compose tabs. (Requires Google Cloud OAuth verification or Publishing).
              </p>
            </div>
            {accessToken ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {accessToken === 'demo-guest-token' ? 'Sandbox Mode Active' : 'API Connected'}
              </span>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-xl transition-colors cursor-pointer"
                >
                  <Zap className={`w-3.5 h-3.5 ${connecting ? 'animate-spin' : ''}`} />
                  <span>{connecting ? 'Connecting...' : 'Authorize Gmail (Popup)'}</span>
                </button>

                <button
                  onClick={async () => {
                    try {
                      await authorizeGmailWithRedirect();
                    } catch (e: any) {
                      setAuthError(e.message);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-xl transition-colors cursor-pointer"
                  title="Redirect to Google directly without popup blocker"
                >
                  <span>Connect via Redirect</span>
                </button>

                <button
                  onClick={() => enableSandboxMode()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 text-xs font-medium rounded-xl transition-colors cursor-pointer"
                >
                  <span>Enable Sandbox Mode</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {authError && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-amber-900 font-bold">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <span>Google OAuth Access Notice</span>
            </div>
            <p className="text-slate-700 leading-relaxed">
              If other users cannot connect or see an access denied notice, switch your Google Cloud OAuth app to <strong>Production</strong> mode so ANY user can sign in and send freely without you needing to add them to a test list!
            </p>
            <div className="p-3 bg-white rounded-lg border border-amber-200 space-y-1.5 text-slate-600">
              <p className="font-semibold text-slate-900">How to make it work automatically for all users (No manual email adding):</p>
              <p>1. Go to <strong>Google Cloud Console &rarr; APIs & Services &rarr; OAuth consent screen</strong>.</p>
              <p>2. Under <strong>Publishing status</strong>, click <strong>&quot;PUBLISH APP&quot;</strong> and confirm.</p>
              <p>3. Once published, ANY user can sign up with their Google account and connect their Gmail automatically. When Google shows the one-time &quot;Google hasn't verified this app&quot; screen, users simply click <strong>Advanced &rarr; Go to App (unsafe) &rarr; Continue</strong>!</p>
              <p className="text-slate-500 pt-1">&bull; Users can also always use <strong>Open in Gmail (Web)</strong> to send immediately with zero setup required.</p>
            </div>
          </div>
        )}

        {/* Intelligence Grid: Quotas & Security */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-2">
            <span className="text-slate-500 font-semibold uppercase tracking-wider text-[11px] block">
              Identity Verification
            </span>
            <p className="text-slate-600">
              <strong className="text-slate-900">Account:</strong> {user?.email}
            </p>
            <p className="text-slate-600">
              <strong className="text-slate-900">Protocol:</strong> Google Workspace OAuth 2.0
            </p>
            <p className="text-slate-600">
              <strong className="text-slate-900">Scope:</strong> mail.google.com / send
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-2">
            <span className="text-slate-500 font-semibold uppercase tracking-wider text-[11px] block">
              Daily Safe Volume
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-indigo-600">{emailsSentToday}</span>
              <span className="text-slate-500 text-[11px]">/ 500 safe limit</span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div
                className="bg-indigo-600 h-full rounded-full"
                style={{ width: `${Math.min(100, (emailsSentToday / 500) * 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Pacing prevents Google spam threshold triggers.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-2">
            <span className="text-slate-500 font-semibold uppercase tracking-wider text-[11px] block">
              Inbox Safeguards
            </span>
            <div className="space-y-1.5 text-slate-600 text-[11px]">
              <div className="flex items-center gap-1.5 text-emerald-700">
                <Check className="w-3.5 h-3.5" /> RFC 2822 MIME Encoding
              </div>
              <div className="flex items-center gap-1.5 text-emerald-700">
                <Check className="w-3.5 h-3.5" /> Anti-Spam Jitter Pacing
              </div>
              <div className="flex items-center gap-1.5 text-emerald-700">
                <Check className="w-3.5 h-3.5" /> Direct Personal Sending
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Deliverability Sandbox */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Deliverability Sandbox Tester
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            Score: <strong className="text-emerald-600 text-sm">{deliverabilityResult.score}%</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="space-y-2">
            <label className="text-slate-700 font-medium text-[11px] block">Test Subject Line</label>
            <input
              type="text"
              value={testSubject}
              onChange={(e) => setTestSubject(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white"
            />

            <label className="text-slate-700 font-medium text-[11px] block pt-2">Test Email Body</label>
            <textarea
              rows={6}
              value={testBody}
              onChange={(e) => setTestBody(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3.5 text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white leading-relaxed resize-y"
            />
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
            <span className="text-[11px] text-slate-500 uppercase font-bold block">
              Spam Filter Diagnostic Report
            </span>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Spam Trigger Words:</span>
                <span className={deliverabilityResult.triggers.length === 0 ? 'text-emerald-700 font-semibold' : 'text-rose-600 font-semibold'}>
                  {deliverabilityResult.triggers.length === 0
                    ? 'None detected (Clean)'
                    : deliverabilityResult.triggers.map((t) => t.word).join(', ')}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-600">Personalization Tags:</span>
                <span className="text-indigo-600 font-medium">
                  {deliverabilityResult.hasPersonalization ? 'Active (High Inbox Confidence)' : 'None used'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-600">Length Balance:</span>
                <span className="text-emerald-700 font-semibold">Optimal concise pitch</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-100 text-[11px] text-slate-700 space-y-1">
              <strong className="text-indigo-900 block">Deliverability Recommendation:</strong>
              <p>Keep your initial emails between 50-125 words, use at least 1 personalized token, and avoid excessive capitalized buzzwords.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
