import React, { useState, useEffect } from 'react';
import {
  Mail,
  ShieldCheck,
  Sparkles,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  ArrowRight,
  Gamepad2,
  CheckCircle2,
  Globe,
  UserCheck,
  Settings,
  Key,
  HelpCircle,
} from 'lucide-react';
import { AuthErrorInfo, useAuth } from '../lib/AuthContext';

interface GoogleAuthConnectViewProps {
  onLogin: () => Promise<void>;
  onLoginWithRedirect: () => Promise<void>;
  onLoginWithEmail?: (email: string, displayName?: string) => Promise<void>;
  onLoginAsGuest?: () => Promise<void>;
  authError: AuthErrorInfo | null;
  clearAuthError: () => void;
  loading?: boolean;
  onOpenHelper?: () => void;
}

export const GoogleAuthConnectView: React.FC<GoogleAuthConnectViewProps> = ({
  onLogin,
  onLoginWithRedirect,
  onLoginWithEmail,
  onLoginAsGuest,
  authError,
  clearAuthError,
  loading = false,
  onOpenHelper,
}) => {
  const { googleClientId, updateGoogleClientId } = useAuth();
  const [activeTab, setActiveTab] = useState<'google' | 'email'>('google');
  const [emailInput, setEmailInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [guestSubmitting, setGuestSubmitting] = useState(false);
  const [showCloudConfig, setShowCloudConfig] = useState(false);
  const [customClientIdInput, setCustomClientIdInput] = useState(googleClientId);
  const [savedClientIdMsg, setSavedClientIdMsg] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const isVercel = currentHostname.includes('vercel.app');

  // If there's an origin mismatch error, automatically suggest switching to Email or opening helper
  const isOriginMismatch =
    authError?.message?.toLowerCase().includes('origin_mismatch') ||
    authError?.message?.toLowerCase().includes('origin') ||
    authError?.message?.toLowerCase().includes('registered') ||
    authError?.message?.toLowerCase().includes('invalid_request');

  const handleGoogleConnect = async () => {
    setGoogleSubmitting(true);
    try {
      await onLogin();
    } finally {
      setGoogleSubmitting(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    if (!onLoginWithEmail) return;

    setEmailSubmitting(true);
    try {
      await onLoginWithEmail(emailInput.trim(), nameInput.trim() || undefined);
    } finally {
      setEmailSubmitting(false);
    }
  };

  const handleGuestConnect = async () => {
    if (!onLoginAsGuest) return;
    setGuestSubmitting(true);
    try {
      await onLoginAsGuest();
    } finally {
      setGuestSubmitting(false);
    }
  };

  const handleSaveClientId = (e: React.FormEvent) => {
    e.preventDefault();
    updateGoogleClientId(customClientIdInput.trim());
    setSavedClientIdMsg(true);
    setTimeout(() => setSavedClientIdMsg(false), 2500);
  };

  const handleCopyOrigin = () => {
    navigator.clipboard.writeText(currentOrigin);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 antialiased selection:bg-indigo-100 selection:text-indigo-900 font-sans">
      {/* Top Header Bar */}
      <header className="px-6 sm:px-10 py-5 flex items-center justify-between border-b border-slate-200/80 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
            <Gamepad2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-lg tracking-tight">
                GameReach
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                Steam &bull; Gmail
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Verified Game Studio Outreach
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCloudConfig(!showCloudConfig)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium transition-colors cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">Google Cloud OAuth Settings</span>
            <span className="sm:hidden">OAuth Setup</span>
          </button>
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Google OAuth 2.0</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="max-w-xl w-full space-y-6">
          {/* Main Card */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 p-6 sm:p-10 space-y-6">
            {/* Header / Intro */}
            <div className="text-center space-y-2.5">
              <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 shadow-xs mb-1">
                <Mail className="w-7 h-7 sm:w-8 sm:h-8" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Sign In to GameReach
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                Scout indie game developers on Steam and dispatch personalized outreach directly from your verified Gmail.
              </p>
            </div>

            {/* Error / Alert notice */}
            {authError && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-slate-800 space-y-3 animate-in fade-in duration-200">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1 flex-1 text-xs">
                    <p className="font-bold text-amber-900">
                      {isOriginMismatch ? 'Google Cloud Origin Whitelist Notice' : 'Google Sign-In Notice'}
                    </p>
                    <p className="text-slate-600 leading-relaxed">
                      {isOriginMismatch ? (
                        <>
                          Your production domain (<strong>{currentHostname}</strong>) is not yet registered under Authorized JavaScript origins in Google Cloud Console.
                        </>
                      ) : (
                        authError.message
                      )}
                    </p>
                  </div>
                </div>

                {/* Instant Solution for Vercel / Deployed Domain */}
                {isOriginMismatch && (
                  <div className="bg-white border border-amber-200 rounded-xl p-3 space-y-2 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <strong className="text-slate-800 block">Instant 1-Click Solution:</strong>
                        <span className="text-slate-600">
                          Sign in with your email directly to enter your workspace right away without waiting on Google Cloud approval.
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          clearAuthError();
                          setActiveTab('email');
                        }}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs shrink-0 transition-colors cursor-pointer inline-flex items-center gap-1 justify-center"
                      >
                        <span>Use Email Sign-In</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-slate-500 text-[11px]">
                        Or add <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-800 font-semibold">{currentOrigin}</code> to Google Cloud Console.
                      </span>
                      <button
                        onClick={handleCopyOrigin}
                        className="text-indigo-600 hover:text-indigo-800 text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                      >
                        {copiedUrl ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedUrl ? 'Copied' : 'Copy URL'}</span>
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1 text-xs">
                  <button
                    onClick={clearAuthError}
                    className="text-slate-500 hover:text-slate-700 underline cursor-pointer"
                  >
                    Dismiss Notice
                  </button>
                  {onOpenHelper && (
                    <button
                      onClick={onOpenHelper}
                      className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer inline-flex items-center gap-1"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>View Setup Guide</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Google Cloud Configuration Accordion / Modal */}
            {showCloudConfig && (
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4 animate-in fade-in text-xs">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <Settings className="w-4 h-4 text-indigo-600" />
                    <span>Google Cloud OAuth 2.0 Credentials</span>
                  </div>
                  <button
                    onClick={() => setShowCloudConfig(false)}
                    className="text-slate-400 hover:text-slate-600 text-xs font-semibold cursor-pointer"
                  >
                    Close
                  </button>
                </div>

                <form onSubmit={handleSaveClientId} className="space-y-2">
                  <label className="font-bold text-slate-800 block">
                    Google OAuth Client ID:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customClientIdInput}
                      onChange={(e) => setCustomClientIdInput(e.target.value)}
                      placeholder="e.g. 123456789-xyz.apps.googleusercontent.com"
                      className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-600"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors cursor-pointer"
                    >
                      Save
                    </button>
                  </div>
                  {savedClientIdMsg && (
                    <p className="text-emerald-600 font-semibold text-[11px]">
                      Client ID saved successfully!
                    </p>
                  )}
                </form>

                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <p className="font-bold text-slate-800">
                    Step-by-Step Google Cloud Checklist for Vercel:
                  </p>
                  <ol className="list-decimal pl-4 space-y-1.5 text-slate-600">
                    <li>
                      Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline inline-flex items-center gap-0.5 font-semibold">Google Cloud Credentials <ExternalLink className="w-3 h-3" /></a>.
                    </li>
                    <li>
                      Click your <strong>OAuth 2.0 Client ID</strong> (Web application).
                    </li>
                    <li>
                      Under <strong>Authorized JavaScript origins</strong>, add your production origin:
                      <div className="flex items-center gap-2 mt-1">
                        <code className="bg-white px-2 py-1 rounded border border-slate-200 font-mono text-[11px] text-slate-800 select-all font-semibold">
                          {currentOrigin}
                        </code>
                        <button
                          type="button"
                          onClick={handleCopyOrigin}
                          className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                        >
                          {copiedUrl ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    </li>
                    <li>
                      Click <strong>Save</strong> and wait 1-2 minutes for Google to update.
                    </li>
                  </ol>
                </div>
              </div>
            )}

            {/* Segmented Sign-In Mode Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => setActiveTab('google')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'google'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {/* Official Google G icon */}
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>Google One-Click</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('email')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'email'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Mail className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Direct Email Sign-In</span>
                {isVercel && (
                  <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100">
                    Fast
                  </span>
                )}
              </button>
            </div>

            {/* TAB CONTENT 1: GOOGLE ONE CLICK */}
            {activeTab === 'google' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <button
                  type="button"
                  onClick={handleGoogleConnect}
                  disabled={googleSubmitting || loading}
                  className="w-full flex items-center justify-center gap-3.5 px-6 py-4 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 font-semibold text-sm rounded-2xl border border-slate-300 shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed group"
                >
                  {googleSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                      <span>Connecting to Google...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                        />
                      </svg>
                      <span className="text-slate-900 group-hover:text-indigo-600 transition-colors">
                        Sign in with Google
                      </span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                  <span>Authenticates with Google Identity Services</span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('email')}
                    className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer underline"
                  >
                    Or sign in with email directly &rarr;
                  </button>
                </div>
              </div>
            )}

            {/* TAB CONTENT 2: DIRECT EMAIL SIGN IN */}
            {activeTab === 'email' && (
              <form onSubmit={handleEmailSignIn} className="space-y-4 animate-in fade-in duration-150">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Your Email Address <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="e.g. dev@gamestudio.com or you@gmail.com"
                      className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Full Name or Studio Name <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder="e.g. Alex (Indie Publisher)"
                      className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all font-medium"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={emailSubmitting || !emailInput.trim()}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-6 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-sm rounded-2xl shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {emailSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Entering Workspace...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In &amp; Open Workspace</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <p className="text-[11px] text-slate-500 text-center">
                  Instant access on Vercel with zero Google Cloud whitelist barriers. All leads, campaigns, and drafts stay saved in your browser.
                </p>
              </form>
            )}

            {/* Guest / Instant Preview Option */}
            {onLoginAsGuest && (
              <div className="pt-3 border-t border-slate-100 flex flex-col items-center">
                <button
                  type="button"
                  onClick={handleGuestConnect}
                  disabled={guestSubmitting || loading}
                  className="w-full py-3 px-4 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {guestSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-600" />
                  ) : (
                    <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                  )}
                  <span>Continue as Guest (Instant 1-Click Preview)</span>
                </button>
                <p className="text-[11px] text-slate-400 mt-1.5 text-center">
                  Explore Steam game scouting and pitch drafting immediately without signing in
                </p>
              </div>
            )}

            {/* Feature Highlights */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 text-center">
                Built for High-Delivery Game Studio Outreach
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-800 block">Instant Game Scouting</strong>
                    Paste any Steam search page to find verified studio emails in seconds.
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-800 block">Direct Gmail Connection</strong>
                    Emails send from your own Gmail address and show in your Sent folder.
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-800 block">Sequential Dispatch</strong>
                    Dispatches pitches one after the other with natural human pacing.
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-800 block">100% Private &amp; Local</strong>
                    Zero database locks. All your leads and campaigns stay saved in your browser.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center text-xs text-slate-400">
            GameReach &bull; Steam Game Outreach &bull; Powered by Google OAuth 2.0 &amp; Vercel Ready
          </div>
        </div>
      </main>
    </div>
  );
};
