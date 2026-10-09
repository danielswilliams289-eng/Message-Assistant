import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  updateDoc,
  addDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, initAuth, signInWithGoogle, signInWithGoogleRedirect, logOut, getCachedAccessToken, requestGmailTokenViaGIS, handleFirestoreError, OperationType } from './firebase';
import { Lead, Campaign, ActivityLog, UserProfile, CampaignRecipient, OutreachStatus } from '../types';

export interface AuthErrorInfo {
  code: string;
  message: string;
  hostname: string;
}

const LEADS_STORAGE_PREFIX = 'scout_leads_';
const CAMPAIGNS_STORAGE_PREFIX = 'scout_campaigns_';
const PROFILE_STORAGE_PREFIX = 'scout_profile_';

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
  user: User | null;
  loading: boolean;
  accessToken: string | null;
  profile: UserProfile | null;
  leads: Lead[];
  campaigns: Campaign[];
  activities: ActivityLog[];
  authError: AuthErrorInfo | null;
  login: (method?: 'popup' | 'redirect') => Promise<void>;
  loginWithRedirect: () => Promise<void>;
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
  reauthorizeGmail: () => Promise<string | null>;
  recordActivity: (type: ActivityLog['type'], description: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [authError, setAuthError] = useState<AuthErrorInfo | null>(null);

  useEffect(() => {
    const unsubscribeAuth = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setAccessToken(token || getCachedAccessToken());
        setLoading(false);
      },
      () => {
        setUser(null);
        setAccessToken(null);
        setLoading(false);
        setLeads([]);
        setCampaigns([]);
        setActivities([]);
        setProfile(null);
      }
    );

    return () => unsubscribeAuth();
  }, []);

  // Fetch or sync user profile & real-time collections when user is logged in
  useEffect(() => {
    if (!user) return;

    const leadsKey = LEADS_STORAGE_PREFIX + user.uid;
    const campaignsKey = CAMPAIGNS_STORAGE_PREFIX + user.uid;
    const profileKey = PROFILE_STORAGE_PREFIX + user.uid;

    // Load initial cached data for instant responsiveness
    const cachedLeads = getStored<Lead>(leadsKey);
    if (cachedLeads.length > 0) {
      const sanitized = cachedLeads.map((l, idx) => ({
        ...l,
        id: l.id || `lead_cached_${idx}_${Date.now()}`,
      }));
      setLeads(sanitized);
    }

    const cachedCampaigns = getStored<Campaign>(campaignsKey);
    if (cachedCampaigns.length > 0) setCampaigns(cachedCampaigns);

    const cachedProfile = getStored<UserProfile>(profileKey)[0] || null;
    if (cachedProfile) setProfile(cachedProfile);

    // Load or create User Profile
    const userDocRef = doc(db, 'users', user.uid);
    const unsubUser = onSnapshot(userDocRef, async (snapshot) => {
      if (snapshot.exists()) {
        const prof = snapshot.data() as UserProfile;
        setProfile(prof);
        setStored(profileKey, [prof]);
      } else {
        const defaultProfile: UserProfile = {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || user.email?.split('@')[0] || 'User',
          photoURL: user.photoURL || '',
          defaultSenderName: user.displayName || 'Scout Team',
          defaultSignature: `Best regards,\n${user.displayName || 'Scout Team'}`,
          defaultNiche: 'General Business',
          sendingPaceSeconds: 3,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        try {
          await setDoc(userDocRef, defaultProfile);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
        }
        setProfile(defaultProfile);
        setStored(profileKey, [defaultProfile]);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
    });

    // Real-time Leads listener
    const leadsQuery = query(
      collection(db, 'leads'),
      where('userId', '==', user.uid)
    );
    const unsubLeads = onSnapshot(leadsQuery, (snapshot) => {
      const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Lead));
      docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setLeads((currentLeads) => {
        // Prevent race condition: if local state has leads marked as inSendList: true, preserve that status during sync
        const currentSendListIds = new Set(
          currentLeads.filter((l) => l.inSendList && l.id).map((l) => l.id!)
        );
        const mergedDocs = docs.map((doc) => {
          if (doc.id && currentSendListIds.has(doc.id)) {
            return {
              ...doc,
              inSendList: true,
              outreachStatus: doc.outreachStatus === 'not_contacted' ? 'queued' : doc.outreachStatus,
            };
          }
          return doc;
        });
        setStored(leadsKey, mergedDocs);
        return mergedDocs;
      });
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'leads');
    });

    // Real-time Campaigns listener
    const campaignsQuery = query(
      collection(db, 'campaigns'),
      where('userId', '==', user.uid)
    );
    const unsubCampaigns = onSnapshot(campaignsQuery, (snapshot) => {
      const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Campaign));
      docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setCampaigns(docs);
      setStored(campaignsKey, docs);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'campaigns');
    });

    // Real-time Activity Logs listener
    const activityQuery = query(
      collection(db, 'activity_logs'),
      where('userId', '==', user.uid)
    );
    const unsubActivity = onSnapshot(activityQuery, (snapshot) => {
      const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as ActivityLog));
      docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setActivities(docs);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'activity_logs');
    });

    return () => {
      unsubUser();
      unsubLeads();
      unsubCampaigns();
      unsubActivity();
    };
  }, [user]);

  const clearAuthError = () => {
    setAuthError(null);
  };

  const login = async (method: 'popup' | 'redirect' = 'popup') => {
    try {
      setAuthError(null);
      if (method === 'redirect') {
        await signInWithGoogleRedirect();
        return;
      }

      const result = await signInWithGoogle();
      if (result) {
        setUser(result.user);
        setAccessToken(result.accessToken);
        // Record log
        const logData: ActivityLog = {
          userId: result.user.uid,
          type: 'gmail_connected',
          description: `Logged in and connected Gmail (${result.user.email})`,
          createdAt: new Date().toISOString(),
        };
        try {
          await addDoc(collection(db, 'activity_logs'), logData);
        } catch (e) {
          handleFirestoreError(e, OperationType.CREATE, 'activity_logs');
        }
      }
    } catch (err: any) {
      console.error('Login action error:', err);
      const message = err?.friendlyMessage || err?.message || 'Authentication error';
      setAuthError({
        code: err?.code || 'auth/unknown',
        message,
        hostname: typeof window !== 'undefined' ? window.location.hostname : '',
      });
      throw err;
    }
  };

  const loginWithRedirect = async () => {
    return login('redirect');
  };

  const logout = async () => {
    await logOut();
    setUser(null);
    setAccessToken(null);
    setAuthError(null);
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) throw new Error('Not authenticated');
    const updated = profile ? { ...profile, ...data, updatedAt: new Date().toISOString() } : null;
    if (updated) {
      setProfile(updated);
      setStored(PROFILE_STORAGE_PREFIX + user.uid, [updated]);
    }
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, { ...data, updatedAt: new Date().toISOString() });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const recordActivity = async (type: ActivityLog['type'], description: string) => {
    if (!user) return;
    const logData: ActivityLog = {
      id: 'local_' + Date.now(),
      userId: user.uid,
      type,
      description,
      createdAt: new Date().toISOString(),
    };
    setActivities((prev) => [logData, ...prev]);
    try {
      await addDoc(collection(db, 'activity_logs'), {
        userId: logData.userId,
        type: logData.type,
        description: logData.description,
        createdAt: logData.createdAt,
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'activity_logs');
    }
  };

  const addLead = async (leadData: Omit<Lead, 'id' | 'userId' | 'createdAt'>): Promise<string> => {
    if (!user) throw new Error('Not authenticated');
    // Pre-create document reference with valid Firestore ID
    const newRef = doc(collection(db, 'leads'));
    const docData: Lead = {
      ...leadData,
      id: newRef.id,
      userId: user.uid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Optimistic state & local storage update
    setLeads((prev) => {
      const updated = [docData, ...prev];
      setStored(LEADS_STORAGE_PREFIX + user.uid, updated);
      return updated;
    });

    try {
      const { id: _, ...toWrite } = docData;
      await setDoc(newRef, toWrite);
      await recordActivity('lead_scouted', `Added lead: ${leadData.company || leadData.fullName || 'New prospect'}`);
      return newRef.id;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'leads');
      return newRef.id;
    }
  };

  const bulkAddLeads = async (leadsData: Omit<Lead, 'id' | 'userId' | 'createdAt'>[]): Promise<number> => {
    if (!user || leadsData.length === 0) return 0;
    
    const now = new Date().toISOString();
    // Pre-create document references with real Firestore IDs to avoid any mismatch between local and Firestore state
    const newLeadsWithIds: Lead[] = leadsData.map((ld) => {
      const newRef = doc(collection(db, 'leads'));
      return {
        ...ld,
        id: newRef.id,
        userId: user.uid,
        createdAt: now,
        updatedAt: now,
      };
    });

    // Optimistically update state and localStorage immediately
    setLeads((prev) => {
      const updated = [...newLeadsWithIds, ...prev];
      setStored(LEADS_STORAGE_PREFIX + user.uid, updated);
      return updated;
    });

    // Firestore batch limit is 500 operations (we use 450 chunk size)
    const batchSize = 450;
    let totalSaved = 0;

    for (let i = 0; i < newLeadsWithIds.length; i += batchSize) {
      const chunk = newLeadsWithIds.slice(i, i + batchSize);
      const batch = writeBatch(db);

      for (const lead of chunk) {
        const ref = doc(db, 'leads', lead.id!);
        const { id: _, ...docData } = lead;
        batch.set(ref, docData);
      }

      try {
        await batch.commit();
        totalSaved += chunk.length;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'leads');
        totalSaved += chunk.length;
      }
    }

    await recordActivity('lead_scouted', `Scouted and saved ${leadsData.length} lead(s)`);
    return leadsData.length;
  };

  const updateLead = async (id: string, updates: Partial<Lead>) => {
    if (!user) throw new Error('Not authenticated');
    const now = new Date().toISOString();
    setLeads((prev) => {
      const updated = prev.map((l) => (l.id === id ? { ...l, ...updates, updatedAt: now } : l));
      setStored(LEADS_STORAGE_PREFIX + user.uid, updated);
      return updated;
    });

    try {
      const leadRef = doc(db, 'leads', id);
      await setDoc(leadRef, { ...updates, updatedAt: now }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `leads/${id}`);
    }
  };

  const deleteLead = async (id: string) => {
    if (!user) throw new Error('Not authenticated');
    setLeads((prev) => {
      const updated = prev.filter((l) => l.id !== id);
      setStored(LEADS_STORAGE_PREFIX + user.uid, updated);
      return updated;
    });

    try {
      await deleteDoc(doc(db, 'leads', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `leads/${id}`);
    }
  };

  const bulkAddToSendList = async (leadIds: string[]) => {
    if (!user) throw new Error('Not authenticated');
    if (leadIds.length === 0) return;
    const idSet = new Set(leadIds);
    const now = new Date().toISOString();

    // 1. Instantly update all leads in local state & localStorage
    setLeads((prev) => {
      const updated = prev.map((l) =>
        l.id && idSet.has(l.id)
          ? {
              ...l,
              inSendList: true,
              outreachStatus: (l.outreachStatus === 'not_contacted' ? 'queued' : l.outreachStatus) as OutreachStatus,
              updatedAt: now,
            }
          : l
      );
      setStored(LEADS_STORAGE_PREFIX + user.uid, updated);
      return updated;
    });

    // 2. Atomically update all selected documents in Firestore batches
    const batchSize = 450;
    for (let i = 0; i < leadIds.length; i += batchSize) {
      const chunk = leadIds.slice(i, i + batchSize);
      const batch = writeBatch(db);

      for (const id of chunk) {
        const ref = doc(db, 'leads', id);
        batch.set(
          ref,
          {
            inSendList: true,
            outreachStatus: 'queued',
            updatedAt: now,
          },
          { merge: true }
        );
      }

      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `leads/${chunk[0]}`);
      }
    }

    await recordActivity('send_list_added', `Moved ${leadIds.length} lead(s) to Send List`);
  };

  const bulkRemoveFromSendList = async (leadIds: string[]) => {
    if (!user) throw new Error('Not authenticated');
    if (leadIds.length === 0) return;
    const idSet = new Set(leadIds);
    const now = new Date().toISOString();

    // 1. Instantly update local state
    setLeads((prev) => {
      const updated = prev.map((l) =>
        l.id && idSet.has(l.id)
          ? { ...l, inSendList: false, outreachStatus: 'not_contacted' as const, updatedAt: now }
          : l
      );
      setStored(LEADS_STORAGE_PREFIX + user.uid, updated);
      return updated;
    });

    // 2. Atomically update in Firestore batch
    const batchSize = 450;
    for (let i = 0; i < leadIds.length; i += batchSize) {
      const chunk = leadIds.slice(i, i + batchSize);
      const batch = writeBatch(db);

      for (const id of chunk) {
        const ref = doc(db, 'leads', id);
        batch.set(
          ref,
          {
            inSendList: false,
            outreachStatus: 'not_contacted',
            updatedAt: now,
          },
          { merge: true }
        );
      }

      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `leads/${chunk[0]}`);
      }
    }
  };

  const createCampaign = async (
    data: Omit<Campaign, 'id' | 'userId' | 'createdAt'>,
    recipientLeads: Lead[]
  ): Promise<string> => {
    if (!user) throw new Error('Not authenticated');

    const tempCampId = 'camp_' + Date.now();
    const campaignData: Campaign = {
      ...data,
      id: tempCampId,
      userId: user.uid,
      createdAt: new Date().toISOString(),
      totalRecipients: recipientLeads.length,
      sentCount: 0,
      pendingCount: recipientLeads.length,
      failedCount: 0,
    };

    setCampaigns((prev) => {
      const updated = [campaignData, ...prev];
      setStored(CAMPAIGNS_STORAGE_PREFIX + user.uid, updated);
      return updated;
    });

    try {
      const { id: _, ...toWrite } = campaignData;
      const campaignRef = await addDoc(collection(db, 'campaigns'), toWrite);

      // Create Campaign Recipients
      const replaceVariables = (text: string, lead: Lead) => {
        return text
          .replace(/\{\{first_name\}\}/gi, lead.firstName || lead.fullName?.split(' ')[0] || 'there')
          .replace(/\{\{name\}\}/gi, lead.fullName || lead.firstName || 'there')
          .replace(/\{\{last_name\}\}/gi, lead.lastName || '')
          .replace(/\{\{company\}\}/gi, lead.company || 'your team')
          .replace(/\{\{website\}\}/gi, lead.website || '')
          .replace(/\{\{niche\}\}/gi, lead.niche || data.niche || 'your industry')
          .replace(/\{\{email\}\}/gi, lead.email || '')
          .replace(/\{\{sender_name\}\}/gi, data.senderName || 'Team')
          .replace(/\{\{[a-zA-Z0-9_]+\}\}/g, '');
      };

      for (const lead of recipientLeads) {
        if (!lead.id || !lead.email) continue;
        const recipientData: CampaignRecipient = {
          campaignId: campaignRef.id,
          userId: user.uid,
          leadId: lead.id,
          recipientEmail: lead.email,
          recipientName: lead.fullName || lead.firstName || 'Valued Partner',
          recipientCompany: lead.company || 'Your Business',
          status: 'queued',
          personalizedSubject: replaceVariables(data.subject, lead),
          personalizedBody: replaceVariables(data.body, lead),
        };
        await addDoc(collection(db, 'campaign_recipients'), recipientData);
      }

      setCampaigns((prev) => {
        const updated = prev.map((c) => (c.id === tempCampId ? { ...c, id: campaignRef.id } : c));
        setStored(CAMPAIGNS_STORAGE_PREFIX + user.uid, updated);
        return updated;
      });

      await recordActivity('campaign_created', `Created campaign "${data.name}" with ${recipientLeads.length} recipients`);
      return campaignRef.id;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'campaigns');
      return tempCampId;
    }
  };

  const reauthorizeGmail = async (): Promise<string | null> => {
    try {
      // If user is already authenticated, attempt quick GIS token authorization first
      if (user?.email) {
        try {
          const gisToken = await requestGmailTokenViaGIS(user.email);
          if (gisToken) {
            setAccessToken(gisToken);
            return gisToken;
          }
        } catch (e) {
          console.warn('GIS re-auth attempt notice:', e);
        }
      }

      const result = await signInWithGoogle();
      if (result) {
        setUser(result.user);
        setAccessToken(result.accessToken);
        return result.accessToken;
      }
      return null;
    } catch (err) {
      console.error('Failed to reauthorize Gmail:', err);
      throw err;
    }
  };

  const updateCampaignStatus = async (id: string, status: Campaign['status']) => {
    if (!user) throw new Error('Not authenticated');
    const updates: any = { status };
    if (status === 'running') updates.startedAt = new Date().toISOString();
    if (status === 'completed' || status === 'cancelled') updates.completedAt = new Date().toISOString();

    setCampaigns((prev) => {
      const updated = prev.map((c) => (c.id === id ? { ...c, ...updates } : c));
      setStored(CAMPAIGNS_STORAGE_PREFIX + user.uid, updated);
      return updated;
    });

    try {
      const ref = doc(db, 'campaigns', id);
      await updateDoc(ref, updates);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `campaigns/${id}`);
    }
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
        login,
        loginWithRedirect,
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
        reauthorizeGmail,
        recordActivity,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
