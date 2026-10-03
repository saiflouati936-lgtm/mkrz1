// =====================================
// عناصر الصفحة
// =====================================

const search = document.getElementById("searchInput");
const fileInput = document.getElementById("fileInput");
const gallery = document.getElementById("gallery");
const filters = [...document.querySelectorAll(".filter")];

const ICON_IMAGE = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M21 15l-4-4-9 8"/></svg>`;
const ICON_VIDEO = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="14" height="14" rx="2"/><path d="M21 8l-4 3 4 3z"/></svg>`;

function esc(str) {
  return String(str).replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

// =====================================
// إنشاء بطاقة (زر الحذف يظهر فقط للملك عبر body.is-admin)
// =====================================

function createCard(fileName, publicUrl, reactionInfo, uploaderName) {
  const extension = fileName.split(".").pop().toLowerCase();
  const videoExtensions = ["mp4", "webm", "mov", "mkv", "avi"];
  const isVideo = videoExtensions.includes(extension);

  const card = document.createElement("article");
  card.className = "card";
  card.dataset.type = isVideo ? "video" : "image";
  card.dataset.name = fileName;

  const mediaTag = isVideo
    ? `<video src="${publicUrl}" muted playsinline preload="metadata"></video><div class="play-badge"><svg viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg></div>`
    : `<img src="${publicUrl}" alt="${esc(fileName)}" loading="lazy">`;

  const displayName = uploaderName ? "رفعها " + uploaderName : fileName;

  card.innerHTML = `
    <div class="media">${mediaTag}</div>
    <div class="card-info">
      <span class="card-info-name">${isVideo ? ICON_VIDEO : ICON_IMAGE}${esc(displayName)}</span>
      <button class="card-del admin-only" title="حذف">🗑</button>
    </div>
  `;

  card.querySelector(".media").addEventListener("click", () => {
    window.mkrzOpenLightbox(isVideo, publicUrl, fileName, uploaderName);
  });

  card.querySelector(".card-del").addEventListener("click", async () => {
    if (!confirm("حذف هذا الملف نهائيًا؟")) return;
    const { error } = await supabaseClient.storage.from("media").remove([fileName]);
    if (error) { alert("فشل الحذف: " + error.message); return; }
    card.remove();
  });

  if (window.MKRZReactions) {
    card.appendChild(window.MKRZReactions.render(fileName, reactionInfo));
  }

  return card;
}

// =====================================
// تحميل الملفات من Supabase
// =====================================

async function loadFiles() {
  const { data, error } = await supabaseClient
    .storage
    .from("media")
    .list("", { limit: 100, sortBy: { column: "created_at", order: "desc" } });

  if (error) {
    console.error("خطأ في تحميل الملفات:", error);
    gallery.innerHTML = `<div class="empty-state">تعذّر تحميل الملفات. تأكد من إعدادات Supabase.</div>`;
    return;
  }

  const files = (data || []).filter(f => f.id && f.name !== ".emptyFolderPlaceholder");

  if (files.length === 0) {
    gallery.innerHTML = `<div class="empty-state">لا توجد ملفات بعد — ارفع أول صورة أو فيديو.</div>`;
    return;
  }

  const names = files.map(f => f.name);
  const [reactionMap, uploadsRes] = await Promise.all([
    window.MKRZReactions ? window.MKRZReactions.fetchFor(names) : {},
    supabaseClient.from("uploads").select("file_name, username").in("file_name", names)
  ]);
  const uploaderMap = {};
  (uploadsRes.data || []).forEach(u => { uploaderMap[u.file_name] = u.username; });

  gallery.innerHTML = "";
  for (const file of files) {
    const { data: publicData } = supabaseClient.storage.from("media").getPublicUrl(file.name);
    gallery.appendChild(createCard(file.name, publicData.publicUrl, reactionMap[file.name], uploaderMap[file.name]));
  }
}

// =====================================
// الفلاتر
// =====================================

filters.forEach(button => {
  button.addEventListener("click", () => {
    filters.forEach(btn => btn.classList.remove("active"));
    button.classList.add("active");
    const type = button.dataset.filter;
    document.querySelectorAll(".card").forEach(card => {
      card.style.display = type === "all" || card.dataset.type === type ? "" : "none";
    });
  });
});

// =====================================
// البحث
// =====================================

if (search) {
  search.addEventListener("input", () => {
    const query = search.value.trim().toLowerCase();
    document.querySelectorAll(".card").forEach(card => {
      const name = card.dataset.name || "";
      card.style.display = name.toLowerCase().includes(query) ? "" : "none";
    });
  });
}

// =====================================
// رفع الملفات (يتطلب تسجيل الدخول)
// =====================================

if (fileInput) {
  fileInput.addEventListener("change", async () => {
    const files = [...fileInput.files];
    if (files.length === 0) return;

    if (!window.MKRZAuth || !window.MKRZAuth.state.session) {
      alert("سجّل الدخول أولاً عشان ترفع ملفات.");
      fileInput.value = "";
      window.MKRZAuth && window.MKRZAuth.openLogin();
      return;
    }

    const emptyState = gallery.querySelector(".empty-state");
    if (emptyState) emptyState.remove();

    for (const file of files) {
      try {
        const extension = file.name.includes(".") ? "." + file.name.split(".").pop() : "";
        const fileName = Date.now() + "_" + Math.random().toString(36).substring(2) + extension;

        const { error } = await supabaseClient
          .storage
          .from("media")
          .upload(fileName, file, { cacheControl: "3600", upsert: false });

        if (error) {
          console.error(error);
          alert("فشل رفع الملف:\n\n" + error.message);
          continue;
        }

        const { session, profile } = window.MKRZAuth.state;
        const uploaderName = profile ? profile.username : session.user.email;
        supabaseClient.from("uploads").insert({
          file_name: fileName, user_id: session.user.id, username: uploaderName
        }).then(({ error: upErr }) => { if (upErr) console.error("uploads insert:", upErr); });

        const { data: publicData } = supabaseClient.storage.from("media").getPublicUrl(fileName);
        gallery.prepend(createCard(fileName, publicData.publicUrl, null, uploaderName));
      } catch (err) {
        console.error(err);
        alert("حدث خطأ أثناء رفع الملف.");
      }
    }

    fileInput.value = "";
  });
}

// =====================================
// تشغيل الصفحة
// =====================================

loadFiles();
