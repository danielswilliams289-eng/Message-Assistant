// Google Identity Services & OAuth 2.0 Integration
// Lightweight, secure, zero Firebase dependency.
import firebaseConfig from '../../firebase-applet-config.json';

const STORAGE_CUSTOM_CLIENT_ID = 'scout_google_client_id';
const DEFAULT_CLIENT_ID = (firebaseConfig as any)?.oAuthClientId || '457431787927-rhb4dcccmc1vt9n1b2v7cj973rid8q5q.apps.googleusercontent.com';

export interface GoogleUserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  isAnonymous?: boolean;
}

export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'openid',
];

// Global type augmentation for Google Identity Services
declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
            error_callback?: (err: any) => void;
            prompt?: string;
          }) => {
            requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
          };
        };
      };
    };
  }
}

// Memory-only access token storage
let memoryAccessToken: string | null = null;

export function getCachedAccessToken(): string | null {
  return memoryAccessToken;
}

export function setCachedAccessToken(token: string | null): void {
  memoryAccessToken = token;
}

export function getGoogleClientId(): string {
  try {
    const custom = localStorage.getItem(STORAGE_CUSTOM_CLIENT_ID);
    if (custom && custom.trim()) return custom.trim();
  } catch {}
  return DEFAULT_CLIENT_ID;
}

export function setGoogleClientId(clientId: string): void {
  try {
    if (clientId && clientId.trim()) {
      localStorage.setItem(STORAGE_CUSTOM_CLIENT_ID, clientId.trim());
    } else {
      localStorage.removeItem(STORAGE_CUSTOM_CLIENT_ID);
    }
  } catch {}
}

// Fetch Google User Profile via access token
export async function fetchGoogleUserProfile(accessToken: string): Promise<GoogleUserProfile | null> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!res.ok) {
      console.warn('Failed to fetch Google userinfo:', res.status);
      return null;
    }
    const data = await res.json();
    return {
      uid: data.sub || `google_${data.email}`,
      email: data.email || '',
      displayName: data.name || data.email?.split('@')[0] || 'Google User',
      photoURL: data.picture || '',
      isAnonymous: false,
    };
  } catch (err) {
    console.error('Error fetching Google profile:', err);
    return null;
  }
}

// Ensure Google Identity Services script is available
export function loadGoogleIdentityServices(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if (window.google?.accounts?.oauth2) return resolve(true);

    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(true), { once: true });
      setTimeout(() => resolve(!!window.google?.accounts?.oauth2), 1500);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

// Request Google OAuth Token (GIS Token Client)
export async function requestGoogleOAuthToken(
  customPrompt: 'select_account' | 'consent' | '' = 'select_account',
  hintEmail?: string
): Promise<{ accessToken: string; profile: GoogleUserProfile | null } | null> {
  await loadGoogleIdentityServices();

  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new Error('Google Cloud Client ID is missing. Please configure it in Google Cloud settings.');
  }

  if (typeof window === 'undefined' || !window.google?.accounts?.oauth2) {
    throw new Error('Google Identity Services library failed to load. Please check your internet connection or ad blocker.');
  }

  return new Promise((resolve, reject) => {
    try {
      const tokenClient = window.google!.accounts!.oauth2!.initTokenClient({
        client_id: clientId,
        scope: GMAIL_SCOPES.join(' '),
        prompt: hintEmail ? '' : customPrompt,
        callback: async (tokenResponse) => {
          if (tokenResponse.error) {
            console.error('Google OAuth error:', tokenResponse.error);
            if (tokenResponse.error === 'access_denied') {
              return reject(new Error('Access was denied or dismissed. Please approve Gmail permissions to send emails.'));
            }
            return reject(new Error(`Google authorization error: ${tokenResponse.error}`));
          }

          if (!tokenResponse.access_token) {
            return reject(new Error('No access token returned from Google.'));
          }

          const token = tokenResponse.access_token;
          setCachedAccessToken(token);

          // Fetch user profile
          const profile = await fetchGoogleUserProfile(token);
          resolve({
            accessToken: token,
            profile,
          });
        },
        error_callback: (err: any) => {
          console.error('Google token error callback:', err);
          reject(new Error(err?.message || 'Google authorization failed.'));
        },
      });

      tokenClient.requestAccessToken({
        prompt: hintEmail ? '' : customPrompt,
      });
    } catch (err: any) {
      console.error('Exception starting Google Token Client:', err);
      reject(err);
    }
  });
}

// Helper to open real Gmail web compose window (100% reliable fallback)
export function openGmailWebCompose(params: {
  to?: string;
  bcc?: string[];
  subject: string;
  body: string;
}): void {
  const query = new URLSearchParams();
  query.set('view', 'cm');
  query.set('fs', '1');
  if (params.to) query.set('to', params.to);
  if (params.bcc && params.bcc.length > 0) query.set('bcc', params.bcc.join(','));
  query.set('su', params.subject);
  query.set('body', params.body);

  const url = `https://mail.google.com/mail/?${query.toString()}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}
