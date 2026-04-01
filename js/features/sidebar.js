function usuarioParticipaDoChat(chat) {
  return chat.participantes?.includes(usuarioLogado.id);
}

function obterNomeContato(chat, outroId) {
  return chat.nomes?.[outroId] || "Usuário";
}

async function montarResumoConversa(doc) {
  const chat = doc.data();

  if (!usuarioParticipaDoChat(chat)) return null;

  const outroId = chat.participantes?.find(id => id !== usuarioLogado.id);

  let outroNome = obterNomeContato(chat, outroId);
  let outroFoto = chat.fotos?.[outroId] || "";

  if (outroId) {
    try {
      const usuarioDoc = await db.collection("usuarios").doc(outroId).get();
      if (usuarioDoc.exists) {
        const usuarioData = usuarioDoc.data();
        outroNome = usuarioData.nome || outroNome;
        outroFoto = usuarioData.foto || outroFoto;
      }
    } catch (error) {
      console.warn("Não foi possível carregar dados do contato:", error);
    }
  }

  const ordem = chat.atualizadoEm?.seconds || 0;

  return {
    id: doc.id,
    outroNome,
    outroFoto,
    ultimaTexto: chat.ultimaMensagem || "Toque para abrir a conversa",
    ordem
  };
}

function renderizarCardConversa(conversa) {
  const ativa = conversa.id === window.chatAtualId ? "active" : "";
  const nome = conversa.outroNome || "Contato";
  const inicial = nome.charAt(0).toUpperCase();
  const preview = conversa.ultimaTexto || "Toque para abrir a conversa";

  const avatar = conversa.outroFoto
    ? `<img class="conversa-avatar conversa-foto" src="${conversa.outroFoto}" alt="${inicial}">`
    : `<div class="conversa-avatar">${inicial}</div>`;

  return `
    <div
      class="ride-card show conversa-card ${ativa}"
      role="button"
      tabindex="0"
      onclick="abrirChat('${conversa.id}', true)"
      onkeydown="if(event.key === 'Enter' || event.key === ' '){ event.preventDefault(); abrirChat('${conversa.id}', true); }"
    >
      ${avatar}
      <div class="conversa-info">
        <span class="conversa-nome">${inicial}${nome.slice(1)}</span>
        <span class="conversa-preview">${preview}</span>
      </div>
    </div>
  `;
}

function iniciarNotificacoes() {
  db.collection("solicitacoes")
    .where("motoristaId", "==", usuarioLogado.id)
    .where("status", "==", "pendente")
    .where("lida", "==", false)
    .onSnapshot(snapshot => {
      renderizarSidebar(snapshot.docs);
    });
}

async function renderizarSidebar(solicitacoes) {
  const sidebar = document.getElementById("rightSidebar");
  if (!sidebar) return;

  let html = `<h3>${ICONS.bell} Notificações</h3>`;

  if (!solicitacoes.length) {
    html += `<p>Nenhuma solicitação pendente</p>`;
  }

  solicitacoes.forEach(doc => {
    const s = doc.data();
    html += `
      <div class="notificacao-card">
        <b>${ICONS.car} Nova solicitação</b>
        <p>${escapeHtmlSidebar(s.passageiroNome)} quer entrar na carona</p>
        <div class="popup-actions">
          <button class="btn-primary" onclick="aceitarSolicitacao('${doc.id}', '${s.caronaId}')">
            Aprovar
          </button>
        </div>
      </div>
    `;
  });

  // Filtra chats apenas do usuário logado — evita buscar todos os chats do sistema
  const chats = await db.collection("chats")
    .where("participantes", "array-contains", usuarioLogado.id)
    .get();

  html += `<h3 style="margin-top:20px;">${ICONS.message} Mensagens</h3>`;

  // Busca última mensagem de cada chat via subcoleção
  const chatPromises = chats.docs.map(async doc => {
    const data = doc.data();
    const outroId = data.participantes?.find(id => id !== usuarioLogado.id);
    const outroNome = obterNomeContato(data, outroId);

    const ultimaSnap = await db
      .collection("chats").doc(doc.id)
      .collection("mensagens")
      .orderBy("criadoEm", "desc")
      .limit(1)
      .get();

    if (ultimaSnap.empty) return null;

    const ultima = ultimaSnap.docs[0].data();

    // Só mostra se a última mensagem for do outro e não lida
    if (ultima.lida || ultima.userId === usuarioLogado.id) return null;

    return { docId: doc.id, outroNome, texto: ultima.texto };
  });

  const resultados = await Promise.all(chatPromises);
  resultados.filter(Boolean).forEach(({ docId, outroNome, texto }) => {
    html += `
      <div class="notificacao-card">
        <b>${escapeHtmlSidebar(outroNome)}</b>
        <p>${escapeHtmlSidebar(texto)}</p>
        <button class="btn-secondary" onclick="abrirChat('${docId}')">Abrir Chat</button>
      </div>
    `;
  });

  sidebar.innerHTML = html;
}

async function carregarConversas() {
  const lista = document.getElementById("listaConversas");
  if (!lista) return;

  lista.innerHTML = "";

  // Filtra só os chats do usuário — não busca todos
  const chats = await db.collection("chats")
    .where("participantes", "array-contains", usuarioLogado.id)
    .get();

  const conversasBrutas = await Promise.all(chats.docs.map(montarResumoConversa));

  const conversas = conversasBrutas
    .filter(Boolean)
    .sort((a, b) => b.ordem - a.ordem);

  if (!conversas.length) {
    lista.innerHTML = `
      <div class="ride-card show">
        <b>Nenhuma conversa ainda</b>
        <p>Quando você falar com um motorista ou passageiro, o contato vai ficar salvo aqui.</p>
      </div>
    `;
    return;
  }

  lista.innerHTML = conversas.map(renderizarCardConversa).join("");
}

function escapeHtmlSidebar(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

window.iniciarNotificacoes = iniciarNotificacoes;
window.renderizarSidebar = renderizarSidebar;
window.carregarConversas = carregarConversas;
