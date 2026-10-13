/* ============================================================
   app.js — вся логика интерфейса сайта
   Здесь описаны все экраны: вход, объявления, "мои квартиры",
   подбор, заявки и сообщения. Никаких сторонних библиотек.
   ============================================================ */

const appEl = document.getElementById("app");
const navEl = document.getElementById("nav");
const headerUserEl = document.getElementById("headerUser");
const modalRoot = document.getElementById("modalRoot");
const toastEl = document.getElementById("toast");
const logoEl = document.getElementById("logo");

// Экраны, доступные только после входа.
const AUTH_VIEWS = ["my", "matches", "requests", "messages"];

// Состояние приложения.
const state = {
  view: "listings",
  chatWith: null,
  chatName: "",
  apartmentsById: {},
};

/* ------------------------- Мелкие утилиты ------------------------- */

function $(selector, root = document) {
  return root.querySelector(selector);
}

function $$(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

// Экранирует текст, чтобы его нельзя было использовать как HTML.
function esc(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function money(value) {
  const number = Number(value) || 0;
  return number.toLocaleString("ru-RU") + " \u20BD";
}

function dateText(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (isNaN(date)) return "";
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function roleText(role) {
  return role === "landlord" ? "Арендодатель" : "Арендатор";
}

function initials(text) {
  return (text || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();
}

function roomsText(rooms) {
  const n = Number(rooms) || 0;
  if (n === 0) return "Студия";
  if (n === 1) return "1-комнатная";
  return n + "-комнатная";
}

function statusBadge(status) {
  const labels = {
    pending: "Ожидает",
    accepted: "Принята",
    rejected: "Отклонена",
    active: "Активна",
    closed: "Снята",
  };
  return '<span class="badge badge--' + esc(status) + '">' + esc(labels[status] || status) + "</span>";
}

/* ------------------------- Уведомления и модальные окна ------------------------- */

let toastTimer = null;

function toast(message, type) {
  toastEl.textContent = message;
  toastEl.className = "toast is-visible" + (type === "error" ? " toast--error" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.className = "toast";
  }, 3200);
}

function openModal(options) {
  const foot = options.footHtml ? '<div class="modal__foot">' + options.footHtml + "</div>" : "";
  modalRoot.innerHTML =
    '<div class="modal-backdrop" id="modalBackdrop">' +
      '<div class="modal" role="dialog" aria-modal="true">' +
        '<div class="modal__head">' +
          '<h3 class="modal__title">' + esc(options.title) + "</h3>" +
          '<button class="modal__close" id="modalClose" type="button" aria-label="Закрыть">&times;</button>' +
        "</div>" +
        '<div class="modal__body">' + options.bodyHtml + "</div>" +
        foot +
      "</div>" +
    "</div>";

  $("#modalClose").addEventListener("click", closeModal);
  $("#modalBackdrop").addEventListener("click", (event) => {
    if (event.target.id === "modalBackdrop") closeModal();
  });
}

function closeModal() {
  modalRoot.innerHTML = "";
}

// Если сервер вернул 401 — сбрасываем сессию и ведём на вход.
function handleAuthError(error) {
  if (error && error.status === 401) {
    Auth.clear();
    toast("Сессия истекла, войдите заново", "error");
    navigate("auth");
    return true;
  }
  return false;
}

function requireLogin() {
  if (!Auth.isLoggedIn()) {
    toast("Сначала войдите в аккаунт", "error");
    navigate("auth");
    return false;
  }
  return true;
}

/* ------------------------- Навигация и шапка ------------------------- */

function renderHeader() {
  const user = Auth.getUser();

  if (user) {
    headerUserEl.innerHTML =
      '<span class="header__name">' + esc(user.name) +
      ' <span class="badge">' + esc(roleText(user.role)) + "</span></span>" +
      '<button class="btn btn--ghost btn--sm" id="logoutBtn" type="button">Выйти</button>';
    $("#logoutBtn").addEventListener("click", () => {
      Auth.clear();
      toast("Вы вышли из аккаунта");
      navigate("listings");
    });
  } else {
    headerUserEl.innerHTML = '<button class="btn btn--primary btn--sm" id="loginBtn" type="button">Войти</button>';
    $("#loginBtn").addEventListener("click", () => navigate("auth"));
  }

  $$(".nav__link", navEl).forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === state.view);
  });
}

function renderAll() {
  renderHeader();
  const renderers = {
    auth: renderAuth,
    listings: renderListings,
    my: renderMy,
    matches: renderMatches,
    requests: renderRequests,
    messages: renderMessages,
  };
  const render = renderers[state.view] || renderListings;
  render();
}

function navigate(view) {
  if (AUTH_VIEWS.includes(view) && !Auth.isLoggedIn()) {
    toast("Сначала войдите в аккаунт", "error");
    view = "auth";
  }
  if (view !== "messages") {
    state.chatWith = null;
    state.chatName = "";
  }
  state.view = view;
  renderAll();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openChat(userId, name) {
  state.view = "messages";
  state.chatWith = userId;
  state.chatName = name || "";
  renderAll();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ------------------------- Экран: вход / регистрация ------------------------- */

function renderAuth() {
  appEl.innerHTML =
    '<div class="auth-wrap">' +
      '<div class="auth-card">' +
        '<div class="tabs">' +
          '<button class="tab is-active" data-tab="login" type="button">Вход</button>' +
          '<button class="tab" data-tab="register" type="button">Регистрация</button>' +
        "</div>" +
        '<form id="authForm">' +
          '<div class="field hidden" id="nameField">' +
            '<label class="field__label" for="authName">Имя</label>' +
            '<input class="input" id="authName" type="text" placeholder="Как вас зовут">' +
          "</div>" +
          '<div class="field">' +
            '<label class="field__label" for="authEmail">Email</label>' +
            '<input class="input" id="authEmail" type="email" placeholder="you@example.com" required>' +
          "</div>" +
          '<div class="field">' +
            '<label class="field__label" for="authPassword">Пароль</label>' +
            '<input class="input" id="authPassword" type="password" placeholder="Ваш пароль" required>' +
          "</div>" +
          '<div class="field hidden" id="roleField">' +
            '<label class="field__label" for="authRole">Я —</label>' +
            '<select class="select" id="authRole">' +
              '<option value="landlord">Арендодатель</option>' +
              '<option value="tenant">Арендатор</option>' +
            "</select>" +
          "</div>" +
          '<button class="btn btn--primary btn--block" id="authSubmit" type="submit">Войти</button>' +
        "</form>" +
        '<p class="auth-switch">Нет аккаунта? <button type="button" id="toRegister">Зарегистрируйтесь</button></p>' +
      "</div>" +
    "</div>";

  let mode = "login";
  const setMode = (next) => {
    mode = next;
    $("#nameField").classList.toggle("hidden", next !== "register");
    $("#roleField").classList.toggle("hidden", next !== "register");
    $("#authSubmit").textContent = next === "register" ? "Зарегистрироваться" : "Войти";
    $$(".tab", appEl).forEach((tab) => tab.classList.toggle("is-active", tab.dataset.tab === next));
  };

  $$(".tab", appEl).forEach((tab) => tab.addEventListener("click", () => setMode(tab.dataset.tab)));
  $("#toRegister").addEventListener("click", () => setMode("register"));

  $("#authForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = $("#authEmail").value.trim();
    const password = $("#authPassword").value;

    try {
      let data;
      if (mode === "register") {
        const name = $("#authName").value.trim();
        if (!name) {
          toast("Введите имя", "error");
          return;
        }
        data = await Api.register({ name, email, password, role: $("#authRole").value });
      } else {
        data = await Api.login({ email, password });
      }
      Auth.setSession(data.token, data.user);
      toast(mode === "register" ? "Регистрация успешна" : "Добро пожаловать, " + data.user.name);
      navigate("listings");
    } catch (error) {
      toast(error.message, "error");
    }
  });
}

/* ------------------------- Карточка квартиры ------------------------- */

function apartmentCard(apartment, options) {
  const opts = options || {};
  const user = Auth.getUser();
  const isMine = user && user.id === apartment.owner_id;

  const imageHtml = apartment.image
    ? '<div class="card__image" style="background-image:url(\'' + esc(apartment.image) + "')\"></div>"
    : '<div class="card__image">' + esc(initials(apartment.title)) + "</div>";

  let actions = opts.actionsHtml;
  if (!actions) {
    const offer =
      opts.offer === false || isMine
        ? ""
        : '<button class="btn btn--primary btn--sm" data-offer="' + apartment.id + '">Предложить обмен</button>';
    actions =
      '<button class="btn btn--ghost btn--sm" data-detail="' + apartment.id + '">Подробнее</button>' + offer;
  }

  return (
    '<article class="card">' +
      imageHtml +
      '<div class="card__body">' +
        (opts.badgeHtml || "") +
        '<h3 class="card__title">' + esc(apartment.title) + "</h3>" +
        '<div class="card__meta">' + esc(apartment.city) +
          (apartment.district ? ", " + esc(apartment.district) : "") + "</div>" +
        '<div class="card__meta">' + roomsText(apartment.rooms) + " · " + esc(apartment.area) +
          " м² · " + esc(apartment.floor) + "/" + esc(apartment.floors) + " эт.</div>" +
        '<div class="card__price">' + money(apartment.price) + "</div>" +
        (apartment.description ? '<p class="card__desc">' + esc(apartment.description) + "</p>" : "") +
      "</div>" +
      '<div class="card__actions">' + actions + "</div>" +
    "</article>"
  );
}

function renderApartmentGrid(box, apartments, emptyText) {
  if (!apartments.length) {
    box.innerHTML = '<div class="empty">' + esc(emptyText) + "</div>";
    return;
  }
  apartments.forEach((apartment) => {
    state.apartmentsById[apartment.id] = apartment;
  });
  box.innerHTML = '<div class="grid">' + apartments.map((a) => apartmentCard(a)).join("") + "</div>";
}

/* ------------------------- Экран: объявления ------------------------- */

async function renderListings() {
  appEl.innerHTML =
    '<h1 class="page-title">Объявления об обмене</h1>' +
    '<p class="page-subtitle">Найдите квартиру для обмена</p>' +
    '<form class="filters" id="filtersForm">' +
      '<div class="field"><label class="field__label" for="filterCity">Город</label>' +
        '<input class="input" id="filterCity" placeholder="Москва"></div>' +
      '<div class="field"><label class="field__label" for="filterRooms">Комнат</label>' +
        '<input class="input" id="filterRooms" type="number" min="0" placeholder="2"></div>' +
      '<div class="field"><label class="field__label" for="filterMin">Цена от</label>' +
        '<input class="input" id="filterMin" type="number" min="0" placeholder="1000000"></div>' +
      '<div class="field"><label class="field__label" for="filterMax">Цена до</label>' +
        '<input class="input" id="filterMax" type="number" min="0" placeholder="10000000"></div>' +
      '<button class="btn btn--primary" type="submit">Найти</button>' +
    "</form>" +
    '<div id="listingsBox"><div class="empty">Загрузка...</div></div>';

  const load = async (filters) => {
    const box = $("#listingsBox");
    box.innerHTML = '<div class="empty">Загрузка...</div>';
    try {
      const apartments = await Api.listApartments(filters || {});
      renderApartmentGrid(box, apartments, "Пока нет объявлений");
    } catch (error) {
      box.innerHTML = '<div class="empty">Ошибка: ' + esc(error.message) + "</div>";
    }
  };

  $("#filtersForm").addEventListener("submit", (event) => {
    event.preventDefault();
    load({
      city: $("#filterCity").value.trim(),
      rooms: $("#filterRooms").value.trim(),
      min_price: $("#filterMin").value.trim(),
      max_price: $("#filterMax").value.trim(),
    });
  });

  load();
}

/* ------------------------- Экран: мои квартиры ------------------------- */

async function renderMy() {
  appEl.innerHTML =
    '<div class="section-head">' +
      "<div>" +
        '<h1 class="page-title">Мои квартиры</h1>' +
        '<p class="page-subtitle">Управляйте своими объявлениями</p>' +
      "</div>" +
      '<button class="btn btn--primary" id="addApartment" type="button">Добавить квартиру</button>' +
    "</div>" +
    '<div id="myBox"><div class="empty">Загрузка...</div></div>';

  $("#addApartment").addEventListener("click", () => apartmentFormModal());

  const box = $("#myBox");
  try {
    const apartments = await Api.myApartments();
    if (!apartments.length) {
      box.innerHTML = '<div class="empty">У вас пока нет квартир. Добавьте первую!</div>';
      return;
    }
    apartments.forEach((apartment) => {
      state.apartmentsById[apartment.id] = apartment;
    });
    box.innerHTML =
      '<div class="grid">' +
      apartments
        .map((apartment) =>
          apartmentCard(apartment, {
            offer: false,
            badgeHtml: '<div>' + statusBadge(apartment.status) + "</div>",
            actionsHtml:
              '<button class="btn btn--ghost btn--sm" data-detail="' + apartment.id + '">Подробнее</button>' +
              '<button class="btn btn--ghost btn--sm" data-edit="' + apartment.id + '">Изменить</button>' +
              '<button class="btn btn--danger btn--sm" data-delete="' + apartment.id + '">Удалить</button>',
          })
        )
        .join("") +
      "</div>";
  } catch (error) {
    if (!handleAuthError(error)) {
      box.innerHTML = '<div class="empty">Ошибка: ' + esc(error.message) + "</div>";
    }
  }
}

/* ------------------------- Экран: подбор ------------------------- */

async function renderMatches() {
  appEl.innerHTML =
    '<h1 class="page-title">Подбор совпадений</h1>' +
    '<p class="page-subtitle">Автоматически подобранные варианты для обмена</p>' +
    '<div id="matchBox"><div class="empty">Загрузка...</div></div>';

  const box = $("#matchBox");
  try {
    const groups = await Api.matchesAll();
    if (!groups.length) {
      box.innerHTML = '<div class="empty">Сначала добавьте квартиру в разделе «Мои квартиры».</div>';
      return;
    }

    let html = "";
    groups.forEach((group) => {
      html +=
        '<section style="margin-bottom:28px">' +
        '<h2 class="page-title" style="font-size:20px">' + esc(group.apartment_title) + "</h2>";

      if (!group.matches.length) {
        html += '<div class="empty">Пока нет подходящих вариантов.</div>';
      } else {
        group.matches.forEach((match) => {
          state.apartmentsById[match.apartment.id] = match.apartment;
        });
        html +=
          '<div class="grid">' +
          group.matches
            .map((match) =>
              apartmentCard(match.apartment, {
                badgeHtml:
                  '<div><span class="badge badge--score">Совпадение ' + esc(match.score) + "%</span></div>",
              })
            )
            .join("") +
          "</div>";
      }
      html += "</section>";
    });
    box.innerHTML = html;
  } catch (error) {
    if (!handleAuthError(error)) {
      box.innerHTML = '<div class="empty">' + esc(error.message) + "</div>";
    }
  }
}

/* ------------------------- Экран: заявки ------------------------- */

function requestRow(request, tab) {
  const myApartment = request.apartment ? request.apartment.title : "—";
  const targetApartment = request.target_apartment ? request.target_apartment.title : "—";

  const title =
    tab === "incoming"
      ? esc(request.sender_name || "Пользователь") + " хочет обменять «" + esc(myApartment) +
        "» на «" + esc(targetApartment) + "»"
      : "Вы предлагаете «" + esc(myApartment) + "» за «" + esc(targetApartment) + "»";

  const actions = [];
  if (tab === "incoming" && request.status === "pending") {
    actions.push('<button class="btn btn--success btn--sm" data-accept="' + request.id + '">Принять</button>');
    actions.push('<button class="btn btn--danger btn--sm" data-reject="' + request.id + '">Отклонить</button>');
  }
  if (tab === "incoming") {
    actions.push(
      '<button class="btn btn--ghost btn--sm" data-msg="' + request.sender_id +
        '" data-msgname="' + esc(request.sender_name || "") + '">Написать</button>'
    );
  }
  if (tab === "sent" && request.status === "pending") {
    actions.push('<button class="btn btn--ghost btn--sm" data-cancel="' + request.id + '">Отменить</button>');
  }

  return (
    '<div class="row">' +
      '<div class="row__main">' +
        '<div class="row__title">' + statusBadge(request.status) + "</div>" +
        '<p class="row__text">' + title + "</p>" +
        (request.message ? '<p class="row__text">«' + esc(request.message) + "»</p>" : "") +
        '<p class="row__text">' + dateText(request.created_at) + "</p>" +
      "</div>" +
      '<div class="row__actions">' + actions.join("") + "</div>" +
    "</div>"
  );
}

async function renderRequests() {
  appEl.innerHTML =
    '<h1 class="page-title">Заявки на обмен</h1>' +
    '<p class="page-subtitle">Входящие и отправленные предложения</p>' +
    '<div class="tabs">' +
      '<button class="tab is-active" data-tab="incoming" type="button">Входящие</button>' +
      '<button class="tab" data-tab="sent" type="button">Отправленные</button>' +
    "</div>" +
    '<div id="requestsBox"><div class="empty">Загрузка...</div></div>';

  let tab = "incoming";

  const load = async () => {
    const box = $("#requestsBox");
    box.innerHTML = '<div class="empty">Загрузка...</div>';
    try {
      const requests = tab === "incoming" ? await Api.incomingRequests() : await Api.sentRequests();
      if (!requests.length) {
        box.innerHTML =
          '<div class="empty">' +
          (tab === "incoming" ? "Входящих заявок нет" : "Вы ещё не отправляли заявок") +
          "</div>";
        return;
      }
      box.innerHTML = '<div class="list">' + requests.map((r) => requestRow(r, tab)).join("") + "</div>";
    } catch (error) {
      if (!handleAuthError(error)) {
        box.innerHTML = '<div class="empty">Ошибка: ' + esc(error.message) + "</div>";
      }
    }
  };

  $$(".tab", appEl).forEach((button) =>
    button.addEventListener("click", () => {
      tab = button.dataset.tab;
      $$(".tab", appEl).forEach((b) => b.classList.toggle("is-active", b.dataset.tab === tab));
      load();
    })
  );

  load();
}

/* ------------------------- Экран: сообщения ------------------------- */

async function renderMessages() {
  if (state.chatWith) {
    renderChat();
    return;
  }

  appEl.innerHTML =
    '<h1 class="page-title">Сообщения</h1>' +
    '<p class="page-subtitle">Ваши диалоги с другими пользователями</p>' +
    '<div class="row">' +
      '<div class="row__main">' +
        '<div class="row__title">Начать новый диалог</div>' +
        '<p class="row__text">Введите ID пользователя, которому хотите написать.</p>' +
      "</div>" +
      '<div class="row__actions">' +
        '<input class="input" id="newChatId" type="number" placeholder="ID" style="width:110px">' +
        '<button class="btn btn--primary btn--sm" id="newChatBtn" type="button">Открыть</button>' +
      "</div>" +
    "</div>" +
    '<div id="conversationsBox" style="margin-top:20px"><div class="empty">Загрузка...</div></div>';

  $("#newChatBtn").addEventListener("click", () => {
    const userId = Number($("#newChatId").value);
    if (!userId) {
      toast("Введите корректный ID", "error");
      return;
    }
    openChat(userId, "");
  });

  const box = $("#conversationsBox");
  try {
    const inbox = await Api.inbox();
    const byUser = {};
    inbox.forEach((message) => {
      if (!byUser[message.sender_id]) {
        byUser[message.sender_id] = { name: message.sender_name, last: message, unread: 0 };
      }
      if (!message.is_read) byUser[message.sender_id].unread += 1;
    });

    const contacts = Object.entries(byUser);
    if (!contacts.length) {
      box.innerHTML =
        '<div class="empty">Сообщений пока нет. Начните диалог из объявления или введите ID выше.</div>';
      return;
    }

    box.innerHTML =
      '<div class="list">' +
      contacts
        .map(([id, contact]) =>
          '<div class="row row--clickable" data-chat="' + id +
            '" data-chatname="' + esc(contact.name || "") + '">' +
            '<div class="row__main">' +
              '<div class="row__title">' + esc(contact.name || "Пользователь") +
                (contact.unread
                  ? ' <span class="badge badge--pending">' + contact.unread + "</span>"
                  : "") +
              "</div>" +
              '<p class="row__text">' + esc(contact.last.text) + "</p>" +
            "</div>" +
            '<div class="row__actions"><span class="row__text">' +
              dateText(contact.last.created_at) + "</span></div>" +
          "</div>"
        )
        .join("") +
      "</div>";
  } catch (error) {
    if (!handleAuthError(error)) {
      box.innerHTML = '<div class="empty">Ошибка: ' + esc(error.message) + "</div>";
    }
  }
}

async function renderChat() {
  const me = Auth.getUser();

  appEl.innerHTML =
    '<div class="section-head">' +
      "<div>" +
        '<h1 class="page-title">Диалог с ' +
          esc(state.chatName || "пользователем #" + state.chatWith) + "</h1>" +
        '<p class="page-subtitle">ID пользователя: ' + esc(state.chatWith) + "</p>" +
      "</div>" +
      '<button class="btn btn--ghost" id="backToDialogs" type="button">Назад к диалогам</button>' +
    "</div>" +
    '<div class="chat" id="chatBox"><div class="empty">Загрузка...</div></div>' +
    '<div class="filters" style="grid-template-columns:1fr">' +
      '<div class="field" style="margin-bottom:10px">' +
        '<textarea class="textarea" id="chatInput" placeholder="Введите сообщение..."></textarea>' +
      "</div>" +
      '<button class="btn btn--primary" id="chatSend" type="button">Отправить</button>' +
    "</div>";

  $("#backToDialogs").addEventListener("click", () => {
    state.chatWith = null;
    state.chatName = "";
    renderAll();
  });

  const load = async () => {
    const box = $("#chatBox");
    try {
      const messages = await Api.conversation(state.chatWith);
      if (!messages.length) {
        box.innerHTML = '<div class="empty">Сообщений нет. Напишите первым!</div>';
        return;
      }
      box.innerHTML = messages
        .map((message) => {
          const mine = me && message.sender_id === me.id;
          return (
            '<div class="bubble' + (mine ? " bubble--mine" : "") + '">' +
              "<div>" + esc(message.text) + "</div>" +
              '<div class="bubble__meta">' + (mine ? "Вы" : esc(message.sender_name || "")) +
                " · " + dateText(message.created_at) + "</div>" +
            "</div>"
          );
        })
        .join("");
      box.scrollTop = box.scrollHeight;

      messages
        .filter((message) => me && message.receiver_id === me.id && !message.is_read)
        .forEach((message) => {
          Api.markRead(message.id).catch(() => {});
        });
    } catch (error) {
      if (!handleAuthError(error)) {
        box.innerHTML = '<div class="empty">Ошибка: ' + esc(error.message) + "</div>";
      }
    }
  };

  await load();

  const send = async () => {
    const input = $("#chatInput");
    const text = input.value.trim();
    if (!text) return;
    try {
      await Api.sendMessage({ receiver_id: state.chatWith, text });
      input.value = "";
      await load();
    } catch (error) {
      if (!handleAuthError(error)) toast(error.message, "error");
    }
  };

  $("#chatSend").addEventListener("click", send);
  $("#chatInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  });
}

/* ------------------------- Модальные окна с действиями ------------------------- */

function apartmentDetailModal(apartment) {
  const user = Auth.getUser();
  const isMine = user && user.id === apartment.owner_id;

  const bodyHtml =
    '<div class="list">' +
      '<div>' + statusBadge(apartment.status) + "</div>" +
      '<div class="card__price">' + money(apartment.price) + "</div>" +
      '<div class="card__meta">' + esc(apartment.city) +
        (apartment.district ? ", " + esc(apartment.district) : "") +
        (apartment.address ? ", " + esc(apartment.address) : "") + "</div>" +
      '<div class="card__meta">' + roomsText(apartment.rooms) + " · " + esc(apartment.area) +
        " м² · " + esc(apartment.floor) + "/" + esc(apartment.floors) + " этаж</div>" +
      '<div class="card__meta">Владелец: ' + esc(apartment.owner_name || "—") + "</div>" +
      (apartment.description ? "<p>" + esc(apartment.description) + "</p>" : "") +
      '<div class="card__meta">Добавлено: ' + dateText(apartment.created_at) + "</div>" +
    "</div>";

  let footHtml;
  if (!Auth.isLoggedIn()) {
    footHtml =
      '<button class="btn btn--ghost" id="detailClose" type="button">Закрыть</button>' +
      '<button class="btn btn--primary" id="detailLogin" type="button">Войти</button>';
  } else if (isMine) {
    footHtml =
      '<button class="btn btn--ghost" id="detailClose" type="button">Закрыть</button>' +
      '<button class="btn btn--ghost" id="detailEdit" type="button">Изменить</button>';
  } else {
    footHtml =
      '<button class="btn btn--ghost" id="detailMessage" type="button">Написать владельцу</button>' +
      '<button class="btn btn--primary" id="detailOffer" type="button">Предложить обмен</button>';
  }

  openModal({ title: apartment.title, bodyHtml, footHtml });

  const bind = (id, handler) => {
    const element = document.getElementById(id);
    if (element) element.addEventListener("click", handler);
  };

  bind("detailClose", closeModal);
  bind("detailLogin", () => {
    closeModal();
    navigate("auth");
  });
  bind("detailEdit", () => {
    closeModal();
    apartmentFormModal(apartment);
  });
  bind("detailMessage", () => {
    closeModal();
    messageModal(apartment.owner_id, apartment.owner_name);
  });
  bind("detailOffer", () => {
    closeModal();
    requestModal(apartment);
  });
}

function messageModal(receiverId, receiverName) {
  if (!requireLogin()) return;

  openModal({
    title: "Сообщение для " + (receiverName || "пользователя #" + receiverId),
    bodyHtml:
      '<div class="field">' +
        '<label class="field__label" for="messageText">Текст</label>' +
        '<textarea class="textarea" id="messageText" placeholder="Напишите сообщение..."></textarea>' +
      "</div>",
    footHtml:
      '<button class="btn btn--ghost" id="messageCancel" type="button">Отмена</button>' +
      '<button class="btn btn--primary" id="messageSend" type="button">Отправить</button>',
  });

  $("#messageCancel").addEventListener("click", closeModal);
  $("#messageSend").addEventListener("click", async () => {
    const text = $("#messageText").value.trim();
    if (!text) {
      toast("Введите текст", "error");
      return;
    }
    try {
      await Api.sendMessage({ receiver_id: receiverId, text });
      toast("Сообщение отправлено");
      closeModal();
    } catch (error) {
      if (!handleAuthError(error)) toast(error.message, "error");
    }
  });
}

async function requestModal(targetApartment) {
  if (!requireLogin()) return;

  let myApartments;
  try {
    myApartments = await Api.myApartments();
  } catch (error) {
    if (!handleAuthError(error)) toast(error.message, "error");
    return;
  }

  if (!myApartments.length) {
    openModal({
      title: "Нет своих квартир",
      bodyHtml: "<p>Чтобы предложить обмен, сначала добавьте свою квартиру.</p>",
      footHtml:
        '<button class="btn btn--ghost" id="requestClose" type="button">Закрыть</button>' +
        '<button class="btn btn--primary" id="requestAdd" type="button">Добавить квартиру</button>',
    });
    $("#requestClose").addEventListener("click", closeModal);
    $("#requestAdd").addEventListener("click", () => {
      closeModal();
      navigate("my");
      apartmentFormModal();
    });
    return;
  }

  const options = myApartments
    .map((apartment) => '<option value="' + apartment.id + '">' + esc(apartment.title) + " — " + esc(apartment.city) + "</option>")
    .join("");

  openModal({
    title: "Предложить обмен",
    bodyHtml:
      '<p class="card__meta">Вы хотите получить: <strong>' + esc(targetApartment.title) + "</strong></p>" +
      '<div class="field">' +
        '<label class="field__label" for="requestApartment">Какую свою квартиру предложить?</label>' +
        '<select class="select" id="requestApartment">' + options + "</select>" +
      "</div>" +
      '<div class="field">' +
        '<label class="field__label" for="requestMessage">Сообщение (необязательно)</label>' +
        '<textarea class="textarea" id="requestMessage" placeholder="Например: Давайте меняться!"></textarea>' +
      "</div>",
    footHtml:
      '<button class="btn btn--ghost" id="requestCancel" type="button">Отмена</button>' +
      '<button class="btn btn--primary" id="requestSend" type="button">Отправить заявку</button>',
  });

  $("#requestCancel").addEventListener("click", closeModal);
  $("#requestSend").addEventListener("click", async () => {
    try {
      await Api.createRequest({
        apartment_id: Number($("#requestApartment").value),
        target_apartment_id: targetApartment.id,
        message: $("#requestMessage").value.trim(),
      });
      toast("Заявка отправлена");
      closeModal();
    } catch (error) {
      if (!handleAuthError(error)) toast(error.message, "error");
    }
  });
}

function apartmentFormModal(apartment) {
  const a = apartment || {};
  const isEdit = Boolean(apartment);

  const statusField = isEdit
    ? '<div class="field">' +
        '<label class="field__label" for="formStatus">Статус</label>' +
        '<select class="select" id="formStatus">' +
          '<option value="active"' + (a.status === "active" ? " selected" : "") + ">Активна</option>" +
          '<option value="closed"' + (a.status === "closed" ? " selected" : "") + ">Снята</option>" +
        "</select>" +
      "</div>"
    : "";

  openModal({
    title: isEdit ? "Редактировать квартиру" : "Новая квартира",
    bodyHtml:
      '<div class="field">' +
        '<label class="field__label" for="formTitle">Заголовок *</label>' +
        '<input class="input" id="formTitle" value="' + esc(a.title || "") + '" placeholder="2-комнатная в Москве">' +
      "</div>" +
      '<div class="form-grid">' +
        '<div class="field"><label class="field__label" for="formCity">Город *</label>' +
          '<input class="input" id="formCity" value="' + esc(a.city || "") + '" placeholder="Москва"></div>' +
        '<div class="field"><label class="field__label" for="formDistrict">Район</label>' +
          '<input class="input" id="formDistrict" value="' + esc(a.district || "") + '"></div>' +
      "</div>" +
      '<div class="field"><label class="field__label" for="formAddress">Адрес</label>' +
        '<input class="input" id="formAddress" value="' + esc(a.address || "") + '"></div>' +
      '<div class="form-grid">' +
        '<div class="field"><label class="field__label" for="formRooms">Комнат</label>' +
          '<input class="input" id="formRooms" type="number" min="0" value="' + (a.rooms != null ? a.rooms : 1) + '"></div>' +
        '<div class="field"><label class="field__label" for="formArea">Площадь, м²</label>' +
          '<input class="input" id="formArea" type="number" min="0" step="0.1" value="' + (a.area != null ? a.area : 0) + '"></div>' +
        '<div class="field"><label class="field__label" for="formFloor">Этаж</label>' +
          '<input class="input" id="formFloor" type="number" min="1" value="' + (a.floor != null ? a.floor : 1) + '"></div>' +
        '<div class="field"><label class="field__label" for="formFloors">Этажей в доме</label>' +
          '<input class="input" id="formFloors" type="number" min="1" value="' + (a.floors != null ? a.floors : 1) + '"></div>' +
        '<div class="field"><label class="field__label" for="formPrice">Цена, ₽</label>' +
          '<input class="input" id="formPrice" type="number" min="0" step="1000" value="' + (a.price != null ? a.price : 0) + '"></div>' +
        statusField +
      "</div>" +
      '<div class="field"><label class="field__label" for="formImage">Ссылка на фото</label>' +
        '<input class="input" id="formImage" value="' + esc(a.image || "") + '" placeholder="https://..."></div>' +
      '<div class="field"><label class="field__label" for="formDescription">Описание</label>' +
        '<textarea class="textarea" id="formDescription">' + esc(a.description || "") + "</textarea></div>",
    footHtml:
      '<button class="btn btn--ghost" id="formCancel" type="button">Отмена</button>' +
      '<button class="btn btn--primary" id="formSave" type="button">' + (isEdit ? "Сохранить" : "Добавить") + "</button>",
  });

  $("#formCancel").addEventListener("click", closeModal);
  $("#formSave").addEventListener("click", async () => {
    const payload = {
      title: $("#formTitle").value.trim(),
      city: $("#formCity").value.trim(),
      district: $("#formDistrict").value.trim(),
      address: $("#formAddress").value.trim(),
      rooms: Number($("#formRooms").value) || 0,
      area: Number($("#formArea").value) || 0,
      floor: Number($("#formFloor").value) || 1,
      floors: Number($("#formFloors").value) || 1,
      price: Number($("#formPrice").value) || 0,
      image: $("#formImage").value.trim(),
      description: $("#formDescription").value.trim(),
    };

    if (!payload.title || !payload.city) {
      toast("Заполните заголовок и город", "error");
      return;
    }
    if (isEdit) payload.status = $("#formStatus").value;

    try {
      if (isEdit) {
        await Api.updateApartment(a.id, payload);
        toast("Квартира обновлена");
      } else {
        await Api.createApartment(payload);
        toast("Квартира добавлена");
      }
      closeModal();
      renderAll();
    } catch (error) {
      if (!handleAuthError(error)) toast(error.message, "error");
    }
  });
}

function confirmDeleteApartment(id) {
  const apartment = state.apartmentsById[id];
  openModal({
    title: "Удалить квартиру?",
    bodyHtml:
      "<p>Объявление <strong>" + esc(apartment ? apartment.title : "") +
      "</strong> будет удалено вместе со связанными заявками.</p>",
    footHtml:
      '<button class="btn btn--ghost" id="deleteCancel" type="button">Отмена</button>' +
      '<button class="btn btn--danger" id="deleteConfirm" type="button">Удалить</button>',
  });

  $("#deleteCancel").addEventListener("click", closeModal);
  $("#deleteConfirm").addEventListener("click", async () => {
    try {
      await Api.deleteApartment(id);
      toast("Квартира удалена");
      closeModal();
      renderAll();
    } catch (error) {
      if (!handleAuthError(error)) toast(error.message, "error");
    }
  });
}

/* ------------------------- Действия с заявками ------------------------- */

async function updateRequestStatus(id, status) {
  try {
    await Api.updateRequestStatus(id, status);
    toast(status === "accepted" ? "Заявка принята" : "Заявка отклонена");
    renderAll();
  } catch (error) {
    if (!handleAuthError(error)) toast(error.message, "error");
  }
}

async function cancelRequest(id) {
  try {
    await Api.deleteRequest(id);
    toast("Заявка отменена");
    renderAll();
  } catch (error) {
    if (!handleAuthError(error)) toast(error.message, "error");
  }
}

/* ------------------------- Обработчик кликов ------------------------- */

function globalClick(event) {
  let target = event.target.closest("[data-detail]");
  if (target) {
    const apartment = state.apartmentsById[target.dataset.detail];
    if (apartment) apartmentDetailModal(apartment);
    return;
  }

  target = event.target.closest("[data-edit]");
  if (target) {
    const apartment = state.apartmentsById[target.dataset.edit];
    if (apartment) apartmentFormModal(apartment);
    return;
  }

  target = event.target.closest("[data-delete]");
  if (target) {
    confirmDeleteApartment(target.dataset.delete);
    return;
  }

  target = event.target.closest("[data-offer]");
  if (target) {
    const apartment = state.apartmentsById[target.dataset.offer];
    if (apartment) requestModal(apartment);
    return;
  }

  target = event.target.closest("[data-msg]");
  if (target) {
    messageModal(Number(target.dataset.msg), target.dataset.msgname || "");
    return;
  }

  target = event.target.closest("[data-accept]");
  if (target) {
    updateRequestStatus(Number(target.dataset.accept), "accepted");
    return;
  }

  target = event.target.closest("[data-reject]");
  if (target) {
    updateRequestStatus(Number(target.dataset.reject), "rejected");
    return;
  }

  target = event.target.closest("[data-cancel]");
  if (target) {
    cancelRequest(Number(target.dataset.cancel));
    return;
  }

  target = event.target.closest("[data-chat]");
  if (target) {
    openChat(Number(target.dataset.chat), target.dataset.chatname || "");
    return;
  }
}

/* ------------------------- Запуск ------------------------- */

function init() {
  navEl.addEventListener("click", (event) => {
    const button = event.target.closest(".nav__link");
    if (button) navigate(button.dataset.view);
  });

  logoEl.addEventListener("click", (event) => {
    event.preventDefault();
    navigate("listings");
  });

  document.addEventListener("click", globalClick);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });

  if (!Auth.isLoggedIn() && AUTH_VIEWS.includes(state.view)) {
    state.view = "auth";
  }

  renderAll();
}

init();
