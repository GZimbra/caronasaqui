(function validarSessaoLocal() {
  const user = localStorage.getItem("user");

  if (!user) {
    window.location.replace("index.html");
    return;
  }

  window.usuarioLogado = JSON.parse(user);
}());
