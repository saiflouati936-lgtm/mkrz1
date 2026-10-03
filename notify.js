// علامة "فيه جديد" — كل عضو يشوفها أول ما يدخل، وتختفي له بعد أول تحميل صفحة
// (تضل تظهر لعضو ثاني لين هو بردو يدخل ويشوفها)
(function () {
  const client = window.supabaseClient;

  function ensureDot(target, extraClass) {
    if (!target) return null;
    let dot = target.querySelector(":scope > .nav-dot");
    if (!dot) {
      dot = document.createElement("span");
      dot.className = "nav-dot" + (extraClass ? " " + extraClass : "");
      target.appendChild(dot);
    }
    return dot;
  }

  async function checkArea(area, latestPromise, dotEl) {
    if (!dotEl) return;
    const { session } = window.MKRZAuth.state;

    const [{ data: seenRows }, { data: latestRows }] = await Promise.all([
      client.from("last_seen").select("seen_at").eq("user_id", session.user.id).eq("area", area),
      latestPromise
    ]);

    const lastSeen = seenRows && seenRows[0] ? new Date(seenRows[0].seen_at) : new Date(0);
    const latest = latestRows && latestRows[0] ? new Date(latestRows[0].created_at) : null;

    dotEl.classList.toggle("show", !!(latest && latest > lastSeen));

    client.from("last_seen")
      .upsert({ user_id: session.user.id, area, seen_at: new Date().toISOString() })
      .then(({ error }) => { if (error) console.error("last_seen upsert:", error); });
  }

  function run() {
    if (!window.MKRZAuth || !window.MKRZAuth.state.ready || !window.MKRZAuth.state.session) return;

    const galleryLink = document.querySelector('.navlinks a[href="gallery.html"]');
    if (galleryLink) galleryLink.style.position = "relative";
    const galleryDot = ensureDot(galleryLink);

    const bubbleEl = document.querySelector(".chat-bubble");
    const chatDot = ensureDot(bubbleEl, "chat-dot");

    checkArea(
      "gallery",
      client.from("uploads").select("created_at").order("created_at", { ascending: false }).limit(1),
      galleryDot
    );
    checkArea(
      "chat",
      client.from("messages").select("created_at").order("created_at", { ascending: false }).limit(1),
      chatDot
    );
  }

  function boot() {
    if (window.MKRZAuth) window.MKRZAuth.onChange(run);
    else setTimeout(boot, 50);
  }
  boot();
})();
