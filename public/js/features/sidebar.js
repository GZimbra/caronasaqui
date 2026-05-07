// Sidebar direita: solicitacoes, decisoes de corrida e mensagens.

window.notifState = {
  pendentesMotorista: [],
  decisoesPassageiro: [],
};
window.notifUnsubscribes = [];

function iniciarNotificacoes() {
  registrarServiceWorkerNotificacoes();
  window.notifUnsubscribes.forEach(unsub => unsub?.());
  window.notifUnsubscribes = [];

  const pendentes = db.collection("solicitacoes")
    .where("motoristaId", "==", usuarioLogado.id)
    .where("status", "in", SOL_STATUS.pending)
    .where("lida", "==", false)
    .onSnapshot(snapshot => {
      window.notifState.pendentesMotorista = snapshot.docs;
      renderizarSidebar();
    });

  const decisoes = db.collection("solicitacoes")
    .where("passageiroId", "==", usuarioLogado.id)
    .where("status", "in", [...SOL_STATUS.approved, ...SOL_STATUS.rejected])
    .onSnapshot(snapshot => {
      window.notifState.decisoesPassageiro = snapshot.docs;
      notificarDecisoesPassageiro(snapshot.docs);
      renderizarSidebar();
    });

  window.notifUnsubscribes.push(pendentes, decisoes);
}

function carregarMapaNotificacoesVistas() {
  const key = `rideNotificationsSeen:${usuarioLogado.id}`;
  try {
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
}

function salvarMapaNotificacoesVistas(mapa) {
  localStorage.setItem(`rideNotificationsSeen:${usuarioLogado.id}`, JSON.stringify(mapa));
}

function notificarDecisoesPassageiro(docs) {
  const vistos = carregarMapaNotificacoesVistas();

  docs.forEach(doc => {
    const s = doc.data();
    const status = normalizarStatusSolicitacao(s.status);
    const unread = s.notificationReadByPassenger !== true;
    const toastKey = `${doc.id}:${status}:${s.decidedAt?.seconds || "pending"}`;

    if (!unread || vistos[toastKey]) return;

    const aprovada = status === "approved";
    const msg = aprovada
      ? "Sua solicitacao de carona foi aprovada."
      : `Sua solicitacao de carona foi recusada.${s.rejectionReason ? " Motivo: " + s.rejectionReason : ""}`;

    showToast(msg, aprovada ? "sucesso" : "erro", 6000);
    enviarPushLocal(aprovada ? "Corrida aprovada" : "Corrida recusada", msg);
    vistos[toastKey] = true;
  });

  salvarMapaNotificacoesVistas(vistos);
}

async function registrarServiceWorkerNotificacoes() {
  if (!("serviceWorker" in navigator) || window.swNotifRegistrado) return;

  try {
    await navigator.serviceWorker.register("sw.js");
    window.swNotifRegistrado = true;
  } catch {}
}

async function enviarPushLocal(title, body) {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return;

  try {
    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }
    if (Notification.permission !== "granted") return;

    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, {
      body,
      icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='12' fill='%234f9eff'/%3E%3Cpath d='M14 38h4l4-12h25l4 12h3v8h-5a6 6 0 0 1-12 0H27a6 6 0 0 1-12 0h-1z' fill='white'/%3E%3C/svg%3E",
      tag: `ride-${Date.now()}`,
    });
  } catch {}
}

async function renderizarSidebar() {
  const sidebar = document.getElementById("rightSidebar");
  if (!sidebar) return;

  const solicitacoes = window.notifState.pendentesMotorista || [];
  const decisoesNaoLidas = (window.notifState.decisoesPassageiro || [])
    .filter(doc => doc.data().notificationReadByPassenger !== true);

  let html = `<h3>${ICONS.bell} Notificacoes</h3>`;

  html += renderSolicitacoesMotorista(solicitacoes);
  html += renderDecisoesPassageiro(decisoesNaoLidas);

  const naoLidas = await carregarMensagensNaoLidas();
  html += renderMensagensNaoLidas(naoLidas);

  sidebar.innerHTML = html;

  const totalNotifs = solicitacoes.length + decisoesNaoLidas.length + naoLidas.length;
  atualizarBadgeNotificacoes(totalNotifs);
  atualizarDrawerNotificacoes(html);
}

function renderSolicitacoesMotorista(solicitacoes) {
  let html = `<h3 style="margin-top:14px;">${ICONS.car} Pedidos pendentes</h3>`;

  if (!solicitacoes.length) {
    return html + `<p>Nenhuma solicitacao pendente</p>`;
  }

  return html + solicitacoes.map(doc => {
    const s = doc.data();
    const quando = formatarTimestampNotif(s.criadoEm);
    return `
      <div class="notificacao-card notif-pending">
        <b>${ICONS.car} Nova solicitacao</b>
        <p>${esc(s.passageiroNome)} quer entrar na carona.</p>
        <small>${esc(quando)}</small>
        <div class="popup-actions">
          <button class="btn-primary" onclick="aceitarSolicitacao('${doc.id}','${s.caronaId}')">Aprovar</button>
          <button class="btn-secondary" onclick="abrirModalRecusa('${doc.id}')">Recusar</button>
        </div>
      </div>
    `;
  }).join("");
}

function renderDecisoesPassageiro(decisoes) {
  let html = `<h3 style="margin-top:20px;">Status das corridas</h3>`;

  if (!decisoes.length) {
    return html + `<p>Nenhuma decisao nova</p>`;
  }

  return html + decisoes.map(doc => {
    const s = doc.data();
    const status = normalizarStatusSolicitacao(s.status);
    const aprovada = status === "approved";
    const titulo = aprovada ? "Corrida aprovada" : "Corrida recusada";
    const motivo = !aprovada && s.rejectionReason
      ? `<p><b>Motivo:</b> ${esc(s.rejectionReason)}</p>`
      : "";

    return `
      <div class="notificacao-card ${aprovada ? "notif-approved" : "notif-rejected"}">
        <b>${titulo}</b>
        <p>${aprovada ? "Motorista aprovou sua solicitacao." : "Motorista recusou sua solicitacao."}</p>
        ${motivo}
        <small>${esc(formatarTimestampNotif(s.decidedAt || s.atualizadoEm || s.criadoEm))}</small>
        <button class="btn-secondary btn-small" onclick="marcarNotificacaoCorridaLida('${doc.id}')">Marcar como lida</button>
      </div>
    `;
  }).join("");
}

async function carregarMensagensNaoLidas() {
  const chats = await db.collection("chats")
    .where("participantes", "array-contains", usuarioLogado.id)
    .get();

  return (await Promise.all(
    chats.docs.map(async doc => {
      const data = doc.data();
      const outroId = data.participantes?.find(id => id !== usuarioLogado.id);
      const nome = data.nomes?.[outroId] || "Usuario";

      const snap = await db.collection("chats").doc(doc.id)
        .collection("mensagens").orderBy("criadoEm", "desc").limit(1).get();
      if (snap.empty) return null;

      const ultima = snap.docs[0].data();
      if (ultima.lida || ultima.userId === usuarioLogado.id) return null;

      return { chatId: doc.id, nome, texto: ultima.texto };
    })
  )).filter(Boolean);
}

function renderMensagensNaoLidas(naoLidas) {
  let html = `<h3 style="margin-top:20px;">${ICONS.message} Mensagens</h3>`;

  if (!naoLidas.length) {
    return html + `<p>Nenhuma mensagem nova</p>`;
  }

  return html + naoLidas.map(({ chatId, nome, texto }) => `
    <div class="notificacao-card">
      <b>${esc(nome)}</b>
      <p>${esc(texto)}</p>
      <button class="btn-secondary" onclick="abrirChat('${chatId}')">Abrir Chat</button>
    </div>
  `).join("");
}

function atualizarBadgeNotificacoes(totalNotifs) {
  const badge = document.getElementById("notifBadge");
  if (!badge) return;

  if (totalNotifs > 0) {
    badge.textContent = totalNotifs > 9 ? "9+" : totalNotifs;
    badge.classList.remove("hidden");
    return;
  }

  badge.classList.add("hidden");
}

function atualizarDrawerNotificacoes(html) {
  const drawer = document.getElementById("notifDrawer");
  if (!drawer?.classList.contains("open")) return;

  const drawerContent = document.getElementById("notifDrawerContent");
  if (drawerContent) drawerContent.innerHTML = html;
}

function formatarTimestampNotif(timestamp) {
  if (!timestamp) return "Agora";
  const data = timestamp?.toDate ? timestamp.toDate() : timestamp;
  if (!(data instanceof Date) || Number.isNaN(data.getTime())) return "Agora";
  return data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

async function marcarNotificacaoCorridaLida(solicitacaoId) {
  try {
    await db.collection("solicitacoes").doc(solicitacaoId).update({
      notificationReadByPassenger: true,
      notificationReadAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch {
    showToast("Nao foi possivel marcar a notificacao como lida.", "erro");
  }
}

async function carregarConversas() {
  const lista = document.getElementById("listaConversas");
  if (!lista) return;

  lista.innerHTML = "";

  const chats = await db.collection("chats")
    .where("participantes", "array-contains", usuarioLogado.id)
    .get();

  const conversas = (await Promise.all(chats.docs.map(_montarConversa)))
    .filter(Boolean)
    .sort((a, b) => b.ordem - a.ordem);

  if (!conversas.length) {
    lista.innerHTML = `
      <div class="ride-card show">
        <b>Nenhuma conversa ainda</b>
        <p>Quando voce falar com um motorista ou passageiro, o contato vai ficar salvo aqui.</p>
      </div>
    `;
    return;
  }

  lista.innerHTML = conversas.map(_cardConversa).join("");
}

async function _montarConversa(doc) {
  const chat = doc.data();
  if (!chat.participantes?.includes(usuarioLogado.id)) return null;

  const outroId = chat.participantes.find(id => id !== usuarioLogado.id);
  let nome = chat.nomes?.[outroId] || "Usuario";
  let foto = chat.fotos?.[outroId] || "";

  if (outroId) {
    try {
      const u = await db.collection("usuarios").doc(outroId).get();
      if (u.exists) {
        nome = u.data().nome || nome;
        foto = u.data().foto || foto;
      }
    } catch {}
  }

  return {
    id: doc.id,
    nome,
    foto,
    preview: chat.ultimaMensagem || "Toque para abrir a conversa",
    ordem: chat.atualizadoEm?.seconds || 0,
  };
}

function _cardConversa(c) {
  const ativa = c.id === window.chatAtualId ? "active" : "";
  const inicial = (c.nome || "C")[0].toUpperCase();
  const avatar = c.foto
    ? `<img class="conversa-avatar conversa-foto" src="${esc(c.foto)}" alt="${esc(inicial)}">`
    : `<div class="conversa-avatar">${esc(inicial)}</div>`;

  return `
    <div class="ride-card show conversa-card ${ativa}"
         role="button" tabindex="0"
         onclick="abrirChat('${c.id}', true)"
         onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();abrirChat('${c.id}',true);}">
      ${avatar}
      <div class="conversa-info">
        <span class="conversa-nome">${esc(c.nome)}</span>
        <span class="conversa-preview">${esc(c.preview)}</span>
      </div>
    </div>
  `;
}

Object.assign(window, {
  iniciarNotificacoes,
  renderizarSidebar,
  carregarConversas,
  marcarNotificacaoCorridaLida,
});
