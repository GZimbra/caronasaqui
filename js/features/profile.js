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
window.salvarFotoPerfil = salvarFotoPerfil;
window.removerFotoPerfil = removerFotoPerfil;
window.toggleMenuFotoPerfil = toggleMenuFotoPerfil;
window.abrirSeletorFotoPerfil = abrirSeletorFotoPerfil;
window.fecharMenuFotoPerfil = fecharMenuFotoPerfil;
