// تعليقات على الصور والفيديوهات — تُعرض داخل اللايت بوكس فقط
window.MKRZComments = (function () {
  const client = window.supabaseClient;
  let channel = null;

  function esc(str) {
    return String(str).replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
  }

  function bubble(c) {
    return `<div class="comment-item" data-id="${c.id}"><b>${esc(c.username)}</b><span>${esc(c.content)}</span></div>`;
  }

  function renderInput(inputRow, fileName, list) {
    if (!window.MKRZAuth || !window.MKRZAuth.state.session) {
      inputRow.innerHTML = `<button class="btn btn-primary" id="cmtLoginBtn" style="width:100%">سجّل الدخول للتعليق</button>`;
      inputRow.querySelector("#cmtLoginBtn").onclick = () => window.MKRZAuth.openLogin();
      return;
    }
    inputRow.innerHTML = `<input id="cmtInput" placeholder="علّق..." maxlength="300"><button id="cmtSend">إرسال</button>`;
    async function send() {
      const input = inputRow.querySelector("#cmtInput");
      const content = input.value.trim();
      if (!content) return;
      const { session, profile } = window.MKRZAuth.state;
      const username = profile ? profile.username : session.user.email;
      input.value = "";
      const { error } = await client.from("comments").insert({
        file_name: fileName, user_id: session.user.id, username, content
      });
      if (error) alert("تعذر إرسال التعليق: " + error.message);
    }
    inputRow.querySelector("#cmtSend").onclick = send;
    inputRow.querySelector("#cmtInput").addEventListener("keydown", e => { if (e.key === "Enter") send(); });
  }

  async function mount(container, fileName) {
    container.innerHTML = `
      <div class="comment-list" id="cmtList"><div class="comment-empty">...تحميل</div></div>
      <div class="comment-input-row" id="cmtInputRow"></div>
    `;
    const list = container.querySelector("#cmtList");
    const inputRow = container.querySelector("#cmtInputRow");
    renderInput(inputRow, fileName, list);

    const { data, error } = await client
      .from("comments").select("*").eq("file_name", fileName)
      .order("created_at", { ascending: true });

    list.innerHTML = (!error && data && data.length)
      ? data.map(bubble).join("")
      : `<div class="comment-empty">${error ? "تعذر تحميل التعليقات" : "علّق أول وحد"}</div>`;
    list.scrollTop = list.scrollHeight;

    if (channel) client.removeChannel(channel);
    channel = client
      .channel("comments:" + fileName)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "comments", filter: `file_name=eq.${fileName}` },
        payload => {
          const empty = list.querySelector(".comment-empty");
          if (empty) empty.remove();
          list.insertAdjacentHTML("beforeend", bubble(payload.new));
          list.scrollTop = list.scrollHeight;
        })
      .subscribe();
  }

  function unmount() {
    if (channel) { client.removeChannel(channel); channel = null; }
  }

  return { mount, unmount };
})();
