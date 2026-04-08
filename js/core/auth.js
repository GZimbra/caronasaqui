// =============================================================
// AUTH — identificador: nome de usuário + senha
// Firebase Auth exige email → geramos um email sintético
// invisível ao usuário: nomeSlug@caronasaqui.internal
// =============================================================

function _slugNome(nome) {
  return nome.trim().toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
}

function _emailSintetico(nome) {
  return _slugNome(nome) + '@caronasaqui.internal';
}

// =============================================================
// TROCA DE ABA (login ↔ registro)
// =============================================================

function mostrarLogin(animar) {
  window.modo = 'login';
  document.getElementById('titulo').innerText   = 'Entrar';
  document.getElementById('btnAcao').innerText  = 'Entrar';
  document.getElementById('tabLogin').classList.add('active');
  document.getElementById('tabRegister').classList.remove('active');

  const extras = document.getElementById('camposExtras');
  if (extras) {
    if (animar) {
      extras.classList.remove('campos-abertos');
    } else {
      extras.classList.remove('campos-abertos');
      extras.style.transition = 'none';
      requestAnimationFrame(() => { extras.style.transition = ''; });
    }
  }
}

function mostrarRegistro() {
  window.modo = 'registro';
  document.getElementById('titulo').innerText   = 'Cadastro';
  document.getElementById('btnAcao').innerText  = 'Registrar';
  document.getElementById('tabLogin').classList.remove('active');
  document.getElementById('tabRegister').classList.add('active');

  const extras = document.getElementById('camposExtras');
  if (extras) extras.classList.add('campos-abertos');
}

function acaoAuth() {
  if (window.modo === 'login') login();
  else registrar();
}

// =============================================================
// LOGIN
// =============================================================

async function login() {
  const nome  = (document.getElementById('nomeUsuario')?.value || '').trim();
  const senha = (document.getElementById('senha')?.value       || '').trim();

  if (!nome || !senha) {
    showToast('Preencha o nome de usuário e a senha.', 'aviso');
    return;
  }

  const btn = document.getElementById('btnAcao');
  btn.disabled = true;
  btn.innerText = 'Entrando...';

  try {
    const email = _emailSintetico(nome);
    const res   = await auth.signInWithEmailAndPassword(email, senha);
    const uid   = res.user.uid;

    const docSnap = await db.collection('usuarios').doc(uid).get();
    if (!docSnap.exists) {
      showToast('Usuário não encontrado.', 'erro');
      btn.disabled = false; btn.innerText = 'Entrar';
      return;
    }

    const data = docSnap.data();
    localStorage.setItem('user', JSON.stringify({
      id:      uid,
      nome:    data.nome,
      email:   data.email || email,
      celular: data.celular || '',
      curso:   data.curso   || '',
      foto:    data.foto    || ''
    }));
    window.location.replace('app.html');

  } catch (e) {
    showToast(_traduzirErro(e.code) || 'Nome ou senha incorretos.', 'erro');
    btn.disabled = false; btn.innerText = 'Entrar';
  }
}

// =============================================================
// REGISTRO
// =============================================================

async function registrar() {
  const nome     = (document.getElementById('nomeUsuario')?.value    || '').trim();
  const senha    = (document.getElementById('senha')?.value          || '').trim();
  const confirma = (document.getElementById('confirmarSenha')?.value || '').trim();

  if (!nome || !senha || !confirma) {
    showToast('Preencha todos os campos.', 'aviso');
    return;
  }
  if (senha !== confirma) {
    showToast('As senhas não coincidem.', 'aviso');
    return;
  }
  if (senha.length < 6) {
    showToast('A senha precisa ter ao menos 6 caracteres.', 'aviso');
    return;
  }

  const btn = document.getElementById('btnAcao');
  btn.disabled = true;
  btn.innerText = 'Criando conta...';

  const email = _emailSintetico(nome);
  const slug  = _slugNome(nome);

  try {
    // Verifica se nome já está em uso
    const jaExiste = await db.collection('usuarios').where('nomeSlug', '==', slug).get();
    if (!jaExiste.empty) {
      showToast('Nome de usuário já está em uso. Escolha outro.', 'aviso');
      btn.disabled = false; btn.innerText = 'Registrar';
      return;
    }

    const res = await auth.createUserWithEmailAndPassword(email, senha);
    const uid = res.user.uid;

    await db.collection('usuarios').doc(uid).set({
      nome,
      nomeSlug: slug,
      email,
      celular: '',
      curso:   '',
      foto:    ''
    });

    showToast('Conta criada! Faça login para continuar.', 'sucesso', 4000);
    mostrarLogin(true);

  } catch (e) {
    showToast(_traduzirErro(e.code) || 'Não foi possível criar a conta.', 'erro');
  } finally {
    btn.disabled = false;
    btn.innerText = 'Registrar';
  }
}

// =============================================================
// LOGOUT
// =============================================================

function logout() {
  auth.signOut().then(() => {
    localStorage.removeItem('user');
    window.location.replace('index.html');
  });
}

// =============================================================
// ERROS FIREBASE
// =============================================================

function _traduzirErro(code) {
  const map = {
    'auth/user-not-found':         'Usuário não encontrado.',
    'auth/wrong-password':         'Senha incorreta.',
    'auth/invalid-email':          'Nome de usuário inválido.',
    'auth/email-already-in-use':   'Nome de usuário já cadastrado.',
    'auth/weak-password':          'Senha muito fraca. Use ao menos 6 caracteres.',
    'auth/too-many-requests':      'Muitas tentativas. Aguarde alguns minutos.',
    'auth/network-request-failed': 'Sem conexão com a internet.',
    'auth/invalid-credential':     'Nome ou senha incorretos.',
  };
  return map[code] || null;
}

// =============================================================
// INIT
// =============================================================

document.addEventListener('DOMContentLoaded', () => mostrarLogin(false));

window.mostrarLogin    = mostrarLogin;
window.mostrarRegistro = mostrarRegistro;
window.acaoAuth        = acaoAuth;
window.logout          = logout;
