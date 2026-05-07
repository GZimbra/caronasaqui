const FACULDADES = [
  {
    id: "dom-bosco-resende",
    nome: "Dom Bosco",
    campus: "Resende",
    endereco: "Estrada Resende-Riachuelo, 2535 - Resende, RJ",
    lat: -22.482778,
    lng: -44.472778,
  },
  {
    id: "uerj-resende",
    nome: "UERJ",
    campus: "Resende",
    endereco: "Rodovia Presidente Dutra, km 298 - Polo Industrial, Resende, RJ",
    lat: -22.452713,
    lng: -44.380222,
  },
];

function obterFaculdadePorId(id) {
  return FACULDADES.find(faculdade => faculdade.id === id) || null;
}

function popularSelectFaculdades(select, valorAtual = "") {
  if (!select) return;

  select.innerHTML = [
    '<option value="">Selecione a faculdade</option>',
    ...FACULDADES.map(faculdade => {
      const selected = faculdade.id === valorAtual ? " selected" : "";
      return `<option value="${faculdade.id}"${selected}>${faculdade.nome} - ${faculdade.campus}</option>`;
    }),
  ].join("");
}

function montarDadosFaculdade(faculdadeId) {
  const faculdade = obterFaculdadePorId(faculdadeId);
  if (!faculdade) return null;

  return {
    faculdadeId: faculdade.id,
    faculdadeNome: faculdade.nome,
    faculdadeCampus: faculdade.campus,
    faculdadeEndereco: faculdade.endereco,
    faculdadeLat: faculdade.lat,
    faculdadeLng: faculdade.lng,
  };
}

Object.assign(window, {
  FACULDADES,
  obterFaculdadePorId,
  popularSelectFaculdades,
  montarDadosFaculdade,
});
