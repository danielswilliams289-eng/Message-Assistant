import React, { useState } from 'react';
import {
  AlertTriangle,
  Copy,
  Check,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  X,
  Sparkles,
  Mail,
  RotateCw,
} from 'lucide-react';
import { AuthErrorInfo } from '../lib/AuthContext';

interface VercelPopupHelperModalProps {
  error: AuthErrorInfo | null;
  onClose: () => void;
  onRetryWithRedirect: () => void;
}

export const VercelPopupHelperModal: React.FC<VercelPopupHelperModalProps> = ({
  error,
  onClose,
  onRetryWithRedirect,
}) => {
  const [copiedDomain, setCopiedDomain] = useState(false);
  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : 'your-vercel-domain.vercel.app';
  const isVercelDomain = currentHostname.includes('vercel.app');
  const isUnauthorizedDomain = error?.code === 'auth/unauthorized-domain';
  const isPopupBlocked = error?.code === 'auth/popup-blocked' || error?.code === 'auth/popup-closed-by-user';

  const handleCopyHostname = () => {
    navigator.clipboard.writeText(currentHostname);
    setCopiedDomain(true);
    setTimeout(() => setCopiedDomain(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-amber-50 border-b border-amber-100 px-6 py-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                {isUnauthorizedDomain
                  ? 'Vercel Domain Authorization Needed'
                  : isPopupBlocked
                  ? 'Browser Blocked Sign-In Pop-up'
                  : 'Google Sign-In Notice'}
              </h3>
              <p className="text-xs text-amber-800 mt-0.5">
                {isVercelDomain
                  ? 'Running on Vercel deployment'
                  : `Running on ${currentHostname}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-amber-100/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 text-sm text-slate-600">
          <p className="text-slate-700 leading-relaxed">
            {isUnauthorizedDomain ? (
              <>
                Google & Firebase require any external deployment domain (like <strong>Vercel</strong>) to be whitelisted before allowing pop-up authentication.
              </>
            ) : isPopupBlocked ? (
              <>
                Your browser or browser privacy extension blocked the authentication pop-up from opening.
              </>
            ) : (
              error?.message || 'Authentication could not complete.'
            )}
          </p>

          {/* Quick Domain Copy Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">Your Current Domain:</span>
              <button
                onClick={handleCopyHostname}
                className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-700 font-medium cursor-pointer"
              >
                {copiedDomain ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-600">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Domain</span>
                  </>
                )}
              </button>
            </div>
            <div className="bg-white border border-slate-200 px-3 py-2 rounded-lg font-mono text-xs text-slate-800 select-all break-all">
              {currentHostname}
            </div>
          </div>

          {/* Recommended Solutions */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-900 text-xs tracking-wider uppercase">
              How You Can Proceed Right Now:
            </h4>

            {/* Option 1: No login needed! */}
            <div className="flex items-start gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                <Mail className="w-4 h-4" />
              </div>
              <div className="flex-1 text-xs">
                <strong className="text-emerald-950 font-semibold block">
                  Option 1: Send via Gmail Web (No setup needed!)
                </strong>
                <p className="text-emerald-800 mt-0.5">
                  You can use <strong>&quot;Open in Gmail (Web)&quot;</strong> or <strong>&quot;Copy All Emails&quot;</strong> immediately. This drafts your outreach directly in your Gmail browser with zero logins or domain setup required.
                </p>
              </div>
            </div>

            {/* Option 2: Sign in via Redirect */}
            <div className="flex items-start gap-3 p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
              <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5">
                <RotateCw className="w-4 h-4" />
              </div>
              <div className="flex-1 text-xs">
                <strong className="text-indigo-950 font-semibold block">
                  Option 2: Sign In via Page Redirect (Bypasses Pop-up Blockers)
                </strong>
                <p className="text-indigo-800 mt-0.5">
                  Redirects this page directly to Google and back, completely avoiding browser pop-up blockers.
                </p>
                <button
                  onClick={onRetryWithRedirect}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium shadow-xs transition-colors cursor-pointer"
                >
                  <span>Sign In via Redirect</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Option 3: Whitelist Domain in Firebase */}
            {isUnauthorizedDomain && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1.5">
                <strong className="text-slate-800 font-semibold block">
                  Option 3: Whitelist Domain in Firebase Console
                </strong>
                <ol className="list-decimal pl-4 space-y-1 text-slate-600">
                  <li>Open Firebase Console &rarr; <strong>Authentication</strong> &rarr; <strong>Settings</strong></li>
                  <li>Click <strong>Authorized Domains</strong> tab &rarr; <strong>Add Domain</strong></li>
                  <li>Paste <code className="bg-slate-200/60 px-1 py-0.5 rounded text-slate-800">{currentHostname}</code> and save</li>
                </ol>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
          >
            Close &amp; Continue with Gmail Web
          </button>
          <button
            onClick={onRetryWithRedirect}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <span>Try Redirect Login</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
