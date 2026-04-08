// ============================================================
// FEED — listagem e ações sobre caronas
// ============================================================

let busca         = '';
let feedUnsubscribe = null;

// ── Carregamento ─────────────────────────────────────────────

function carregarFeed() {
  if (feedUnsubscribe) { feedUnsubscribe(); feedUnsubscribe = null; }

  feedUnsubscribe = db.collection('caronas')
    .orderBy('criadoEm', 'desc')
    .onSnapshot(snapshot => {
      const feed = document.getElementById('feed');
      if (!feed) { if (feedUnsubscribe) { feedUnsubscribe(); feedUnsubscribe = null; } return; }

      feed.innerHTML = '';

      // Caronas do usuário primeiro, depois por data
      const docs = snapshot.docs.slice().sort((a, b) => {
        const dA = a.data(), dB = b.data();
        const minhaA = dA.motoristaId === usuarioLogado.id;
        const minhaB = dB.motoristaId === usuarioLogado.id;
        if (minhaA !== minhaB) return minhaA ? -1 : 1;
        return (dB.criadoEm?.seconds || 0) - (dA.criadoEm?.seconds || 0);
      });

      docs.forEach(doc => {
        const d = doc.data();

        if (d.status && d.status !== 'aberta') return;
        const texto = ((d.origemEndereco || '') + ' ' + (d.destinoEndereco || '')).toLowerCase();
        if (!texto.includes(busca.toLowerCase())) return;

        const card = _criarCardCarona(doc.id, d);
        feed.appendChild(card);
        setTimeout(() => card.classList.add('show'), 50);
      });
    });
}

function _criarCardCarona(id, d) {
  const eh = esc;
  const ehMeu = d.motoristaId === usuarioLogado.id;

  // Todas as strings calculadas antes do template — evita backtick aninhado
  const docId         = eh(id);
  const motoristaNome = eh(d.motorista || 'Motorista');
  const motoristaId   = eh(d.motoristaId || '');
  const motoristaFoto = eh(d.motoristaFoto || '');
  const origemTexto   = eh(_fmtEndereco(d.origemEndereco));
  const destinoTexto  = eh(_fmtEndereco(d.destinoEndereco));
  const descricao     = eh(d.descricao || 'Sem descrição');
  const horario       = d.horario ? ' · ' + eh(d.horario) : '';

  const avatar = d.motoristaFoto
    ? '<img src="' + motoristaFoto + '" alt="' + motoristaNome + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">'
    : eh((d.motorista || '?')[0]);

  // Botões calculados antecipadamente
  const btnSolicitar = ehMeu
    ? ''
    : '<button class="btn-primary" onclick="solicitarCarona(\'' + docId + '\')">Solicitar</button>';

  const onclickChat = ehMeu ? "loadPage('mensagens')" : "iniciarChatDaCarona('" + docId + "')";
  const labelChat   = ehMeu ? 'Mensagens' : 'Mensagem';

  const acoesMotorista = ehMeu
    ? '<div class="popup-actions">'
      + '<button class="btn-primary" onclick="finalizarCarona(\'' + docId + '\')">Concluir</button>'
      + '<button class="btn-secondary" onclick="cancelarCarona(\'' + docId + '\')">Cancelar</button>'
      + '</div>'
    : '';

  const div = document.createElement('div');
  div.className    = 'ride-card';

  div.innerHTML = `
    <div class="ride-top">
      <div class="timeline">
        <div class="dot"></div>
        <div class="line"></div>
      </div>
      <div class="ride-info">
        <span class="time">${ICONS.car} Ativa${horario}</span>
        <h3>${origemTexto}</h3>
        <p class="destino">${destinoTexto}</p>
        <p class="descricao">${ICONS.message} ${descricao}</p>
      </div>
    </div>

    <div class="ride-driver">
      <div class="driver-left" style="cursor:pointer"
           onclick="verPerfilUsuario('${motoristaId}','${motoristaNome}','${motoristaFoto}')"
           title="Ver perfil">
        <div class="avatar" style="overflow:hidden">${avatar}</div>
        <div>
          <b class="driver-name-link">${motoristaNome}</b>
        </div>
      </div>

    </div>

    <div class="ride-footer">
      ${btnSolicitar}
      <button class="btn-secondary" onclick="${onclickChat}">${labelChat}</button>
    </div>

    ${acoesMotorista}
  `;

  return div;
}

// ── Filtros ──────────────────────────────────────────────────

function setBusca(valor) { busca = valor;      carregarFeed(); }

// ── Ações ────────────────────────────────────────────────────

async function finalizarCarona(id) {
  try {
    await db.collection('caronas').doc(id).update({ status: 'finalizada' });
    showToast('Carona concluída com sucesso!', 'sucesso');
  } catch (e) {
    console.error(e);
    showToast('Não foi possível finalizar a carona.', 'erro');
  }
}

async function cancelarCarona(id) {
  try {
    await db.collection('caronas').doc(id).update({ status: 'cancelada' });
    showToast('Carona cancelada.', 'info');
  } catch (e) {
    console.error(e);
    showToast('Não foi possível cancelar a carona.', 'erro');
  }
}

// ── Modal de perfil ──────────────────────────────────────────

async function verPerfilUsuario(uid, nomeInicial, fotoInicial) {
  document.getElementById('modalPerfilUsuario')?.remove();

  const modal = document.createElement('div');
  modal.id        = 'modalPerfilUsuario';
  modal.className = 'popup';
  modal.onclick   = e => { if (e.target === modal) modal.remove(); };

  const avatar = fotoInicial
    ? '<img src="' + fotoInicial + '" alt="' + nomeInicial + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">'
    : (nomeInicial?.[0] || '?').toUpperCase();

  modal.innerHTML = `
    <div class="popup-box" style="max-width:380px;text-align:center;">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px;">
        <div class="avatar avatar-perfil" style="overflow:hidden;flex-shrink:0;">${avatar}</div>
        <div style="text-align:left;">
          <h2 id="perfilModalNome" style="margin-bottom:4px;">${esc(nomeInicial)}</h2>
          <p id="perfilModalStatus" style="font-size:12px;color:var(--text-dim);">Carregando...</p>
        </div>
      </div>
      <div id="perfilModalInfo" class="perfil-card" style="padding:16px;text-align:left;">
        <div class="loading-shimmer" style="height:14px;border-radius:6px;margin-bottom:10px;"></div>
        <div class="loading-shimmer" style="height:14px;border-radius:6px;margin-bottom:10px;width:70%;"></div>
        <div class="loading-shimmer" style="height:14px;border-radius:6px;width:50%;"></div>
      </div>
      <button class="btn-secondary" onclick="document.getElementById('modalPerfilUsuario').remove()"
              style="margin-top:16px;">Fechar</button>
    </div>
  `;
  document.body.appendChild(modal);

  try {
    const snap = await db.collection('usuarios').doc(uid).get();
    const info = document.getElementById('perfilModalInfo');
    if (!snap.exists) {
      info.innerHTML = '<p style="color:var(--text-muted)">Perfil não encontrado.</p>';
      return;
    }
    const data = snap.data();
    document.getElementById('perfilModalNome').textContent   = data.nome || nomeInicial;
    document.getElementById('perfilModalStatus').textContent = 'Membro da plataforma';
    info.innerHTML = '<p><b>Nome:</b> ' + esc(data.nome || '—') + '</p>'
      + '<p><b>Curso:</b> ' + esc(data.curso || '—') + '</p>'
      + '<p><b>Celular:</b> ' + esc(data.celular || '—') + '</p>';
  } catch (e) {
    console.error(e);
    const info = document.getElementById('perfilModalInfo');
    if (info) info.innerHTML = '<p style="color:var(--red)">Não foi possível carregar o perfil.</p>';
  }
}

// ── Utilitários ──────────────────────────────────────────────

function _fmtEndereco(end) {
  return (end || '').split(',').map(p => p.trim())
    .filter(p => p && p.toLowerCase() !== 'brasil').join(', ');
}

// ── Exports ──────────────────────────────────────────────────

Object.assign(window, {
  carregarFeed, setBusca,
  finalizarCarona, cancelarCarona,
  verPerfilUsuario,
});
