import React, { createContext, useContext, useEffect, useState } from 'react';
import { Lead, Campaign, ActivityLog, UserProfile, CampaignRecipient, OutreachStatus } from '../types';
import {
  GoogleUserProfile,
  getCachedAccessToken,
  setCachedAccessToken,
  requestGoogleOAuthToken,
  getGoogleClientId,
  setGoogleClientId,
  fetchGoogleUserProfile,
} from './googleAuth';

export interface AuthErrorInfo {
  code: string;
  message: string;
  hostname: string;
}

const STORAGE_ACTIVE_USER = 'scout_active_user';
const LEADS_STORAGE_PREFIX = 'scout_leads_';
const CAMPAIGNS_STORAGE_PREFIX = 'scout_campaigns_';
const RECIPIENTS_STORAGE_PREFIX = 'scout_recipients_';
const PROFILE_STORAGE_PREFIX = 'scout_profile_';
const ACTIVITY_STORAGE_PREFIX = 'scout_activity_';

function getStored<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setStored<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

interface AuthContextType {
  user: GoogleUserProfile | null;
  loading: boolean;
  accessToken: string | null;
  profile: UserProfile | null;
  leads: Lead[];
  campaigns: Campaign[];
  activities: ActivityLog[];
  authError: AuthErrorInfo | null;
  googleClientId: string;
  updateGoogleClientId: (clientId: string) => void;
  login: (method?: 'popup' | 'redirect') => Promise<void>;
  loginWithRedirect: () => Promise<void>;
  loginAsGuest: () => Promise<void>;
  clearAuthError: () => void;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  addLead: (lead: Omit<Lead, 'id' | 'userId' | 'createdAt'>) => Promise<string>;
  bulkAddLeads: (leads: Omit<Lead, 'id' | 'userId' | 'createdAt'>[]) => Promise<number>;
  updateLead: (id: string, updates: Partial<Lead>) => Promise<void>;
  deleteLead: (id: string) => Promise<void>;
  bulkAddToSendList: (leadIds: string[]) => Promise<void>;
  bulkRemoveFromSendList: (leadIds: string[]) => Promise<void>;
  createCampaign: (data: Omit<Campaign, 'id' | 'userId' | 'createdAt'>, recipientLeads: Lead[]) => Promise<string>;
  updateCampaignStatus: (id: string, status: Campaign['status']) => Promise<void>;
  updateCampaign: (id: string, updates: Partial<Campaign>) => Promise<void>;
  getCampaignRecipients: (campaignId: string) => CampaignRecipient[];
  setCampaignRecipients: (campaignId: string, recipients: CampaignRecipient[]) => void;
  updateCampaignRecipient: (recipientId: string, updates: Partial<CampaignRecipient>) => void;
  reauthorizeGmail: () => Promise<string | null>;
  authorizeGmailWithRedirect: () => Promise<void>;
  enableSandboxMode: () => void;
  recordActivity: (type: ActivityLog['type'], description: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<GoogleUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [authError, setAuthError] = useState<AuthErrorInfo | null>(null);
  const [googleClientId, setGoogleClientIdState] = useState<string>(getGoogleClientId());

  // Load active user session on app start
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem(STORAGE_ACTIVE_USER);
      if (storedUser) {
        const parsed = JSON.parse(storedUser) as GoogleUserProfile;
        setUser(parsed);
      }
    } catch (e) {
      console.warn('Error reading stored user session:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // When user changes, load their corresponding collections from persistent storage
  useEffect(() => {
    if (!user) {
      setLeads([]);
      setCampaigns([]);
      setActivities([]);
      setProfile(null);
      return;
    }

    const leadsKey = LEADS_STORAGE_PREFIX + user.uid;
    const campaignsKey = CAMPAIGNS_STORAGE_PREFIX + user.uid;
    const profileKey = PROFILE_STORAGE_PREFIX + user.uid;
    const activityKey = ACTIVITY_STORAGE_PREFIX + user.uid;

    const storedLeads = getStored<Lead>(leadsKey);
    setLeads(storedLeads);

    const storedCampaigns = getStored<Campaign>(campaignsKey);
    setCampaigns(storedCampaigns);

    const storedActivities = getStored<ActivityLog>(activityKey);
    setActivities(storedActivities);

    const storedProfile = getStored<UserProfile>(profileKey)[0] || null;
    if (storedProfile) {
      setProfile(storedProfile);
    } else {
      const defaultProf: UserProfile = {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || user.email.split('@')[0] || 'User',
        photoURL: user.photoURL || '',
        defaultSenderName: user.displayName || 'Scout Outreach Team',
        defaultSignature: `Best regards,\n${user.displayName || 'Scout Outreach Team'}`,
        defaultNiche: 'Indie Game Studios',
        sendingPaceSeconds: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setProfile(defaultProf);
      setStored(profileKey, [defaultProf]);
    }
  }, [user]);

  const updateGoogleClientId = (newId: string) => {
    setGoogleClientId(newId);
    setGoogleClientIdState(newId);
  };

  const clearAuthError = () => {
    setAuthError(null);
  };

  // Sign In with Google via official Google OAuth 2.0 / GIS Token Client
  const login = async (_method: 'popup' | 'redirect' = 'popup') => {
    try {
      setAuthError(null);
      const res = await requestGoogleOAuthToken('select_account');
      if (res && res.profile) {
        setUser(res.profile);
        setAccessToken(res.accessToken);
        setStored(STORAGE_ACTIVE_USER, res.profile);

        // Record activity log
        const logData: ActivityLog = {
          userId: res.profile.uid,
          type: 'gmail_connected',
          description: `Connected Google Account & Gmail (${res.profile.email})`,
          createdAt: new Date().toISOString(),
        };
        const actKey = ACTIVITY_STORAGE_PREFIX + res.profile.uid;
        const currentLogs = getStored<ActivityLog>(actKey);
        const updatedLogs = [logData, ...currentLogs];
        setStored(actKey, updatedLogs);
        setActivities(updatedLogs);
      }
    } catch (err: any) {
      console.warn('Google sign-in error:', err);
      const message = err?.message || 'Google authentication failed';
      setAuthError({
        code: 'google_auth_error',
        message,
        hostname: typeof window !== 'undefined' ? window.location.hostname : '',
      });
      throw err;
    }
  };

  const loginWithRedirect = async () => {
    return login('redirect');
  };

  // Guest / Preview Mode so user can inspect features immediately
  const loginAsGuest = async () => {
    setAuthError(null);
    const guestUser: GoogleUserProfile = {
      uid: 'guest_user_preview',
      email: 'preview.scout@gmail.com',
      displayName: 'Guest Previewer',
      photoURL: '',
      isAnonymous: true,
    };
    setUser(guestUser);
    setAccessToken('demo-guest-token');
    setStored(STORAGE_ACTIVE_USER, guestUser);

    const logData: ActivityLog = {
      userId: guestUser.uid,
      type: 'gmail_connected',
      description: 'Entered Scout in Guest Mode',
      createdAt: new Date().toISOString(),
    };
    const actKey = ACTIVITY_STORAGE_PREFIX + guestUser.uid;
    const currentLogs = getStored<ActivityLog>(actKey);
    const updated = [logData, ...currentLogs];
    setStored(actKey, updated);
    setActivities(updated);
  };

  const logout = async () => {
    setUser(null);
    setAccessToken(null);
    setCachedAccessToken(null);
    try {
      localStorage.removeItem(STORAGE_ACTIVE_USER);
    } catch {}
    setLeads([]);
    setCampaigns([]);
    setActivities([]);
    setProfile(null);
  };

  const reauthorizeGmail = async (): Promise<string | null> => {
    try {
      const res = await requestGoogleOAuthToken('consent', user?.email);
      if (res) {
        setAccessToken(res.accessToken);
        if (res.profile) {
          setUser(res.profile);
          setStored(STORAGE_ACTIVE_USER, res.profile);
        }
        return res.accessToken;
      }
      return null;
    } catch (err: any) {
      console.warn('Reauthorize Gmail notice:', err);
      throw err;
    }
  };

  const authorizeGmailWithRedirect = async () => {
    await reauthorizeGmail();
  };

  const enableSandboxMode = () => {
    setAccessToken('demo-guest-token');
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user || !profile) return;
    const updated: UserProfile = {
      ...profile,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    setProfile(updated);
    setStored(PROFILE_STORAGE_PREFIX + user.uid, [updated]);
  };

  const addLead = async (leadData: Omit<Lead, 'id' | 'userId' | 'createdAt'>): Promise<string> => {
    const userId = user?.uid || 'guest_user';
    const newLead: Lead = {
      ...leadData,
      id: `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId,
      createdAt: new Date().toISOString(),
    };

    setLeads((prev) => {
      const updated = [newLead, ...prev];
      setStored(LEADS_STORAGE_PREFIX + userId, updated);
      return updated;
    });

    return newLead.id!;
  };

  const bulkAddLeads = async (leadsData: Omit<Lead, 'id' | 'userId' | 'createdAt'>[]): Promise<number> => {
    const userId = user?.uid || 'guest_user';
    const newLeads: Lead[] = leadsData.map((l, idx) => ({
      ...l,
      id: `lead_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
      userId,
      createdAt: new Date().toISOString(),
    }));

    setLeads((prev) => {
      const updated = [...newLeads, ...prev];
      setStored(LEADS_STORAGE_PREFIX + userId, updated);
      return updated;
    });

    return newLeads.length;
  };

  const updateLead = async (id: string, updates: Partial<Lead>) => {
    const userId = user?.uid || 'guest_user';
    setLeads((prev) => {
      const updated = prev.map((l) => (l.id === id ? { ...l, ...updates, updatedAt: new Date().toISOString() } : l));
      setStored(LEADS_STORAGE_PREFIX + userId, updated);
      return updated;
    });
  };

  const deleteLead = async (id: string) => {
    const userId = user?.uid || 'guest_user';
    setLeads((prev) => {
      const updated = prev.filter((l) => l.id !== id);
      setStored(LEADS_STORAGE_PREFIX + userId, updated);
      return updated;
    });
  };

  const bulkAddToSendList = async (leadIds: string[]) => {
    const userId = user?.uid || 'guest_user';
    const targetSet = new Set(leadIds);
    setLeads((prev) => {
      const updated = prev.map((l) =>
        l.id && targetSet.has(l.id)
          ? {
              ...l,
              inSendList: true,
              outreachStatus: (l.outreachStatus === 'not_contacted' ? 'queued' : l.outreachStatus) as OutreachStatus,
            }
          : l
      );
      setStored(LEADS_STORAGE_PREFIX + userId, updated);
      return updated;
    });
  };

  const bulkRemoveFromSendList = async (leadIds: string[]) => {
    const userId = user?.uid || 'guest_user';
    const targetSet = new Set(leadIds);
    setLeads((prev) => {
      const updated = prev.map((l) =>
        l.id && targetSet.has(l.id)
          ? {
              ...l,
              inSendList: false,
              outreachStatus: (l.outreachStatus === 'queued' ? 'not_contacted' : l.outreachStatus) as OutreachStatus,
            }
          : l
      );
      setStored(LEADS_STORAGE_PREFIX + userId, updated);
      return updated;
    });
  };

  const createCampaign = async (
    data: Omit<Campaign, 'id' | 'userId' | 'createdAt'>,
    recipientLeads: Lead[]
  ): Promise<string> => {
    const userId = user?.uid || 'guest_user';
    const campaignId = `camp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newCampaign: Campaign = {
      ...data,
      id: campaignId,
      userId,
      createdAt: new Date().toISOString(),
    };

    // Store campaign
    setCampaigns((prev) => {
      const updated = [newCampaign, ...prev];
      setStored(CAMPAIGNS_STORAGE_PREFIX + userId, updated);
      return updated;
    });

    // Store recipients for this campaign
    const recipients: CampaignRecipient[] = recipientLeads.map((l) => ({
      id: `recip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      campaignId,
      userId,
      leadId: l.id || '',
      recipientEmail: l.email || '',
      recipientName: l.fullName || l.company,
      recipientCompany: l.company,
      status: 'queued',
    }));
    setStored(RECIPIENTS_STORAGE_PREFIX + campaignId, recipients);

    return campaignId;
  };

  const updateCampaignStatus = async (id: string, status: Campaign['status']) => {
    const userId = user?.uid || 'guest_user';
    setCampaigns((prev) => {
      const updated = prev.map((c) => (c.id === id ? { ...c, status } : c));
      setStored(CAMPAIGNS_STORAGE_PREFIX + userId, updated);
      return updated;
    });
  };

  const updateCampaign = async (id: string, updates: Partial<Campaign>) => {
    const userId = user?.uid || 'guest_user';
    setCampaigns((prev) => {
      const updated = prev.map((c) => (c.id === id ? { ...c, ...updates } : c));
      setStored(CAMPAIGNS_STORAGE_PREFIX + userId, updated);
      return updated;
    });
  };

  const getCampaignRecipients = (campaignId: string): CampaignRecipient[] => {
    return getStored<CampaignRecipient>(RECIPIENTS_STORAGE_PREFIX + campaignId);
  };

  const setCampaignRecipients = (campaignId: string, recipients: CampaignRecipient[]) => {
    setStored(RECIPIENTS_STORAGE_PREFIX + campaignId, recipients);
  };

  const updateCampaignRecipient = (recipientId: string, updates: Partial<CampaignRecipient>) => {
    // Find matching campaign
    for (const campaign of campaigns) {
      if (!campaign.id) continue;
      const key = RECIPIENTS_STORAGE_PREFIX + campaign.id;
      const list = getStored<CampaignRecipient>(key);
      const matchIdx = list.findIndex((r) => r.id === recipientId);
      if (matchIdx !== -1) {
        list[matchIdx] = { ...list[matchIdx], ...updates };
        setStored(key, list);
        break;
      }
    }
  };

  const recordActivity = async (type: ActivityLog['type'], description: string) => {
    const userId = user?.uid || 'guest_user';
    const newLog: ActivityLog = {
      id: `act_${Date.now()}`,
      userId,
      type,
      description,
      createdAt: new Date().toISOString(),
    };
    const actKey = ACTIVITY_STORAGE_PREFIX + userId;
    setActivities((prev) => {
      const updated = [newLog, ...prev];
      setStored(actKey, updated);
      return updated;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        accessToken,
        profile,
        leads,
        campaigns,
        activities,
        authError,
        googleClientId,
        updateGoogleClientId,
        login,
        loginWithRedirect,
        loginAsGuest,
        clearAuthError,
        logout,
        updateProfile,
        addLead,
        bulkAddLeads,
        updateLead,
        deleteLead,
        bulkAddToSendList,
        bulkRemoveFromSendList,
        createCampaign,
        updateCampaignStatus,
        updateCampaign,
        getCampaignRecipients,
        setCampaignRecipients,
        updateCampaignRecipient,
        reauthorizeGmail,
        authorizeGmailWithRedirect,
        enableSandboxMode,
        recordActivity,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
