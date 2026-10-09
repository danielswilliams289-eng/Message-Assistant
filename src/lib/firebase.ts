import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  initializeFirestore,
  setLogLevel,
  doc,
  getDocFromServer,
  Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Silence internal Firestore transport disconnect logs to prevent noisy console spam in iframe/sandbox
setLogLevel('silent');

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);

// Use initializeFirestore with experimentalForceLongPolling for robust, proxy/iframe-friendly connections
const dbId = (firebaseConfig as any).firestoreDatabaseId;
export const db: Firestore = dbId
  ? initializeFirestore(app, { experimentalForceLongPolling: true }, dbId)
  : initializeFirestore(app, { experimentalForceLongPolling: true });

export const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
];

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));
provider.setCustomParameters({
  prompt: 'select_account',
});

// Strictly in-memory access token cache as required by workspace-integration guidelines
let cachedAccessToken: string | null = null;
let isSigningIn = false;

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

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path,
  };
  console.warn('Firestore Operation Notice: ', JSON.stringify(errInfo));
  return errInfo;
}

// Test Firestore connection on init gracefully without throwing uncaught errors
async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error: any) {
    if (error instanceof Error && (error.message.includes('the client is offline') || (error as any).code === 'unavailable' || (error as any).code === 'not-found')) {
      console.warn('Firestore connection notice (operating in resilient mode):', error.message);
    }
  }
}
testFirestoreConnection();

export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  // Check for redirect result on app initialization (useful if popups are blocked on Vercel)
  if (typeof window !== 'undefined') {
    getRedirectResult(auth)
      .then(async (result) => {
        if (result && result.user) {
          const credential = GoogleAuthProvider.credentialFromResult(result);
          let token = credential?.accessToken || null;
          if (!token) {
            token = await requestGmailTokenViaGIS(result.user.email || undefined);
          }
          if (token) {
            cachedAccessToken = token;
          }
          if (onAuthSuccess) {
            onAuthSuccess(result.user, cachedAccessToken);
          }
        }
      })
      .catch((err) => {
        console.warn('Redirect auth check notice:', err);
      });
  }

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (onAuthSuccess) {
        onAuthSuccess(user, cachedAccessToken);
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const requestGmailTokenViaGIS = async (hintEmail?: string): Promise<string | null> => {
  return new Promise((resolve) => {
    try {
      const clientId = (firebaseConfig as any).oAuthClientId;
      if (!clientId || typeof window === 'undefined' || !window.google?.accounts?.oauth2) {
        return resolve(null);
      }

      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/gmail.send',
        prompt: hintEmail ? '' : 'select_account',
        callback: (response) => {
          if (response.access_token) {
            cachedAccessToken = response.access_token;
            resolve(response.access_token);
          } else {
            console.warn('GIS token callback returned without access_token:', response.error);
            resolve(null);
          }
        },
        error_callback: (err) => {
          console.warn('GIS error callback:', err);
          resolve(null);
        },
      });

      client.requestAccessToken({ prompt: hintEmail ? '' : 'select_account' });
    } catch (e) {
      console.warn('Exception during GIS token request:', e);
      resolve(null);
    }
  });
};

// Sign in with Google via Redirect (Guaranteed to bypass all browser pop-up blockers)
export const signInWithGoogleRedirect = async (): Promise<void> => {
  try {
    await signInWithRedirect(auth, provider);
  } catch (error: any) {
    console.error('Google Sign-in Redirect Error:', error);
    throw error;
  }
};

// Sign in with Google via Popup with automatic error diagnostics
export const signInWithGoogle = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    let token = credential?.accessToken || null;

    // Resilient fallback: if credential token is not provided by popup, request via Google Identity Services
    if (!token && typeof window !== 'undefined') {
      token = await requestGmailTokenViaGIS(result.user.email || undefined);
    }

    if (token) {
      cachedAccessToken = token;
      return { user: result.user, accessToken: token };
    }

    // Even if access token was delayed, the Firebase user authenticated
    return { user: result.user, accessToken: cachedAccessToken || '' };
  } catch (error: any) {
    console.error('Google Sign In Error:', error);

    // Provide friendly domain diagnostic if deployed to Vercel without domain whitelisting
    if (error?.code === 'auth/unauthorized-domain' && typeof window !== 'undefined') {
      error.friendlyMessage = `Your current domain (${window.location.hostname}) is not yet authorized in Firebase Console. Add '${window.location.hostname}' to Firebase Authentication > Settings > Authorized Domains. Alternatively, use 'Open in Gmail (Web)' or 'Copy All Emails' without signing in!`;
    } else if (error?.code === 'auth/popup-blocked') {
      error.friendlyMessage = 'Your browser blocked the sign-in pop-up window. You can use "Sign in via Redirect" or use "Open in Gmail (Web)" directly without signing in.';
    }

    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getCachedAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

export const logOut = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};
