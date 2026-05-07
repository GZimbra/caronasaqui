// Admin panel.
// Credenciais e segredo de sessao ficam no processo local admin-server.js via .env.
// ════════════════════════════════════════════════════
// 🔒 AUTENTICAÇÃO
// ════════════════════════════════════════════════════
let autenticado = false;
let dadosGlobais = null;
let adminDb = null;
let adminAuth = null;

const ADMIN_FIREBASE_EMAIL = "admin@caronasaqui.internal";
const ADMIN_FIREBASE_PASSWORD = "AEDB2025";

function togglePwAdmin() {
  const inp = document.getElementById("adminPw");
  const ico = document.getElementById("eyeIcon");
  const mostrar = inp.type === "password";
  inp.type = mostrar ? "text" : "password";
  ico.innerHTML = mostrar
    ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`
    : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
}

async function fazerLogin() {
  const username = document.getElementById("adminUser").value.trim();
  const pw = document.getElementById("adminPw").value;
  const err = document.getElementById("loginError");

  try {
    const res = await fetch("/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ username, password: pw })
    });

    if (!res.ok) {
      let message = "Usuario ou senha incorretos.";
      if (res.status >= 500) {
        message = "Admin nao configurado no Vercel. Configure ADMIN_USERNAME, ADMIN_PASSWORD e ADMIN_SESSION_SECRET.";
      }
      throw new Error(message);
    }

    autenticado = true;
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("dashboard").style.display = "block";
    carregarDados();
  } catch (error) {
    err.textContent = error.message || "Usuario ou senha incorretos.";
    document.getElementById("adminPw").value = "";
    setTimeout(() => err.textContent = "", 3000);
  }
}

async function sair() {
  await fetch("/admin/logout", { method: "POST", credentials: "same-origin" }).catch(() => {});
  autenticado = false;
  document.getElementById("dashboard").style.display = "none";
  document.getElementById("loginScreen").style.display = "flex";
  document.getElementById("adminUser").value = "";
  document.getElementById("adminPw").value = "";
}

async function verificarSessaoAdmin() {
  try {
    const res = await fetch("/admin/session", { credentials: "same-origin" });
    if (!res.ok) return;
    autenticado = true;
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("dashboard").style.display = "block";
    carregarDados();
  } catch {}
}

function inicializarEventosAdmin() {
  document.getElementById("adminTogglePw")?.addEventListener("click", togglePwAdmin);
  document.getElementById("adminLoginBtn")?.addEventListener("click", fazerLogin);
  document.getElementById("adminRefreshBtn")?.addEventListener("click", carregarDados);
  document.getElementById("adminExportBtn")?.addEventListener("click", exportarCSV);
  document.getElementById("adminLogoutBtn")?.addEventListener("click", sair);

  document.getElementById("adminUser")?.addEventListener("keydown", event => {
    if (event.key === "Enter") document.getElementById("adminPw")?.focus();
  });

  document.getElementById("adminPw")?.addEventListener("keydown", event => {
    if (event.key === "Enter") fazerLogin();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  inicializarEventosAdmin();
  verificarSessaoAdmin();
});

// ════════════════════════════════════════════════════
// 📊 COLETA DE DADOS
// ════════════════════════════════════════════════════
async function carregarDados() {
  if (!autenticado) return;

  document.getElementById("loadingState").style.display = "flex";
  document.getElementById("conteudo").style.display = "none";

  try {
    const { usuarios, caronas, solicitacoes, chats } = await carregarDadosFirebaseDireto()
      .catch(() => carregarDadosBackend());

    dadosGlobais = { usuarios, caronas, solicitacoes, chats };

    renderizarDashboard(dadosGlobais);

    const agora = new Date();
    document.getElementById("lastUpdate").textContent =
      "Atualizado às " + agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  } catch (e) {
    const detalhe = e.message || "Falha desconhecida";
    document.getElementById("loadingState").innerHTML = `
      <div class="admin-error-box">
        <h2>Banco de dados nao conectado</h2>
        <p>O painel admin precisa acessar o Firestore real do app.</p>
        <p class="mono">Erro: ${esc(detalhe)}</p>
        <p>Confirme se o Firebase Auth esta ativo e se as regras permitem leitura autenticada de <b>usuarios</b> e <b>caronas</b>.</p>
      </div>
    `;
  }
}

async function carregarDadosBackend() {
  const response = await fetch("/admin/data", { credentials: "same-origin" });
  if (!response.ok) throw new Error("Falha ao carregar dados administrativos");
  return response.json();
}

async function carregarDadosFirebaseDireto() {
  await prepararFirebaseAdmin();

  const [usuarios, caronas, solicitacoes, chats] = await Promise.all([
    listarColecaoFirebase("usuarios"),
    listarColecaoFirebase("caronas"),
    listarColecaoFirebaseOpcional("solicitacoes"),
    listarColecaoFirebaseOpcional("chats"),
  ]);

  return { usuarios, caronas, solicitacoes, chats };
}

async function prepararFirebaseAdmin() {
  if (adminDb && adminAuth) return;
  if (!window.firebase) throw new Error("Firebase SDK nao carregado");

  const config = window.CARONAS_FIREBASE_CONFIG;
  if (!config?.apiKey || !config?.projectId) throw new Error("Firebase config ausente");

  if (!firebase.apps.length) firebase.initializeApp(config);

  adminDb = firebase.firestore();
  adminAuth = firebase.auth();

  if (!adminAuth.currentUser) {
    try {
      await adminAuth.signInWithEmailAndPassword(ADMIN_FIREBASE_EMAIL, ADMIN_FIREBASE_PASSWORD);
    } catch (error) {
      if (error.code !== "auth/user-not-found") throw error;
      await adminAuth.createUserWithEmailAndPassword(ADMIN_FIREBASE_EMAIL, ADMIN_FIREBASE_PASSWORD);
    }
  }
}

async function listarColecaoFirebase(nome) {
  const snapshot = await adminDb.collection(nome).get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function listarColecaoFirebaseOpcional(nome) {
  try {
    return await listarColecaoFirebase(nome);
  } catch {
    return [];
  }
}

// ════════════════════════════════════════════════════
// 🖥️ RENDERIZAÇÃO
// ════════════════════════════════════════════════════
function renderizarDashboard({ usuarios, caronas, solicitacoes, chats }) {

  // ── Métricas de caronas ──
  const totalCaronas      = caronas.length;
  const caronasFinalizadas= caronas.filter(isCaronaRealizadaAdmin).length;
  const caronasCanceladas = caronas.filter(c => c.status === "cancelada").length;
  const caronasAtivas     = caronas.filter(c => ["aberta","a_caminho","em_andamento","lotada"].includes(c.status)).length;

  // ── Passageiros únicos ──
  const passageirosSet = new Set();
  caronas.forEach(c => {
    (c.passageiros || []).forEach(p => { if (p?.id) passageirosSet.add(p.id); });
    (c.participantes || []).forEach(id => { if (id) passageirosSet.add(id); });
  });
  const totalPassageiros = passageirosSet.size;

  // ── Total de assentos ocupados ──
  let totalAssentos = 0;
  caronas.forEach(c => {
    totalAssentos += (c.passageiros?.length || 0);
  });

  // ── Solicitações ──
  const solicitacoesAceitas  = solicitacoes.filter(s => ["approved","aceita"].includes(s.status)).length;
  const solicitacoesPendentes= solicitacoes.filter(s => ["pending","pendente"].includes(s.status)).length;
  const solicitacoesRecusadas= solicitacoes.filter(s => ["rejected","recusada"].includes(s.status)).length;

  // ── Taxa de conclusão ──
  const taxaConclusao = totalCaronas > 0
    ? ((caronasFinalizadas / totalCaronas) * 100).toFixed(1)
    : "0.0";

  // ── Taxa de aceite de solicitações ──
  const taxaAceite = solicitacoes.length > 0
    ? ((solicitacoesAceitas / solicitacoes.length) * 100).toFixed(1)
    : "0.0";

  // ── Média de passageiros por carona finalizada ──
  const mediaPassageiros = caronasFinalizadas > 0
    ? (totalAssentos / caronasFinalizadas).toFixed(1)
    : "0.0";

  // ── Distância total percorrida ──
  let distanciaTotal = 0;
  caronas.filter(isCaronaRealizadaAdmin).forEach(c => {
    distanciaTotal += parseFloat(c.distancia || 0);
  });

  // ── Motoristas ativos (criaram ao menos 1 carona) ──
  const motoristasSet = new Set(caronas.map(c => c.motoristaId).filter(Boolean));
  const totalMotoristas = motoristasSet.size;

  // ── Usuários sem foto ──
  const semFoto = usuarios.filter(u => !u.foto).length;

  // ── Top motoristas ──
  const contagemMotoristas = {};
  caronas.forEach(c => {
    if (!c.motoristaId) return;
    const nome = c.motoristaNome || c.motorista || c.motoristaId;
    if (!contagemMotoristas[c.motoristaId]) {
      contagemMotoristas[c.motoristaId] = { nome, total: 0, finalizadas: 0 };
    }
    contagemMotoristas[c.motoristaId].total++;
    if (isCaronaRealizadaAdmin(c)) contagemMotoristas[c.motoristaId].finalizadas++;
  });
  const topMotoristas = Object.values(contagemMotoristas)
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  // ── Status distribution ──
  const statusCount = {};
  caronas.forEach(c => {
    const s = c.status || "aberta";
    statusCount[s] = (statusCount[s] || 0) + 1;
  });

  // ── Horários de pico (hora do dia das caronas criadas) ──
  const horaCount = {};
  caronas.forEach(c => {
    let hora = null;
    const criadoEm = parseDataAdmin(c.criadoEm);
    if (criadoEm) hora = criadoEm.getHours();
    if (hora !== null) {
      const label = `${String(hora).padStart(2,"0")}h`;
      horaCount[label] = (horaCount[label] || 0) + 1;
    }
  });
  const horariosPico = Object.entries(horaCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  // ── Usuários recentes ──
  const usuariosRecentes = [...usuarios]
    .filter(u => u.nome)
    .slice(-8)
    .reverse();

  // ── Caronas recentes ──
  const caronasRecentes = [...caronas]
    .sort((a, b) => {
      const ta = obterMillisAdmin(a.criadoEm);
      const tb = obterMillisAdmin(b.criadoEm);
      return tb - ta;
    })
    .slice(0, 8);

  const usuariosOrdenados = [...usuarios]
    .sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

  const caronasRealizadas = [...caronas]
    .filter(isCaronaRealizadaAdmin)
    .sort((a, b) => obterMillisAdmin(b.finalizadoEm || b.atualizadoEm || b.criadoEm) - obterMillisAdmin(a.finalizadoEm || a.atualizadoEm || a.criadoEm));

  const caronasMarcadas = [...caronas]
    .filter(c => ["aberta", "lotada", "a_caminho", "em_andamento", "chegou"].includes(c.status || "aberta"))
    .sort((a, b) => obterMillisAdmin(b.criadoEm || b.atualizadoEm) - obterMillisAdmin(a.criadoEm || a.atualizadoEm));

  const graficoResumoCaronas = [
    ["Realizadas", caronasRealizadas.length, "var(--accent)"],
    ["Marcadas", caronasMarcadas.length, "var(--info)"],
    ["Canceladas", caronasCanceladas, "var(--danger)"],
  ];

  const graficoSolicitacoes = [
    ["Aceitas", solicitacoesAceitas, "var(--accent)"],
    ["Pendentes", solicitacoesPendentes, "var(--warn)"],
    ["Recusadas", solicitacoesRecusadas, "var(--danger)"],
  ];

  // ════ RENDER ════
  const el = document.getElementById("conteudo");
  el.innerHTML = `

    <!-- KPIs PRINCIPAIS -->
    <div class="section-label">visão geral</div>
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Usuários cadastrados</div>
        <div class="kpi-value accent">${usuarios.length}</div>
        <div class="kpi-sub">${totalMotoristas} motoristas · ${semFoto} sem foto</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Caronas criadas</div>
        <div class="kpi-value">${totalCaronas}</div>
        <div class="kpi-sub">${caronasAtivas} ativas agora</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Caronas finalizadas</div>
        <div class="kpi-value accent">${caronasFinalizadas}</div>
        <div class="kpi-sub">Taxa de conclusão: ${taxaConclusao}%</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Caronas canceladas</div>
        <div class="kpi-value danger">${caronasCanceladas}</div>
        <div class="kpi-sub">${((caronasCanceladas/Math.max(totalCaronas,1))*100).toFixed(1)}% do total</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Passageiros únicos</div>
        <div class="kpi-value info">${totalPassageiros}</div>
        <div class="kpi-sub">${totalAssentos} assentos ocupados no total</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Média passageiros/carona</div>
        <div class="kpi-value">${mediaPassageiros}</div>
        <div class="kpi-sub">Em caronas finalizadas</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Distância total</div>
        <div class="kpi-value warn">${distanciaTotal.toFixed(0)}<span style="font-size:16px;color:var(--text-muted)"> km</span></div>
        <div class="kpi-sub">Em caronas finalizadas</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Conversas abertas</div>
        <div class="kpi-value">${chats.length}</div>
        <div class="kpi-sub">${solicitacoes.length} solicitações totais</div>
      </div>
    </div>

    <div class="section-label">graficos</div>
    <div class="charts-grid">
      ${renderGraficoFirebaseAdmin(usuarios.length, caronasRealizadas.length)}
      ${renderGraficoBarrasAdmin("Corridas realizadas", graficoResumoCaronas, Math.max(totalCaronas, 1))}
      ${renderGraficoBarrasAdmin("Corridas por status", Object.entries(statusCount)
        .sort((a, b) => b[1] - a[1])
        .map(([status, count]) => [labelStatus(status), count, "var(--accent)"]), totalCaronas)}
      ${renderGraficoBarrasAdmin("Solicitacoes", graficoSolicitacoes, Math.max(solicitacoes.length, 1))}
      ${renderGraficoBarrasAdmin("Caronas por horario", horariosPico.map(([h, count]) => [h, count, "var(--info)"]), horariosPico[0]?.[1] || 1)}
    </div>

    <div class="section-label">dados do banco</div>

    ${renderTabelaUsuariosAdmin(usuariosOrdenados)}
    ${renderTabelaCaronasRealizadasAdmin(caronasRealizadas)}
    ${renderTabelaCaronasMarcadasAdmin(caronasMarcadas)}

    <!-- SOLICITAÇÕES -->
    <div class="section-label">solicitações</div>
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Total de solicitações</div>
        <div class="kpi-value">${solicitacoes.length}</div>
        <div class="kpi-sub">De passageiros para motoristas</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Aceitas</div>
        <div class="kpi-value accent">${solicitacoesAceitas}</div>
        <div class="kpi-sub">Taxa de aceite: ${taxaAceite}%</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Pendentes</div>
        <div class="kpi-value warn">${solicitacoesPendentes}</div>
        <div class="kpi-sub">Aguardando resposta</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Recusadas</div>
        <div class="kpi-value danger">${solicitacoesRecusadas}</div>
        <div class="kpi-sub">${((solicitacoesRecusadas/Math.max(solicitacoes.length,1))*100).toFixed(1)}% do total</div>
      </div>
    </div>

    <div class="section-label">análises</div>
    <div class="two-col">
      <div class="table-card">
        <div class="table-header">
          <h3>Top Motoristas</h3>
          <span>${topMotoristas.length} motoristas</span>
        </div>
        ${topMotoristas.length ? `
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Nome</th>
              <th>Caronas</th>
              <th>Finalizadas</th>
            </tr>
          </thead>
          <tbody>
            ${topMotoristas.map((m, i) => `
              <tr>
                <td class="mono" style="color:var(--text-muted)">${i + 1}</td>
                <td>${esc(m.nome)}</td>
                <td class="mono">${m.total}</td>
                <td class="mono"><span class="badge badge-green">${m.finalizadas}</span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        ` : `<table><tbody><tr class="empty-row"><td>Nenhum motorista ainda</td></tr></tbody></table>`}
      </div>
    </div>

    <!-- Tabelas de registros recentes -->
    <div class="section-label">registros recentes</div>
    <div class="two-col">

      <!-- Usuários recentes -->
      <div class="table-card">
        <div class="table-header">
          <h3>Últimos Usuários</h3>
          <span>${usuarios.length} total</span>
        </div>
        <table>
          <thead>
            <tr><th>Nome</th><th>Curso</th><th>Foto</th></tr>
          </thead>
          <tbody>
            ${usuariosRecentes.length
              ? usuariosRecentes.map(u => `
                <tr>
                  <td>${esc(u.nome || "—")}</td>
                  <td style="color:var(--text-muted)">${esc(u.curso || "—")}</td>
                  <td>${u.foto
                    ? `<span class="badge badge-green">✓ sim</span>`
                    : `<span class="badge badge-gray">não</span>`}</td>
                </tr>
              `).join("")
              : `<tr class="empty-row"><td colspan="3">Nenhum usuário</td></tr>`
            }
          </tbody>
        </table>
      </div>

      <!-- Caronas recentes -->
      <div class="table-card">
        <div class="table-header">
          <h3>Últimas Caronas</h3>
          <span>${totalCaronas} total</span>
        </div>
        <table>
          <thead>
            <tr><th>Motorista</th><th>Faculdade</th><th>Partida</th><th>Origem</th><th>Status</th></tr>
          </thead>
          <tbody>
            ${caronasRecentes.length
              ? caronasRecentes.map(c => `
                <tr>
                  <td>${esc(c.motoristaNome || c.motorista || "—")}</td>
                  <td style="color:var(--text-muted);font-size:11px">${esc([c.faculdadeNome, c.faculdadeCampus].filter(Boolean).join(" - ") || "—")}</td>
                  <td style="color:var(--text-muted);font-size:11px">${esc(c.partidaLivre || "—")}</td>
                  <td style="color:var(--text-muted);font-size:11px">${esc(resumirEndereco(c.origemEndereco))}</td>
                  <td>${badgeStatus(c.status)}</td>
                </tr>
              `).join("")
              : `<tr class="empty-row"><td colspan="5">Nenhuma carona</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById("loadingState").style.display = "none";
  el.style.display = "block";
}

function renderTabelaUsuariosAdmin(usuarios) {
  return `
    <div class="table-card table-card-wide">
      <div class="table-header">
        <h3>Usuarios Registrados</h3>
        <span>${usuarios.length} total</span>
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Nome</th><th>Email</th><th>Celular</th><th>Faculdade</th>
              <th>Campus</th><th>Matricula</th><th>Curso</th><th>Criado em</th>
            </tr>
          </thead>
          <tbody>
            ${usuarios.length ? usuarios.map(u => `
              <tr>
                <td>${esc(u.nome || "-")}</td>
                <td class="mono">${esc(u.email || "-")}</td>
                <td class="mono">${esc(u.celular || "-")}</td>
                <td>${esc(u.faculdadeNome || "-")}</td>
                <td>${esc(u.faculdadeCampus || "-")}</td>
                <td class="mono">${u.matriculaLast4 ? `****${esc(u.matriculaLast4)}` : "-"}</td>
                <td>${esc(u.curso || "-")}</td>
                <td class="mono">${formatarData(u.criadoEm)}</td>
              </tr>
            `).join("") : `<tr class="empty-row"><td colspan="8">Nenhum usuario registrado.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderGraficoBarrasAdmin(titulo, itens, totalReferencia) {
  const rows = itens.map(([label, count, color]) => [label, Number(count || 0), color]);
  const total = rows.reduce((acc, [, count]) => acc + count, 0);
  const escala = Math.max(Number(totalReferencia || 0), ...rows.map(([, count]) => count), 1);
  return `
    <div class="chart-card">
      <div class="table-header">
        <h3>${esc(titulo)}</h3>
        <span>${total} registros</span>
      </div>
      <div class="chart-body">
        ${rows.length ? rows.map(([label, count, color]) => {
          const percent = count > 0 ? Math.max((count / escala) * 100, 3) : 0;
          return `
            <div class="chart-row">
              <div class="chart-row-top">
                <span>${esc(label)}</span>
                <strong>${count}</strong>
              </div>
              <div class="chart-track">
                <div class="chart-fill" style="width:${percent.toFixed(1)}%;min-width:${count > 0 ? "3px" : "0"};background:${color || "var(--accent)"}"></div>
              </div>
            </div>
          `;
        }).join("") : `<div class="chart-empty">Sem dados para este grafico.</div>`}
      </div>
    </div>
  `;
}

function renderGraficoFirebaseAdmin(totalUsuarios, corridasRealizadas) {
  const maiorValor = Math.max(totalUsuarios, corridasRealizadas, 1);
  return renderGraficoBarrasAdmin("Dados do Firebase", [
    ["Usuarios cadastrados", totalUsuarios, "var(--accent)"],
    ["Corridas realizadas", corridasRealizadas, "var(--info)"],
  ], maiorValor);
}

function renderGraficoResumoVisualAdmin(itens) {
  const total = itens.reduce((acc, [, count]) => acc + Number(count || 0), 0);
  const validos = itens.filter(([, count]) => Number(count) > 0);
  return `
    <div class="chart-card chart-card-main">
      <div class="table-header">
        <h3>Resumo visual de corridas</h3>
        <span>${total} registros</span>
      </div>
      <div class="donut-layout">
        <div class="donut-bars">
          ${validos.length ? validos.map(([label, count, color]) => {
            const percent = total > 0 ? (Number(count) / total) * 100 : 0;
            return `
              <div class="donut-segment" style="height:${Math.max(percent, 8).toFixed(1)}%;background:${color}">
                <span>${count}</span>
              </div>
            `;
          }).join("") : `<div class="chart-empty">Sem corridas registradas.</div>`}
        </div>
        <div class="donut-legend">
          ${itens.map(([label, count, color]) => `
            <div class="legend-row">
              <span class="legend-dot" style="background:${color}"></span>
              <span>${esc(label)}</span>
              <strong>${count}</strong>
            </div>
          `).join("")}
        </div>
      </div>
    </div>
  `;
}

function renderTabelaCaronasRealizadasAdmin(caronas) {
  return `
    <div class="table-card table-card-wide">
      <div class="table-header">
        <h3>Corridas Realizadas</h3>
        <span>${caronas.length} finalizadas</span>
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Motorista</th><th>Faculdade</th><th>Partida</th><th>Origem</th>
              <th>Destino</th><th>Passageiros</th><th>Distancia</th><th>Finalizada em</th>
            </tr>
          </thead>
          <tbody>
            ${caronas.length ? caronas.map(c => `
              <tr>
                <td>${esc(c.motoristaNome || c.motorista || "-")}</td>
                <td>${esc([c.faculdadeNome, c.faculdadeCampus].filter(Boolean).join(" - ") || "-")}</td>
                <td>${esc(c.partidaLivre || "-")}</td>
                <td>${esc(resumirEndereco(c.origemEndereco))}</td>
                <td>${esc(resumirEndereco(c.destinoEndereco))}</td>
                <td class="mono">${contarPassageiros(c)}</td>
                <td class="mono">${esc(c.distancia || "0")} km</td>
                <td class="mono">${formatarData(c.finalizadoEm || c.atualizadoEm || c.criadoEm)}</td>
              </tr>
            `).join("") : `<tr class="empty-row"><td colspan="8">Nenhuma corrida realizada.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderTabelaCaronasMarcadasAdmin(caronas) {
  return `
    <div class="table-card table-card-wide">
      <div class="table-header">
        <h3>Corridas Marcadas</h3>
        <span>${caronas.length} ativas/agendadas</span>
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Motorista</th><th>Status</th><th>Horario</th><th>Faculdade</th>
              <th>Partida</th><th>Origem</th><th>Destino</th><th>Vagas</th><th>Criada em</th>
            </tr>
          </thead>
          <tbody>
            ${caronas.length ? caronas.map(c => `
              <tr>
                <td>${esc(c.motoristaNome || c.motorista || "-")}</td>
                <td>${badgeStatus(c.status || "aberta")}</td>
                <td class="mono">${esc(c.horario || "-")}</td>
                <td>${esc([c.faculdadeNome, c.faculdadeCampus].filter(Boolean).join(" - ") || "-")}</td>
                <td>${esc(c.partidaLivre || "-")}</td>
                <td>${esc(resumirEndereco(c.origemEndereco))}</td>
                <td>${esc(resumirEndereco(c.destinoEndereco))}</td>
                <td class="mono">${esc(c.vagas ?? "-")}/${esc(c.vagasTotais || 4)}</td>
                <td class="mono">${formatarData(c.criadoEm)}</td>
              </tr>
            `).join("") : `<tr class="empty-row"><td colspan="9">Nenhuma corrida marcada.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ════════════════════════════════════════════════════
// 📥 EXPORTAR CSV
// ════════════════════════════════════════════════════
function exportarCSV() {
  if (!dadosGlobais) return;
  const { usuarios, caronas, solicitacoes, chats } = dadosGlobais;
  const caronasRealizadas = caronas.filter(isCaronaRealizadaAdmin);
  const caronasMarcadas = caronas.filter(c => ["aberta", "lotada", "a_caminho", "em_andamento", "chegou"].includes(c.status || "aberta"));

  const sheets = [
    {
      nome: "Usuarios",
      colunas: ["ID", "Nome", "Email", "Celular", "Faculdade", "Campus", "Matricula Final", "Tem Foto"],
      linhas: usuarios.map(u => [u.id, u.nome, u.email, u.celular, u.faculdadeNome || u.curso, u.faculdadeCampus, u.matriculaLast4, u.foto ? "Sim" : "Não"])
    },
    {
      nome: "Caronas",
      colunas: ["ID", "Motorista", "Status", "Faculdade", "Campus", "Local Partida", "Origem", "Destino", "Vagas", "Passageiros", "Distancia (km)", "Preco", "Criado Em"],
      linhas: caronas.map(c => [
        c.id,
        c.motoristaNome || c.motorista,
        c.status,
        c.faculdadeNome || "",
        c.faculdadeCampus || "",
        c.partidaLivre || "",
        c.origemEndereco || "",
        c.destinoEndereco || "",
        c.vagasTotais || 4,
        (c.passageiros?.length || 0),
        c.distancia || "",
        c.preco || "",
        formatarData(c.criadoEm)
      ])
    },
    {
      nome: "Corridas_Realizadas",
      colunas: ["ID", "Motorista", "Faculdade", "Campus", "Local Partida", "Origem", "Destino", "Passageiros", "Distancia (km)", "Finalizada Em"],
      linhas: caronasRealizadas.map(c => [
        c.id,
        c.motoristaNome || c.motorista,
        c.faculdadeNome || "",
        c.faculdadeCampus || "",
        c.partidaLivre || "",
        c.origemEndereco || "",
        c.destinoEndereco || "",
        contarPassageiros(c),
        c.distancia || "",
        formatarData(c.finalizadoEm || c.atualizadoEm || c.criadoEm)
      ])
    },
    {
      nome: "Corridas_Marcadas",
      colunas: ["ID", "Motorista", "Status", "Horario", "Faculdade", "Campus", "Local Partida", "Origem", "Destino", "Vagas", "Criada Em"],
      linhas: caronasMarcadas.map(c => [
        c.id,
        c.motoristaNome || c.motorista,
        c.status || "aberta",
        c.horario || "",
        c.faculdadeNome || "",
        c.faculdadeCampus || "",
        c.partidaLivre || "",
        c.origemEndereco || "",
        c.destinoEndereco || "",
        `${c.vagas ?? ""}/${c.vagasTotais || 4}`,
        formatarData(c.criadoEm)
      ])
    },
    {
      nome: "Solicitacoes",
      colunas: ["ID", "Carona ID", "Passageiro ID", "Passageiro Nome", "Status", "Criado Em"],
      linhas: solicitacoes.map(s => [
        s.id, s.caronaId, s.passageiroId, s.passageiroNome, s.status, formatarData(s.criadoEm)
      ])
    },
    {
      nome: "Resumo",
      colunas: ["Metrica", "Valor"],
      linhas: [
        ["Total de usuarios", usuarios.length],
        ["Total de caronas", caronas.length],
        ["Caronas finalizadas", caronas.filter(isCaronaRealizadaAdmin).length],
        ["Caronas canceladas", caronas.filter(c=>c.status==="cancelada").length],
        ["Caronas ativas", caronas.filter(c=>["aberta","a_caminho","em_andamento","lotada"].includes(c.status)).length],
        ["Total de solicitacoes", solicitacoes.length],
        ["Solicitacoes aceitas", solicitacoes.filter(s=>["approved","aceita"].includes(s.status)).length],
        ["Conversas abertas", chats.length],
        ["Data de exportacao", new Date().toLocaleString("pt-BR")]
      ]
    }
  ];

  sheets.forEach(sheet => {
    const rows = [sheet.colunas, ...sheet.linhas];
    const csv = rows.map(row =>
      row.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")
    ).join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `caronas-aqui_${sheet.nome}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

// ════════════════════════════════════════════════════
// 🛠️ HELPERS
// ════════════════════════════════════════════════════
function esc(v) {
  return String(v ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

function resumirEndereco(end) {
  if (!end) return "—";
  const partes = end.split(",").map(p => p.trim()).filter(p => p && p.toLowerCase() !== "brasil");
  return partes.slice(0, 2).join(", ") || end;
}

function contarPassageiros(carona) {
  const passageiros = Array.isArray(carona?.passageiros) ? carona.passageiros.length : 0;
  const participantes = Array.isArray(carona?.participantes) ? carona.participantes.length : 0;
  return Math.max(passageiros, participantes);
}

function isCaronaRealizadaAdmin(carona) {
  return ["finalizada", "realizada", "completed"].includes(String(carona?.status || "").toLowerCase());
}

function formatarData(ts) {
  if (!ts) return "—";
  const d = parseDataAdmin(ts);
  if (!(d instanceof Date) || isNaN(d)) return "—";
  return d.toLocaleString("pt-BR");
}

function parseDataAdmin(ts) {
  if (!ts) return null;
  if (ts?.toDate) return ts.toDate();
  if (ts instanceof Date) return ts;
  if (typeof ts === "string") return new Date(ts);
  if (typeof ts === "number") return new Date(ts);
  if (typeof ts.seconds === "number") return new Date(ts.seconds * 1000);
  return null;
}

function obterMillisAdmin(ts) {
  const d = parseDataAdmin(ts);
  return d instanceof Date && !isNaN(d) ? d.getTime() : 0;
}

function labelStatus(s) {
  const labels = {
    aberta: "Aberta", em_andamento: "Em andamento", lotada: "Lotada",
    a_caminho: "A caminho", chegou: "Chegou", finalizada: "Finalizada", cancelada: "Cancelada"
  };
  return labels[s] || s;
}

function badgeStatus(s) {
  const map = {
    aberta: "badge-green", finalizada: "badge-blue",
    cancelada: "badge-red", a_caminho: "badge-yellow",
    lotada: "badge-yellow", em_andamento: "badge-yellow",
    chegou: "badge-blue"
  };
  return `<span class="badge ${map[s] || "badge-gray"}">${labelStatus(s)}</span>`;
}
