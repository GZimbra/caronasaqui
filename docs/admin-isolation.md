# Isolamento do painel admin

Metodo adotado:

- Em producao com admin, rode `npm start`.
- `server/admin-server.js` serve o site publico em `/` e o painel em `/admin` no mesmo servidor.
- O painel nao tem botao visivel no login; o acesso escondido usa `Ctrl + Alt + A`.
- No Vercel, `/admin/*` usa `api/admin.js` para login, sessao e dados no mesmo dominio.
- Credencial local definida via `.env`.
- Nao ha credencial hardcoded no servidor.
- A sessao admin usa cookie `HttpOnly`, `SameSite=Strict`, assinado por HMAC.
- Os dados sensiveis sao lidos pelo `server/admin-server.js` via service account, nao pelo browser.

Execucao local ou producao Node:

```powershell
$env:ADMIN_USERNAME="admin"
$env:ADMIN_PASSWORD="troque-por-uma-senha-forte"
$env:ADMIN_SESSION_SECRET="troque-por-um-segredo-longo-aleatorio"
$env:FIREBASE_SERVICE_ACCOUNT="C:\caminho\service-account.json"
npm run admin
```

Para desenvolvimento local no mesmo servidor do site:

```powershell
npm run dev
```

URLs:

```text
http://127.0.0.1:5500
http://127.0.0.1:5500/admin
```

URL no mesmo servidor:

```text
http://127.0.0.1:4174/admin
```

Tambem existe um atalho escondido na tela de login publica.
Use `Ctrl + Alt + A` para abrir `/admin` no mesmo dominio; a autenticacao continua sendo feita no servidor admin.

Para expor em rede interna, coloque um reverse proxy autenticado na frente e defina:

```powershell
$env:ADMIN_HOST="127.0.0.1"
$env:ADMIN_PORT="4174"
$env:ADMIN_SESSION_SECRET="segredo-longo-aleatorio"
```

Nao exponha `server/admin-server.js` diretamente na internet sem VPN, allowlist de IP ou proxy com TLS.

Credenciais obrigatorias:

- `ADMIN_USERNAME`: usuario do painel.
- `ADMIN_PASSWORD`: senha do painel.
- `ADMIN_SESSION_SECRET`: segredo HMAC para cookie de sessao.

Variavel obrigatoria para dados reais:

- `FIREBASE_SERVICE_ACCOUNT`: JSON da service account ou caminho para o arquivo JSON.
- No Vercel, configurar `FIREBASE_SERVICE_ACCOUNT` como JSON nas Environment Variables.

Variaveis opcionais:

- `FIREBASE_PROJECT_ID`: necessario apenas se o JSON nao tiver `project_id`.
- `ADMIN_PORT`: porta local. Padrao `4174`.
- `PORT`: porta definida pelo provedor em producao.
- `ADMIN_HOST`: host de bind. Padrao `0.0.0.0`.
- `ADMIN_SESSION_SECRET`: segredo fixo para manter sessoes validas entre reinicios.
