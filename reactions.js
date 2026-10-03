// ردود الفعل (❤️ 😂 🔥 👍 😮) — يستخدمها script.js (المعرض) و lightbox.js
window.MKRZReactions = (function () {
  const client = window.supabaseClient;
  const EMOJIS = ["❤️", "😂", "🔥", "👍", "😮"];

  async function fetchFor(fileNames) {
    if (!fileNames || fileNames.length === 0) return {};
    const { data } = await client.from("reactions").select("file_name, emoji, user_id").in("file_name", fileNames);
    const myId = window.MKRZAuth && window.MKRZAuth.state.session && window.MKRZAuth.state.session.user.id;
    const out = {};
    for (const row of (data || [])) {
      out[row.file_name] = out[row.file_name] || { counts: {}, mine: null };
      out[row.file_name].counts[row.emoji] = (out[row.file_name].counts[row.emoji] || 0) + 1;
      if (row.user_id === myId) out[row.file_name].mine = row.emoji;
    }
    return out;
  }

  async function toggle(fileName, emoji, wasMine) {
    if (!window.MKRZAuth || !window.MKRZAuth.state.session) { window.MKRZAuth && window.MKRZAuth.openLogin(); return false; }
    const uid = window.MKRZAuth.state.session.user.id;
    if (wasMine) {
      await client.from("reactions").delete().eq("file_name", fileName).eq("user_id", uid);
    } else {
      await client.from("reactions").upsert({ file_name: fileName, user_id: uid, emoji });
    }
    return true;
  }

  function render(fileName, info, size) {
    info = info || { counts: {}, mine: null };
    const wrap = document.createElement("div");
    wrap.className = "reaction-bar" + (size === "lg" ? " lg" : "");
    EMOJIS.forEach(emoji => {
      const btn = document.createElement("button");
      const count = info.counts[emoji] || 0;
      const mine = info.mine === emoji;
      btn.type = "button";
      btn.className = "reaction-chip" + (mine ? " mine" : "");
      btn.innerHTML = `${emoji}${count ? `<span>${count}</span>` : ""}`;
      btn.addEventListener("click", async e => {
        e.stopPropagation();
        const ok = await toggle(fileName, emoji, mine);
        if (!ok) return;
        const fresh = await fetchFor([fileName]);
        wrap.replaceWith(render(fileName, fresh[fileName], size));
      });
      wrap.appendChild(btn);
    });
    return wrap;
  }

  return { fetchFor, render, EMOJIS };
})();
