(function () {
  const client = window.supabaseClient;
  const listeners = [];
  const state = { session: null, profile: null, ready: false };

  function notify() {
    listeners.forEach(fn => fn(state));
  }

  window.MKRZAuth = {
    state,
    onChange(fn) {
      listeners.push(fn);
      if (state.ready) fn(state);
    },
    isAdmin() {
      return !!(state.profile && state.profile.level === 8);
    },
    signOut() {
      return client.auth.signOut();
    },
    openLogin() {
      openModal();
    }
  };

  async function loadProfile(userId) {
    if (!userId) return null;
    const { data } = await client.from("profiles").select("*").eq("id", userId).single();
    return data || null;
  }

  async function refresh(session) {
    state.session = session || null;
    state.profile = session ? await loadProfile(session.user.id) : null;
    state.ready = true;
    document.body.classList.toggle("is-admin", window.MKRZAuth.isAdmin());
    renderAuthSlot();
    notify();
  }

  client.auth.getSession().then(({ data }) => refresh(data.session));
  client.auth.onAuthStateChange((_event, session) => refresh(session));

  async function uploadAvatar(e) {
    const file = e.target.files[0];
    if (!file || !state.session) return;
    const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
    const path = `${state.session.user.id}/avatar.${ext}`;

    const { error: upErr } = await client.storage.from("avatars").upload(path, file, { upsert: true, cacheControl: "3600" });
    if (upErr) { alert("فشل رفع الصورة: " + upErr.message); return; }

    const { data: pub } = client.storage.from("avatars").getPublicUrl(path);
    const freshUrl = pub.publicUrl + "?t=" + Date.now();

    await client.from("profiles").update({ avatar_url: freshUrl }).eq("id", state.session.user.id);
    state.profile = await loadProfile(state.session.user.id);
    renderAuthSlot();
    notify();
  }

  // ---------- بطاقة المستخدم في الشريط العلوي ----------

  function renderAuthSlot() {
    const slot = document.getElementById("authSlot");
    if (!slot) return;

    if (!state.session) {
      slot.innerHTML = `<button class="btn btn-primary" id="openAuthBtn">تسجيل الدخول</button>`;
      document.getElementById("openAuthBtn").onclick = openModal;
      return;
    }

    const name = state.profile ? state.profile.username : state.session.user.email;
    const level = state.profile ? state.profile.level : 1;
    const points = state.profile ? state.profile.points : 0;
    const avatarUrl = state.profile && state.profile.avatar_url;
    const isAdmin = window.MKRZAuth.isAdmin();

    slot.innerHTML = `
      <div class="user-menu">
        <button class="user-chip" id="userChipBtn">
          <span class="user-avatar${avatarUrl ? " has-img" : ""} lvl-ring-${level}">${avatarUrl ? `<img src="${avatarUrl}" alt="">` : name.charAt(0).toUpperCase()}</span>
          ${name} ${mkrzLevelBadge(level, points)}
        </button>
        <div class="user-dropdown" id="userDropdown">
          ${!isAdmin ? `<div class="dd-points">نقاطك: ${points}</div>` : ""}
          <label class="dd-item">
            تغيير صورتك
            <input type="file" accept="image/*" id="avatarInput" hidden>
          </label>
          ${isAdmin ? '<a href="admin.html">لوحة التحكم</a>' : ""}
          <button id="logoutBtn">تسجيل الخروج</button>
        </div>
      </div>`;

    document.getElementById("userChipBtn").onclick = () =>
      document.getElementById("userDropdown").classList.toggle("open");
    document.getElementById("logoutBtn").onclick = () => client.auth.signOut();
    document.getElementById("avatarInput").addEventListener("change", uploadAvatar);

    document.addEventListener("click", e => {
      const menu = document.querySelector(".user-menu");
      if (menu && !menu.contains(e.target)) {
        const dd = document.getElementById("userDropdown");
        if (dd) dd.classList.remove("open");
      }
    });
  }

  // ---------- مودال الدخول / إنشاء الحساب ----------

  function buildModal() {
    if (document.getElementById("authModal")) return;

    const wrap = document.createElement("div");
    wrap.id = "authModal";
    wrap.className = "modal-overlay";
    wrap.innerHTML = `
      <div class="modal">
        <button class="modal-close" id="authClose">✕</button>
        <div class="modal-tabs">
          <button class="tab active" data-tab="login">دخول</button>
          <button class="tab" data-tab="signup">حساب جديد</button>
        </div>
        <form id="loginForm" class="auth-form">
          <input type="email" placeholder="البريد الإلكتروني" required id="loginEmail">
          <input type="password" placeholder="كلمة المرور" required id="loginPass">
          <button class="btn btn-primary" type="submit">دخول</button>
          <p class="auth-msg" id="loginMsg"></p>
        </form>
        <form id="signupForm" class="auth-form hidden">
          <input type="text" placeholder="اسمك" required id="signupName">
          <input type="email" placeholder="البريد الإلكتروني" required id="signupEmail">
          <input type="password" placeholder="كلمة المرور (6 أحرف فأكثر)" required minlength="6" id="signupPass">
          <button class="btn btn-primary" type="submit">إنشاء الحساب</button>
          <p class="auth-msg" id="signupMsg"></p>
        </form>
      </div>`;
    document.body.appendChild(wrap);

    wrap.querySelector("#authClose").onclick = closeModal;
    wrap.addEventListener("click", e => { if (e.target === wrap) closeModal(); });

    wrap.querySelectorAll(".tab").forEach(tab => {
      tab.onclick = () => {
        wrap.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        wrap.querySelector("#loginForm").classList.toggle("hidden", tab.dataset.tab !== "login");
        wrap.querySelector("#signupForm").classList.toggle("hidden", tab.dataset.tab !== "signup");
      };
    });

    wrap.querySelector("#loginForm").addEventListener("submit", async e => {
      e.preventDefault();
      const msg = wrap.querySelector("#loginMsg");
      msg.textContent = "...جاري الدخول";
      const { error } = await client.auth.signInWithPassword({
        email: wrap.querySelector("#loginEmail").value,
        password: wrap.querySelector("#loginPass").value
      });
      if (error) { msg.textContent = "خطأ: " + error.message; return; }
      closeModal();
    });

    wrap.querySelector("#signupForm").addEventListener("submit", async e => {
      e.preventDefault();
      const msg = wrap.querySelector("#signupMsg");
      msg.textContent = "...جاري الإنشاء";
      const username = wrap.querySelector("#signupName").value;
      const { error } = await client.auth.signUp({
        email: wrap.querySelector("#signupEmail").value,
        password: wrap.querySelector("#signupPass").value,
        options: { data: { username } }
      });
      if (error) { msg.textContent = "خطأ: " + error.message; return; }
      msg.textContent = "تم! إذا طُلب تأكيد من بريدك، افتح الرابط ثم سجّل الدخول.";
    });
  }

  function openModal() {
    buildModal();
    document.getElementById("authModal").classList.add("open");
  }
  function closeModal() {
    const m = document.getElementById("authModal");
    if (m) m.classList.remove("open");
  }

  document.addEventListener("DOMContentLoaded", renderAuthSlot);
})();
