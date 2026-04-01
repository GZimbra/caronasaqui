// =========================
// ANIMAÇÃO DE ALTURA DO FORMULÁRIO
// =========================
// Usa grid-template-rows: 0fr ↔ 1fr para animar altura sem medir nada
// Cada campo extra fica dentro de um wrapper com overflow:hidden

function mostrarLogin(animar){
  window.modo = "login";
  document.getElementById("titulo").innerText = "Entrar";
  document.getElementById("btnAcao").innerText = "Entrar";
  document.getElementById("tabLogin").classList.add("active");
  document.getElementById("tabRegister").classList.remove("active");

  const extras = document.getElementById("camposExtras");
  if (extras) {
    if (animar) {
      extras.classList.remove("campos-abertos");
    } else {
      extras.classList.remove("campos-abertos");
      extras.style.transition = "none";
      requestAnimationFrame(() => { extras.style.transition = ""; });
    }
  }
}

function mostrarRegistro(){
  window.modo = "registro";
  document.getElementById("titulo").innerText = "Cadastro";
  document.getElementById("btnAcao").innerText = "Registrar";
  document.getElementById("tabLogin").classList.remove("active");
  document.getElementById("tabRegister").classList.add("active");

  const extras = document.getElementById("camposExtras");
  if (extras) extras.classList.add("campos-abertos");
}

// =========================
// AÇÃO PRINCIPAL
// =========================

function acaoAuth(){
  if(window.modo === "login") login();
  else registrar();
}

// =========================
// LOGIN NORMAL
// =========================

async function login(){
  const email = document.getElementById("email").value.trim();
  const senha = document.getElementById("senha").value.trim();

  if(!email || !senha){
    showToast("Preencha o email e a senha para continuar.", "aviso");
    return;
  }

  const btn = document.getElementById("btnAcao");
  btn.disabled = true;
  btn.innerText = "Entrando...";

  try{
    const res = await auth.signInWithEmailAndPassword(email, senha);
    const uid = res.user.uid;

    const doc = await db.collection("usuarios").doc(uid).get();

    if(!doc.exists){
      showToast("Usuário não encontrado. Verifique seu email.", "erro");
      btn.disabled = false;
      btn.innerText = "Entrar";
      return;
    }

    const data = doc.data();
    const usuarioLogado = {
      id: uid,
      nome: data.nome,
      email: data.email,
      celular: data.celular,
      curso: data.curso,
      foto: data.foto || data.photoURL || ""
    };

    localStorage.setItem("user", JSON.stringify(usuarioLogado));
    window.location.replace("app.html");

  }catch(e){
    const msg = _traduzirErroFirebase(e.code) || "Não foi possível entrar. Tente novamente.";
    showToast(msg, "erro");
    btn.disabled = false;
    btn.innerText = "Entrar";
  }
}

// =========================
// REGISTRO
// =========================

async function registrar(){
  const nome    = document.getElementById("nome").value.trim();
  const celular = document.getElementById("celular").value.trim();
  const curso   = document.getElementById("curso").value.trim();
  const email   = document.getElementById("email").value.trim();
  const senha   = document.getElementById("senha").value.trim();

  if(!nome || !celular || !curso || !email || !senha){
    showToast("Preencha todos os campos para se cadastrar.", "aviso");
    return;
  }

  const btn = document.getElementById("btnAcao");
  btn.disabled = true;
  btn.innerText = "Criando conta...";

  try{
    const res = await auth.createUserWithEmailAndPassword(email, senha);
    const uid = res.user.uid;

    await db.collection("usuarios").doc(uid).set({ nome, celular, curso, email, foto: "" });

    showToast("Conta criada com sucesso! Faça login para continuar.", "sucesso", 4000);
    mostrarLogin();

  }catch(e){
    const msg = _traduzirErroFirebase(e.code) || "Não foi possível criar a conta. Tente novamente.";
    showToast(msg, "erro");
  } finally {
    btn.disabled = false;
    btn.innerText = "Registrar";
  }
}

// =========================
// LOGIN GOOGLE
// =========================

async function loginGoogle(){
  const provider = new firebase.auth.GoogleAuthProvider();

  try{
    const res  = await auth.signInWithPopup(provider);
    const user = res.user;

    const ref = db.collection("usuarios").doc(user.uid);
    const doc = await ref.get();

    if(!doc.exists){
      await ref.set({
        nome:    user.displayName,
        email:   user.email,
        celular: "",
        curso:   "",
        foto:    user.photoURL || ""
      });
    } else {
      await ref.set({ foto: user.photoURL || "" }, { merge: true });
    }

    const usuarioLogado = {
      id:      user.uid,
      nome:    user.displayName,
      email:   user.email,
      celular: "",
      curso:   "",
      foto:    user.photoURL || ""
    };

    localStorage.setItem("user", JSON.stringify(usuarioLogado));
    window.location.replace("app.html");

  }catch(e){
    if(e.code === "auth/popup-closed-by-user") return;
    showToast("Não foi possível entrar com o Google. Tente novamente.", "erro");
  }
}

// =========================
// LOGOUT
// =========================

function logout(){
  auth.signOut().then(() => {
    localStorage.removeItem("user");
    window.location.replace("index.html");
  });
}

// =========================
// TRADUÇÃO DE ERROS FIREBASE
// =========================

function _traduzirErroFirebase(code) {
  const erros = {
    "auth/user-not-found":       "Email não encontrado. Verifique ou crie uma conta.",
    "auth/wrong-password":       "Senha incorreta. Tente novamente.",
    "auth/invalid-email":        "Email inválido. Verifique o formato.",
    "auth/email-already-in-use": "Este email já está cadastrado. Faça login.",
    "auth/weak-password":        "Senha muito fraca. Use ao menos 6 caracteres.",
    "auth/too-many-requests":    "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
    "auth/network-request-failed": "Sem conexão com a internet. Verifique sua rede.",
    "auth/invalid-credential":   "Email ou senha incorretos. Verifique e tente novamente.",
  };
  return erros[code] || null;
}

// =========================
// =========================
// INICIALIZAÇÃO
// =========================
document.addEventListener("DOMContentLoaded", () => {
  // Garante estado inicial sem animação
  mostrarLogin(false);
});

window.mostrarLogin    = mostrarLogin;
window.mostrarRegistro = mostrarRegistro;
window.acaoAuth        = acaoAuth;
window.loginGoogle     = loginGoogle;
window.logout          = logout;
