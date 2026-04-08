// ============================================================
// SIDEBAR DIREITA — notificações de solicitações e mensagens
// ============================================================

// ── Notificações ─────────────────────────────────────────────

function iniciarNotificacoes() {
  db.collection('solicitacoes')
    .where('motoristaId', '==', usuarioLogado.id)
    .where('status',      '==', 'pendente')
    .where('lida',        '==', false)
    .onSnapshot(snapshot => renderizarSidebar(snapshot.docs));
}

async function renderizarSidebar(solicitacoes) {
  const sidebar = document.getElementById('rightSidebar');
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
        <p>${esc(s.passageiroNome)} quer entrar na carona</p>
        <div class="popup-actions">
          <button class="btn-primary"   onclick="aceitarSolicitacao('${doc.id}','${s.caronaId}')">Aprovar</button>
          <button class="btn-secondary" onclick="recusarSolicitacao('${doc.id}')">Recusar</button>
        </div>
      </div>
    `;
  });

  // Mensagens não lidas
  const chats = await db.collection('chats')
    .where('participantes', 'array-contains', usuarioLogado.id)
    .get();

  html += `<h3 style="margin-top:20px;">${ICONS.message} Mensagens</h3>`;

  const naoLidas = (await Promise.all(
    chats.docs.map(async doc => {
      const data    = doc.data();
      const outroId = data.participantes?.find(id => id !== usuarioLogado.id);
      const nome    = data.nomes?.[outroId] || 'Usuário';

      const snap = await db.collection('chats').doc(doc.id)
        .collection('mensagens').orderBy('criadoEm', 'desc').limit(1).get();
      if (snap.empty) return null;

      const ultima = snap.docs[0].data();
      if (ultima.lida || ultima.userId === usuarioLogado.id) return null;

      return { chatId: doc.id, nome, texto: ultima.texto };
    })
  )).filter(Boolean);

  if (!naoLidas.length) {
    html += `<p>Nenhuma mensagem nova</p>`;
  }

  naoLidas.forEach(({ chatId, nome, texto }) => {
    html += `
      <div class="notificacao-card">
        <b>${esc(nome)}</b>
        <p>${esc(texto)}</p>
        <button class="btn-secondary" onclick="abrirChat('${chatId}')">Abrir Chat</button>
      </div>
    `;
  });

  sidebar.innerHTML = html;
}

// ── Lista de conversas (aba Mensagens) ───────────────────────

async function carregarConversas() {
  const lista = document.getElementById('listaConversas');
  if (!lista) return;

  lista.innerHTML = '';

  const chats = await db.collection('chats')
    .where('participantes', 'array-contains', usuarioLogado.id)
    .get();

  const conversas = (await Promise.all(chats.docs.map(_montarConversa)))
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

  lista.innerHTML = conversas.map(_cardConversa).join('');
}

async function _montarConversa(doc) {
  const chat    = doc.data();
  if (!chat.participantes?.includes(usuarioLogado.id)) return null;

  const outroId = chat.participantes.find(id => id !== usuarioLogado.id);
  let nome = chat.nomes?.[outroId] || 'Usuário';
  let foto = chat.fotos?.[outroId] || '';

  if (outroId) {
    try {
      const u = await db.collection('usuarios').doc(outroId).get();
      if (u.exists) { nome = u.data().nome || nome; foto = u.data().foto || foto; }
    } catch { /* silencioso */ }
  }

  return {
    id: doc.id,
    nome,
    foto,
    preview: chat.ultimaMensagem || 'Toque para abrir a conversa',
    ordem:   chat.atualizadoEm?.seconds || 0,
  };
}

function _cardConversa(c) {
  const ativa   = c.id === window.chatAtualId ? 'active' : '';
  const inicial = (c.nome || 'C')[0].toUpperCase();
  const avatar  = c.foto
    ? `<img class="conversa-avatar conversa-foto" src="${c.foto}" alt="${inicial}">`
    : `<div class="conversa-avatar">${inicial}</div>`;

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

// ── Exports ──────────────────────────────────────────────────

Object.assign(window, { iniciarNotificacoes, renderizarSidebar, carregarConversas });
