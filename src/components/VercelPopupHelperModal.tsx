import React, { useState } from 'react';
import {
  Copy,
  Check,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  X,
  Mail,
  UserCheck,
  Globe,
  Settings,
} from 'lucide-react';
import { AuthErrorInfo } from '../lib/AuthContext';

interface VercelPopupHelperModalProps {
  error: AuthErrorInfo | null;
  onClose: () => void;
  onRetryWithRedirect?: () => void;
  onUseEmailSignIn?: () => void;
  onExploreAsGuest?: () => void;
}

export const VercelPopupHelperModal: React.FC<VercelPopupHelperModalProps> = ({
  error,
  onClose,
  onRetryWithRedirect,
  onUseEmailSignIn,
  onExploreAsGuest,
}) => {
  const [copiedOrigin, setCopiedOrigin] = useState(false);
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://your-app.vercel.app';
  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : 'your-app.vercel.app';
  const isVercelDomain = currentHostname.includes('vercel.app');

  const isOriginMismatch =
    error?.message?.toLowerCase().includes('origin_mismatch') ||
    error?.message?.toLowerCase().includes('origin') ||
    error?.message?.toLowerCase().includes('registered') ||
    error?.message?.toLowerCase().includes('invalid_request');

  const isPopupBlocked =
    error?.message?.toLowerCase().includes('closed') ||
    error?.message?.toLowerCase().includes('blocked');

  const handleCopyOrigin = () => {
    navigator.clipboard.writeText(currentOrigin);
    setCopiedOrigin(true);
    setTimeout(() => setCopiedOrigin(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 font-sans">
        {/* Header */}
        <div className="bg-amber-50 border-b border-amber-100 px-6 py-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 shadow-2xs">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                {isOriginMismatch
                  ? 'Google Cloud Origin Whitelist Needed'
                  : isPopupBlocked
                  ? 'Sign-In Window Closed or Blocked'
                  : 'Google Sign-In Guidance'}
              </h3>
              <p className="text-xs text-amber-800 mt-0.5">
                {isVercelDomain
                  ? 'Vercel Deployment Detected'
                  : `Running on ${currentHostname}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-amber-100/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 text-sm text-slate-600">
          <p className="text-slate-700 leading-relaxed text-xs sm:text-sm">
            Google OAuth 2.0 requires every production deployment domain (like <strong>Vercel</strong>) to be registered under <strong>Authorized JavaScript origins</strong> in Google Cloud Console.
          </p>

          {/* Quick Origin Copy Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-indigo-600" />
                <span>Your Production Origin URL:</span>
              </span>
              <button
                onClick={handleCopyOrigin}
                className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer transition-colors"
              >
                {copiedOrigin ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-600">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy URL</span>
                  </>
                )}
              </button>
            </div>
            <div className="bg-white border border-slate-200 px-3.5 py-2.5 rounded-xl font-mono text-xs text-slate-900 select-all break-all shadow-2xs font-semibold">
              {currentOrigin}
            </div>
          </div>

          {/* Instant Options - No Blocking! */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-900 text-xs tracking-wider uppercase">
              Choose How You Want to Proceed:
            </h4>

            {/* Option A: Direct Email Sign-In (Instant access) */}
            <div className="flex items-start gap-3 p-3.5 bg-indigo-50/80 border border-indigo-200 rounded-2xl">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                <Mail className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 text-xs">
                <div className="flex items-center gap-2">
                  <strong className="text-indigo-950 font-bold text-sm block">
                    Option 1: Sign In with Email (Instant Access)
                  </strong>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-200 text-indigo-900">
                    Recommended
                  </span>
                </div>
                <p className="text-slate-600 mt-1">
                  Bypass all Google Cloud origin restrictions immediately. Enter your studio email to scout games, save leads, and send pitches via Gmail Web.
                </p>
                {onUseEmailSignIn && (
                  <button
                    onClick={() => {
                      onClose();
                      onUseEmailSignIn();
                    }}
                    className="mt-2.5 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer"
                  >
                    <span>Use Email Sign-In</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Option B: Add Origin to Google Cloud Console */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-600 space-y-2">
              <div className="flex items-center justify-between">
                <strong className="text-slate-800 font-bold block">
                  Option 2: Add Origin to Google Cloud Console
                </strong>
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-600 hover:underline inline-flex items-center gap-1 font-semibold"
                >
                  <span>Open Console</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <ol className="list-decimal pl-4 space-y-1.5 text-slate-600 leading-relaxed">
                <li>
                  Go to <strong>APIs &amp; Services</strong> &rarr; <strong>Credentials</strong> in Google Cloud Console.
                </li>
                <li>
                  Click your <strong>OAuth 2.0 Web Client ID</strong>.
                </li>
                <li>
                  Under <strong>Authorized JavaScript origins</strong>, click <strong>+ ADD URI</strong> and paste:
                  <span className="block mt-1 font-mono text-[11px] text-slate-800 bg-white px-2 py-1 rounded border border-slate-200 font-semibold select-all">
                    {currentOrigin}
                  </span>
                </li>
                <li>
                  Click <strong>Save</strong>. (Changes take 1-2 minutes to propagate across Google servers).
                </li>
              </ol>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          {onExploreAsGuest ? (
            <button
              onClick={() => {
                onClose();
                onExploreAsGuest();
              }}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer flex items-center gap-1.5"
            >
              <UserCheck className="w-4 h-4 text-slate-500" />
              <span>Explore as Guest</span>
            </button>
          ) : (
            <button
              onClick={onClose}
              className="text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
            >
              Dismiss
            </button>
          )}

          {onUseEmailSignIn ? (
            <button
              onClick={() => {
                onClose();
                onUseEmailSignIn();
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <span>Continue with Email</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
