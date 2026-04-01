let tipoFiltro = "todas";
let busca = "";
let feedUnsubscribe = null; // guarda o listener para cancelar antes de recriar

function carregarFeed() {
  // Cancela listener anterior antes de criar um novo (evita vazamento de memória)
  if (feedUnsubscribe) {
    feedUnsubscribe();
    feedUnsubscribe = null;
  }

  feedUnsubscribe = db.collection("caronas")
    .orderBy("criadoEm", "desc")
    .onSnapshot(snapshot => {
      const feed = document.getElementById("feed");
      if (!feed) {
        // Aba foi trocada, cancela o listener
        if (feedUnsubscribe) { feedUnsubscribe(); feedUnsubscribe = null; }
        return;
      }

      feed.innerHTML = "";

      const docsOrdenados = snapshot.docs.sort((a, b) => {
        const caronaA = a.data();
        const caronaB = b.data();

        const minhaA = caronaA.motoristaId === usuarioLogado.id;
        const minhaB = caronaB.motoristaId === usuarioLogado.id;

        if (minhaA && !minhaB) return -1;
        if (!minhaA && minhaB) return 1;

        const dataA = caronaA.criadoEm?.seconds || 0;
        const dataB = caronaB.criadoEm?.seconds || 0;

        return dataB - dataA;
      });

      docsOrdenados.forEach(doc => {
        const d = doc.data();

        if (d.status && d.status !== "aberta") return;
        if (tipoFiltro !== "todas" && d.tipo !== tipoFiltro) return;

        const texto = (
          (d.origemEndereco || "") + " " + (d.destinoEndereco || "")
        ).toLowerCase();

        if (!texto.includes(busca.toLowerCase())) return;

        // Escapa todos os dados vindos do Firestore antes de inserir no HTML
        const motoristaNome = escHtml(d.motorista || "Motorista");
        const origemTexto = escHtml(formatarEnderecoFeed(d.origemEndereco || ""));
        const destinoTexto = escHtml(formatarEnderecoFeed(d.destinoEndereco || ""));
        const descricaoTexto = escHtml(d.descricao || "Sem descrição");
        const tipoTexto = escHtml(d.tipo || "Oferta");
        const precoTexto = escHtml(String(d.preco || "5,00"));
        const ratingTexto = escHtml(String(d.rating || "5.0"));
        const inicial = escHtml((d.motorista || "?")[0]);
        const docId = escHtml(doc.id);
        const motoristaIdEsc = escHtml(d.motoristaId || "");
        const motoristaFotoEsc = escHtml(d.motoristaFoto || "");

        // Avatar do motorista (foto ou inicial)
        const avatarHTML = d.motoristaFoto
          ? `<img src="${motoristaFotoEsc}" alt="${motoristaNome}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
          : inicial;

        const div = document.createElement("div");
        div.className = "ride-card";
        div.dataset.tipo = d.tipo || "oferta";

        div.innerHTML = `
          <div class="ride-top">
            <div class="timeline">
              <div class="dot"></div>
              <div class="line"></div>
            </div>

            <div class="ride-info">
              <span class="time">${ICONS.car} Ativa</span>
              <h3>${origemTexto}</h3>
              <p class="destino">${destinoTexto}</p>
              <p class="descricao">${ICONS.message} ${descricaoTexto}</p>
            </div>
          </div>

          <div class="ride-driver">
            <div class="driver-left" style="cursor:pointer" onclick="verPerfilUsuario('${motoristaIdEsc}', '${motoristaNome}', '${motoristaFotoEsc}')" title="Ver perfil">
              <div class="avatar" style="overflow:hidden">${avatarHTML}</div>
              <div>
                <b class="driver-name-link">${motoristaNome}</b>
                <p class="rating">${ICONS.star} ${ratingTexto}</p>
              </div>
            </div>

            <div class="ride-meta">
              <span class="tag tag-${escHtml(d.tipo || 'oferta')}">${tipoTexto}</span>
              <span class="price">R$ ${precoTexto}</span>
            </div>
          </div>

          <div class="ride-footer">
            ${
              d.motoristaId !== usuarioLogado.id
                ? `<button class="btn-primary" onclick="solicitarCarona('${docId}')">Solicitar</button>`
                : `<button class="btn-secondary" onclick="verSolicitacoes('${docId}')">Ver Solicitações</button>`
            }

            <button class="btn-secondary" onclick="${
              d.motoristaId !== usuarioLogado.id
                ? `iniciarChatDaCarona('${docId}')`
                : `loadPage('mensagens')`
            }">
              ${d.motoristaId !== usuarioLogado.id ? "Mensagem" : "Mensagens"}
            </button>
          </div>

          ${
            d.motoristaId === usuarioLogado.id
              ? `
                <div class="popup-actions">
                  <button class="btn-primary" onclick="finalizarCarona('${docId}')">Concluir</button>
                  <button class="btn-secondary" onclick="cancelarCarona('${docId}')">Cancelar</button>
                </div>
              `
              : ""
          }
        `;

        feed.appendChild(div);
        setTimeout(() => div.classList.add("show"), 50);
      });
    });
}

// Escape para uso no feed
function escHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Formata endereço removendo "Brasil" e limpando espaços
function formatarEnderecoFeed(endereco) {
  if (!endereco) return "";
  return endereco
    .split(",")
    .map(p => p.trim())
    .filter(p => p && p.toLowerCase() !== "brasil")
    .join(", ");
}

// =====================
// FILTROS
// =====================
function setFiltro(tipo) {
  tipoFiltro = tipo;
  carregarFeed();
}

function setBusca(valor) {
  busca = valor;
  carregarFeed();
}

// =====================
// FINALIZAR / CANCELAR
// =====================
async function finalizarCarona(id) {
  try {
    await db.collection("caronas").doc(id).update({ status: "finalizada" });
    showToast("Carona concluída com sucesso!", "sucesso");
  } catch (error) {
    console.error(error);
    showToast("Não foi possível finalizar a carona.", "erro");
  }
}

async function cancelarCarona(id) {
  try {
    await db.collection("caronas").doc(id).update({ status: "cancelada" });
    showToast("Carona cancelada.", "info");
  } catch (error) {
    console.error(error);
    showToast("Não foi possível cancelar a carona.", "erro");
  }
}

// =====================
// AVALIAÇÃO
// =====================
async function avaliarMotorista(caronaId, nota) {
  const ref = db.collection("caronas").doc(caronaId);
  const doc = await ref.get();
  if (!doc.exists) return;

  const d = doc.data();
  const avaliacoes = d.avaliacoes || [];
  avaliacoes.push(nota);

  const media = avaliacoes.reduce((a, b) => a + b, 0) / avaliacoes.length;

  await ref.update({ avaliacoes, rating: media.toFixed(1) });
  showToast("Avaliação enviada! Obrigado.", "sucesso");
}

// =====================
// VER PERFIL DE OUTRO USUÁRIO
// =====================
async function verPerfilUsuario(uid, nomeInicial, fotoInicial) {
  // Remove modal anterior se existir
  document.getElementById("modalPerfilUsuario")?.remove();

  const modal = document.createElement("div");
  modal.id = "modalPerfilUsuario";
  modal.className = "popup";
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

  const avatarHTML = fotoInicial
    ? `<img src="${fotoInicial}" alt="${nomeInicial}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
    : (nomeInicial?.[0] || "?").toUpperCase();

  modal.innerHTML = `
    <div class="popup-box" style="max-width:380px;text-align:center;">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px;">
        <div class="avatar avatar-perfil" style="overflow:hidden;flex-shrink:0;">${avatarHTML}</div>
        <div style="text-align:left;">
          <h2 id="perfilModalNome" style="margin-bottom:4px;">${nomeInicial}</h2>
          <p id="perfilModalStatus" style="font-size:12px;color:var(--text-dim);">Carregando...</p>
        </div>
      </div>
      <div id="perfilModalInfo" class="perfil-card" style="padding:16px;text-align:left;">
        <div class="loading-shimmer" style="height:14px;border-radius:6px;margin-bottom:10px;"></div>
        <div class="loading-shimmer" style="height:14px;border-radius:6px;margin-bottom:10px;width:70%;"></div>
        <div class="loading-shimmer" style="height:14px;border-radius:6px;width:50%;"></div>
      </div>
      <button class="btn-secondary" onclick="document.getElementById('modalPerfilUsuario').remove()" style="margin-top:16px;">Fechar</button>
    </div>
  `;

  document.body.appendChild(modal);

  // Busca dados reais do Firebase
  try {
    const doc = await db.collection("usuarios").doc(uid).get();
    const info = document.getElementById("perfilModalInfo");
    const statusEl = document.getElementById("perfilModalStatus");
    const nomeEl = document.getElementById("perfilModalNome");

    if (!doc.exists) {
      if (info) info.innerHTML = `<p style="color:var(--text-muted)">Perfil não encontrado.</p>`;
      return;
    }

    const d = doc.data();
    if (nomeEl) nomeEl.textContent = d.nome || nomeInicial;
    if (statusEl) statusEl.textContent = "Membro da plataforma";

    const celularFormatado = d.celular ? formatarCelularExibicao(d.celular) : "—";

    if (info) info.innerHTML = `
      <p><b>Nome:</b> ${escHtml(d.nome || "—")}</p>
      <p><b>Curso:</b> ${escHtml(d.curso || "—")}</p>
      <p><b>Celular:</b> ${escHtml(celularFormatado)}</p>
    `;
  } catch (err) {
    console.error("Erro ao carregar perfil:", err);
    const info = document.getElementById("perfilModalInfo");
    if (info) info.innerHTML = `<p style="color:var(--red)">Não foi possível carregar o perfil.</p>`;
  }
}

function formatarCelularExibicao(cel) {
  const nums = String(cel).replace(/\D/g, '');
  if (nums.length === 11) return `(${nums.slice(0,2)}) ${nums.slice(2,7)}-${nums.slice(7)}`;
  if (nums.length === 10) return `(${nums.slice(0,2)}) ${nums.slice(2,6)}-${nums.slice(6)}`;
  return cel;
}

window.verPerfilUsuario = verPerfilUsuario;
window.carregarFeed = carregarFeed;
window.setFiltro = setFiltro;
window.setBusca = setBusca;
window.finalizarCarona = finalizarCarona;
window.cancelarCarona = cancelarCarona;
window.avaliarMotorista = avaliarMotorista;
