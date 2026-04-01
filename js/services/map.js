window.mapaMain = null;
window.mapaPopup = null;
window.origem = null;
window.destino = null;
window.rotaCoords = null;
window.ouvirCaronasUnsub = null;
window.localizacaoWatchId = null;
window.mapaRenderToken = 0;

function initMapMain() {
  const el = document.getElementById("mapMain");
  if (!el) return;

  if (window.mapaMain) {
    window.mapaMain.remove();
    window.mapaMain = null;
  }

  window._localizacaoCentralizada = false;
  window.mapaMain = L.map(el).setView([-22.49, -44.56], 13);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png")
    .addTo(window.mapaMain);

  ouvirCaronas();
  iniciarLocalizacao();
}

async function buscarEndereco(lat, lng) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
  );

  const data = await res.json();
  return data.display_name || "Local selecionado";
}

function initMapPopup() {
  const el = document.getElementById("mapSelect");
  if (!el) return;

  if (window.mapaPopup) {
    window.mapaPopup.remove();
  }

  window.mapaPopup = L.map(el).setView([-22.49, -44.56], 13);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png")
    .addTo(window.mapaPopup);

  window.origemMarker = null;
  window.destinoMarker = null;

  window.mapaPopup.on("click", async e => {
    const { lat, lng } = e.latlng;
    const modoAtual = window.modo;

    if (modoAtual === "origem") {
      window.origem = { lat, lng };

      if (window.origemMarker) {
        window.mapaPopup.removeLayer(window.origemMarker);
      }

      window.origemMarker = L.marker([lat, lng])
        .addTo(window.mapaPopup)
        .bindPopup("Origem")
        .openPopup();

      const endereco = await buscarEndereco(lat, lng);
      window.origemEndereco = endereco;

      const origemEl = document.getElementById("origemTxt");
      if (origemEl) origemEl.innerText = endereco.split(",").slice(0, 2).join(",");

      window.modo = "destino";
      window.atualizarModoSelecao?.();

    } else if (modoAtual === "destino") {
      window.destino = { lat, lng };

      if (window.destinoMarker) {
        window.mapaPopup.removeLayer(window.destinoMarker);
      }

      window.destinoMarker = L.marker([lat, lng])
        .addTo(window.mapaPopup)
        .bindPopup("Destino")
        .openPopup();

      const endereco = await buscarEndereco(lat, lng);
      window.destinoEndereco = endereco;

      const destinoEl = document.getElementById("destinoTxt");
      if (destinoEl) destinoEl.innerText = endereco.split(",").slice(0, 2).join(",");

      window.modo = null;
      window.atualizarModoSelecao?.();

    } else {
      // Modo null: reclica → reativa modo origem para ajuste
      window.modo = "origem";
      window.atualizarModoSelecao?.();
      return;
    }

    if (window.origem && window.destino) {
      desenharRotaReal();
    }
  });
}
// ============================================================
// ROTEAMENTO — tenta APIs em ordem até obter uma rota real
// ============================================================

async function buscarRotaReal(o, d) {
  // Tentativa 1: OSRM demo (mais rápido, mas às vezes bloqueia)
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${o.lng},${o.lat};${d.lng},${d.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const data = await res.json();
      if (data.code === "Ok" && data.routes?.[0]?.geometry?.coordinates?.length > 2) {
        return data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
      }
    }
  } catch (e) { /* tenta próximo */ }

  // Tentativa 2: OSRM via openstreetmap.de
  try {
    const url = `https://routing.openstreetmap.de/routed-car/route/v1/driving/${o.lng},${o.lat};${d.lng},${d.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const data = await res.json();
      if (data.code === "Ok" && data.routes?.[0]?.geometry?.coordinates?.length > 2) {
        return data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
      }
    }
  } catch (e) { /* tenta próximo */ }

  // Tentativa 3: Valhalla público (suporta CORS, mantido pela comunidade OSM)
  try {
    const body = JSON.stringify({
      locations: [
        { lon: o.lng, lat: o.lat },
        { lon: d.lng, lat: d.lat },
      ],
      costing: "auto",
      shape_match: "map_snap",
    });
    const res = await fetch("https://valhalla1.openstreetmap.de/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const data = await res.json();
      const legs = data.trip?.legs;
      if (legs?.[0]?.shape) {
        // Valhalla usa encoded polyline — decodifica manualmente
        return _decodePolyline(legs[0].shape);
      }
    }
  } catch (e) { /* sem fallback real disponível */ }

  // Fallback final: linha reta (visualmente indica que não há rota)
  console.warn("Todas as APIs de rota falharam — usando linha reta");
  return gerarLinhaRetaSuavizada(o, d);
}

// Gera pontos interpolados em linha reta quando todas as APIs falham
function gerarLinhaRetaSuavizada(o, d) {
  const pontos = [];
  const steps  = 20;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pontos.push([
      o.lat + (d.lat - o.lat) * t,
      o.lng + (d.lng - o.lng) * t,
    ]);
  }
  return pontos;
}

// Decodifica encoded polyline do Valhalla (precision 6)
function _decodePolyline(encoded, precision = 6) {
  const factor = Math.pow(10, precision);
  const coords = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : result >> 1;
    coords.push([lat / factor, lng / factor]);
  }
  return coords;
}

function iniciarLocalizacao() {
  if (!navigator.geolocation) return;

  if (window.localizacaoWatchId !== null) {
    navigator.geolocation.clearWatch(window.localizacaoWatchId);
  }

  window.localizacaoWatchId = navigator.geolocation.watchPosition(pos => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    if (!window.mapaMain) return;

    // Remove marcadores antigos
    if (window.userMarker) {
      window.mapaMain.removeLayer(window.userMarker);
    }
    if (window.userPulse) {
      window.mapaMain.removeLayer(window.userPulse);
    }

    // Anel externo pulsante (efeito "radar")
    window.userPulse = L.circleMarker([lat, lng], {
      radius: 14,
      color: "#4f9eff",
      weight: 1.5,
      fillColor: "#4f9eff",
      fillOpacity: 0.12,
      interactive: false,
    }).addTo(window.mapaMain);

    // Bolinha sólida central
    window.userMarker = L.circleMarker([lat, lng], {
      radius: 7,
      color: "#ffffff",
      weight: 2,
      fillColor: "#4f9eff",
      fillOpacity: 1,
    }).addTo(window.mapaMain).bindPopup("Você está aqui");

    window.userLocation = { lat, lng };

    // Centraliza apenas na primeira leitura de posição
    if (!window._localizacaoCentralizada) {
      window._localizacaoCentralizada = true;
      window.mapaMain.setView([lat, lng], 15);
    }
  }, () => {}, { enableHighAccuracy: true });
}

window.carros = {};
window.rotas  = {};

// Status que significam carona ativa (rota deve aparecer no mapa)
const STATUS_ATIVO = new Set(["aberta", "em_andamento", "lotada", "a_caminho", "chegou"]);
// Status que significam carona encerrada (rota deve sumir)
const STATUS_ENCERRADO = new Set(["finalizada", "cancelada"]);

function deveMostrarCaronaNoMapa(carona) {
  if (!window.usuarioLogado) return false;

  const status = carona.status || "aberta";
  if (!STATUS_ATIVO.has(status)) return false;

  const participantes = Array.isArray(carona.participantes) ? carona.participantes : [];
  const passageiros   = Array.isArray(carona.passageiros)   ? carona.passageiros   : [];

  const ehMotorista   = carona.motoristaId === usuarioLogado.id;
  const ehParticipante =
    participantes.includes(usuarioLogado.id) ||
    passageiros.some(p => p.id === usuarioLogado.id);

  return ehMotorista || ehParticipante;
}

function ouvirCaronas() {
  if (window.ouvirCaronasUnsub) {
    window.ouvirCaronasUnsub();
  }

  // IDs de caronas atualmente renderizadas
  const renderizadas = new Set();

  window.ouvirCaronasUnsub = db.collection("caronas")
    .onSnapshot(snapshot => {
      if (!window.mapaMain) return;

      // Incrementa token para cancelar fetches de rota antigos
      window.mapaRenderToken += 1;
      const renderToken = window.mapaRenderToken;

      // IDs que devem estar no mapa nesse ciclo
      const deveExibir = new Set();

      snapshot.forEach(doc => {
        const d  = doc.data();
        const id = doc.id;

        if (!d.origem || !d.destino) return;

        const deveAparecer = deveMostrarCaronaNoMapa(d);
        const encerrada    = STATUS_ENCERRADO.has(d.status);

        // Remove se encerrada ou o usuário saiu da carona
        if (encerrada || !deveAparecer) {
          _removerCaronaDoMapa(id);
          renderizadas.delete(id);
          return;
        }

        deveExibir.add(id);

        // Sincroniza localização dos passageiros para essa carona
        sincronizarLocalizacaoCarona(id, d);

        // Só desenha se ainda não estava no mapa (evita redesenho a cada update)
        if (!renderizadas.has(id)) {
          renderizadas.add(id);
          _adicionarCaronaNoMapa(id, d, renderToken);
        } else {
          // Atualiza popup se já existir (dados podem ter mudado)
          _atualizarPopupCarona(id, d);
        }
      });

      // Remove do mapa caronas que sumiram do snapshot (deleted)
      for (const id of [...renderizadas]) {
        if (!deveExibir.has(id)) {
          _removerCaronaDoMapa(id);
          renderizadas.delete(id);
        }
      }

    }, error => {
      console.error("Erro ao ouvir caronas no mapa:", error);
    });
}

function _adicionarCaronaNoMapa(id, d, renderToken) {
  const ehMotorista = d.motoristaId === usuarioLogado.id;
  const titulo      = ehMotorista ? "Sua carona" : "Seu embarque";
  const corPin      = ehMotorista ? "#4f9eff" : "#2ecc71";

  // Pin de origem
  const origemIcon = L.divIcon({
    className: "",
    html: `<div style="
      width:14px;height:14px;border-radius:50%;
      background:${corPin};border:2px solid #fff;
      box-shadow:0 0 6px ${corPin}88;
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });

  const marker = L.marker([d.origem.lat, d.origem.lng], { icon: origemIcon })
    .addTo(window.mapaMain)
    .bindPopup(_popupCarona(titulo, d));

  // Pin de destino (menor)
  const destinoIcon = L.divIcon({
    className: "",
    html: `<div style="
      width:10px;height:10px;border-radius:50%;
      border:2px solid ${corPin};background:transparent;
      box-shadow:0 0 4px ${corPin}66;
    "></div>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  });

  const destinoMarker = L.marker([d.destino.lat, d.destino.lng], { icon: destinoIcon })
    .addTo(window.mapaMain)
    .bindPopup(`<b>Destino</b><br>${(d.destinoEndereco || "Destino").split(",").slice(0, 2).join(",")}`);

  window.carros[id] = marker;
  window.carros[id + "_destino"] = destinoMarker;

  desenharRotaCarona(id, d.origem, d.destino, renderToken, corPin);
}

function _removerCaronaDoMapa(id) {
  [id, id + "_destino"].forEach(k => {
    if (window.carros[k]) {
      if (window.mapaMain?.hasLayer(window.carros[k])) {
        window.mapaMain.removeLayer(window.carros[k]);
      }
      delete window.carros[k];
    }
  });

  if (window.rotas[id]) {
    if (window.mapaMain?.hasLayer(window.rotas[id])) {
      window.mapaMain.removeLayer(window.rotas[id]);
    }
    delete window.rotas[id];
  }
}

function _atualizarPopupCarona(id, d) {
  const marker = window.carros[id];
  if (!marker) return;
  const titulo = d.motoristaId === usuarioLogado.id ? "Sua carona" : "Seu embarque";
  marker.setPopupContent(_popupCarona(titulo, d));
}

function _popupCarona(titulo, d) {
  const vagas = d.vagas !== undefined ? d.vagas : "?";
  const preco = d.preco && d.preco !== "0" ? `R$ ${d.preco}` : "Gratuita";
  return `
    <b>${titulo}</b><br>
    <span style="font-size:11px;opacity:.8">
      ${(d.origemEndereco || "Origem").split(",").slice(0, 2).join(",")}<br>
      → ${(d.destinoEndereco || "Destino").split(",").slice(0, 2).join(",")}<br>
      ${preco} · ${vagas} vaga(s)
    </span>
  `;
}

window.userLocation = null;

function pegarLocalizacao(){

  navigator.geolocation.getCurrentPosition(pos => {

    window.userLocation = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude
    };

    console.log("Localização:", window.userLocation);

  }, () => {
    console.warn("Localização não permitida");
  });

}

async function desenharRotaReal() {
  if (!window.origem || !window.destino) return;

  // Remove rota antiga
  if (window.rotaLinha) {
    window.mapaPopup.removeLayer(window.rotaLinha);
    window.rotaLinha = null;
  }

  // Feedback visual de carregamento
  const hint = document.getElementById("modoSelecaoTxt");
  if (hint) hint.innerText = "Calculando rota...";

  try {
    const coords = await buscarRotaReal(window.origem, window.destino);

    if (!window.mapaPopup) return; // popup pode ter sido fechado

    window.rotaLinha = L.polyline(coords, {
      color: "#4f9eff",
      weight: 4,
      opacity: 0.85,
      dashArray: null,
    }).addTo(window.mapaPopup);

    window.mapaPopup.fitBounds(window.rotaLinha.getBounds(), { padding: [30, 30] });
    window.rotaCoords = coords;

    if (hint) hint.innerText = "Rota calculada. Ajuste os pontos se necessário.";
  } catch (err) {
    console.error("Erro ao desenhar rota:", err);
    if (hint) hint.innerText = "Não foi possível calcular a rota. Tente novamente.";
  }
}

async function pegarEndereco(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;

    const res = await fetch(url, {
      headers: {
        "Accept": "application/json"
      }
    });

    const data = await res.json();

    if (data && data.address) {
      const addr = data.address;

      // Rua: nome da via ou ponto de referência
      const rua = addr.road || addr.pedestrian || addr.footway || addr.path || addr.amenity || addr.tourism || "";

      // Número
      const numero = addr.house_number ? `, ${addr.house_number}` : "";

      // Bairro
      const bairro = addr.suburb || addr.neighbourhood || addr.city_district || addr.quarter || "";

      // Cidade
      const cidade = addr.city || addr.town || addr.village || addr.municipality || "";

      // Estado (sigla)
      const estadoCompleto = addr.state || "";
      const estadoSiglas = {
        "Acre": "AC", "Alagoas": "AL", "Amapá": "AP", "Amazonas": "AM",
        "Bahia": "BA", "Ceará": "CE", "Distrito Federal": "DF", "Espírito Santo": "ES",
        "Goiás": "GO", "Maranhão": "MA", "Mato Grosso": "MT", "Mato Grosso do Sul": "MS",
        "Minas Gerais": "MG", "Pará": "PA", "Paraíba": "PB", "Paraná": "PR",
        "Pernambuco": "PE", "Piauí": "PI", "Rio de Janeiro": "RJ", "Rio Grande do Norte": "RN",
        "Rio Grande do Sul": "RS", "Rondônia": "RO", "Roraima": "RR", "Santa Catarina": "SC",
        "São Paulo": "SP", "Sergipe": "SE", "Tocantins": "TO"
      };
      const estado = estadoSiglas[estadoCompleto] || estadoCompleto;

      const partes = [
        rua ? `${rua}${numero}` : "",
        bairro,
        cidade,
        estado
      ].filter(Boolean);

      if (partes.length > 0) {
        return partes.join(", ");
      }
    }

    return data.display_name || "Endereço não encontrado";
  } catch (error) {
    console.error("Erro ao buscar endereço:", error);
    return "Endereço não encontrado";
  }
}

// ──────────────────────────────────────────────
// LOADING OVERLAY DO MAPA
// ──────────────────────────────────────────────

function _mostrarLoadingMapa(msg = "Calculando rota...") {
  const el = document.getElementById("mapMain");
  if (!el) return;

  _esconderLoadingMapa(); // remove anterior

  const overlay = document.createElement("div");
  overlay.id = "mapaLoadingOverlay";
  overlay.style.cssText = `
    position:absolute;inset:0;z-index:1000;
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    background:rgba(8,11,16,0.72);backdrop-filter:blur(4px);
    border-radius:inherit;pointer-events:none;gap:14px;
  `;
  overlay.innerHTML = `
    <div style="
      width:36px;height:36px;border-radius:50%;
      border:3px solid rgba(79,158,255,0.2);
      border-top-color:#4f9eff;
      animation:mapaSpinner 0.8s linear infinite;
    "></div>
    <span style="color:#8892a0;font-size:13px;font-family:inherit;letter-spacing:.02em">${msg}</span>
    <style>
      @keyframes mapaSpinner { to { transform: rotate(360deg); } }
    </style>
  `;

  // O elemento pai do mapa precisa ser relative
  const pai = el.parentElement;
  if (pai) {
    pai.style.position = "relative";
    pai.appendChild(overlay);
  }
}

function _esconderLoadingMapa() {
  document.getElementById("mapaLoadingOverlay")?.remove();
}

async function desenharRotaCarona(id, origem, destino, renderToken = window.mapaRenderToken, cor = "#4f9eff") {
  _mostrarLoadingMapa("Calculando rota...");
  try {
    const coords = await buscarRotaReal(origem, destino);

    if (renderToken !== window.mapaRenderToken || !window.mapaMain) {
      _esconderLoadingMapa();
      return;
    }

    if (window.rotas[id] && window.mapaMain.hasLayer(window.rotas[id])) {
      window.mapaMain.removeLayer(window.rotas[id]);
    }

    const linha = L.polyline(coords, {
      color: cor,
      weight: 4,
      opacity: 0.75,
    }).addTo(window.mapaMain);

    window.rotas[id] = linha;

    window.mapaMain.fitBounds(linha.getBounds(), { padding: [40, 40], maxZoom: 15 });
  } catch (error) {
    console.error("Erro ao desenhar rota da carona:", error);
  } finally {
    _esconderLoadingMapa();
  }
}

async function usarLocalAtual() {
  if (!window.userLocation) {
    showToast("Permita o acesso à localização no navegador.", "aviso");
    return;
  }

  const { lat, lng } = window.userLocation;

  window.origem = { lat, lng };
  window.origemEndereco = "Local Atual";

  if (window.origemMarker) {
    window.mapaPopup.removeLayer(window.origemMarker);
  }

  window.origemMarker = L.marker([lat, lng])
    .addTo(window.mapaPopup)
    .bindPopup("Você está aqui")
    .openPopup();

  document.getElementById("origemTxt").innerText =
    "Local Atual";

  window.modo = "destino";
  window.atualizarModoSelecao?.();

  if (window.destino) {
    desenharRotaReal();
  }
}

function usarDomBosco() {
  const local = window.LOCAL_DOM_BOSCO;

  window.destino = {
    lat: local.lat,
    lng: local.lng
  };

  window.destinoEndereco = local.nome;

  if (window.destinoMarker) {
    window.mapaPopup.removeLayer(window.destinoMarker);
  }

  window.destinoMarker = L.marker([local.lat, local.lng])
    .addTo(window.mapaPopup)
    .bindPopup("Dom Bosco")
    .openPopup();

  document.getElementById("destinoTxt").innerText =
    local.nome;

  window.modo = null;
  window.atualizarModoSelecao?.();

  if (window.origem) {
    desenharRotaReal();
  }
}

window.LOCAL_DOM_BOSCO = {
  lat: -22.4829018,
  lng: -44.472886,
  nome: "Faculdade Dom Bosco"
};

window.pegarEndereco = pegarEndereco;
window.usarLocalAtual = usarLocalAtual;
window.usarDomBosco = usarDomBosco;