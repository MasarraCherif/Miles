import { apiFetch } from "./auth.js";

const API_BASE_URL = "http://localhost:5000/api";

const parse = async (res) => {
  if (res.status === 204) return null;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res.text();
};

const handle = async (res) => {
  const body = await parse(res);
  if (!res.ok) {
    const msg =
      (body && typeof body === "object" && body.message) ||
      (typeof body === "string" && body) ||
      `Erreur ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
};

const apiClient = {
  /* generic verbs --------------------------------------------- */
  async get(path) {
    return handle(await apiFetch(path));
  },

  async post(path, payload) {
    return handle(
      await apiFetch(path, {
        method: "POST",
        body: JSON.stringify(payload || {}),
      })
    );
  },

  async put(path, payload) {
    return handle(
      await apiFetch(path, {
        method: "PUT",
        body: JSON.stringify(payload || {}),
      })
    );
  },

  async del(path) {
    return handle(await apiFetch(path, { method: "DELETE" }));
  },

  /* dashboard ------------------------------------------------- */
  getOverview: () => apiClient.get("/dashboard/overview"),
  getTrend: (range = "6M") => apiClient.get(`/dashboard/trend?range=${range}`),
  getDistribution: () => apiClient.get("/dashboard/distribution"),
  getTopRisk: (limit = 5) => apiClient.get(`/dashboard/top-risk?limit=${limit}`),
  getActivity: (limit = 10) => apiClient.get(`/dashboard/activity?limit=${limit}`),

  /* legacy public endpoints (kept for compatibility) --------- */
  async getDashboard() {
    const response = await fetch(`${API_BASE_URL}/dashboard`);
    if (!response.ok) throw new Error("Erreur dashboard");
    return response.json();
  },

  async getAlertes() {
    const response = await fetch(`${API_BASE_URL}/alertes`);
    if (!response.ok) throw new Error("Erreur alertes");
    return response.json();
  },
sendClientReminder: (data) => apiClient.post("/mail/send-client-reminder", data),

  /* clients --------------------------------------------------- */
  listClients(params = {}) {
    const q = new URLSearchParams(params).toString();
    return apiClient.get(`/clients${q ? `?${q}` : ""}`);
  },

  getClient: (id) => apiClient.get(`/clients/${encodeURIComponent(id)}`),
  createClient: (data) => apiClient.post("/clients", data),
  updateClient: (id, data) => apiClient.put(`/clients/${encodeURIComponent(id)}`, data),
  deleteClient: (id) => apiClient.del(`/clients/${encodeURIComponent(id)}`),

  /* users ----------------------------------------------------- */
  listUsers: () => apiClient.get("/users"),
  getUser: (id) => apiClient.get(`/users/${id}`),
  createUser: (data) => apiClient.post("/users", data),
  updateUser: (id, data) => apiClient.put(`/users/${id}`, data),
  deleteUser: (id) => apiClient.del(`/users/${id}`),

  /* notifications -------------------------------------------- */
  listNotifications(params = {}) {
    const q = new URLSearchParams(params).toString();
    return apiClient.get(`/notifications${q ? `?${q}` : ""}`);
  },

  getRiskClientsByMonth: (month) =>
  apiClient.get(`/dashboard/risk-clients-by-month?month=${encodeURIComponent(month)}`),


  getUnreadCount: () => apiClient.get("/notifications/unread-count"),
  markRead: (id) => apiClient.post(`/notifications/${id}/read`),
  markAllRead: () => apiClient.post(`/notifications/read-all`),
  deleteNotification: (id) => apiClient.del(`/notifications/${id}`),

  sendClientReminder: (data) => apiClient.post("/mail/send-client-reminder", data),

  /* impayés (kept compatible with existing Impayes.jsx) ----- */
  async getImpayes(limit = 50, offset = 0) {
    return apiClient.get(`/impayes?limit=${limit}&offset=${offset}`);
  },  createImpaye: (data) => apiClient.post("/impayes", data),
};

export default apiClient;
