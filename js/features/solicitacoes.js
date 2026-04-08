// ============================================================
// SOLICITAÇÕES — enviar, aceitar e recusar pedidos de carona
// ============================================================

async function solicitarCarona(caronaId) {
  const snap = await db.collection('caronas').doc(caronaId).get();
  if (!snap.exists) { showToast('Carona não encontrada ou expirada.', 'erro'); return; }

  const carona = snap.data();
  if (carona.motoristaId === usuarioLogado.id) {
    showToast('Você não pode solicitar sua própria carona.', 'aviso'); return;
  }

  const duplicada = await db.collection('solicitacoes')
    .where('caronaId',     '==', caronaId)
    .where('passageiroId', '==', usuarioLogado.id)
    .where('status',       '==', 'pendente')
    .get();
  if (!duplicada.empty) { showToast('Você já enviou uma solicitação para essa carona.', 'aviso'); return; }

  await db.collection('solicitacoes').add({
    caronaId,
    motoristaId:    carona.motoristaId,
    passageiroId:   usuarioLogado.id,
    passageiroNome: usuarioLogado.nome,
    status:         'pendente',
    lida:           false,
    criadoEm:       firebase.firestore.FieldValue.serverTimestamp(),
  });

  showToast('Solicitação enviada com sucesso!', 'sucesso');
}

async function aceitarSolicitacao(solicitacaoId, caronaId) {
  try {
    const solRef   = db.collection('solicitacoes').doc(solicitacaoId);
    const caronaRef = db.collection('caronas').doc(caronaId);
    let solData = null;

    await db.runTransaction(async t => {
      const [caronaDoc, solDoc] = await Promise.all([t.get(caronaRef), t.get(solRef)]);
      if (!caronaDoc.exists || !solDoc.exists) throw new Error('Dados não encontrados');

      const carona      = caronaDoc.data();
      const sol         = solDoc.data();
      solData           = sol;

      const participantes = Array.isArray(carona.participantes) ? [...carona.participantes] : [];
      const passageiros   = Array.isArray(carona.passageiros)   ? [...carona.passageiros]   : [];

      if (participantes.includes(sol.passageiroId) ||
          passageiros.some(p => p.id === sol.passageiroId)) throw new Error('Usuário já está na carona');
      if ((carona.vagas || 0) <= 0) throw new Error('Carona lotada');

      participantes.push(sol.passageiroId);
      passageiros.push({ id: sol.passageiroId, nome: sol.passageiroNome, pronto: false, entrou: false });

      const vagasRestantes = Math.max((carona.vagas || 0) - 1, 0);

      t.update(caronaRef, {
        participantes, passageiros,
        vagas:  vagasRestantes,
        status: vagasRestantes === 0 ? 'lotada' : (carona.status || 'aberta'),
      });
      t.update(solRef, { status: 'aceita', lida: true });
    });

    const chatId = gerarChatId(usuarioLogado.id, solData.passageiroId);
    await garantirChat(chatId, solData.passageiroId, solData.passageiroNome);

    document.querySelector('.popup')?.remove();
    loadPage('mensagens');
    requestAnimationFrame(() => abrirChat(chatId));

  } catch (err) {
    showToast(err.message || 'Não foi possível aceitar a solicitação.', 'erro');
  }
}

async function recusarSolicitacao(solicitacaoId) {
  try {
    await db.collection('solicitacoes').doc(solicitacaoId).update({ status: 'recusada', lida: true });
    showToast('Solicitação recusada.', 'info');
  } catch {
    showToast('Não foi possível recusar a solicitação.', 'erro');
  }
}

// ── Exports ──────────────────────────────────────────────────

Object.assign(window, { solicitarCarona, aceitarSolicitacao, recusarSolicitacao });
