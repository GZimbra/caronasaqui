// Solicitacoes: enviar, aprovar e recusar pedidos de carona.

const SOL_STATUS = {
  pending: ["pending", "pendente"],
  approved: ["approved", "aceita"],
  rejected: ["rejected", "recusada"],
};

function normalizarStatusSolicitacao(status) {
  if (SOL_STATUS.approved.includes(status)) return "approved";
  if (SOL_STATUS.rejected.includes(status)) return "rejected";
  return "pending";
}

async function solicitarCarona(caronaId) {
  const snap = await db.collection("caronas").doc(caronaId).get();
  if (!snap.exists) {
    showToast("Carona nao encontrada ou expirada.", "erro");
    return;
  }

  const carona = snap.data();
  if (carona.motoristaId === usuarioLogado.id) {
    showToast("Voce nao pode solicitar sua propria carona.", "aviso");
    return;
  }

  const duplicada = await db.collection("solicitacoes")
    .where("caronaId", "==", caronaId)
    .where("passageiroId", "==", usuarioLogado.id)
    .where("status", "in", SOL_STATUS.pending)
    .get();

  if (!duplicada.empty) {
    showToast("Voce ja enviou uma solicitacao para essa carona.", "aviso");
    return;
  }

  await db.collection("solicitacoes").add({
    caronaId,
    motoristaId: carona.motoristaId,
    passageiroId: usuarioLogado.id,
    passageiroNome: usuarioLogado.nome,
    status: "pending",
    lida: false,
    notificationReadByPassenger: false,
    criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
  });

  showToast("Solicitacao enviada com sucesso.", "sucesso");
}

async function aceitarSolicitacao(solicitacaoId, caronaId) {
  try {
    const solRef = db.collection("solicitacoes").doc(solicitacaoId);
    const caronaRef = db.collection("caronas").doc(caronaId);
    let solData = null;

    await db.runTransaction(async t => {
      const [caronaDoc, solDoc] = await Promise.all([t.get(caronaRef), t.get(solRef)]);
      if (!caronaDoc.exists || !solDoc.exists) throw new Error("Dados nao encontrados");

      const carona = caronaDoc.data();
      const sol = solDoc.data();
      solData = sol;

      if (normalizarStatusSolicitacao(sol.status) !== "pending") {
        throw new Error("Solicitacao ja respondida");
      }

      const participantes = Array.isArray(carona.participantes) ? [...carona.participantes] : [];
      const passageiros = Array.isArray(carona.passageiros) ? [...carona.passageiros] : [];

      if (participantes.includes(sol.passageiroId) ||
          passageiros.some(p => p.id === sol.passageiroId)) {
        throw new Error("Usuario ja esta na carona");
      }
      if ((carona.vagas || 0) <= 0) throw new Error("Carona lotada");

      participantes.push(sol.passageiroId);
      passageiros.push({ id: sol.passageiroId, nome: sol.passageiroNome, pronto: false, entrou: false });

      const vagasRestantes = Math.max((carona.vagas || 0) - 1, 0);

      t.update(caronaRef, {
        participantes,
        passageiros,
        vagas: vagasRestantes,
        status: vagasRestantes === 0 ? "lotada" : (carona.status || "aberta"),
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      });

      t.update(solRef, {
        status: "approved",
        lida: true,
        notificationReadByPassenger: false,
        decidedAt: firebase.firestore.FieldValue.serverTimestamp(),
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      });
    });

    const chatId = gerarChatId(usuarioLogado.id, solData.passageiroId);
    await garantirChat(chatId, solData.passageiroId, solData.passageiroNome);

    document.querySelector(".popup")?.remove();
    loadPage("mensagens");
    requestAnimationFrame(() => abrirChat(chatId));
  } catch (err) {
    showToast(err.message || "Nao foi possivel aceitar a solicitacao.", "erro");
  }
}

function abrirModalRecusa(solicitacaoId) {
  document.getElementById("modalRecusaSolicitacao")?.remove();

  const modal = document.createElement("div");
  modal.id = "modalRecusaSolicitacao";
  modal.className = "popup";
  modal.onclick = event => {
    if (event.target === modal) modal.remove();
  };

  modal.innerHTML = `
    <div class="popup-box" style="max-width:420px">
      <h2>Recusar solicitacao</h2>
      <p class="popup-hint">Motivo opcional. Ele sera exibido ao passageiro.</p>
      <label class="form-label" for="motivoRecusaSolicitacao">Motivo da recusa</label>
      <textarea id="motivoRecusaSolicitacao" class="input-textarea" maxlength="240" placeholder="Ex: vagas ja preenchidas"></textarea>
      <div class="popup-actions">
        <button class="btn-secondary" onclick="document.getElementById('modalRecusaSolicitacao')?.remove()">Cancelar</button>
        <button class="btn-primary danger-action" onclick="recusarSolicitacao('${solicitacaoId}')">Confirmar recusa</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.getElementById("motivoRecusaSolicitacao")?.focus();
}

async function recusarSolicitacao(solicitacaoId) {
  try {
    const motivo = (document.getElementById("motivoRecusaSolicitacao")?.value || "").trim();
    const erroConteudo = validarTextoPermitido("Motivo", motivo);
    if (erroConteudo) {
      showToast(erroConteudo, "aviso");
      return;
    }

    await db.collection("solicitacoes").doc(solicitacaoId).update({
      status: "rejected",
      lida: true,
      notificationReadByPassenger: false,
      rejectionReason: motivo,
      decidedAt: firebase.firestore.FieldValue.serverTimestamp(),
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    });

    document.getElementById("modalRecusaSolicitacao")?.remove();
    showToast("Solicitacao recusada.", "info");
  } catch {
    showToast("Nao foi possivel recusar a solicitacao.", "erro");
  }
}

Object.assign(window, {
  SOL_STATUS,
  normalizarStatusSolicitacao,
  solicitarCarona,
  aceitarSolicitacao,
  abrirModalRecusa,
  recusarSolicitacao,
});
