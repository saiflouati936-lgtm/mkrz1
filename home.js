(function () {
  const client = window.supabaseClient;

  function esc(str) {
    return String(str).replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
  }

  // ===== جسيمات خلفية متحركة =====
  const field = document.getElementById("particleField");
  if (field) {
    const colors = ["#6f5cff", "#ff4d8d", "#ffd76a", "#4fc3f7"];
    for (let i = 0; i < 16; i++) {
      const s = document.createElement("span");
      const size = 4 + Math.random() * 10;
      s.style.left = Math.random() * 100 + "%";
      s.style.width = size + "px";
      s.style.height = size + "px";
      s.style.setProperty("--p-color", colors[i % colors.length]);
      s.style.setProperty("--p-dur", (10 + Math.random() * 10).toFixed(1) + "s");
      s.style.setProperty("--p-delay", (-(Math.random() * 18)).toFixed(1) + "s");
      s.style.setProperty("--p-drift", Math.round(Math.random() * 60 - 30) + "px");
      field.appendChild(s);
    }
  }

  // ===== عدّاد متحرك للأرقام =====
  function countUp(el, target, duration = 1200) {
    if (!el) return;
    const start = performance.now();
    function tick(now) {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(eased * target).toLocaleString("en-US");
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // ===== إحصائيات حقيقية =====
  async function loadStats() {
    const [membersRes, filesRes, msgRes] = await Promise.all([
      client.from("profiles").select("*", { count: "exact", head: true }),
      client.storage.from("media").list("", { limit: 1000 }),
      client.from("messages").select("*", { count: "exact", head: true })
    ]);
    const fileCount = (filesRes.data || []).filter(f => f.id).length;
    countUp(document.getElementById("statFilesHome"), fileCount);
    countUp(document.getElementById("statMembersHome"), membersRes.count || 0);
    countUp(document.getElementById("statMsgsHome"), msgRes.count || 0);
  }

  // ===== معاينة حية لآخر الملفات =====
  async function loadRecent() {
    const strip = document.getElementById("recentStrip");
    if (!strip) return;
    const { data } = await client.storage
      .from("media")
      .list("", { limit: 4, sortBy: { column: "created_at", order: "desc" } });

    const files = (data || []).filter(f => f.id);
    if (files.length === 0) return;

    strip.innerHTML = "";
    for (const file of files) {
      const { data: pub } = client.storage.from("media").getPublicUrl(file.name);
      const ext = file.name.split(".").pop().toLowerCase();
      const isVideo = ["mp4", "webm", "mov", "mkv", "avi"].includes(ext);
      const el = document.createElement("div");
      el.className = "recent-thumb";
      el.innerHTML = isVideo
        ? `<video src="${pub.publicUrl}" muted playsinline></video>`
        : `<img src="${pub.publicUrl}" alt="" loading="lazy">`;
      el.addEventListener("click", () => window.mkrzOpenLightbox(isVideo, pub.publicUrl, file.name));
      strip.appendChild(el);
    }
  }

  // ===== قائد الطاقم الحالي (أعلى رتبة ونقاط) =====
  async function loadLeader() {
    const section = document.getElementById("leaderSection");
    const card = document.getElementById("leaderCard");
    if (!section || !card) return;

    const { data } = await client
      .from("profiles")
      .select("*")
      .order("level", { ascending: false })
      .order("points", { ascending: false })
      .limit(1);

    if (!data || data.length === 0) return;
    const p = data[0];
    const avatarInner = p.avatar_url ? `<img src="${p.avatar_url}" alt="">` : (p.username || "?").charAt(0).toUpperCase();

    card.innerHTML = `
      <div class="avatar${p.avatar_url ? " has-img" : ""} lvl-ring-${p.level}">${avatarInner}</div>
      <div>
        <div class="leader-label">قائد الطاقم الحالي</div>
        <div class="leader-name">${esc(p.username)}</div>
        ${typeof mkrzLevelBadge === "function" ? mkrzLevelBadge(p.level, p.points) : ""}
      </div>`;
    section.style.display = "";
  }

  loadStats();
  loadRecent();
  loadLeader();
})();
