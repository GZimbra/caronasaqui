// Auth por matricula institucional + senha.
// Compatibilidade: login antigo por nome de usuario continua aceito.

const MATRICULA_REGEX = /^\d{8,12}$/;

function _slugNome(nome) {
  return nome.trim().toLowerCase().replace(/\s+/g, ".").replace(/[^a-z0-9.]/g, "");
}

function _emailSintetico(nome) {
  return _slugNome(nome) + "@caronasaqui.internal";
}

function normalizarMatricula(valor) {
  return String(valor || "").replace(/\D/g, "");
}

async function sha256Hex(valor) {
  const bytes = new TextEncoder().encode(valor);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function _emailMatricula(matricula) {
  const hash = await sha256Hex(normalizarMatricula(matricula));
  return `${hash}@matricula.caronasaqui.internal`;
}

function setAuthFeedback(msg, tipo = "erro") {
  const el = document.getElementById("authFeedback");
  if (!el) return;
  el.textContent = msg || "";
  el.className = `form-status auth-feedback ${tipo}`;
}

function setFieldError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg || "";
}

function limparErrosAuth() {
  ["erroNomeUsuario", "erroMatriculaUsuario", "erroFaculdadeUsuario", "erroSenha"].forEach(id => setFieldError(id, ""));
  setAuthFeedback("");
}

function atualizarInfoFaculdade() {
  const select = document.getElementById("faculdadeUsuario");
  const info = document.getElementById("faculdadeInfo");
  const faculdade = obterFaculdadePorId(select?.value || "");
  if (!info) return;
  info.textContent = faculdade ? `${faculdade.campus} - ${faculdade.endereco}` : "";
}

function initFaculdadesAuth() {
  const select = document.getElementById("faculdadeUsuario");
  popularSelectFaculdades(select);
  select?.addEventListener("change", atualizarInfoFaculdade);

  const matricula = document.getElementById("matriculaUsuario");
  matricula?.addEventListener("input", () => {
    matricula.value = normalizarMatricula(matricula.value).slice(0, 12);
  });
}

function mostrarLogin(animar) {
  window.modo = "login";
  document.getElementById("titulo").innerText = "Entrar";
  document.getElementById("btnAcao").innerText = "Entrar";
  document.getElementById("labelIdentificador").innerText = "Matricula ou usuario";
  document.getElementById("nomeUsuario").placeholder = "Ex: 2024123456";
  document.getElementById("tabLogin").classList.add("active");
  document.getElementById("tabRegister").classList.remove("active");
  document.getElementById("senha")?.setAttribute("autocomplete", "current-password");
  limparErrosAuth();

  const extras = document.getElementById("camposExtras");
  const confirmar = document.getElementById("campoConfirmarSenha");
  confirmar?.classList.remove("campos-abertos");

  if (!extras) return;

  extras.classList.remove("campos-abertos");
  if (!animar) {
    extras.style.transition = "none";
    requestAnimationFrame(() => { extras.style.transition = ""; });
  }
}

function mostrarRegistro() {
  window.modo = "registro";
  document.getElementById("titulo").innerText = "Cadastro";
  document.getElementById("btnAcao").innerText = "Registrar";
  document.getElementById("labelIdentificador").innerText = "Nome completo";
  document.getElementById("nomeUsuario").placeholder = "Ex: Gabriel Silva";
  document.getElementById("tabLogin").classList.remove("active");
  document.getElementById("tabRegister").classList.add("active");
  document.getElementById("senha")?.setAttribute("autocomplete", "new-password");
  document.getElementById("camposExtras")?.classList.add("campos-abertos");
  document.getElementById("campoConfirmarSenha")?.classList.add("campos-abertos");
  limparErrosAuth();
}

function acaoAuth() {
  if (window.modo === "login") login();
  else registrar();
}

function validarSenhaForte(senha) {
  return senha.length >= 8 && /[A-Za-z]/.test(senha) && /\d/.test(senha);
}

function validarRegistro({ nome, matricula, senha, confirma, faculdadeId }) {
  let ok = true;

  if (nome.length < 3) {
    setFieldError("erroNomeUsuario", "Informe o nome completo.");
    ok = false;
  }
  if (!MATRICULA_REGEX.test(matricula)) {
    setFieldError("erroMatriculaUsuario", "Matricula deve ter 8 a 12 digitos.");
    ok = false;
  }
  if (!obterFaculdadePorId(faculdadeId)) {
    setFieldError("erroFaculdadeUsuario", "Selecione uma faculdade valida.");
    ok = false;
  }
  if (!validarSenhaForte(senha)) {
    setFieldError("erroSenha", "Senha minima: 8 caracteres, com letras e numeros.");
    ok = false;
  } else if (senha !== confirma) {
    setFieldError("erroSenha", "A confirmacao da senha nao confere.");
    ok = false;
  }

  return ok;
}

async function login() {
  limparErrosAuth();

  const identificador = (document.getElementById("nomeUsuario")?.value || "").trim();
  const senha = (document.getElementById("senha")?.value || "").trim();

  if (!identificador || !senha) {
    const msg = "Preencha a matricula/usuario e a senha.";
    setAuthFeedback(msg, "aviso");
    showToast(msg, "aviso");
    return;
  }

  const btn = document.getElementById("btnAcao");
  btn.disabled = true;
  btn.innerText = "Entrando...";

  try {
    const matricula = normalizarMatricula(identificador);
    const email = MATRICULA_REGEX.test(matricula)
      ? await _emailMatricula(matricula)
      : _emailSintetico(identificador);

    const res = await auth.signInWithEmailAndPassword(email, senha);
    const uid = res.user.uid;

    const docSnap = await db.collection("usuarios").doc(uid).get();
    if (!docSnap.exists) {
      console.warn("[Auth Warning] Login bem-sucedido no Auth mas doc do usuário ausente. UID:", uid);
      const msg = "Matricula/usuario ou senha incorretos.";
      setAuthFeedback(msg);
      showToast(msg, "erro");
      return;
    }

    const data = docSnap.data();
    localStorage.setItem("user", JSON.stringify({
      id: uid,
      nome: data.nome,
      email: data.email || "",
      celular: data.celular || "",
      faculdadeId: data.faculdadeId || "",
      faculdadeNome: data.faculdadeNome || "",
      faculdadeCampus: data.faculdadeCampus || "",
      faculdadeEndereco: data.faculdadeEndereco || "",
      matriculaLast4: data.matriculaLast4 || "",
      curso: data.curso || "",
      foto: data.foto || "",
      tags: Array.isArray(data.tags) ? data.tags : [],
    }));
    window.location.replace("app.html");
  } catch (e) {
    // Log interno separado
    console.error("[Auth Error] Falha no login:", e.code || e.message);
    
    const msg = _traduzirErro(e.code, "login") || "Matricula/usuario ou senha incorretos.";
    setAuthFeedback(msg);
    showToast(msg, "erro");
  } finally {
    btn.disabled = false;
    btn.innerText = "Entrar";
  }
}

async function registrar() {
  limparErrosAuth();

  const nome = (document.getElementById("nomeUsuario")?.value || "").trim();
  const matricula = normalizarMatricula(document.getElementById("matriculaUsuario")?.value || "");
  const faculdadeId = document.getElementById("faculdadeUsuario")?.value || "";
  const senha = (document.getElementById("senha")?.value || "").trim();
  const confirma = (document.getElementById("confirmarSenha")?.value || "").trim();

  if (!validarRegistro({ nome, matricula, senha, confirma, faculdadeId })) {
    setAuthFeedback("Corrija os campos destacados.", "aviso");
    return;
  }

  const dadosFaculdade = montarDadosFaculdade(faculdadeId);
  const btn = document.getElementById("btnAcao");
  btn.disabled = true;
  btn.innerText = "Criando conta...";

  try {
    const matriculaHash = await sha256Hex(matricula);
    const emailAuth = `${matriculaHash}@matricula.caronasaqui.internal`;
    const res = await auth.createUserWithEmailAndPassword(emailAuth, senha);
    const uid = res.user.uid;

    await db.collection("usuarios").doc(uid).set({
      nome,
      nomeSlug: _slugNome(nome),
      email: "",
      celular: "",
      foto: "",
      tags: [],
      matriculaHash,
      matriculaLast4: matricula.slice(-4),
      ...dadosFaculdade,
      criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    });

    setAuthFeedback("Conta criada. Faca login com sua matricula.", "sucesso");
    showToast("Conta criada. Faca login com sua matricula.", "sucesso", 4000);
    await auth.signOut();
    mostrarLogin(true);
  } catch (e) {
    // Log interno separado
    console.error("[Auth Error] Falha no registro:", e.code || e.message);
    
    const msg = e.code === "auth/email-already-in-use"
      ? "Matricula ja cadastrada."
      : (_traduzirErro(e.code, "registro") || "Nao foi possivel criar a conta.");
    setAuthFeedback(msg);
    showToast(msg, "erro");
  } finally {
    btn.disabled = false;
    btn.innerText = window.modo === "registro" ? "Registrar" : "Entrar";
  }
}

function logout() {
  auth.signOut().then(() => {
    localStorage.removeItem("user");
    window.location.replace("index.html");
  });
}

function _traduzirErro(code, contexto = "login") {
  if (contexto === "login") {
    // PADRONIZAÇÃO CONTRA ENUMERAÇÃO (CWE-204)
    const errosGenericos = [
      "auth/user-not-found",
      "auth/wrong-password",
      "auth/invalid-email",
      "auth/invalid-credential"
    ];
    if (errosGenericos.includes(code)) {
      return "Matricula/usuario ou senha incorretos.";
    }
  }

  const map = {
    "auth/email-already-in-use": "Identificador ja cadastrado.",
    "auth/weak-password": "Senha muito fraca. Use ao menos 8 caracteres.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos.",
    "auth/network-request-failed": "Sem conexao com a internet.",
  };
  return map[code] || null;
}

document.addEventListener("DOMContentLoaded", () => {
  initFaculdadesAuth();
  mostrarLogin(false);
});

window.mostrarLogin = mostrarLogin;
window.mostrarRegistro = mostrarRegistro;
window.acaoAuth = acaoAuth;
window.logout = logout;
