/* ============================================================
   api.js — работа с бэкендом
   Здесь собраны все запросы к серверу (Flask API) и хранение токена.
   ============================================================ */

// Адрес бэкенда. Если сервер запущен на другом порту — поменяйте здесь.
const API_BASE = "http://127.0.0.1:5000";

// Ключи, под которыми храним данные в localStorage браузера.
const TOKEN_KEY = "hc_token";
const USER_KEY = "hc_user";

/* Хранилище сессии: токен и данные пользователя. */
const Auth = {
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },
  getUser() {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  setSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
  isLoggedIn() {
    return Boolean(this.getToken());
  },
};

/* Превращает объект в строку запроса: {city:"Москва"} -> "?city=Москва" */
function toQuery(params) {
  if (!params) return "";
  const parts = [];
  Object.entries(params).forEach(([key, value]) => {
    if (value !== "" && value !== null && value !== undefined) {
      parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(value));
    }
  });
  return parts.length ? "?" + parts.join("&") : "";
}

/* Базовый запрос к API: добавляет заголовки, токен и разбирает ответ. */
async function apiFetch(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const token = Auth.getToken();
  if (token) headers["Authorization"] = "Bearer " + token;

  let response;
  try {
    response = await fetch(API_BASE + path, { ...options, headers });
  } catch (networkError) {
    throw new Error("Не удалось связаться с сервером. Запущен ли бэкенд?");
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = { message: text };
    }
  }

  if (!response.ok) {
    const error = new Error((data && data.message) || "Ошибка " + response.status);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

/* Все эндпоинты бэкенда, сгруппированные по разделам. */
const Api = {
  // --- Авторизация ---
  register: (payload) =>
    apiFetch("/api/register", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload) =>
    apiFetch("/api/login", { method: "POST", body: JSON.stringify(payload) }),

  // --- Квартиры ---
  listApartments: (filters) => apiFetch("/api/apartments" + toQuery(filters)),
  myApartments: () => apiFetch("/api/apartments/my"),
  getApartment: (id) => apiFetch("/api/apartments/" + id),
  createApartment: (payload) =>
    apiFetch("/api/apartments", { method: "POST", body: JSON.stringify(payload) }),
  updateApartment: (id, payload) =>
    apiFetch("/api/apartments/" + id, { method: "PUT", body: JSON.stringify(payload) }),
  deleteApartment: (id) => apiFetch("/api/apartments/" + id, { method: "DELETE" }),

  // --- Подбор совпадений ---
  matchesAll: () => apiFetch("/api/matches"),
  matchesFor: (apartmentId) => apiFetch("/api/matches" + toQuery({ apartment_id: apartmentId })),

  // --- Заявки на обмен ---
  createRequest: (payload) =>
    apiFetch("/api/requests", { method: "POST", body: JSON.stringify(payload) }),
  incomingRequests: () => apiFetch("/api/requests"),
  sentRequests: () => apiFetch("/api/requests/sent"),
  getRequest: (id) => apiFetch("/api/requests/" + id),
  updateRequestStatus: (id, status) =>
    apiFetch("/api/requests/" + id + "/status", {
      method: "PUT",
      body: JSON.stringify({ status }),
    }),
  deleteRequest: (id) => apiFetch("/api/requests/" + id, { method: "DELETE" }),

  // --- Сообщения ---
  sendMessage: (payload) =>
    apiFetch("/api/messages", { method: "POST", body: JSON.stringify(payload) }),
  inbox: () => apiFetch("/api/messages/inbox"),
  conversation: (userId) => apiFetch("/api/messages/conversation/" + userId),
  markRead: (messageId) => apiFetch("/api/messages/" + messageId + "/read", { method: "PUT" }),
};
