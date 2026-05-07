// ============================================================
// LOCALIZAÇÃO EM TEMPO REAL DOS PASSAGEIROS
// ============================================================
// Fluxo:
//  - Passageiro com carona ativa → publica coords no Firestore
//  - Motorista (e passageiros) ouvem a subcoleção e exibem bolinhas
//  - Quando entrou:true → para de publicar e remove o marcador
// ============================================================

let _locWatchId         = null;   // watchPosition do passageiro atual
let _locUnsubs          = {};     // listeners de outras localizações (por caronaId)
let _passageiroMarkers  = {};     // marcadores no mapa { passageiroId: marker }
let _caronaAtualId      = null;   // ID da carona que estamos ouvindo

// ──────────────────────────────────────────────
// PUBLICAR MINHA LOCALIZAÇÃO (quando sou passageiro)
// ──────────────────────────────────────────────

function iniciarPublicacaoLocalizacao(caronaId, passageiroId) {
  pararPublicacaoLocalizacao(); // limpa watch anterior

  if (!navigator.geolocation) return;

  _locWatchId = navigator.geolocation.watchPosition(
    pos => {
      const { latitude: lat, longitude: lng } = pos.coords;

      // Salva no Firestore — merge para não sobrescrever outros campos
      db.collection("caronas")
        .doc(caronaId)
        .collection("localizacoes")
        .doc(passageiroId)
        .set({ lat, lng, ts: firebase.firestore.FieldValue.serverTimestamp() })
        .catch(err => console.warn("Erro ao salvar localização:", err));
    },
    () => {},
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
  );
}

function pararPublicacaoLocalizacao() {
  if (_locWatchId !== null) {
    navigator.geolocation.clearWatch(_locWatchId);
    _locWatchId = null;
  }
}

// ──────────────────────────────────────────────
// OUVIR LOCALIZAÇÕES DOS PASSAGEIROS (motorista ou outros)
// ──────────────────────────────────────────────

function ouvirLocalizacoesPassageiros(caronaId, passageiros) {
  // Cancela listener anterior se mudou de carona
  if (_caronaAtualId !== caronaId) {
    pararOuvirLocalizacoes();
    _caronaAtualId = caronaId;
  }

  // Já está ouvindo essa carona
  if (_locUnsubs[caronaId]) return;

  _locUnsubs[caronaId] = db.collection("caronas")
    .doc(caronaId)
    .collection("localizacoes")
    .onSnapshot(snapshot => {
      if (!window.mapaMain) return;

      const passageiroMap = {};
      (passageiros || []).forEach(p => { passageiroMap[p.id] = p; });

      snapshot.forEach(doc => {
        const pid  = doc.id;
        const data = doc.data();

        // Ignora o próprio motorista ou passageiros que já embarcaram
        if (pid === usuarioLogado.id) return;
        const passageiro = passageiroMap[pid];
        if (passageiro?.entrou) {
          _removerPassageiroDoMapa(pid);
          return;
        }

        const { lat, lng } = data;
        if (!lat || !lng) return;

        const nome = passageiro?.nome || "Passageiro";
        _atualizarPassageiroNoMapa(pid, lat, lng, nome);
      });

      // Remove marcadores de passageiros que sumiram do snapshot
      snapshot.docChanges().forEach(change => {
        if (change.type === "removed") {
          _removerPassageiroDoMapa(change.doc.id);
        }
      });
    }, err => console.warn("Erro ao ouvir localizações:", err));
}

function pararOuvirLocalizacoes() {
  Object.values(_locUnsubs).forEach(unsub => unsub?.());
  _locUnsubs = {};
  _passageiroMarkers = {};
  _caronaAtualId = null;
}

// ──────────────────────────────────────────────
// MARCADORES NO MAPA
// ──────────────────────────────────────────────

function _atualizarPassageiroNoMapa(pid, lat, lng, nome) {
  if (!window.mapaMain) return;

  if (_passageiroMarkers[pid]) {
    // Já existe — só move
    _passageiroMarkers[pid].setLatLng([lat, lng]);
    return;
  }

  // Cria bolinha verde para o passageiro
  const pulso = L.circleMarker([lat, lng], {
    radius: 12,
    color: "#2ecc71",
    weight: 1,
    fillColor: "#2ecc71",
    fillOpacity: 0.1,
    interactive: false,
  }).addTo(window.mapaMain);

  const marker = L.circleMarker([lat, lng], {
    radius: 6,
    color: "#ffffff",
    weight: 2,
    fillColor: "#2ecc71",
    fillOpacity: 1,
  }).addTo(window.mapaMain)
    .bindPopup(`<b>${nome}</b><br><span style="font-size:11px;opacity:.8">Aguardando embarque</span>`);

  // Guarda os dois juntos para remoção
  _passageiroMarkers[pid] = { marker, pulso, setLatLng(ll) { marker.setLatLng(ll); pulso.setLatLng(ll); } };
}

function _removerPassageiroDoMapa(pid) {
  const entry = _passageiroMarkers[pid];
  if (!entry || !window.mapaMain) return;
  if (entry.marker) window.mapaMain.removeLayer(entry.marker);
  if (entry.pulso)  window.mapaMain.removeLayer(entry.pulso);
  delete _passageiroMarkers[pid];
}

// ──────────────────────────────────────────────
// INTEGRAÇÃO COM ouvirCaronas
// ──────────────────────────────────────────────

// Chamado pelo ouvirCaronas quando a carona do usuário é detectada
function sincronizarLocalizacaoCarona(caronaId, dados) {
  const passageiros   = Array.isArray(dados.passageiros) ? dados.passageiros : [];
  const participantes = Array.isArray(dados.participantes) ? dados.participantes : [];
  const ehMotorista   = dados.motoristaId === usuarioLogado.id;

  const mePassageiro = passageiros.find(p => p.id === usuarioLogado.id)
    || (participantes.includes(usuarioLogado.id) ? { id: usuarioLogado.id, entrou: false } : null);

  if (ehMotorista) {
    // Motorista: ouve localização dos outros, não publica
    pararPublicacaoLocalizacao();
    ouvirLocalizacoesPassageiros(caronaId, passageiros);
  } else if (mePassageiro) {
    if (mePassageiro.entrou) {
      // Já embarcou: para de publicar
      pararPublicacaoLocalizacao();
    } else {
      // Ainda esperando: publica minha localização
      iniciarPublicacaoLocalizacao(caronaId, usuarioLogado.id);
    }
    // Passageiro também pode ver os outros passageiros
    ouvirLocalizacoesPassageiros(caronaId, passageiros);
  } else {
    pararPublicacaoLocalizacao();
    pararOuvirLocalizacoes();
  }
}

// Para tudo quando sai do mapa
function pararLocalizacaoCompleta() {
  pararPublicacaoLocalizacao();
  pararOuvirLocalizacoes();
  Object.values(_passageiroMarkers).forEach(entry => {
    if (window.mapaMain) {
      if (entry.marker) window.mapaMain.removeLayer(entry.marker);
      if (entry.pulso)  window.mapaMain.removeLayer(entry.pulso);
    }
  });
  _passageiroMarkers = {};
}

window.sincronizarLocalizacaoCarona = sincronizarLocalizacaoCarona;
window.pararLocalizacaoCompleta     = pararLocalizacaoCompleta;
