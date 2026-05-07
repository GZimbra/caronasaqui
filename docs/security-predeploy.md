# Checklist de seguranca pre-deploy

Estado atual do projeto:

- Frontend publico usa Firebase Auth e Firestore direto no browser.
- Painel admin roda em servidor local separado (`admin-server.js`) e nao vai para o Vercel.
- Nao existe backend Express publico neste checkout; por isso `helmet.js`, `express-rate-limit`, JWT proprio e bcrypt nao se aplicam sem uma migracao de arquitetura.

Checklist:

- [x] Senhas de usuarios: gerenciadas pelo Firebase Auth.
- [x] Senha fraca bloqueada no cadastro: minimo 8 caracteres, letras e numeros.
- [x] Matricula nao armazenada em plain text: salvo `matriculaHash` + `matriculaLast4`.
- [x] Headers HTTP no servidor local publico e admin.
- [x] Rate limit no login admin: 10 req/min por IP.
- [x] `.env` fora do repositorio e `.env.example` documentado.
- [x] Firebase client config fora do codigo versionado (`js/config/firebase-config.js` ignorado).
- [x] Admin fora do Vercel via `.vercelignore`.
- [x] `/admin/:path*` bloqueado no `vercel.json`.
- [x] Inputs criticos validados em Firestore Rules.
- [x] Local de partida sanitizado no client e validado nas rules.
- [ ] CORS restrito no backend publico: pendente porque nao ha backend Express publico.
- [ ] `helmet.js`: pendente porque nao ha Express publico.
- [ ] JWT access/refresh proprio: pendente porque auth atual e Firebase Auth.
- [ ] bcrypt rounds >= 12: pendente porque senhas sao tratadas pelo Firebase Auth.

Arquivos locais obrigatorios antes de rodar o frontend:

- Copiar `js/config/firebase-config.example.js` para `js/config/firebase-config.js`.
- Preencher os dados do Firebase no arquivo local.
- Restringir a API key no console do Firebase por HTTP referrer e APIs permitidas.

Se o projeto migrar para backend Express:

- Usar `helmet`.
- Usar `cors` com allowlist do dominio Vercel.
- Usar `express-rate-limit` em `/auth/login`, `/auth/register` e endpoints publicos.
- Usar `bcrypt` com `saltRounds >= 12`.
- Emitir access token curto em cookie httpOnly `Secure; SameSite=Strict`.
- Rotacionar refresh token e invalidar no logout.
- Validar payloads com `zod` ou `express-validator`.
- Sanitizar textos livres com `sanitize-html` ou `xss`.
