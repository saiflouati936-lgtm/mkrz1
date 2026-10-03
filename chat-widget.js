(function () {
  const client = window.supabaseClient;
  let panelOpen = false;
  let subscribed = false;
  let replyingTo = null; // {id, username, content}

  const bubble = document.createElement("button");
  bubble.className = "chat-bubble";
  bubble.setAttribute("aria-label", "الشات");
  bubble.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.4 8.5 8.5 0 0 1-4-1L3 20l1.1-5.5A8.4 8.4 0 1 1 21 11.5z"/></svg>`;
  document.body.appendChild(bubble);

  const panel = document.createElement("div");
  panel.className = "chat-panel";
  panel.innerHTML = `
    <div class="chat-head">شات MKRZ</div>
    <div class="chat-body" id="chatBody"></div>
    <div class="chat-reply-bar" id="chatReplyBar"></div>
    <div class="chat-input-row" id="chatInputRow"></div>`;
  document.body.appendChild(panel);

  bubble.onclick = () => {
    panelOpen = !panelOpen;
    panel.classList.toggle("open", panelOpen);
    if (panelOpen) openChat();
  };

  function esc(str) {
    return String(str).replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
  }

  function bubbleMarkup(msg) {
    const canDelete = window.MKRZAuth && window.MKRZAuth.isAdmin();
    const quoted = msg.reply_to_id
      ? `<div class="chat-quote">↩ <b>${esc(msg.reply_to_username || "")}</b>: ${esc((msg.reply_to_content || "").slice(0, 80))}</div>`
      : "";
    return `
      <div class="chat-msg" data-id="${msg.id}">
        ${quoted}
        <div class="chat-msg-head">
          <b>${esc(msg.username)}</b>
          <span class="chat-msg-actions">
            <button class="chat-reply" data-id="${msg.id}" data-username="${esc(msg.username)}" title="رد">↩</button>
            ${canDelete ? `<button class="chat-del" data-id="${msg.id}">حذف</button>` : ""}
          </span>
        </div>
        <div>${esc(msg.content)}</div>
      </div>`;
  }

  function renderReplyBar() {
    const bar = document.getElementById("chatReplyBar");
    if (!bar) return;
    if (!replyingTo) { bar.innerHTML = ""; bar.classList.remove("open"); return; }
    bar.classList.add("open");
    bar.innerHTML = `
      <div class="chat-reply-preview">↩ رد على <b>${esc(replyingTo.username)}</b>: ${esc(replyingTo.content.slice(0, 50))}</div>
      <button id="chatReplyCancel">✕</button>`;
    document.getElementById("chatReplyCancel").onclick = () => { replyingTo = null; renderReplyBar(); };
  }

  function renderInputRow() {
    const row = document.getElementById("chatInputRow");
    if (!row) return;
    if (!window.MKRZAuth || !window.MKRZAuth.state.session) {
      row.innerHTML = `<button class="btn btn-primary" id="chatLoginBtn" style="width:100%">سجّل الدخول للمشاركة</button>`;
      document.getElementById("chatLoginBtn").onclick = () => window.MKRZAuth.openLogin();
      return;
    }
    row.innerHTML = `
      <input id="chatInput" placeholder="اكتب رسالة..." maxlength="500">
      <button id="chatSend">إرسال</button>`;
    document.getElementById("chatSend").onclick = sendMessage;
    document.getElementById("chatInput").addEventListener("keydown", e => {
      if (e.key === "Enter") sendMessage();
    });
  }

  async function sendMessage() {
    const input = document.getElementById("chatInput");
    const content = input.value.trim();
    if (!content) return;
    const { session, profile } = window.MKRZAuth.state;
    const username = profile ? profile.username : session.user.email;
    input.value = "";

    const payload = { user_id: session.user.id, username, content };
    if (replyingTo) {
      payload.reply_to_id = replyingTo.id;
      payload.reply_to_username = replyingTo.username;
      payload.reply_to_content = replyingTo.content;
    }
    replyingTo = null;
    renderReplyBar();

    const { error } = await client.from("messages").insert(payload);
    if (error) alert("تعذر إرسال الرسالة: " + error.message);
  }

  function wireMessageButtons() {
    document.querySelectorAll(".chat-del").forEach(btn => {
      btn.onclick = async () => {
        await client.from("messages").delete().eq("id", btn.dataset.id);
      };
    });
    document.querySelectorAll(".chat-reply").forEach(btn => {
      btn.onclick = () => {
        const msgEl = btn.closest(".chat-msg");
        const contentEl = msgEl.querySelector("div:last-child");
        replyingTo = { id: btn.dataset.id, username: btn.dataset.username, content: contentEl.textContent };
        renderReplyBar();
        const input = document.getElementById("chatInput");
        if (input) input.focus();
      };
    });
  }

  async function openChat() {
    renderInputRow();
    renderReplyBar();
    const body = document.getElementById("chatBody");
    if (!window.MKRZAuth || !window.MKRZAuth.state.session) {
      body.innerHTML = `<div class="chat-empty">سجّل الدخول لرؤية الشات والمشاركة فيه</div>`;
      return;
    }

    body.innerHTML = `<div class="chat-empty">...تحميل</div>`;
    const { data, error } = await client
      .from("messages")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(50);

    if (error) { body.innerHTML = `<div class="chat-empty">تعذر تحميل الشات</div>`; return; }

    body.innerHTML = data.length
      ? data.map(bubbleMarkup).join("")
      : `<div class="chat-empty">لا رسائل بعد — ابدأ الحديث</div>`;
    body.scrollTop = body.scrollHeight;
    wireMessageButtons();

    if (!subscribed) {
      subscribed = true;
      client
        .channel("public:messages")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, payload => {
          const b = document.getElementById("chatBody");
          const empty = b.querySelector(".chat-empty");
          if (empty) empty.remove();
          b.insertAdjacentHTML("beforeend", bubbleMarkup(payload.new));
          b.scrollTop = b.scrollHeight;
          wireMessageButtons();
        })
        .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, payload => {
          const el = document.querySelector(`.chat-msg[data-id="${payload.old.id}"]`);
          if (el) el.remove();
        })
        .subscribe();
    }
  }

  function boot() {
    if (window.MKRZAuth) {
      window.MKRZAuth.onChange(() => { if (panelOpen) openChat(); else renderInputRow(); });
    } else {
      setTimeout(boot, 50);
    }
  }
  boot();
})();
