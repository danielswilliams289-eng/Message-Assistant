import React, { useState } from 'react';
import { useAuth } from './lib/AuthContext';
import { GameLeadSender } from './components/GameLeadSender';
import { LeadsView } from './components/LeadsView';
import { CampaignsListView } from './components/CampaignsListView';
import { CampaignDetailView } from './components/CampaignDetailView';
import { GmailConnectionView } from './components/GmailConnectionView';
import { LeadDetailModal } from './components/LeadDetailModal';
import { CreateCampaignModal } from './components/CreateCampaignModal';
import { VercelPopupHelperModal } from './components/VercelPopupHelperModal';
import { Lead } from './types';
import {
  Gamepad2,
  MailCheck,
  Users,
  Mail,
  Loader2,
  ShieldCheck,
  Send,
  Sparkles,
  LogOut,
  Inbox,
  HelpCircle,
} from 'lucide-react';

export type AppViewMode = 'scout_and_send' | 'saved_leads' | 'campaigns' | 'gmail_settings';

export default function App() {
  const { user, loading, login, loginWithRedirect, logout, campaigns, accessToken, reauthorizeGmail, leads, authError, clearAuthError } = useAuth();
  const [currentView, setCurrentView] = useState<AppViewMode>('scout_and_send');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [selectedLeadDetail, setSelectedLeadDetail] = useState<Lead | null>(null);
  const [isCreateCampaignOpen, setIsCreateCampaignOpen] = useState(false);
  const [isHelperOpen, setIsHelperOpen] = useState(false);
  const [reauthorizing, setReauthorizing] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  const handleLogin = async () => {
    setLoginLoading(true);
    try {
      await login();
    } catch (e: any) {
      console.warn('Sign-in notice:', e);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleQuickReauth = async () => {
    setReauthorizing(true);
    try {
      await reauthorizeGmail();
    } catch (e: any) {
      console.warn('Re-auth notice:', e);
    } finally {
      setReauthorizing(false);
    }
  };

  // Initial loader
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-700">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md animate-pulse">
            <Gamepad2 className="w-6 h-6" />
          </div>
          <div className="text-center space-y-1">
            <h2 className="text-sm font-bold tracking-wide text-slate-800">
              Steam Game Lead Finder
            </h2>
            <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
              <span>Loading workspace...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col antialiased">
      {/* Top Header Bar */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-40 shadow-2xs">
        {/* Left: Brand & Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
            <Gamepad2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-base tracking-tight">
                GameReach
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                Steam &bull; Gmail
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              Paste games &bull; Find developer contacts &bull; Send Gmail outreach
            </p>
          </div>
        </div>

        {/* Center: Navigation Bar */}
        <nav className="hidden md:flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs">
          <button
            onClick={() => setCurrentView('scout_and_send')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer font-medium ${
              currentView === 'scout_and_send'
                ? 'bg-white text-indigo-700 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>Paste & Send</span>
          </button>

          <button
            onClick={() => setCurrentView('saved_leads')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer font-medium ${
              currentView === 'saved_leads'
                ? 'bg-white text-indigo-700 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-slate-500" />
            <span>Saved Database ({leads.length})</span>
          </button>

          <button
            onClick={() => setCurrentView('campaigns')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer font-medium ${
              currentView === 'campaigns'
                ? 'bg-white text-indigo-700 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Mail className="w-3.5 h-3.5 text-slate-500" />
            <span>Campaigns ({campaigns.length})</span>
          </button>
        </nav>

        {/* Right: Gmail OAuth Connection & User Account */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              {accessToken ? (
                <button
                  onClick={() => setCurrentView('gmail_settings')}
                  title="Gmail OAuth Connected"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium cursor-pointer hover:bg-emerald-100 transition-colors"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="hidden sm:inline">Gmail Connected</span>
                </button>
              ) : (
                <button
                  onClick={handleQuickReauth}
                  disabled={reauthorizing}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium hover:bg-amber-100 transition-colors cursor-pointer"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span>{reauthorizing ? 'Connecting...' : 'Authorize Gmail'}</span>
                </button>
              )}

              {/* User Dropdown / Logout */}
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="Account"
                    className="w-7 h-7 rounded-full border border-slate-200"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                    {user.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
                <span className="hidden lg:inline text-xs text-slate-700 font-medium truncate max-w-[120px]">
                  {user.email?.split('@')[0]}
                </span>
                <button
                  onClick={() => logout()}
                  title="Sign out"
                  className="text-slate-400 hover:text-red-600 transition-colors p-1 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleLogin}
              disabled={loginLoading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-xl transition-all shadow-xs cursor-pointer active:scale-98"
            >
              {loginLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Inbox className="w-3.5 h-3.5" />
              )}
              <span>Connect Gmail</span>
            </button>
          )}

          {/* Vercel & Pop-up Setup Guide trigger */}
          <button
            onClick={() => setIsHelperOpen(true)}
            title="Vercel & Pop-up Configuration Guide"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <HelpCircle className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </header>

      {/* Mobile Nav Switcher */}
      <div className="md:hidden flex items-center justify-around bg-white border-b border-slate-200 p-2 text-xs">
        <button
          onClick={() => setCurrentView('scout_and_send')}
          className={`px-3 py-1.5 rounded-lg ${
            currentView === 'scout_and_send' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600'
          }`}
        >
          Paste & Send
        </button>
        <button
          onClick={() => setCurrentView('saved_leads')}
          className={`px-3 py-1.5 rounded-lg ${
            currentView === 'saved_leads' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600'
          }`}
        >
          Database ({leads.length})
        </button>
        <button
          onClick={() => setCurrentView('campaigns')}
          className={`px-3 py-1.5 rounded-lg ${
            currentView === 'campaigns' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600'
          }`}
        >
          Campaigns
        </button>
      </div>

      {/* Main Workspace */}
      <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto bg-slate-50">
        {/* VIEW 1: THE CORE 2-STEP APPLICATION (Paste & Analyze -> Bring out contacts -> Send) */}
        {currentView === 'scout_and_send' && <GameLeadSender />}

        {/* VIEW 2: SAVED LEADS DATABASE */}
        {currentView === 'saved_leads' && (
          <div className="max-w-5xl mx-auto space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  Saved Leads Database
                </h1>
                <p className="text-xs text-slate-500">
                  All extracted studios and contacts automatically saved to your database
                </p>
              </div>
              <button
                onClick={() => setCurrentView('scout_and_send')}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium cursor-pointer hover:bg-indigo-700"
              >
                + Find More Games
              </button>
            </div>
            <LeadsView
              onOpenLeadDetail={(lead: Lead) => setSelectedLeadDetail(lead)}
            />
          </div>
        )}

        {/* VIEW 3: CAMPAIGNS */}
        {currentView === 'campaigns' && (
          <div className="max-w-5xl mx-auto space-y-4">
            {selectedCampaignId ? (
              <CampaignDetailView
                campaignId={selectedCampaignId}
                onBack={() => setSelectedCampaignId(null)}
              />
            ) : (
              <CampaignsListView
                onSelectCampaign={(id) => setSelectedCampaignId(id)}
                onOpenCreateModal={() => setIsCreateCampaignOpen(true)}
              />
            )}
          </div>
        )}

        {/* VIEW 4: GMAIL SETTINGS */}
        {currentView === 'gmail_settings' && (
          <div className="max-w-4xl mx-auto py-4">
            <GmailConnectionView />
          </div>
        )}
      </main>

      {/* Modals */}
      {selectedLeadDetail && (
        <LeadDetailModal
          lead={selectedLeadDetail}
          onClose={() => setSelectedLeadDetail(null)}
        />
      )}

      {isCreateCampaignOpen && (
        <CreateCampaignModal
          onClose={() => setIsCreateCampaignOpen(false)}
          onCampaignCreated={(newId) => {
            setSelectedCampaignId(newId);
            setCurrentView('campaigns');
            setIsCreateCampaignOpen(false);
          }}
        />
      )}

      {/* Vercel & Pop-up Assistant Modal */}
      {(authError || isHelperOpen) && (
        <VercelPopupHelperModal
          error={authError}
          onClose={() => {
            clearAuthError();
            setIsHelperOpen(false);
          }}
          onRetryWithRedirect={async () => {
            clearAuthError();
            setIsHelperOpen(false);
            await loginWithRedirect();
          }}
        />
      )}
    </div>
  );
}
