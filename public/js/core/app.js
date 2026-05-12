// ============================================================
// APP SHELL — inicialização, navegação e popup de nova carona
// ============================================================

(function bootstrap() {
  if (window.appStarted) return;
  window.appStarted = true;

  if (!window.usuarioLogado) {
    location.replace('index.html');
    return;
  }

  iniciarApp();
}());

// ── Shell ────────────────────────────────────────────────────

function iniciarApp() {
  document.getElementById('app').innerHTML = `
    <div class="layout">
      <aside class="sidebar">
        <div class="logo">
          ${ICONS.car} <span class="brand-name">Caronas Aqui</span>
        </div>

        <nav>
          <button onclick="loadPage('feed', this)" class="active" data-tooltip="Feed">
            ${ICONS.home} <span>Feed</span>
          </button>
          <button onclick="loadPage('minha-carona', this)" data-tooltip="Minha carona">
            ${ICONS.car} <span>Minha carona</span>
          </button>
          <button onclick="loadPage('mapa', this)" data-tooltip="Mapa">
            ${ICONS.map} <span>Mapa</span>
          </button>
          <button onclick="loadPage('mensagens', this)" data-tooltip="Mensagens">
            ${ICONS.message} <span>Mensagens</span>
          </button>
          <button id="btnNotifMobile" class="notif-mobile-btn" onclick="toggleNotifDrawer()" data-tooltip="Notificações">
            <span class="notif-bell-wrap">${ICONS.bell}<span id="notifBadge" class="notif-badge hidden">0</span></span>
            <span>Avisos</span>
          </button>
        </nav>

        <div class="user" onclick="loadPage('perfil')">
          ${criarAvatarHTML(usuarioLogado, 'user-avatar')}
          <span>${usuarioLogado.nome}</span>
        </div>
      </aside>

      <div class="main-area">
        <main id="content"></main>
        <aside id="rightSidebar" class="right-sidebar"></aside>
      </div>
    </div>
  `;

  loadPage('feed');
  iniciarNotificacoes();
}

// ── Drawer de Notificações (mobile) ─────────────────────────

function toggleNotifDrawer() {
  let drawer = document.getElementById('notifDrawer');
  if (!drawer) {
    drawer = document.createElement('div');
    drawer.id = 'notifDrawer';
    drawer.className = 'notif-drawer';
    drawer.innerHTML = `
      <div class="notif-drawer-header">
        <span>${ICONS.bell} Notificações</span>
        <button class="notif-drawer-close" onclick="fecharNotifDrawer()">✕</button>
      </div>
      <div id="notifDrawerContent" class="notif-drawer-content">
        <p style="color:var(--text-muted)">Carregando...</p>
      </div>
    `;
    document.body.appendChild(drawer);

    // Overlay para fechar ao clicar fora
    const overlay = document.createElement('div');
    overlay.id = 'notifOverlay';
    overlay.className = 'notif-overlay';
    overlay.onclick = fecharNotifDrawer;
    document.body.appendChild(overlay);
  }

  const isOpen = drawer.classList.contains('open');
  if (isOpen) {
    fecharNotifDrawer();
  } else {
    drawer.classList.add('open');
    document.getElementById('notifOverlay')?.classList.add('open');
    // Renderiza o conteúdo atual da rightSidebar no drawer
    const sidebarContent = document.getElementById('rightSidebar');
    const drawerContent  = document.getElementById('notifDrawerContent');
    if (sidebarContent && drawerContent) {
      drawerContent.innerHTML = sidebarContent.innerHTML || '<p style="color:var(--text-muted)">Nenhuma notificação</p>';
    }
  }
}

function fecharNotifDrawer() {
  document.getElementById('notifDrawer')?.classList.remove('open');
  document.getElementById('notifOverlay')?.classList.remove('open');
}

Object.assign(window, { toggleNotifDrawer, fecharNotifDrawer });

function loadPage(page, btn = null) {
  const content = document.getElementById('content');

  window.encerrarMinhaCaronaListener?.();
  if (page !== 'mapa') window.pararLocalizacaoCompleta?.();

  // Atualiza botão ativo na sidebar
  const botoesNav = document.querySelectorAll('.sidebar nav button');
  const indices   = { feed: 0, 'minha-carona': 1, mapa: 2, mensagens: 3 };
  botoesNav.forEach(b => b.classList.remove('active'));
  (btn || botoesNav[indices[page]])?.classList.add('active');

  const paginas = {
    feed:          renderFeed,
    'minha-carona': renderMinhaCarona,
    mapa:          renderMapa,
    mensagens:     renderMensagens,
    perfil:        renderPerfil,
  };

  paginas[page]?.(content);
}

// ── Páginas ──────────────────────────────────────────────────

function renderFeed(content) {
  content.innerHTML = `
    <div class="header">
      <h1>Mural de Caronas</h1>
      <button class="btn-primary" onclick="abrirPopup()">+ Nova Publicação</button>
    </div>
    <input placeholder="Buscar rotas..." oninput="setBusca(this.value)" class="search">
    <div id="feed" class="feed"></div>
  `;
  carregarFeed();
}

function renderMinhaCarona(content) {
  content.innerHTML = `
    <div class="header">
      <div>
        <h1>Minha carona</h1>
        <p class="my-ride-helper">Acompanhe sua carona ativa e o histórico abaixo.</p>
      </div>
    </div>
    <div id="minhaCaronaContainer" class="feed"></div>
  `;
  inicializarMinhaCarona();
}

function renderMapa(content) {
  content.innerHTML = `
    <div class="header"><h1>Mapa</h1></div>
    <div id="mapMain" class="map"></div>
  `;
  setTimeout(initMapMain, 100);
}

function renderMensagens(content) {
  content.innerHTML = `
    <div class="header"><h1>Mensagens</h1></div>
    <div class="mensagens-layout">
      <div class="mensagens-lista">
        <div id="listaConversas" class="feed"></div>
      </div>
      <div id="chatPanel" class="mensagens-chat">
        <div class="chat-placeholder">Selecione um contato para continuar a conversa ${ICONS.message}</div>
      </div>
    </div>
  `;
  carregarConversas();
}

function renderPerfil(content) {
  content.innerHTML = `
    <div class="header"><h1>Perfil</h1></div>
    <div class="perfil-card">
      <div class="perfil-topo">
        <div id="perfilFotoArea" class="perfil-foto-area">
          <div class="avatar-clickable" title="Clique para trocar ou remover a foto"
               onclick="toggleMenuFotoPerfil(event)">
            ${criarAvatarHTML(usuarioLogado, 'avatar-perfil', 'perfilAvatarPreview')}
          </div>
          <div id="menuFotoPerfil" class="menu-foto-perfil hidden">
            <button class="btn-secondary menu-foto-btn" onclick="abrirSeletorFotoPerfil()">Trocar foto</button>
            <button class="btn-secondary menu-foto-btn" onclick="removerFotoPerfil()">Remover foto</button>
          </div>
        </div>
        <div>
          <h2>${esc(usuarioLogado.nome || '')}</h2>
          <p>${esc(usuarioLogado.email || '')}</p>
        </div>
      </div>

      <input id="fotoPerfilInput" type="file" accept="image/*" hidden onchange="salvarFotoPerfil(event)">
      <p id="perfilFotoStatus" class="perfil-status">Clique na foto para abrir o menu.</p>

      <form class="profile-form" onsubmit="salvarDadosPerfil(event)">
        <div class="form-grid">
          <div>
            <label class="form-label" for="perfilNome">Nome</label>
            <input id="perfilNome" value="${esc(usuarioLogado.nome || '')}" autocomplete="name" required minlength="3">
          </div>
          <div>
            <label class="form-label" for="perfilEmail">Email</label>
            <input id="perfilEmail" value="${esc(usuarioLogado.email || '')}" autocomplete="email" inputmode="email">
          </div>
          <div>
            <label class="form-label" for="perfilCelular">Celular</label>
            <input id="perfilCelular" value="${esc(usuarioLogado.celular || '')}" autocomplete="tel" inputmode="tel">
          </div>
          <div>
            <label class="form-label" for="perfilFaculdade">Faculdade</label>
            <select id="perfilFaculdade" class="input-select"></select>
          </div>
        </div>
        <div class="profile-tags-field">
          <label class="form-label">Tags do perfil</label>
          <div id="perfilTagsOpcoes" class="profile-tags-options">
            ${renderTagsPerfilSelecionaveis(usuarioLogado.tags || [])}
          </div>
          <div id="perfilTagsPreview" class="profile-tags-preview">
            ${renderTagsPerfil(usuarioLogado.tags || [])}
          </div>
        </div>
        <p id="perfilFaculdadeInfo" class="field-hint"></p>
        <p class="field-hint">Matricula vinculada: final ${esc(usuarioLogado.matriculaLast4 || '----')}</p>
        <p id="perfilFormStatus" class="form-status" aria-live="polite"></p>
        <div class="popup-actions">
          <button id="btnSalvarPerfil" class="btn-primary" type="submit">Salvar perfil</button>
        </div>
      </form>
    </div>

    <div class="perfil-card">
      <h2>Seguranca</h2>
      <form class="profile-form" onsubmit="alterarSenhaPerfil(event)">
        <label class="form-label" for="senhaAtualPerfil">Senha atual</label>
        <input id="senhaAtualPerfil" type="password" autocomplete="current-password" required>

        <label class="form-label" for="novaSenhaPerfil">Nova senha</label>
        <input id="novaSenhaPerfil" type="password" autocomplete="new-password" minlength="8" required>

        <label class="form-label" for="confirmarNovaSenhaPerfil">Confirmar nova senha</label>
        <input id="confirmarNovaSenhaPerfil" type="password" autocomplete="new-password" minlength="8" required>

        <p id="senhaPerfilStatus" class="form-status" aria-live="polite"></p>
        <div class="popup-actions">
          <button id="btnAlterarSenha" class="btn-secondary" type="submit">Alterar senha</button>
        </div>
      </form>
    </div>
    <button class="btn-danger" onclick="logout()">Sair da conta</button>
  `;
  carregarPerfilAutenticado();
}

// ── Popup — Nova Carona ──────────────────────────────────────

function abrirPopup() {
  fecharPopup();

  const popup = document.createElement('div');
  popup.className = 'popup';
  popup.innerHTML = `
    <div class="popup-box popup-box-wide">
      <h2>Nova Carona</h2>

      <label class="form-label" for="faculdadeCarona">Faculdade</label>
      <select id="faculdadeCarona" class="input-select"></select>
      <p id="faculdadeCaronaInfo" class="field-hint"></p>
      <p id="faculdadeCaronaErro" class="field-error" aria-live="polite"></p>

      <label class="form-label" for="localPartidaCarona">Local de partida</label>
      <input id="localPartidaCarona" placeholder="Ex: Portao principal, bloco B ou ponto de onibus" maxlength="140">
      <p id="localPartidaErro" class="field-error" aria-live="polite"></p>

      <label class="form-label" for="descricaoCarona">Descricao</label>
      <input id="descricaoCarona" placeholder="Descrição da carona">

      <div class="popup-section">
        <p class="popup-label">Horário de saída</p>
        <input id="horarioCarona" type="time" class="input-time">
      </div>

      <div class="aviso-financeiro">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>Qualquer questão financeira deve ser combinada diretamente entre motorista e passageiro, fora da plataforma.</span>
      </div>

      <div class="popup-section">
        <p class="popup-label">Atalhos rápidos</p>
        <div class="popup-actions popup-actions-grid">
          <button class="btn-secondary" onclick="usarLocalAtual()">${ICONS.pin} Usar local atual</button>
          <button id="btnUsarFaculdade" class="btn-secondary" onclick="usarFaculdadeSelecionada()">${ICONS.graduation} Usar minha faculdade</button>
        </div>
      </div>

      <div class="popup-section">
        <p class="popup-label">Seleção manual no mapa</p>
        <div class="popup-actions popup-actions-grid">
          <button id="btnSelecionarOrigem"  class="btn-secondary manual-select-btn" onclick="definirOrigem()">${ICONS.circleGreen} Marcar origem</button>
          <button id="btnSelecionarDestino" class="btn-secondary manual-select-btn" onclick="definirDestino()">${ICONS.circleRed} Marcar destino</button>
        </div>
        <p id="modoSelecaoTxt" class="popup-hint">Clique no mapa para marcar a origem da carona.</p>
      </div>

      <div class="location-preview">
        <p id="origemTxt"  class="location-chip">Origem não definida</p>
        <p id="destinoTxt" class="location-chip">Destino não definido</p>
      </div>

      <div id="mapSelect" class="map"></div>

      <div class="popup-actions">
        <button class="btn-primary"    onclick="salvarCarona()">Publicar</button>
        <button class="btn-secondary"  onclick="fecharPopup()">Cancelar</button>
      </div>
    </div>
  `;

  document.body.appendChild(popup);
  popularSelectFaculdades(document.getElementById('faculdadeCarona'), usuarioLogado.faculdadeId || '');
  atualizarInfoFaculdadeCarona();
  document.getElementById('faculdadeCarona')?.addEventListener('change', atualizarInfoFaculdadeCarona);
  window.modo = 'origem';
  atualizarModoSelecao();
  setTimeout(initMapPopup, 100);
}

function fecharPopup() {
  document.querySelector('.popup')?.remove();
  if (window.mapaPopup) { window.mapaPopup.remove(); window.mapaPopup = null; }
  window.origem  = null;
  window.destino = null;
  window.modo    = null;
}

function atualizarModoSelecao() {
  const btnOrigem  = document.getElementById('btnSelecionarOrigem');
  const btnDestino = document.getElementById('btnSelecionarDestino');
  const texto      = document.getElementById('modoSelecaoTxt');
  if (!btnOrigem || !btnDestino || !texto) return;

  btnOrigem.classList.toggle('active',  window.modo === 'origem');
  btnDestino.classList.toggle('active', window.modo === 'destino');

  if (window.modo === 'origem')  { texto.innerText = 'Clique no mapa para marcar a origem da carona.'; return; }
  if (window.modo === 'destino') { texto.innerText = 'Agora clique no mapa para marcar o destino.';   return; }
  if (window.origem && window.destino) {
    texto.innerText = 'Origem e destino definidos. Use os botões acima para ajustar.';
    return;
  }
  texto.innerText = 'Escolha se deseja marcar origem ou destino manualmente.';
}

function definirOrigem()  { window.modo = 'origem';  atualizarModoSelecao(); }
function definirDestino() { window.modo = 'destino'; atualizarModoSelecao(); }

function atualizarInfoFaculdadeCarona() {
  const faculdade = obterFaculdadePorId(document.getElementById('faculdadeCarona')?.value || '');
  const info = document.getElementById('faculdadeCaronaInfo');
  if (info) info.textContent = faculdade ? `${faculdade.campus} - ${faculdade.endereco}` : '';

  const btn = document.getElementById('btnUsarFaculdade');
  if (btn) {
    btn.innerHTML = `${ICONS.graduation} Usar ${faculdade ? faculdade.nome : 'minha faculdade'}`;
  }
}

function sanitizarTextoLivre(valor) {
  return String(valor || "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function salvarCarona() {
  if (!window.origem || !window.destino) {
    showToast('Defina a origem e o destino no mapa.', 'aviso');
    return;
  }

  const ativa = await db.collection('caronas')
    .where('motoristaId', '==', usuarioLogado.id)
    .where('status', 'in', ['aberta', 'em_andamento', 'lotada', 'a_caminho', 'chegou'])
    .get();

  if (!ativa.empty) {
    showToast('Você já tem uma carona ativa. Finalize-a antes de criar outra.', 'aviso');
    return;
  }

  const partidaLivre = sanitizarTextoLivre(document.getElementById('localPartidaCarona')?.value || '');
  const faculdadeId = document.getElementById('faculdadeCarona')?.value || '';
  const dadosFaculdade = montarDadosFaculdade(faculdadeId);

  if (!dadosFaculdade) {
    const msg = 'Selecione uma faculdade valida.';
    const erro = document.getElementById('faculdadeCaronaErro');
    if (erro) erro.textContent = msg;
    showToast(msg, 'aviso');
    return;
  }

  if (partidaLivre.length < 3) {
    const msg = 'Informe o local de partida com ao menos 3 caracteres.';
    const erro = document.getElementById('localPartidaErro');
    if (erro) erro.textContent = msg;
    showToast(msg, 'aviso');
    return;
  }

  const descricao = sanitizarTextoLivre(document.getElementById('descricaoCarona').value);
  const horario   = document.getElementById('horarioCarona')?.value || '';

  const [origemEndereco, destinoEndereco] = await Promise.all([
    pegarEndereco(window.origem.lat, window.origem.lng),
    pegarEndereco(window.destino.lat, window.destino.lng),
  ]);

  const dist = calcularDistancia(
    window.origem.lat, window.origem.lng,
    window.destino.lat, window.destino.lng
  );

  await db.collection('caronas').add({
    motorista:      usuarioLogado.nome,
    motoristaFoto:  usuarioLogado.foto || '',
    motoristaTags:  normalizarTagsPerfil(usuarioLogado.tags || []),
    motoristaId:    usuarioLogado.id,
    descricao,
    horario,
    tipo:           'oferta',
    ...dadosFaculdade,
    vagas:          4,
    vagasTotais:    4,
    status:         'aberta',
    passageiros:    [],
    participantes:  [],
    origem:         { lat: window.origem.lat,  lng: window.origem.lng  },
    destino:        { lat: window.destino.lat, lng: window.destino.lng },
    partidaLivre,
    origemEndereco,
    destinoEndereco,
    distancia:      dist.toFixed(1),
    criadoEm:       firebase.firestore.FieldValue.serverTimestamp(),
  });

  fecharPopup();
  carregarFeed();
  showToast('Carona publicada com sucesso!', 'sucesso');
}

// ── Logout ───────────────────────────────────────────────────

function logout() {
  auth.signOut()
    .then(() => { localStorage.removeItem('user'); location.replace('index.html'); })
    .catch(() => showToast('Não foi possível sair da conta. Tente novamente.', 'erro'));
}

// ── Utilitário local ─────────────────────────────────────────

function _fmtCelular(cel) {
  const n = String(cel).replace(/\D/g, '');
  if (n.length === 11) return `(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0,2)}) ${n.slice(2,6)}-${n.slice(6)}`;
  return cel;
}

// ── Exports ──────────────────────────────────────────────────

Object.assign(window, {
  loadPage, abrirPopup, abrirCriarCarona: abrirPopup,
  fecharPopup, salvarCarona, atualizarModoSelecao,
  definirOrigem, definirDestino, logout,
});

pegarLocalizacao();
