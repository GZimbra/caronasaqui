# Estrutura do projeto

```text
/
  public/                 App publico entregue no Vercel/Firebase Hosting
    index.html            Login/registro
    app.html              Aplicacao autenticada
    404.html              Pagina publica de erro
    sw.js                 Service Worker
    css/
      main.css            Entrada CSS
      base.css            Tokens, reset e base global
      layout.css          Estrutura geral e sidebar
      responsive.css      Breakpoints globais
      components/         Componentes reutilizaveis
      pages/              Estilos especificos por tela
    js/
      config/             Configuracoes publicas e listas centralizadas
      core/               Bootstrap, auth guard e fluxo principal
      features/           Funcionalidades do app
      services/           Firebase, mapa e geolocalizacao
      utils/              Helpers sem regra de negocio
    admin/                Painel admin estatico publicado no Vercel
      index.html
      css/
      js/

  api/
    admin.js              API serverless do admin no Vercel

  server/                 Servidores Node locais
    dev-server.js         Servidor local do app publico
    admin-server.js       Servidor local isolado do admin

  src/                    Reserva para backend publico futuro
  docs/                   Documentacao tecnica
```

Comandos:

```powershell
npm run dev
npm run admin
npm run check
```

Regras:

- Tudo que roda no navegador fica em `public/`.
- Painel admin fica em `public/admin/`; no Vercel a API continua em `api/admin.js`.
- Em producao no mesmo servidor, use `npm start`; `/` serve o site e `/admin` serve o painel.
- Servidores locais ficam em `server/`.
- Config sensivel continua fora do Git via `.env`; config Firebase do client e publica.
- Nova regra de negocio backend deve entrar em `src/services` ou `src/controllers`, nao em rotas soltas.
