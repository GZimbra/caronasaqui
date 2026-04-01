// =========================
// CHAT — subcoleção
// Mensagens ficam em chats/{id}/mensagens/{msgId}
// Em vez de array dentro do documento (limite 1MB).
// =========================

let typingTimeout;
window.chatUnsubscribe = null;
window.chatAtualId = null;

function gerarChatId(userA, userB) {
  return [userA, userB]
    .filter(Boolean)
    .sort()
    .join("_");
}

async function garantirChat(chatId, outroId, outroNome = "Usuário") {
  if (!chatId || !outroId) return null;

  const ref = db.collection("chats").doc(chatId);
  const doc = await ref.get();
  const atual = doc.exists ? doc.data() : {};

  const participantes = Array.from(new Set([
    ...(atual.participantes || []),
    usuarioLogado.id,
    outroId
  ]));

  const nomes = {
    ...(atual.nomes || {}),
    [usuarioLogado.id]: usuarioLogado.nome,
    [outroId]: outroNome || atual.nomes?.[outroId] || "Usuário"
  };

  const fotos = {
    ...(atual.fotos || {}),
    [usuarioLogado.id]: usuarioLogado.foto || ""
  };

  await ref.set({
    participantes,
    nomes,
    fotos,
    criadoEm: atual.criadoEm || firebase.firestore.FieldValue.serverTimestamp(),
    atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  return chatId;
}

function abrirAbaMensagens(chatId = null) {
  if (chatId) window.chatAtualId = chatId;
  loadPage("mensagens");
  if (chatId) {
    requestAnimationFrame(() => {
      abrirChat(chatId, true);
    });
  }
}

async function iniciarChatDaCarona(caronaId) {
  try {
    const caronaDoc = await db.collection("caronas").doc(caronaId).get();
    if (!caronaDoc.exists) { showToast("Carona não encontrada.", "erro"); return; }

    const carona = caronaDoc.data();
    if (carona.motoristaId === usuarioLogado.id) { abrirAbaMensagens(); return; }

    const chatId = gerarChatId(usuarioLogado.id, carona.motoristaId);
    await garantirChat(chatId, carona.motoristaId, carona.motorista || "Motorista");
    abrirAbaMensagens(chatId);
  } catch (error) {
    console.error("Erro ao iniciar chat:", error);
    showToast("Não foi possível abrir a conversa.", "erro");
  }
}

function abrirChat(id, jaNaAbaMensagens = false) {
  if (!jaNaAbaMensagens && !document.getElementById("listaConversas")) {
    abrirAbaMensagens(id);
    return;
  }

  window.chatAtualId = id;
  marcarMensagensComoLidas(id).then(() => carregarConversas());

  if (window.chatUnsubscribe) {
    window.chatUnsubscribe();
    window.chatUnsubscribe = null;
  }

  const content = document.getElementById("chatPanel") || document.getElementById("content");
  content.innerHTML = `
    <div class="chat-header">
      <button class="btn-secondary" onclick="voltarFeed()">←</button>
      <h2 id="chatTitulo">Chat</h2>
    </div>

    <div id="chatBox" class="chat-box"></div>
    <div id="typing" class="typing hidden">digitando...</div>

    <div class="chat-input">
      <input id="msg" placeholder="Digite uma mensagem">
      <button class="btn-primary" onclick="enviarMsg('${id}')">➤</button>
    </div>
  `;

  const input = document.getElementById("msg");
  input.addEventListener("keypress", e => {
    if (e.key === "Enter") enviarMsg(id);
    mostrarTyping();
  });

  // Carrega nome do contato a partir do doc principal
  db.collection("chats").doc(id).get().then(doc => {
    const titulo = document.getElementById("chatTitulo");
    if (doc.exists && titulo) {
      const data = doc.data();
      const outroId = data.participantes?.find(uid => uid !== usuarioLogado.id);
      titulo.innerText = data.nomes?.[outroId] || "Chat";
    }
  });

  // Escuta a subcoleção de mensagens em tempo real
  window.chatUnsubscribe = db
    .collection("chats").doc(id)
    .collection("mensagens")
    .orderBy("criadoEm", "asc")
    .onSnapshot(snapshot => {
      const box = document.getElementById("chatBox");
      if (!box) return;

      box.innerHTML = "";

      if (snapshot.empty) {
        box.innerHTML = `<p>Nenhuma mensagem ainda. Envie a primeira ${ICONS.wave}</p>`;
        return;
      }

      snapshot.forEach(docMsg => {
        const m = docMsg.data();
        const isMe = m.userId === usuarioLogado.id;

        let hora = new Date();
        if (m.criadoEm?.toDate) {
          hora = m.criadoEm.toDate();
        } else if (m.criadoEm?.seconds) {
          hora = new Date(m.criadoEm.seconds * 1000);
        }

        const time = hora.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

        const bubble = document.createElement("div");
        bubble.className = `msg ${isMe ? "me" : "other"}`;
        bubble.innerHTML = `
          <div class="bubble">
            <span>${escapeHtmlChat(m.texto)}</span>
            <div class="time">${time}</div>
          </div>
        `;
        box.appendChild(bubble);
      });

      box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
    });
}

function voltarFeed() {
  if (window.chatUnsubscribe) {
    window.chatUnsubscribe();
    window.chatUnsubscribe = null;
  }

  window.chatAtualId = null;

  const painel = document.getElementById("chatPanel");
  if (painel) {
    painel.innerHTML = `
      <div class="chat-placeholder">
        Selecione um contato para continuar a conversa
      </div>
    `;
    carregarConversas();
    return;
  }

  loadPage("mensagens");
}

async function enviarMsg(id) {
  const input = document.getElementById("msg");
  const texto = input.value.trim();
  if (!texto) return;

  input.value = "";

  const chatRef = db.collection("chats").doc(id);
  const msgRef = chatRef.collection("mensagens").doc();

  // Usa batch para atualizar o doc do chat e adicionar a mensagem atomicamente
  const batch = db.batch();

  batch.set(msgRef, {
    userId: usuarioLogado.id,
    user: usuarioLogado.nome,
    texto,
    lida: false,
    criadoEm: firebase.firestore.FieldValue.serverTimestamp()
  });

  batch.set(chatRef, {
    participantes: firebase.firestore.FieldValue.arrayUnion(usuarioLogado.id),
    nomes: { [usuarioLogado.id]: usuarioLogado.nome },
    ultimaMensagem: texto,
    ultimoRemetenteId: usuarioLogado.id,
    atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  await batch.commit();

  carregarConversas();
}

function mostrarTyping() {
  const typing = document.getElementById("typing");
  if (!typing) return;

  typing.classList.remove("hidden");
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    typing.classList.add("hidden");
  }, 1500);
}

async function marcarMensagensComoLidas(chatId) {
  const snapshot = await db
    .collection("chats").doc(chatId)
    .collection("mensagens")
    .where("userId", "!=", usuarioLogado.id)
    .where("lida", "==", false)
    .get();

  if (snapshot.empty) return;

  const batch = db.batch();
  snapshot.forEach(doc => batch.update(doc.ref, { lida: true }));
  await batch.commit();
}

// Escape local para o chat (evita XSS nas mensagens)
function escapeHtmlChat(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

window.gerarChatId = gerarChatId;
window.garantirChat = garantirChat;
window.iniciarChatDaCarona = iniciarChatDaCarona;
window.abrirAbaMensagens = abrirAbaMensagens;
window.abrirChat = abrirChat;
window.voltarFeed = voltarFeed;
window.enviarMsg = enviarMsg;
