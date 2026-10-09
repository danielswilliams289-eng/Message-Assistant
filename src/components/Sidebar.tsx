import React from 'react';
import {
  LayoutDashboard,
  Compass,
  Users,
  SendHorizontal,
  Mail,
  MailCheck,
  Settings as SettingsIcon,
  LogOut,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

export type NavTab = 'dashboard' | 'scout' | 'leads' | 'send_list' | 'campaigns' | 'gmail' | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenScoutModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab, onOpenScoutModal }) => {
  const { user, profile, logout, leads, campaigns, accessToken } = useAuth();

  const queuedCount = leads.filter((l) => l.inSendList).length;
  const runningCampaignsCount = campaigns.filter((c) => c.status === 'running').length;

  const primaryNav = [
    { id: 'dashboard', label: 'Overview', code: '01', icon: LayoutDashboard },
    { id: 'scout', label: 'Scout Engine', code: '02', icon: Compass },
    { id: 'leads', label: 'Intelligence Base', code: '03', icon: Users, badge: leads.length ? String(leads.length) : null },
    { id: 'send_list', label: 'Send Queue', code: '04', icon: SendHorizontal, badge: queuedCount ? String(queuedCount) : null, badgeColor: 'text-cyan-400 bg-cyan-950/80 border-cyan-800' },
    { id: 'campaigns', label: 'Campaign Control', code: '05', icon: Mail, pulse: runningCampaignsCount > 0 },
  ];

  const secondaryNav = [
    { id: 'gmail', label: 'Gmail Connection', icon: MailCheck, statusDot: accessToken ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-amber-400' },
    { id: 'settings', label: 'System Settings', icon: SettingsIcon },
  ];

  return (
    <aside className="w-64 bg-[#0a0d16] border-r border-[#1a2133] flex flex-col justify-between shrink-0 text-slate-300 select-none h-auto md:h-screen sticky top-0 z-30">
      {/* Top Brand & Scout Launcher */}
      <div>
        <div className="p-5 pb-4 border-b border-[#161c2d] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-[0_0_12px_rgba(139,92,246,0.5)]">
              <Zap className="w-4 h-4 text-cyan-200" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-white tracking-widest text-sm">SCOUT</span>
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              </div>
              <p className="text-[10px] font-mono text-cyan-400/80 tracking-widest uppercase">
                COMMAND v2.6
              </p>
            </div>
          </div>
        </div>

        {/* Action Button: Scout Leads */}
        <div className="p-3">
          <button
            onClick={onOpenScoutModal}
            className="w-full relative group overflow-hidden flex items-center justify-center gap-2 py-2.5 px-3.5 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white rounded-xl font-bold text-xs tracking-wider uppercase transition-all shadow-[0_0_18px_rgba(139,92,246,0.35)] cursor-pointer"
          >
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            <Sparkles className="w-3.5 h-3.5 text-cyan-200 animate-pulse" />
            <span>+ Scout Leads</span>
          </button>
        </div>

        {/* Section: COMMAND */}
        <div className="px-3 pt-2">
          <div className="px-2 pb-2 flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold tracking-widest text-slate-500 uppercase">
              COMMAND
            </span>
            <span className="text-[10px] font-mono text-slate-600">SYS.ONLINE</span>
          </div>

          <nav className="space-y-1">
            {primaryNav.map((item) => {
              const Icon = item.icon;
              const active = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id as NavTab)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                    active
                      ? 'bg-gradient-to-r from-violet-950/80 to-[#121829] text-white border-l-2 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-[#121624]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`text-[10px] font-mono ${active ? 'text-cyan-400' : 'text-slate-600'}`}>
                      {item.code}
                    </span>
                    <Icon className={`w-3.5 h-3.5 ${active ? 'text-cyan-400' : 'text-slate-500'}`} />
                    <span>{item.label}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {item.pulse && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    )}
                    {item.badge && (
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono border ${item.badgeColor || 'border-slate-800 text-slate-400 bg-slate-900/60'}`}>
                        {item.badge}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Section: INTEGRATIONS */}
        <div className="px-3 pt-4">
          <div className="px-2 pb-2">
            <span className="text-[10px] font-mono font-bold tracking-widest text-slate-500 uppercase">
              PLATFORM
            </span>
          </div>
          <nav className="space-y-1">
            {secondaryNav.map((item) => {
              const Icon = item.icon;
              const active = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id as NavTab)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                    active
                      ? 'bg-gradient-to-r from-violet-950/80 to-[#121829] text-white border-l-2 border-violet-400 shadow-[0_0_12px_rgba(139,92,246,0.15)]'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-[#121624]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-3.5 h-3.5 ${active ? 'text-violet-400' : 'text-slate-500'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.statusDot && (
                    <span className={`w-2 h-2 rounded-full ${item.statusDot}`} />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* User Status Bar */}
      <div className="p-3 border-t border-[#161c2d] bg-[#07090e]/60">
        <div className="flex items-center justify-between gap-2.5 p-2 rounded-lg bg-[#0e121d] border border-[#1a2133]">
          <div className="flex items-center gap-2 overflow-hidden">
            {profile?.photoURL ? (
              <img
                src={profile.photoURL}
                alt="Avatar"
                className="w-7 h-7 rounded-md border border-[#2a344d] shrink-0"
              />
            ) : (
              <div className="w-7 h-7 rounded-md bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 font-mono">
                {profile?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}
              </div>
            )}
            <div className="truncate">
              <p className="text-xs font-semibold text-slate-200 truncate">
                {profile?.displayName || user?.displayName || 'Scout Operator'}
              </p>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <p className="text-[10px] font-mono text-slate-400 truncate">{user?.email}</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => logout()}
            title="Terminate Session"
            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};
