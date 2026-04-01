(function () {
  if (window.appStarted) return;
  window.appStarted = true;

  if (!window.usuarioLogado) {
    location.replace("index.html");
    return;
  }

  iniciarApp();
})();

// ============================================================
// APP SHELL
// ============================================================

function iniciarApp() {
  document.getElementById("app").innerHTML = `
    <div class="layout">
      <aside class="sidebar">
        <div class="logo">
          ${ICONS.car} <span class="brand-name">Caronas Aqui</span>
        </div>

        <nav>
          <button onclick="loadPage('feed', this)"        class="active"  data-tooltip="Feed">${ICONS.home} <span>Feed</span></button>
          <button onclick="loadPage('minha-carona', this)"                data-tooltip="Minha carona">${ICONS.car} <span>Minha carona</span></button>
          <button onclick="loadPage('mapa', this)"                        data-tooltip="Mapa">${ICONS.map} <span>Mapa</span></button>
          <button onclick="loadPage('mensagens', this)"                   data-tooltip="Mensagens">${ICONS.message} <span>Mensagens</span></button>
        </nav>

        <div class="user" onclick="loadPage('perfil')">
          ${criarAvatarHTML(usuarioLogado, "user-avatar")}
          <span>${usuarioLogado.nome}</span>
        </div>
      </aside>

      <div class="main-area">
        <main id="content"></main>
        <aside id="rightSidebar" class="right-sidebar"></aside>
      </div>
    </div>
  `;

  loadPage("feed");
  iniciarNotificacoes();
}

// ============================================================
// NAVEGAÇÃO
// ============================================================

function loadPage(page, btn = null) {
  const content = document.getElementById("content");

  window.encerrarMinhaCaronaListener?.();

  // Para listeners de localização de passageiros ao sair do mapa
  if (page !== "mapa") {
    window.pararLocalizacaoCompleta?.();
  }

  // Marca botão ativo
  const botoesNav = document.querySelectorAll(".sidebar nav button");
  const indicePorPagina = { feed: 0, "minha-carona": 1, mapa: 2, mensagens: 3 };

  botoesNav.forEach(b => b.classList.remove("active"));
  const botaoAtivo = btn || botoesNav[indicePorPagina[page]];
  if (botaoAtivo) botaoAtivo.classList.add("active");

  const paginas = {
    feed: renderFeed,
    "minha-carona": renderMinhaCarona,
    mapa: renderMapa,
    mensagens: renderMensagens,
    perfil: renderPerfil,
  };

  const render = paginas[page];
  if (render) render(content);
}

// ============================================================
// PÁGINAS
// ============================================================

function renderFeed(content) {
  content.innerHTML = `
    <div class="header">
      <h1>Mural de Caronas</h1>
      <button class="btn-primary" onclick="abrirPopup()">+ Nova Publicação</button>
    </div>

    <div class="filtros">
      <button onclick="setFiltro('todas')">Todas</button>
      <button onclick="setFiltro('oferta')">Ofertas</button>
      <button onclick="setFiltro('pedido')">Pedidos</button>
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
            ${criarAvatarHTML(usuarioLogado, "avatar-perfil", "perfilAvatarPreview")}
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
      <p><b>Celular:</b> ${formatarCelularExibicaoApp(usuarioLogado.celular || "—")}</p>
      <p><b>Curso:</b> ${usuarioLogado.curso || "—"}</p>
    </div>
    <button class="btn-secondary" onclick="logout()">Sair da conta</button>
  `;
}

// ============================================================
// POPUP NOVA CARONA
// ============================================================

function abrirPopup() {
  fecharPopup();

  const popup = document.createElement("div");
  popup.className = "popup";

  popup.innerHTML = `
    <div class="popup-box popup-box-wide">
      <h2>Nova Carona</h2>

      <input id="descricaoCarona" placeholder="Descrição da carona">

      <div class="popup-section">
        <div class="cobrar-toggle-row">
          <label class="cobrar-label">
            ${ICONS.dollar}
            <span>Cobrar pela carona?</span>
          </label>
          <button id="btnCobrar" class="toggle-cobrar active" onclick="toggleCobrar()">
            <span class="toggle-thumb"></span>
          </button>
        </div>
        <div id="precoSection">
          <input id="precoCarona" placeholder="Preço (opcional — será calculado se vazio)">
        </div>
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
          <button id="btnSelecionarOrigem" class="btn-secondary manual-select-btn" onclick="definirOrigem()">${ICONS.circleGreen} Marcar origem</button>
          <button id="btnSelecionarDestino" class="btn-secondary manual-select-btn" onclick="definirDestino()">${ICONS.circleRed} Marcar destino</button>
        </div>
        <p id="modoSelecaoTxt" class="popup-hint">Clique no mapa para marcar a origem da carona.</p>
      </div>

      <div class="location-preview">
        <p id="origemTxt" class="location-chip">Origem não definida</p>
        <p id="destinoTxt" class="location-chip">Destino não definido</p>
      </div>

      <div id="mapSelect" class="map"></div>

      <div class="popup-actions">
        <button class="btn-primary" onclick="salvarCarona()">Publicar</button>
        <button class="btn-secondary" onclick="fecharPopup()">Cancelar</button>
      </div>
    </div>
  `;

  document.body.appendChild(popup);

  window.modo = "origem";
  atualizarModoSelecao();
  setTimeout(initMapPopup, 100);
}

function toggleCobrar() {
  const btn = document.getElementById("btnCobrar");
  const precoSection = document.getElementById("precoSection");
  const isActive = btn.classList.contains("active");

  if (isActive) {
    btn.classList.remove("active");
    precoSection.style.display = "none";
    document.getElementById("precoCarona") && (document.getElementById("precoCarona").value = "");
  } else {
    btn.classList.add("active");
    precoSection.style.display = "";
  }
}

function atualizarModoSelecao() {
  const btnOrigem  = document.getElementById("btnSelecionarOrigem");
  const btnDestino = document.getElementById("btnSelecionarDestino");
  const texto      = document.getElementById("modoSelecaoTxt");

  if (!btnOrigem || !btnDestino || !texto) return;

  btnOrigem.classList.toggle("active", window.modo === "origem");
  btnDestino.classList.toggle("active", window.modo === "destino");

  if (window.modo === "origem")  { texto.innerText = "Clique no mapa para marcar a origem da carona."; return; }
  if (window.modo === "destino") { texto.innerText = "Agora clique no mapa para marcar o destino."; return; }

  if (window.origem && window.destino) {
    texto.innerText = "Origem e destino definidos. Use os botões acima para ajustar.";
    return;
  }

  texto.innerText = "Escolha se deseja marcar origem ou destino manualmente.";
}

function definirOrigem()  { window.modo = "origem";  atualizarModoSelecao(); }
function definirDestino() { window.modo = "destino"; atualizarModoSelecao(); }

function fecharPopup() {
  document.querySelector(".popup")?.remove();

  if (window.mapaPopup) {
    window.mapaPopup.remove();
    window.mapaPopup = null;
  }

  window.origem  = null;
  window.destino = null;
  window.modo    = null;
}

async function salvarCarona() {
  if (!window.origem || !window.destino) {
    showToast("Defina a origem e o destino no mapa.", "aviso");
    return;
  }

  const existente = await db.collection("caronas")
    .where("motoristaId", "==", usuarioLogado.id)
    .where("status", "in", ["aberta", "em_andamento", "lotada", "a_caminho", "chegou"])
    .get();

  if (!existente.empty) {
    showToast("Você já tem uma carona ativa. Finalize-a antes de criar outra.", "aviso");
    return;
  }

  const descricao = document.getElementById("descricaoCarona").value.trim();
  const precoInput = document.getElementById("precoCarona")?.value?.trim() || "";
  const cobrar = document.getElementById("btnCobrar")?.classList.contains("active") ?? true;

  const [origemEndereco, destinoEndereco] = await Promise.all([
    pegarEndereco(window.origem.lat, window.origem.lng),
    pegarEndereco(window.destino.lat, window.destino.lng),
  ]);

  const dist  = calcularDistancia(window.origem.lat, window.origem.lng, window.destino.lat, window.destino.lng);
  const preco = cobrar ? (precoInput || calcularPreco(dist)) : "0";
  const tipo  = cobrar ? "oferta" : "pedido";

  await db.collection("caronas").add({
    motorista:     usuarioLogado.nome,
    motoristaNome: usuarioLogado.nome,
    motoristaFoto: usuarioLogado.foto || "",
    motoristaId:   usuarioLogado.id,

    descricao,
    preco,
    tipo,
    vagas:         4,
    vagasTotais:   4,
    status:        "aberta",
    passageiros:   [],
    participantes: [],

    origem:  { lat: window.origem.lat, lng: window.origem.lng },
    destino: { lat: window.destino.lat, lng: window.destino.lng },

    origemEndereco,
    destinoEndereco,
    origemTexto:  origemEndereco,
    destinoTexto: destinoEndereco,
    distancia:    dist.toFixed(1),

    criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
  });

  fecharPopup();
  carregarFeed();

  if (!cobrar) {
    // Muda filtro para "pedido" para o usuário ver a própria publicação
    setFiltro("pedido");
  }

  showToast(`Carona publicada com sucesso`, "sucesso");
}

// ============================================================
// LOGOUT
// ============================================================

function logout() {
  auth.signOut()
    .then(() => {
      localStorage.removeItem("user");
      location.replace("index.html");
    })
    .catch(err => {
      console.error("Erro ao sair:", err);
      showToast("Não foi possível sair da conta. Tente novamente.", "erro");
    });
}

// ============================================================
// GLOBALS
// ============================================================

window.logout             = logout;
window.loadPage           = loadPage;
window.abrirPopup         = abrirPopup;
window.abrirCriarCarona   = abrirPopup;
window.fecharPopup        = fecharPopup;
window.salvarCarona       = salvarCarona;
window.atualizarModoSelecao = atualizarModoSelecao;
window.definirOrigem      = definirOrigem;
window.definirDestino     = definirDestino;
window.toggleCobrar       = toggleCobrar;

function formatarCelularExibicaoApp(cel) {
  const nums = String(cel).replace(/\D/g, '');
  if (nums.length === 11) return `(${nums.slice(0,2)}) ${nums.slice(2,7)}-${nums.slice(7)}`;
  if (nums.length === 10) return `(${nums.slice(0,2)}) ${nums.slice(2,6)}-${nums.slice(6)}`;
  return cel;
}

pegarLocalizacao();
