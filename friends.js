(function () {
  const client = window.supabaseClient;
  const grid = document.getElementById("crewGrid");

  function esc(str) {
    return String(str).replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
  }

  function card(p) {
    const initial = (p.username || "?").charAt(0).toUpperCase();
    const avatarInner = p.avatar_url ? `<img src="${p.avatar_url}" alt="">` : initial;
    return `
      <div class="crew-card">
        <div class="avatar${p.avatar_url ? " has-img" : ""} lvl-ring-${p.level}">${avatarInner}</div>
        <h3>${esc(p.username)}</h3>
        <div class="role">${mkrzLevelBadge(p.level, p.points)}</div>
      </div>`;
  }

  async function load() {
    const { data, error } = await client
      .from("profiles")
      .select("*")
      .order("level", { ascending: false })
      .order("points", { ascending: false });

    if (error) {
      grid.innerHTML = `<div class="empty-state">تعذر تحميل الأعضاء</div>`;
      return;
    }
    if (!data || data.length === 0) {
      grid.innerHTML = `<div class="empty-state">ما فيه أعضاء مسجلين بعد — أول وحد يسجّل حساب يظهر هنا.</div>`;
      return;
    }
    grid.innerHTML = data.map(card).join("");
  }

  load();
})();
