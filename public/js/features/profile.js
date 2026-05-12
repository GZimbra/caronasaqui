const PERFIL_TAGS_DISPONIVEIS = [
  { id: "rock", label: "Rock" },
  { id: "funk", label: "Funk" },
  { id: "sertanejo", label: "Sertanejo" },
  { id: "eletronica", label: "Eletronica" },
  { id: "falante", label: "Falante" },
  { id: "quieto", label: "Quieto" },
  { id: "pontual", label: "Pontual" },
  { id: "sem-fumaca", label: "Sem fumaca" },
];

function normalizarTagsPerfil(tags) {
  if (!Array.isArray(tags)) return [];
  const permitidas = new Set(PERFIL_TAGS_DISPONIVEIS.map(tag => tag.id));
  return [...new Set(tags.filter(tag => permitidas.has(tag)))];
}

function obterTagsPerfilSelecionadas() {
  return Array.from(document.querySelectorAll('input[name="perfilTags"]:checked'))
    .map(input => input.value);
}

function renderTagsPerfilSelecionaveis(tagsSelecionadas = []) {
  const selecionadas = new Set(normalizarTagsPerfil(tagsSelecionadas));

  return PERFIL_TAGS_DISPONIVEIS.map(tag => `
    <label class="profile-tag-option">
      <input type="checkbox" name="perfilTags" value="${tag.id}" ${selecionadas.has(tag.id) ? "checked" : ""}>
      <span>${tag.label}</span>
    </label>
  `).join("");
}

function renderTagsPerfil(tags = []) {
  const normalizadas = normalizarTagsPerfil(tags);
  if (!normalizadas.length) {
    return '<p class="empty-inline">Nenhuma tag selecionada.</p>';
  }

  return `
    <div class="profile-tags-list">
      ${normalizadas.map(tagId => {
        const tag = PERFIL_TAGS_DISPONIVEIS.find(item => item.id === tagId);
        return `<span class="profile-tag">${esc(tag?.label || tagId)}</span>`;
      }).join("")}
    </div>
  `;
}

function criarAvatarHTML(usuario, extraClass = "", elementId = "") {
  const nome = usuario?.nome || "Usuário";
  const inicial = nome.charAt(0).toUpperCase();
  const foto = usuario?.foto || "";
  const idAttr = elementId ? ` id="${elementId}"` : "";
  const classes = ["avatar", extraClass, foto ? "has-photo" : ""]
    .filter(Boolean)
    .join(" ");

  const overlay = extraClass.includes("avatar-perfil")
    ? `<span class="avatar-overlay">${ICONS.camera} Alterar foto</span>`
    : "";

  if (foto) {
    return `
      <div${idAttr} class="${classes}">
        <img src="${foto}" alt="${nome}">
        ${overlay}
      </div>
    `;
  }

  return `
    <div${idAttr} class="${classes}">
      ${inicial}
      ${overlay}
    </div>
  `;
}

function atualizarUsuarioLocal(dados) {
  window.usuarioLogado = { ...window.usuarioLogado, ...dados };
  localStorage.setItem("user", JSON.stringify(window.usuarioLogado));
}

function atualizarAvataresDoUsuario() {
  const sidebarAvatar = document.querySelector(".user .user-avatar");
  if (sidebarAvatar) {
    sidebarAvatar.outerHTML = criarAvatarHTML(window.usuarioLogado, "user-avatar");
  }

  const profileAvatar = document.getElementById("perfilAvatarPreview");
  if (profileAvatar) {
    profileAvatar.outerHTML = criarAvatarHTML(
      window.usuarioLogado,
      "avatar-perfil",
      "perfilAvatarPreview"
    );
  }
}

function preencherFormularioPerfil(dados) {
  const campos = {
    perfilNome: dados.nome || "",
    perfilEmail: dados.email || "",
    perfilCelular: dados.celular || "",
  };

  Object.entries(campos).forEach(([id, valor]) => {
    const input = document.getElementById(id);
    if (input) input.value = valor;
  });

  popularSelectFaculdades(document.getElementById("perfilFaculdade"), dados.faculdadeId || "");
  const tagsContainer = document.getElementById("perfilTagsOpcoes");
  if (tagsContainer) tagsContainer.innerHTML = renderTagsPerfilSelecionaveis(dados.tags || []);
  const tagsPreview = document.getElementById("perfilTagsPreview");
  if (tagsPreview) tagsPreview.innerHTML = renderTagsPerfil(dados.tags || []);
  atualizarInfoFaculdadePerfil();
}

function atualizarInfoFaculdadePerfil() {
  const faculdade = obterFaculdadePorId(document.getElementById("perfilFaculdade")?.value || "");
  const info = document.getElementById("perfilFaculdadeInfo");
  if (info) info.textContent = faculdade ? `${faculdade.campus} - ${faculdade.endereco}` : "";
}

async function carregarPerfilAutenticado() {
  if (!window.usuarioLogado?.id) return;

  const status = document.getElementById("perfilFormStatus");
  try {
    if (status) status.textContent = "Carregando dados atualizados...";

    const snap = await db.collection("usuarios").doc(usuarioLogado.id).get();
    if (!snap.exists) {
      if (status) status.textContent = "Perfil nao encontrado.";
      return;
    }

    const dados = snap.data();
    atualizarUsuarioLocal({
      nome: dados.nome || usuarioLogado.nome,
      email: dados.email || usuarioLogado.email,
      celular: dados.celular || "",
      faculdadeId: dados.faculdadeId || "",
      faculdadeNome: dados.faculdadeNome || "",
      faculdadeCampus: dados.faculdadeCampus || "",
      faculdadeEndereco: dados.faculdadeEndereco || "",
      matriculaLast4: dados.matriculaLast4 || usuarioLogado.matriculaLast4 || "",
      curso: dados.curso || "",
      foto: dados.foto || "",
      tags: normalizarTagsPerfil(dados.tags),
    });

    preencherFormularioPerfil(window.usuarioLogado);
    atualizarAvataresDoUsuario();

    const titulo = document.querySelector(".perfil-topo h2");
    const email = document.querySelector(".perfil-topo p");
    if (titulo) titulo.textContent = window.usuarioLogado.nome || "Usuario";
    if (email) email.textContent = window.usuarioLogado.email || "";

    if (status) status.textContent = "";
  } catch {
    if (status) status.textContent = "Nao foi possivel carregar os dados atuais.";
  }
}

function validarDadosPerfil(dados) {
  if (dados.nome.length < 3) return "Nome deve ter ao menos 3 caracteres.";
  if (dados.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email)) return "Email invalido.";
  if (dados.celular && !/^\+?[\d\s().-]{10,20}$/.test(dados.celular)) return "Celular invalido.";
  if (!obterFaculdadePorId(dados.faculdadeId)) return "Selecione uma faculdade valida.";
  return "";
}

async function salvarDadosPerfil(event) {
  event?.preventDefault();

  const btn = document.getElementById("btnSalvarPerfil");
  const status = document.getElementById("perfilFormStatus");
  const dados = {
    nome: (document.getElementById("perfilNome")?.value || "").trim(),
    email: (document.getElementById("perfilEmail")?.value || "").trim(),
    celular: (document.getElementById("perfilCelular")?.value || "").trim(),
    faculdadeId: document.getElementById("perfilFaculdade")?.value || "",
    tags: obterTagsPerfilSelecionadas(),
  };

  const erro = validarDadosPerfil(dados);
  if (erro) {
    if (status) status.textContent = erro;
    showToast(erro, "aviso");
    return;
  }

  const dadosFaculdade = montarDadosFaculdade(dados.faculdadeId);

  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Salvando...";
    }
    if (status) status.textContent = "";

    await db.collection("usuarios").doc(usuarioLogado.id).set({
      ...dados,
      ...dadosFaculdade,
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    atualizarUsuarioLocal({ ...dados, ...dadosFaculdade, tags: normalizarTagsPerfil(dados.tags) });
    atualizarAvataresDoUsuario();
    const tagsPreview = document.getElementById("perfilTagsPreview");
    if (tagsPreview) tagsPreview.innerHTML = renderTagsPerfil(dados.tags);

    const userLabel = document.querySelector(".user span");
    const titulo = document.querySelector(".perfil-topo h2");
    const email = document.querySelector(".perfil-topo p");
    if (userLabel) userLabel.textContent = dados.nome;
    if (titulo) titulo.textContent = dados.nome;
    if (email) email.textContent = dados.email;

    if (status) status.textContent = "Perfil atualizado.";
    showToast("Perfil atualizado com sucesso.", "sucesso");
  } catch {
    if (status) status.textContent = "Nao foi possivel salvar o perfil.";
    showToast("Nao foi possivel salvar o perfil.", "erro");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Salvar perfil";
    }
  }
}

function obterUsuarioFirebaseAtual() {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);

  return new Promise(resolve => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      unsubscribe();
      resolve(user);
    });
  });
}

function validarNovaSenha(senha, confirma) {
  if (senha.length < 8) return "A nova senha deve ter ao menos 8 caracteres.";
  if (!/[A-Za-z]/.test(senha) || !/\d/.test(senha)) return "Use letras e numeros na nova senha.";
  if (senha !== confirma) return "A confirmacao da senha nao confere.";
  return "";
}

async function alterarSenhaPerfil(event) {
  event?.preventDefault();

  const atual = document.getElementById("senhaAtualPerfil")?.value || "";
  const nova = document.getElementById("novaSenhaPerfil")?.value || "";
  const confirma = document.getElementById("confirmarNovaSenhaPerfil")?.value || "";
  const btn = document.getElementById("btnAlterarSenha");
  const status = document.getElementById("senhaPerfilStatus");

  const erro = validarNovaSenha(nova, confirma);
  if (erro) {
    if (status) status.textContent = erro;
    showToast(erro, "aviso");
    return;
  }

  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Alterando...";
    }
    if (status) status.textContent = "";

    const user = await obterUsuarioFirebaseAtual();
    if (!user) throw new Error("Sessao expirada");

    const credential = firebase.auth.EmailAuthProvider.credential(user.email, atual);
    await user.reauthenticateWithCredential(credential);
    await user.updatePassword(nova);

    ["senhaAtualPerfil", "novaSenhaPerfil", "confirmarNovaSenhaPerfil"].forEach(id => {
      const input = document.getElementById(id);
      if (input) input.value = "";
    });

    if (status) status.textContent = "Senha alterada com sucesso.";
    showToast("Senha alterada com sucesso.", "sucesso");
  } catch (error) {
    const msg = error?.code === "auth/wrong-password" || error?.code === "auth/invalid-credential"
      ? "Senha atual incorreta."
      : "Nao foi possivel alterar a senha.";
    if (status) status.textContent = msg;
    showToast(msg, "erro");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Alterar senha";
    }
  }
}

function toggleMenuFotoPerfil(event) {
  event?.preventDefault();
  event?.stopPropagation();
  const menu = document.getElementById("menuFotoPerfil");
  if (!menu) return;
  menu.classList.toggle("hidden");
}

function fecharMenuFotoPerfil() {
  const menu = document.getElementById("menuFotoPerfil");
  if (menu) menu.classList.add("hidden");
}

function abrirSeletorFotoPerfil() {
  fecharMenuFotoPerfil();
  document.getElementById("fotoPerfilInput")?.click();
}

document.addEventListener("click", event => {
  const area = document.getElementById("perfilFotoArea");
  if (!area || area.contains(event.target)) return;
  fecharMenuFotoPerfil();
});

document.addEventListener("change", event => {
  if (event.target?.id === "perfilFaculdade") atualizarInfoFaculdadePerfil();
  if (event.target?.name === "perfilTags") {
    const preview = document.getElementById("perfilTagsPreview");
    if (preview) preview.innerHTML = renderTagsPerfil(obterTagsPerfilSelecionadas());
  }
});

// =========================
// FIREBASE STORAGE
// Foto enviada ao Storage; apenas a URL fica no Firestore.
// Evita o limite de 1MB por documento.
// =========================

function redimensionarImagem(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = event => {
      const img = new Image();
      img.onload = () => {
        const maxSize = 256;
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          blob => blob ? resolve(blob) : reject(new Error("Erro ao gerar imagem")),
          "image/jpeg",
          0.82
        );
      };
      img.onerror = () => reject(new Error("Não foi possível ler a imagem"));
      img.src = event.target.result;
    };
    reader.onerror = () => reject(new Error("Erro ao abrir o arquivo"));
    reader.readAsDataURL(file);
  });
}

async function salvarFotoPerfil(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    showToast("Selecione uma imagem válida (JPG, PNG ou WebP).", "aviso");
    return;
  }

  const status = document.getElementById("perfilFotoStatus");

  try {
    if (status) status.innerText = "Salvando foto...";

    const blob = await redimensionarImagem(file);

    // Upload para Firebase Storage (não salva base64 no Firestore)
    const ref = storage.ref(`fotos_perfil/${usuarioLogado.id}`);
    await ref.put(blob, { contentType: "image/jpeg" });
    const fotoURL = await ref.getDownloadURL();

    await db.collection("usuarios").doc(usuarioLogado.id).set(
      { foto: fotoURL },
      { merge: true }
    );

    atualizarUsuarioLocal({ foto: fotoURL });
    atualizarAvataresDoUsuario();
    fecharMenuFotoPerfil();

    if (status) status.innerText = "Foto atualizada com sucesso";
  } catch (error) {
    console.error("Erro ao salvar foto de perfil:", error);
    if (status) status.innerText = "Não foi possível salvar a foto.";
    showToast("Não foi possível salvar a foto. Tente novamente.", "erro");
  } finally {
    if (event?.target) event.target.value = "";
  }
}

async function removerFotoPerfil() {
  const status = document.getElementById("perfilFotoStatus");

  try {
    if (status) status.innerText = "Removendo foto...";

    // Tenta remover do Storage (pode não existir se era base64 antigo)
    try {
      await storage.ref(`fotos_perfil/${usuarioLogado.id}`).delete();
    } catch (e) {
      if (e.code !== "storage/object-not-found") {
        console.warn("Aviso ao remover do Storage:", e);
      }
    }

    await db.collection("usuarios").doc(usuarioLogado.id).set(
      { foto: "" },
      { merge: true }
    );

    atualizarUsuarioLocal({ foto: "" });
    atualizarAvataresDoUsuario();
    fecharMenuFotoPerfil();

    if (status) status.innerText = "Foto removida com sucesso.";
  } catch (error) {
    console.error("Erro ao remover foto de perfil:", error);
    if (status) status.innerText = "Não foi possível remover a foto.";
    showToast("Não foi possível remover a foto. Tente novamente.", "erro");
  }
}

window.criarAvatarHTML = criarAvatarHTML;
window.atualizarAvataresDoUsuario = atualizarAvataresDoUsuario;
window.carregarPerfilAutenticado = carregarPerfilAutenticado;
window.salvarDadosPerfil = salvarDadosPerfil;
window.alterarSenhaPerfil = alterarSenhaPerfil;
window.salvarFotoPerfil = salvarFotoPerfil;
window.removerFotoPerfil = removerFotoPerfil;
window.toggleMenuFotoPerfil = toggleMenuFotoPerfil;
window.abrirSeletorFotoPerfil = abrirSeletorFotoPerfil;
window.fecharMenuFotoPerfil = fecharMenuFotoPerfil;
