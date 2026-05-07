# Caronas Aqui

Aplicacao web para caronas universitarias com login por matricula, criacao de corridas, mapa, chat, perfil de usuario e painel administrativo.

Stack principal:

- Frontend estatico em HTML, CSS e JavaScript.
- Firebase Auth para autenticacao.
- Firestore como banco de dados.
- Leaflet para mapa.
- API serverless no Vercel para o admin.
- Servidor Node local para desenvolvimento.

## Funcionalidades

- Cadastro e login de usuarios por matricula institucional.
- Lista centralizada de faculdades permitidas.
- Criacao de caronas com local de partida livre, faculdade, origem, destino, horario e vagas.
- Mapa com rotas e marcadores.
- Solicitacoes de carona com status.
- Notificacoes visuais de aprovar/recusar solicitacoes.
- Perfil do usuario com edicao de dados e foto.
- Chat entre usuarios.
- Painel admin escondido com dados do banco:
  - usuarios registrados;
  - corridas realizadas;
  - corridas marcadas;
  - solicitacoes;
  - chats;
  - graficos e exportacao CSV.

## Estrutura

```text
/
  public/                 Site e app publico
    index.html            Login e registro
    app.html              Aplicacao autenticada
    404.html
    sw.js
    css/
      main.css            Entrada CSS
      theme-refresh.css   Tema visual atual
      components/
      pages/
    js/
      config/
      core/
      features/
      services/
      utils/

  admin/                  Painel admin estatico
    index.html
    css/admin.css
    js/admin-panel.js

  api/
    admin.js              API serverless do admin para Vercel

  server/
    admin-server.js       Servidor local completo
    dev-server.js         Servidor publico legado

  docs/                   Documentacao tecnica
  src/                    Reserva para backend futuro
```

## Comandos

Instalar dependencias:

```powershell
npm install
```

Rodar local com site e admin no mesmo servidor:

```powershell
npm run dev
```

URL local:

```text
http://127.0.0.1:5500
```

Rodar como servidor Node de producao:

```powershell
npm start
```

Validar sintaxe dos arquivos JavaScript:

```powershell
npm run check
```

## Acesso Admin

O admin nao aparece como botao visivel no login.

Na tela de login, use:

```text
Ctrl + Alt + A
```

Isso abre:

```text
/admin
```

Credenciais locais atuais:

```text
usuario: admin
senha: AEDB2025
```

O painel admin busca dados reais em:

```text
/admin/data
```

Nao ha dados simulados no deploy.

## Variaveis de Ambiente

Crie um `.env` local baseado em `.env.example`.

Minimo local:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=AEDB2025
ADMIN_SESSION_SECRET=troque-por-um-segredo-longo
ADMIN_HOST=127.0.0.1
ADMIN_PORT=5500
ADMIN_COOKIE_SECURE=false
FIREBASE_PROJECT_ID=caronas-aqui
ADMIN_FIREBASE_EMAIL=admin@caronasaqui.internal
```

Recomendado para acesso admin completo ao Firestore:

```env
FIREBASE_SERVICE_ACCOUNT=C:\caminho\service-account.json
```

No Vercel, configure as Environment Variables:

```text
ADMIN_USERNAME
ADMIN_PASSWORD
ADMIN_SESSION_SECRET
FIREBASE_PROJECT_ID
ADMIN_FIREBASE_EMAIL
FIREBASE_SERVICE_ACCOUNT
```

`FIREBASE_SERVICE_ACCOUNT` pode ser o JSON inteiro da service account.

## Firebase

Config publica do client:

```text
public/js/config/firebase-config.js
```

Projeto atual:

```text
projectId: caronas-aqui
```

Colecoes usadas:

- `usuarios`
- `caronas`
- `solicitacoes`
- `chats`
- subcolecoes de localizacao/mensagens conforme o fluxo do app

As regras ficam em:

```text
firestore.rules
```

Deploy das regras:

```powershell
firebase deploy --only firestore:rules
```

Se o Firebase CLI nao estiver instalado:

```powershell
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

## Deploy no Vercel

O projeto esta preparado para Vercel com:

```text
vercel.json
api/admin.js
admin/
public/
```

Rotas principais no deploy:

```text
/                 login
/app              app autenticado
/admin            painel admin
/admin/login      API admin
/admin/session    API admin
/admin/logout     API admin
/admin/data       API admin com Firestore
```

O admin e independente do servidor local no Vercel. A tela e estatica e a API roda como serverless function.

## Fluxo de Usuario

1. Usuario registra nome, matricula, faculdade, senha e confirmacao.
2. O app cria conta no Firebase Auth usando email sintetico baseado na matricula.
3. Dados publicos do perfil sao salvos em `usuarios`.
4. Usuario cria carona com local de partida, origem, destino, faculdade e horario.
5. Passageiros solicitam entrada.
6. Motorista aprova ou recusa.
7. O painel admin lista os dados reais do banco.

## Faculdades

Lista centralizada em:

```text
public/js/config/faculdades.js
```

Faculdades atuais:

- Dom Bosco Resende
- UERJ Resende

O backend/Firestore Rules validam os IDs permitidos.

## Seguranca

- `.env` fica fora do Git.
- Painel admin usa cookie `HttpOnly`.
- Admin server/API nao expoe senha no frontend.
- Matricula e tratada como dado sensivel no fluxo de auth.
- Texto livre de partida e sanitizado/validado.
- Headers de seguranca configurados no servidor local e no Vercel.
- Admin le Firestore pelo backend, nao diretamente pelo browser.

## Observacoes Importantes

- A chave `apiKey` do Firebase no frontend e configuracao publica de cliente, nao segredo.
- Para admin completo, prefira `FIREBASE_SERVICE_ACCOUNT`.
- Sem service account, o backend tenta acessar com `ADMIN_FIREBASE_EMAIL`; isso depende das Firestore Rules publicadas.
- Se `/admin/data` retornar `403`, publique as rules ou configure service account.
- Se os graficos nao aparecerem, confirme que `/admin/data` retorna dados reais.

## Validacao Rapida

```powershell
npm run check
npm run dev
```

Teste no navegador:

```text
http://127.0.0.1:5500
Ctrl + Alt + A
```

Login admin:

```text
admin
AEDB2025
```
