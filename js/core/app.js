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
          <h2>${usuarioLogado.nome}</h2>
          <p>${usuarioLogado.email}</p>
        </div>
      </div>

      <input id="fotoPerfilInput" type="file" accept="image/*" hidden onchange="salvarFotoPerfil(event)">
      <p id="perfilFotoStatus" class="perfil-status">Clique na foto para abrir o menu.</p>

      <p><b>Nome:</b> ${usuarioLogado.nome}</p>
      <p><b>Email:</b> ${usuarioLogado.email}</p>
      <p><b>Celular:</b> ${_fmtCelular(usuarioLogado.celular || '—')}</p>
      <p><b>Curso:</b> ${usuarioLogado.curso || '—'}</p>
    </div>
    <button class="btn-secondary" onclick="logout()">Sair da conta</button>
  `;
}

// ── Popup — Nova Carona ──────────────────────────────────────

function abrirPopup() {
  fecharPopup();

  const popup = document.createElement('div');
  popup.className = 'popup';
  popup.innerHTML = `
    <div class="popup-box popup-box-wide">
      <h2>Nova Carona</h2>

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
          <button class="btn-secondary" onclick="usarDomBosco()">${ICONS.graduation} Usar Dom Bosco</button>
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

  const descricao = document.getElementById('descricaoCarona').value.trim();
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
    motoristaId:    usuarioLogado.id,
    descricao,
    horario,
    tipo:           'oferta',
    vagas:          4,
    vagasTotais:    4,
    status:         'aberta',
    passageiros:    [],
    participantes:  [],
    origem:         { lat: window.origem.lat,  lng: window.origem.lng  },
    destino:        { lat: window.destino.lat, lng: window.destino.lng },
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
