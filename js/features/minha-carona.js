window.minhaCaronaUnsubscribe = null;
window.minhasCaronasCache = [];
window.minhaCaronaHistoricoExpandido = {};

const STATUS_CARONA_LABELS = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  lotada: "Lotada",
  a_caminho: "A caminho",
  chegou: "Chegou",
  finalizada: "Finalizada",
  cancelada: "Cancelada"
};

const STATUS_CARONA_ICONES = {
  aberta: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2ecc71" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`,
  em_andamento: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17H3a2 2 0 0 1-2-2V9l3-5h14l3 5v6a2 2 0 0 1-2 2h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/></svg>`,
  lotada: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  a_caminho: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
  chegou: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  finalizada: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  cancelada: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#e55" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
};

const STATUS_CARONA_HISTORICO = ["finalizada", "cancelada"];

function encerrarMinhaCaronaListener() {
  if (typeof window.minhaCaronaUnsubscribe === "function") {
    window.minhaCaronaUnsubscribe();
    window.minhaCaronaUnsubscribe = null;
  }
}

function inicializarMinhaCarona() {
  const container = document.getElementById("minhaCaronaContainer");

  if (!container || !window.usuarioLogado?.id) return;

  encerrarMinhaCaronaListener();
  renderMinhaCaronaLoading();

  try {
    const query = db.collection("caronas")
      .where("motoristaId", "==", usuarioLogado.id);

    window.minhaCaronaUnsubscribe = query.onSnapshot(
      snapshot => {
        const area = document.getElementById("minhaCaronaContainer");
        if (!area) return;

        const caronas = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        const caronasOrdenadas = ordenarMinhasCaronas(caronas);
        window.minhasCaronasCache = caronasOrdenadas;

        if (!caronasOrdenadas.length) {
          renderMinhaCaronaVazia();
          return;
        }

        renderListaMinhasCaronas(caronasOrdenadas);
      },
      error => {
        console.error("Erro ao ouvir minhas caronas:", error);
        renderMinhaCaronaErro("Não foi possível carregar suas caronas agora.");
      }
    );
  } catch (error) {
    console.error("Erro ao inicializar aba Minha carona:", error);
    renderMinhaCaronaErro("Não foi possível abrir a aba Minha carona.");
  }
}

function renderMinhaCaronaLoading() {
  const container = document.getElementById("minhaCaronaContainer");
  if (!container) return;

  container.innerHTML = `
    <div class="ride-card minha-carona-card">
      <p class="my-ride-helper">Carregando suas caronas...</p>
    </div>
  `;
}

function renderMinhaCaronaVazia() {
  const container = document.getElementById("minhaCaronaContainer");
  if (!container) return;

  container.innerHTML = `
    <div class="ride-card minha-carona-card empty-my-ride">
      <h2>Você ainda não criou uma carona</h2>
      <p>Publique uma nova rota para começar a receber passageiros.</p>
      <div class="popup-actions">
        <button class="btn-primary" onclick="abrirCriarCarona()">
          Criar carona
        </button>
      </div>
    </div>
  `;
}

function renderMinhaCaronaErro(mensagem) {
  const container = document.getElementById("minhaCaronaContainer");
  if (!container) return;

  container.innerHTML = `
    <div class="ride-card minha-carona-card empty-my-ride">
      <h2>Ops! Algo deu errado</h2>
      <p>${esc(mensagem || "Tente novamente em instantes.")}</p>
      <div class="popup-actions">
        <button class="btn-secondary" onclick="inicializarMinhaCarona()">
          Tentar novamente
        </button>
      </div>
    </div>
  `;
}

function renderListaMinhasCaronas(caronas) {
  const container = document.getElementById("minhaCaronaContainer");
  if (!container) return;

  const caronasAtivas = caronas.filter(carona => !isCaronaHistorico(carona));
  const historico = caronas.filter(carona => isCaronaHistorico(carona));

  container.innerHTML = `
    <div class="my-ride-stack">
      ${caronasAtivas.length ? `
        <section class="my-ride-section">
          <div class="my-ride-section-title">
            <h3>Carona atual</h3>
            <span class="tag">${caronasAtivas.length} ativa(s)</span>
          </div>
          ${caronasAtivas.map(carona => renderCardMinhaCarona(carona)).join("")}
        </section>
      ` : renderBlocoSemCaronaAtiva(Boolean(historico.length))}

      ${historico.length ? `
        <section class="my-ride-section">
          <div class="my-ride-section-title">
            <h3>Histórico de caronas</h3>
            <span class="tag">${historico.length} registro(s)</span>
          </div>
          ${historico.map(carona => renderCardMinhaCarona(carona, { compacta: true })).join("")}
        </section>
      ` : ""}
    </div>
  `;
}

function renderBlocoSemCaronaAtiva(possuiHistorico) {
  return `
    <div class="ride-card minha-carona-card empty-my-ride">
      <h2>Você não possui uma carona ativa agora</h2>
      <p>${possuiHistorico
        ? "Sua última carona ficou salva como registro logo abaixo."
        : "Publique uma nova rota para começar a receber passageiros."}</p>
      <div class="popup-actions">
        <button class="btn-primary" onclick="abrirCriarCarona()">
          Criar carona
        </button>
      </div>
    </div>
  `;
}

function renderCardMinhaCarona(carona, options = {}) {
  const compacta = Boolean(options.compacta);
  const dados = obterDadosMinhaCarona(carona);

  if (compacta) {
    const expandida = Boolean(window.minhaCaronaHistoricoExpandido?.[dados.caronaId]);

    return `
      <div class="ride-card minha-carona-card my-ride-history-card">
        <div class="my-ride-history-top">
          <div>
            <p class="my-ride-helper">Registro encerrado</p>
            <h3>${esc(dados.origem)} <span class="history-arrow">→</span> ${esc(dados.destino)}</h3>
            <p>${dados.passageiros.length} passageiro(s) • ${esc(formatarDataCarona(dados.carona.finalizadoEm || dados.carona.criadoEm))}</p>
          </div>

          <div class="my-ride-history-actions">
            <span class="status-badge status-${dados.status}">
              ${STATUS_CARONA_ICONES[dados.status] || "🚗"} ${STATUS_CARONA_LABELS[dados.status] || dados.status}
            </span>

            <button
              class="btn-secondary btn-small"
              onclick="toggleDetalhesMinhaCaronaHistorico('${dados.caronaId}')"
            >
              ${expandida ? "Ocultar detalhes" : "Ver detalhes"}
            </button>
          </div>
        </div>

        ${expandida ? `
          <div class="my-ride-history-body">
            ${renderDetalhesMinhaCarona(dados)}
          </div>
        ` : ""}
      </div>
    `;
  }

  return `
    <div class="ride-card minha-carona-card">
      <div class="my-ride-header">
        <div>
          <p class="my-ride-helper">Sua carona em tempo real</p>
          <h2>${esc(dados.origem)}</h2>
          <p class="destino">Destino: ${esc(dados.destino)}</p>
        </div>

        <span class="status-badge status-${dados.status}">
          ${STATUS_CARONA_ICONES[dados.status] || "🚗"} ${STATUS_CARONA_LABELS[dados.status] || dados.status}
        </span>
      </div>

      ${renderDetalhesMinhaCarona(dados)}
      ${renderAcoesMinhaCarona(dados.caronaId, dados.status)}
    </div>
  `;
}

function obterDadosMinhaCarona(carona) {
  const status = carona.status || "aberta";
  const passageiros = normalizarPassageiros(carona);
  const vagasRestantes = obterVagasRestantes(carona, passageiros.length);
  const motoristaNome = carona.motoristaNome || carona.motorista || usuarioLogado.nome || "Motorista";
  const motoristaFoto = carona.motoristaFoto || usuarioLogado.foto || "";
  const origem = formatarEnderecoCarona(carona, "origem");
  const destino = formatarEnderecoCarona(carona, "destino");

  return {
    carona,
    caronaId: carona.id,
    status,
    passageiros,
    vagasRestantes,
    motoristaNome,
    motoristaFoto,
    origem,
    destino
  };
}

function renderDetalhesMinhaCarona(dados) {
  return `
    <div class="my-ride-grid">
      <div class="my-ride-item">
        <span>Origem</span>
        <strong>${esc(dados.origem)}</strong>
      </div>

      <div class="my-ride-item">
        <span>Destino</span>
        <strong>${esc(dados.destino)}</strong>
      </div>

      <div class="my-ride-item">
        <span>Status</span>
        <strong>${STATUS_CARONA_LABELS[dados.status] || dados.status}</strong>
      </div>

      <div class="my-ride-item">
        <span>Vagas restantes</span>
        <strong>${dados.vagasRestantes}</strong>
      </div>
    </div>

    <div class="my-ride-driver-box">
      <div class="my-ride-driver-avatar">
        ${criarAvatarMotorista(dados.motoristaNome, dados.motoristaFoto)}
      </div>

      <div>
        <span class="my-ride-helper">Motorista</span>
        <h3>${esc(dados.motoristaNome)}</h3>
        <p>${dados.passageiros.length} passageiro(s) confirmado(s)</p>
      </div>
    </div>

    <div class="my-ride-passengers">
      <div class="my-ride-section-title">
        <h3>Passageiros</h3>
        <span class="tag">${dados.passageiros.length} atual(is)</span>
      </div>

      ${renderListaPassageiros(dados.passageiros)}
    </div>
  `;
}

function renderAcoesMinhaCarona(caronaId, status) {
  if (isCaronaHistorico({ status })) {
    return "";
  }

  return `
    <div class="popup-actions my-ride-actions">
      <button
        class="btn-primary"
        onclick="atualizarStatusMinhaCarona('${caronaId}', 'a_caminho')"
        ${["a_caminho", "chegou", "finalizada", "cancelada"].includes(status) ? "disabled" : ""}
      >
        Iniciar corrida
      </button>

      <button
        class="btn-secondary"
        onclick="atualizarStatusMinhaCarona('${caronaId}', 'chegou')"
        ${["chegou", "finalizada", "cancelada"].includes(status) ? "disabled" : ""}
      >
        Cheguei ao destino
      </button>

      <button
        class="btn-secondary"
        onclick="atualizarStatusMinhaCarona('${caronaId}', 'finalizada')"
        ${["finalizada", "cancelada"].includes(status) ? "disabled" : ""}
      >
        Finalizar carona
      </button>
    </div>
  `;
}

function renderListaPassageiros(passageiros) {
  if (!passageiros.length) {
    return `
      <p class="empty-inline">Nenhum passageiro confirmado até agora.</p>
    `;
  }

  return `
    <div class="passenger-list">
      ${passageiros.map(passageiro => `
        <div class="passenger-item">
          <div>
            <strong>${esc(passageiro.nome || "Passageiro")}</strong>
            <p>ID: ${esc(passageiro.id || "-")}</p>
          </div>

          <div class="passenger-flags">
            <span class="passenger-flag ${passageiro.pronto ? "is-ok" : "is-pending"}">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${passageiro.pronto ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>' : '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'}</svg> Pronto
            </span>
            <span class="passenger-flag ${passageiro.entrou ? "is-ok" : "is-pending"}">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${passageiro.entrou ? '<path d="M5 17H3a2 2 0 0 1-2-2V9l3-5h14l3 5v6a2 2 0 0 1-2 2h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/>' : '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'}</svg> Entrou
            </span>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function toggleDetalhesMinhaCaronaHistorico(caronaId) {
  window.minhaCaronaHistoricoExpandido[caronaId] = !window.minhaCaronaHistoricoExpandido[caronaId];
  renderListaMinhasCaronas(window.minhasCaronasCache || []);
}

function ordenarMinhasCaronas(caronas) {
  return [...caronas].sort((caronaA, caronaB) => {
    const historicoA = isCaronaHistorico(caronaA);
    const historicoB = isCaronaHistorico(caronaB);

    if (historicoA !== historicoB) {
      return historicoA ? 1 : -1;
    }

    return obterDataOrdenacao(caronaB) - obterDataOrdenacao(caronaA);
  });
}

function isCaronaHistorico(carona) {
  return STATUS_CARONA_HISTORICO.includes(carona?.status);
}

function obterDataOrdenacao(carona) {
  const referencia = carona?.finalizadoEm || carona?.criadoEm || carona?.atualizadoEm;

  if (referencia?.toDate) {
    return referencia.toDate().getTime();
  }

  if (referencia instanceof Date) {
    return referencia.getTime();
  }

  if (typeof referencia === "number") {
    return referencia;
  }

  return 0;
}

function formatarDataCarona(timestamp) {
  if (!timestamp) {
    return "Data não informada";
  }

  const data = timestamp?.toDate ? timestamp.toDate() : timestamp;

  if (!(data instanceof Date) || Number.isNaN(data.getTime())) {
    return "Data não informada";
  }

  try {
    return data.toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    });
  } catch {
    return data.toLocaleString("pt-BR");
  }
}

function normalizarPassageiros(carona) {
  if (Array.isArray(carona.passageiros) && carona.passageiros.length) {
    return carona.passageiros.map((passageiro, index) => ({
      id: passageiro?.id || `passageiro-${index}`,
      nome: passageiro?.nome || `Passageiro ${index + 1}`,
      pronto: Boolean(passageiro?.pronto),
      entrou: Boolean(passageiro?.entrou)
    }));
  }

  if (Array.isArray(carona.participantes) && carona.participantes.length) {
    return carona.participantes.map((id, index) => ({
      id,
      nome: `Passageiro ${index + 1}`,
      pronto: false,
      entrou: false
    }));
  }

  return [];
}

function obterVagasRestantes(carona, passageirosCount) {
  if (typeof carona.vagas === "number") {
    return carona.vagas;
  }

  const total = typeof carona.vagasTotais === "number" ? carona.vagasTotais : 4;
  return Math.max(total - passageirosCount, 0);
}

function formatarEnderecoCarona(carona, tipo) {
  const enderecoTexto = carona[`${tipo}Endereco`] || carona[`${tipo}Texto`] || carona[tipo];

  if (typeof enderecoTexto === "string" && enderecoTexto.trim()) {
    // Remove "Brasil" do final se presente (legado) e retorna limpo
    return enderecoTexto
      .split(",")
      .map(p => p.trim())
      .filter(p => p.toLowerCase() !== "brasil")
      .join(", ");
  }

  return tipo === "origem" ? "Origem não informada" : "Destino não informado";
}
  
function criarAvatarMotorista(nome, foto) {
  if (foto) {
    return `<img src="${esc(foto)}" alt="${esc(nome)}" class="my-ride-avatar-img">`;
  }

  const inicial = (nome || "M").trim().charAt(0).toUpperCase();
  return `<div class="my-ride-avatar-fallback">${esc(inicial)}</div>`;
}

async function atualizarStatusMinhaCarona(caronaId, novoStatus) {
  try {
    const payload = {
      status: novoStatus,
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (novoStatus === "finalizada") {
      payload.finalizadoEm = firebase.firestore.FieldValue.serverTimestamp();
    }

    await db.collection("caronas").doc(caronaId).update(payload);
  } catch (error) {
    console.error("Erro ao atualizar status da carona:", error);
    showToast("Não foi possível atualizar o status da carona.", "erro");
  }
}

window.inicializarMinhaCarona = inicializarMinhaCarona;
window.encerrarMinhaCaronaListener = encerrarMinhaCaronaListener;
window.atualizarStatusMinhaCarona = atualizarStatusMinhaCarona;
window.toggleDetalhesMinhaCaronaHistorico = toggleDetalhesMinhaCaronaHistorico;