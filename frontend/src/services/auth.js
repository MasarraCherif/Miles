import { API_BASE } from "../config.js";

const ACCESS_TOKEN_KEY = "miles_access_token";
const USER_KEY = "miles_current_user";

let accessToken = localStorage.getItem(ACCESS_TOKEN_KEY) || null;
let currentUser = (() => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
})();

const subscribers = new Set();
const API = API_BASE;

const notify = () => {
  subscribers.forEach((cb) => cb({ accessToken, user: currentUser }));
};

export const authStore = {
  subscribe(cb) {
    subscribers.add(cb);
    return () => subscribers.delete(cb);
  },

  getAccessToken() {
    return accessToken;
  },

  getUser() {
    return currentUser;
  },

  setSession({ accessToken: token, user }) {
    accessToken = token || null;
    currentUser = user || null;

    if (accessToken) {
      localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    } else {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
    }

    if (currentUser) {
      localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(USER_KEY);
    }

    notify();
  },

  clearSession() {
    accessToken = null;
    currentUser = null;
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    notify();
  },
};

let refreshPromise = null;

async function tryRefresh() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const r = await fetch(`${API}/auth/refresh`, {
          method: "POST",
          credentials: "include",
        });

        if (!r.ok) return false;

        const data = await r.json();
        accessToken = data.accessToken || null;

        if (accessToken) {
          localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
        } else {
          localStorage.removeItem(ACCESS_TOKEN_KEY);
        }

        notify();
        return true;
      } catch {
        return false;
      } finally {
        setTimeout(() => {
          refreshPromise = null;
        }, 0);
      }
    })();
  }

  return refreshPromise;
}

export async function apiFetch(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  let res = await fetch(`${API}${path}`, {
    credentials: "include",
    ...options,
    headers,
  });

  if (res.status === 401) {
    const refreshed = await tryRefresh();

    if (refreshed && accessToken) {
      const retryHeaders = {
        ...headers,
        Authorization: `Bearer ${accessToken}`,
      };

      res = await fetch(`${API}${path}`, {
        credentials: "include",
        ...options,
        headers: retryHeaders,
      });
    } else {
      authStore.clearSession();
    }
  }

  return res;
}

export async function login(email, mot_de_passe) {
  const r = await fetch(`${API}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, mot_de_passe }),
  });

  const data = await r.json();

  if (!r.ok) {
    throw new Error(data.message || "Échec de la connexion");
  }

  if (data.mfaRequired) {
    return { mfaRequired: true, ...data };
  }

  authStore.setSession({
    accessToken: data.accessToken,
    user: data.user,
  });

  return { mfaRequired: false, user: data.user };
}
export async function verifyMfa({ challengeId, type, code }) {
  const r = await fetch(`${API}/auth/mfa/verify`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ challengeId, type, code }),
  });

  const data = await r.json();

  if (!r.ok) {
    throw new Error(data.message || "Code invalide");
  }

  authStore.setSession({
    accessToken: data.accessToken,
    user: data.user,
  });

  return data.user;
}

export async function resendMfaEmail(challengeId) {
  const r = await fetch(`${API}/auth/mfa/resend`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ challengeId }),
  });

  const data = await r.json();

  if (!r.ok) {
    throw new Error(data.message || "Impossible de renvoyer le code");
  }

  return data;
}

export async function logout() {
  try {
    await fetch(`${API}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch {}

  authStore.clearSession();
}

export async function bootstrapSession() {
  if (!accessToken) {
    const refreshed = await tryRefresh();
    if (!refreshed) return null;
  }

  try {
    const r = await apiFetch("/auth/me");
    if (!r.ok) return null;

    const data = await r.json();
    currentUser = data.user || null;

    if (currentUser) {
      localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(USER_KEY);
    }

    notify();
    return data.user;
  } catch {
    return null;
  }
}
