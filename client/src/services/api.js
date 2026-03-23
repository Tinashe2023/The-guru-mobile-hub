const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : "/api";

const getHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const handleResponse = async (res) => {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
};

// ─── Auth ───
export const authAPI = {
  register: (data) =>
    fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data),
      credentials: "include",
    }).then(handleResponse),
  login: (data) =>
    fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data),
      credentials: "include",
    }).then(handleResponse),
  getMe: () =>
    fetch(`${API_BASE}/auth/me`, {
      headers: getHeaders(),
      credentials: "include",
    }).then(handleResponse),
  logout: () =>
    fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      headers: getHeaders(),
      credentials: "include",
    }).then(handleResponse),
  googleLogin: () => {
    window.location.href = `${API_BASE}/auth/google`;
  },
};

// ─── Users ───
export const userAPI = {
  getProfile: () =>
    fetch(`${API_BASE}/users/profile`, {
      headers: getHeaders(),
      credentials: "include",
    }).then(handleResponse),
  updateProfile: (data) =>
    fetch(`${API_BASE}/users/profile`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(data),
      credentials: "include",
    }).then(handleResponse),
  uploadAvatar: (formData) =>
    fetch(`${API_BASE}/users/avatar`, {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      body: formData,
      credentials: "include",
    }).then(handleResponse),
  getAdmins: () =>
    fetch(`${API_BASE}/users/admins`, {
      headers: getHeaders(),
      credentials: "include",
    }).then(handleResponse),
  listUsers: () =>
    fetch(`${API_BASE}/users`, {
      headers: getHeaders(),
      credentials: "include",
    }).then(handleResponse),
  updateRole: (id, role) =>
    fetch(`${API_BASE}/users/${id}/role`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify({ role }),
      credentials: "include",
    }).then(handleResponse),
};

// ─── Shop ───
export const shopAPI = {
  getStatus: () =>
    fetch(`${API_BASE}/shop/status`, {
      headers: getHeaders(),
      credentials: "include",
    }).then(handleResponse),
  updateStatus: (data) =>
    fetch(`${API_BASE}/shop/status`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(data),
      credentials: "include",
    }).then(handleResponse),
};

// ─── Announcements ───
export const announcementAPI = {
  getAll: (limit = 20, offset = 0) =>
    fetch(`${API_BASE}/announcements?limit=${limit}&offset=${offset}`, {
      headers: getHeaders(),
      credentials: "include",
    }).then(handleResponse),
  create: (data) =>
    fetch(`${API_BASE}/announcements`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data),
      credentials: "include",
    }).then(handleResponse),
  update: (id, data) =>
    fetch(`${API_BASE}/announcements/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(data),
      credentials: "include",
    }).then(handleResponse),
  delete: (id) =>
    fetch(`${API_BASE}/announcements/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
      credentials: "include",
    }).then(handleResponse),
};

// ─── Chat ───
export const chatAPI = {
  getConversations: () =>
    fetch(`${API_BASE}/chat/conversations`, {
      headers: getHeaders(),
      credentials: "include",
    }).then(handleResponse),
  createConversation: (data) =>
    fetch(`${API_BASE}/chat/conversations`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data),
      credentials: "include",
    }).then(handleResponse),
  getMessages: (convId, limit = 50) =>
    fetch(`${API_BASE}/chat/conversations/${convId}/messages?limit=${limit}`, {
      headers: getHeaders(),
      credentials: "include",
    }).then(handleResponse),
  sendMessage: (convId, data) =>
    fetch(`${API_BASE}/chat/conversations/${convId}/messages`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data),
      credentials: "include",
    }).then(handleResponse),
  sendFile: (convId, formData) =>
    fetch(`${API_BASE}/chat/conversations/${convId}/messages/file`, {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      body: formData,
      credentials: "include",
    }).then(handleResponse),
  editMessage: (messageId, content) =>
    fetch(`${API_BASE}/chat/messages/${messageId}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify({ content }),
      credentials: "include",
    }).then(handleResponse),
  deleteMessage: (messageId) =>
    fetch(`${API_BASE}/chat/messages/${messageId}`, {
      method: "DELETE",
      headers: getHeaders(),
      credentials: "include",
    }).then(handleResponse),
  addReaction: (messageId, emoji) =>
    fetch(`${API_BASE}/chat/messages/${messageId}/reactions`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ emoji }),
      credentials: "include",
    }).then(handleResponse),
  removeReaction: (messageId, emoji) =>
    fetch(
      `${API_BASE}/chat/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
      { method: "DELETE", headers: getHeaders(), credentials: "include" },
    ).then(handleResponse),
  markAsRead: (convId) =>
    fetch(`${API_BASE}/chat/conversations/${convId}/read`, {
      method: "POST",
      headers: getHeaders(),
      credentials: "include",
    }).then(handleResponse),
};

// ─── Tickets ───
export const ticketAPI = {
  getAll: () =>
    fetch(`${API_BASE}/tickets`, {
      headers: getHeaders(),
      credentials: "include",
    }).then(handleResponse),
  getOne: (id) =>
    fetch(`${API_BASE}/tickets/${id}`, {
      headers: getHeaders(),
      credentials: "include",
    }).then(handleResponse),
  create: (data) =>
    fetch(`${API_BASE}/tickets`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data),
      credentials: "include",
    }).then(handleResponse),
  updateStatus: (id, data) =>
    fetch(`${API_BASE}/tickets/${id}/status`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(data),
      credentials: "include",
    }).then(handleResponse),
};

// ─── Documents ───
export const documentAPI = {
  getAll: () =>
    fetch(`${API_BASE}/documents`, {
      headers: getHeaders(),
      credentials: "include",
    }).then(handleResponse),
  upload: (formData, type = "personal") =>
    fetch(`${API_BASE}/documents?type=${type}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      body: formData,
      credentials: "include",
    }).then(handleResponse),
  share: (id, shared, admin_id) =>
    fetch(`${API_BASE}/documents/${id}/share`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify({ shared, admin_id }),
      credentials: "include",
    }).then(handleResponse),
  delete: (id) =>
    fetch(`${API_BASE}/documents/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
      credentials: "include",
    }).then(handleResponse),
  getShared: () =>
    fetch(`${API_BASE}/documents/shared`, {
      headers: getHeaders(),
      credentials: "include",
    }).then(handleResponse),
};

// ─── Services ───
export const serviceAPI = {
  getAll: () => fetch(`${API_BASE}/services`).then(handleResponse),
  update: (id, data) =>
    fetch(`${API_BASE}/services/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(data),
      credentials: "include",
    }).then(handleResponse),
};

// ─── Products ───
export const productAPI = {
  getAll: (category) =>
    fetch(
      `${API_BASE}/products${category ? `?category=${category}` : ""}`,
    ).then(handleResponse),
  create: (data) =>
    fetch(`${API_BASE}/products`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data),
      credentials: "include",
    }).then(handleResponse),
  update: (id, data) =>
    fetch(`${API_BASE}/products/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(data),
      credentials: "include",
    }).then(handleResponse),
  delete: (id) =>
    fetch(`${API_BASE}/products/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
      credentials: "include",
    }).then(handleResponse),
};

// ─── WebAuthn ───
export const webauthnAPI = {
  getRegisterOptions: () =>
    fetch(`${API_BASE}/webauthn/register/generate-options`, {
      headers: getHeaders(),
      credentials: "include",
    }).then(handleResponse),
  verifyRegister: (data) =>
    fetch(`${API_BASE}/webauthn/register/verify`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data),
      credentials: "include",
    }).then(handleResponse),
  getLoginOptions: () =>
    fetch(`${API_BASE}/webauthn/login/generate-options`, {
      headers: getHeaders(),
      credentials: "include",
    }).then(handleResponse),
  verifyLogin: (data) =>
    fetch(`${API_BASE}/webauthn/login/verify`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data),
      credentials: "include",
    }).then(handleResponse),
};
