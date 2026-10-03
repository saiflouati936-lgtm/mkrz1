(function () {
  const client = window.supabaseClient;

  function esc(str) {
    return String(str).replace(/</g, "&lt;");
  }

  function guard() {
    const ok = window.MKRZAuth.state.ready && window.MKRZAuth.isAdmin();
    const guardEl = document.getElementById("adminGuard");
    const contentEl = document.getElementById("adminContent");

    if (!window.MKRZAuth.state.ready) {
      guardEl.textContent = "...جاري التحقق من الصلاحية";
      return;
    }
    if (!window.MKRZAuth.state.session) {
      guardEl.textContent = "سجّل الدخول أولاً للوصول للوحة التحكم.";
      contentEl.style.display = "none";
      return;
    }
    if (!ok) {
      guardEl.textContent = "🚫 هذه الصفحة مخصصة للمسؤول فقط.";
      contentEl.style.display = "none";
      return;
    }

    guardEl.style.display = "none";
    contentEl.style.display = "block";
    loadAll();
  }

  async function loadStats() {
    const [membersRes, filesRes, msgRes] = await Promise.all([
      client.from("profiles").select("*", { count: "exact", head: true }),
      client.storage.from("media").list("", { limit: 1000 }),
      client.from("messages").select("*", { count: "exact", head: true })
    ]);
    document.getElementById("statMembers").textContent = membersRes.count ?? "—";
    document.getElementById("statFiles").textContent = (filesRes.data || []).filter(f => f.id).length;
    document.getElementById("statMessages").textContent = msgRes.count ?? "—";
  }

  async function loadMembers() {
    const box = document.getElementById("membersTable");
    const { data, error } = await client.from("profiles").select("*").order("level", { ascending: false });
    if (error) { box.innerHTML = `<div class="admin-row">تعذر التحميل</div>`; return; }

    const myId = window.MKRZAuth.state.session.user.id;

    box.innerHTML = data.map(p => `
      <div class="admin-row">
        <span>${esc(p.username)}</span>
        ${mkrzLevelBadge(p.level, p.points)}
        <span style="color:var(--muted);font-size:12px">${p.points} نقطة</span>
        ${p.id === myId
          ? "<span></span>"
          : `<select class="lvl-select" data-id="${p.id}" title="تصحيح يدوي (استثنائي — المستوى يرتفع تلقائيًا)">
               ${[1, 2, 3, 4, 5, 6, 7].map(n => `<option value="${n}" ${p.level === n ? "selected" : ""}>${window.MKRZ_LEVELS[n].name}</option>`).join("")}
             </select>`}
      </div>`).join("");

    box.querySelectorAll(".lvl-select").forEach(sel => {
      sel.onchange = async () => {
        const { error } = await client.rpc("set_member_level", {
          target_id: sel.dataset.id,
          new_level: parseInt(sel.value, 10)
        });
        if (error) alert("خطأ: " + error.message);
        loadMembers();
      };
    });
  }

  async function loadFiles() {
    const box = document.getElementById("filesTable");
    const { data, error } = await client
      .storage.from("media")
      .list("", { limit: 200, sortBy: { column: "created_at", order: "desc" } });

    if (error) { box.innerHTML = `<div class="admin-row">تعذر التحميل</div>`; return; }
    const files = data.filter(f => f.id);

    box.innerHTML = files.length
      ? files.map(f => `
        <div class="admin-row">
          <span>${esc(f.name)}</span>
          <button class="btn" data-name="${f.name}">حذف</button>
        </div>`).join("")
      : `<div class="admin-row">لا ملفات بعد</div>`;

    box.querySelectorAll("button[data-name]").forEach(btn => {
      btn.onclick = async () => {
        if (!confirm("حذف هذا الملف نهائيًا؟")) return;
        await client.storage.from("media").remove([btn.dataset.name]);
        loadFiles();
        loadStats();
      };
    });
  }

  async function loadMessages() {
    const box = document.getElementById("messagesTable");
    const { data, error } = await client
      .from("messages").select("*")
      .order("created_at", { ascending: false }).limit(30);

    if (error) { box.innerHTML = `<div class="admin-row">تعذر التحميل</div>`; return; }

    box.innerHTML = data.length
      ? data.map(m => `
        <div class="admin-row">
          <span><b>${esc(m.username)}:</b> ${esc(m.content)}</span>
          <button class="btn" data-id="${m.id}">حذف</button>
        </div>`).join("")
      : `<div class="admin-row">لا رسائل بعد</div>`;

    box.querySelectorAll("button[data-id]").forEach(btn => {
      btn.onclick = async () => {
        await client.from("messages").delete().eq("id", btn.dataset.id);
        loadMessages();
        loadStats();
      };
    });
  }

  function loadAll() {
    loadStats();
    loadMembers();
    loadFiles();
    loadMessages();
  }

  function boot() {
    if (window.MKRZAuth) window.MKRZAuth.onChange(guard);
    else setTimeout(boot, 50);
  }
  boot();
})();
