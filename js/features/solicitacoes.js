async function solicitarCarona(caronaId) {
  const caronaRef = db.collection("caronas").doc(caronaId);
  const caronaDoc = await caronaRef.get();

  if (!caronaDoc.exists) {
    showToast("Carona não encontrada ou expirada.", "erro");
    return;
  }

  const carona = caronaDoc.data();

  // 🚫 motorista não pode pedir a própria carona
  if (carona.motoristaId === usuarioLogado.id) {
    showToast("Você não pode solicitar sua própria carona.", "aviso");
    return;
  }

  // 🚫 evita duplicar solicitação
  const jaExiste = await db.collection("solicitacoes")
    .where("caronaId", "==", caronaId)
    .where("passageiroId", "==", usuarioLogado.id)
    .where("status", "==", "pendente")
    .get();

  if (!jaExiste.empty) {
    showToast("Você já enviou uma solicitação para essa carona.", "aviso");
    return;
  }

  await db.collection("solicitacoes").add({
    caronaId,
    motoristaId: carona.motoristaId,
    passageiroId: usuarioLogado.id,
    passageiroNome: usuarioLogado.nome,
    status: "pendente",
    lida: false,
    criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });

  showToast("Solicitação enviada com sucesso!", "sucesso");
}

async function verSolicitacoes(caronaId) {
  const snapshot = await db.collection("solicitacoes")
    .where("caronaId", "==", caronaId)
    .where("status", "==", "pendente")
    .get();

  let html = `
    <div class="popup">
      <div class="popup-box">
        <h2>Solicitações</h2>
  `;

  if (snapshot.empty) {
    html += `<p>Nenhuma solicitação pendente</p>`;
  }

  snapshot.forEach(doc => {
    const s = doc.data();

    html += `
      <div class="ride-card">
        <b>${s.passageiroNome}</b>

        <div class="popup-actions">
          <button class="btn-primary"
            onclick="aceitarSolicitacao('${doc.id}', '${caronaId}')">
            Aceitar
          </button>

          <button class="btn-secondary"
            onclick="recusarSolicitacao('${doc.id}')">
            Recusar
          </button>
        </div>
      </div>
    `;
  });

  html += `
        <button class="btn-secondary"
          onclick="this.closest('.popup').remove()">
          Fechar
        </button>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", html);
}

async function aceitarSolicitacao(solicitacaoId, caronaId) {
  try {
    const solicitacaoRef = db.collection("solicitacoes").doc(solicitacaoId);
    const caronaRef = db.collection("caronas").doc(caronaId);

    let solicitacaoData = null;

    await db.runTransaction(async t => {
      const caronaDoc = await t.get(caronaRef);
      const solicitacaoDoc = await t.get(solicitacaoRef);

      if (!caronaDoc.exists || !solicitacaoDoc.exists) {
        throw new Error("Dados não encontrados");
      }

      const carona = caronaDoc.data();
      const solicitacao = solicitacaoDoc.data();

      solicitacaoData = solicitacao;

      const participantes = Array.isArray(carona.participantes)
        ? [...carona.participantes]
        : [];
      const passageiros = Array.isArray(carona.passageiros)
        ? [...carona.passageiros]
        : [];

      if (
        participantes.includes(solicitacao.passageiroId) ||
        passageiros.some(passageiro => passageiro.id === solicitacao.passageiroId)
      ) {
        throw new Error("Usuário já está na carona");
      }

      if ((carona.vagas || 0) <= 0) {
        throw new Error("Carona lotada");
      }

      participantes.push(solicitacao.passageiroId);
      passageiros.push({
        id: solicitacao.passageiroId,
        nome: solicitacao.passageiroNome,
        pronto: false,
        entrou: false
      });

      const vagasRestantes = Math.max((carona.vagas || 0) - 1, 0);

      t.update(caronaRef, {
        participantes,
        passageiros,
        vagas: vagasRestantes,
        status: vagasRestantes === 0 ? "lotada" : (carona.status || "aberta")
      });

      t.update(solicitacaoRef, {
        status: "aceita",
        lida: true
      });
    });

    // 💬 cria ou reutiliza o contato da conversa
    const chatId = gerarChatId(
      usuarioLogado.id,
      solicitacaoData.passageiroId
    );

    await garantirChat(
      chatId,
      solicitacaoData.passageiroId,
      solicitacaoData.passageiroNome
    );

    // fecha popup/notificação
    document.querySelector(".popup")?.remove();

    // 🚀 abre direto a conversa
    loadPage("mensagens");

    // espera a tela montar e abre a conversa
    requestAnimationFrame(() => {
      abrirChat(chatId);
    });

  } catch (error) {
    console.error(error);
    showToast(error.message || "Não foi possível aceitar a solicitação.", "erro");
  }
}

async function recusarSolicitacao(solicitacaoId) {
  try {
    await db.collection("solicitacoes")
      .doc(solicitacaoId)
      .update({
        status: "recusada",
        lida: true
      });

    showToast("Solicitação recusada.", "info");
  } catch (error) {
    console.error(error);
    showToast("Não foi possível recusar a solicitação.", "erro");
  }
}

window.recusarSolicitacao = recusarSolicitacao;
window.aceitarSolicitacao = aceitarSolicitacao;
window.verSolicitacoes = verSolicitacoes;
window.solicitarCarona = solicitarCarona;