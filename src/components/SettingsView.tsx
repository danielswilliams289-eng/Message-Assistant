import React, { useState } from 'react';
import { Settings, User, Mail, ShieldAlert, Check, LogOut, Trash2, Zap } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

export const SettingsView: React.FC = () => {
  const { user, profile, updateProfile, logout } = useAuth();
  const [senderName, setSenderName] = useState(profile?.defaultSenderName || '');
  const [signature, setSignature] = useState(profile?.defaultSignature || '');
  const [defaultNiche, setDefaultNiche] = useState(profile?.defaultNiche || 'Game Developers');
  const [paceSeconds, setPaceSeconds] = useState(profile?.sendingPaceSeconds || 4);
  const [saved, setSaved] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile({
      defaultSenderName: senderName,
      defaultSignature: signature,
      defaultNiche,
      sendingPaceSeconds: paceSeconds,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16 font-mono">
      {/* Header */}
      <div className="space-y-1 border-b border-[#182033] pb-5">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-violet-400" />
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            SYSTEM SETTINGS
          </h1>
        </div>
        <p className="text-sm text-slate-400 font-sans">
          Configure default sending preferences, campaign parameters, and profile defaults.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSave} className="bg-[#0b0e1a] border border-[#1b233a] rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
        <div className="space-y-4">
          <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-[#182033] pb-2">
            Profile & Sender Identity
          </h2>

          <div>
            <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-1.5">
              Google Account (Authenticated)
            </label>
            <input
              type="text"
              readOnly
              value={user?.email || ''}
              className="w-full bg-[#07090e] border border-[#182033] rounded-xl p-3 text-xs text-slate-400 cursor-not-allowed"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-1.5">
                Default Sender Name
              </label>
              <input
                type="text"
                placeholder="e.g. Alex at Scout"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                className="w-full bg-[#07090e] border border-[#1e273e] rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-1.5">
                Default Target Niche
              </label>
              <input
                type="text"
                placeholder="e.g. Game Developers"
                value={defaultNiche}
                onChange={(e) => setDefaultNiche(e.target.value)}
                className="w-full bg-[#07090e] border border-[#1e273e] rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-1.5">
              Default Signature
            </label>
            <textarea
              rows={4}
              placeholder="Your standard sign-off..."
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              className="w-full bg-[#07090e] border border-[#1e273e] rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500 leading-relaxed resize-y"
            />
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-[#182033]">
          <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-[#182033] pb-2">
            Sending Controls & Humanized Pacing
          </h2>

          <div>
            <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-1.5">
              Default Delay between Emails (Seconds)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={2}
                max={60}
                value={paceSeconds}
                onChange={(e) => setPaceSeconds(parseInt(e.target.value) || 4)}
                className="w-24 bg-[#07090e] border border-[#1e273e] rounded-xl p-2.5 text-xs text-cyan-400 text-center font-bold focus:outline-none focus:border-cyan-500"
              />
              <span className="text-xs text-slate-500">
                Recommended 3-6 seconds with anti-spam jitter to prevent Google throttling.
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-[#182033]">
          <div>
            {saved && (
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
                <Check className="w-4 h-4" /> Preferences saved to profile
              </span>
            )}
          </div>
          <button
            type="submit"
            className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-[0_0_15px_rgba(139,92,246,0.35)] cursor-pointer"
          >
            Save Settings
          </button>
        </div>
      </form>
    </div>
  );
};
