# Isolamento do painel admin

Metodo adotado:

- A pasta `admin/` nao entra no deploy Vercel por causa do `.vercelignore`.
- `vercel.json` reescreve `/admin/:path*` para `404.html`.
- O painel roda somente via `admin-server.js`, bindado em `127.0.0.1` por padrao.
- Credencial local definida via `.env`.
- Nao ha credencial hardcoded no servidor.
- A sessao admin usa cookie `HttpOnly`, `SameSite=Strict`, assinado por HMAC.
- Os dados sensiveis sao lidos pelo `admin-server.js` via service account, nao pelo browser.

Execucao local:

```powershell
$env:ADMIN_USERNAME="admin"
$env:ADMIN_PASSWORD="troque-por-uma-senha-forte"
$env:ADMIN_SESSION_SECRET="troque-por-um-segredo-longo-aleatorio"
$env:FIREBASE_SERVICE_ACCOUNT="C:\caminho\service-account.json"
npm run admin
```

URL local:

```text
http://127.0.0.1:4174
```

Para expor em rede interna, coloque um reverse proxy autenticado na frente e defina:

```powershell
$env:ADMIN_HOST="127.0.0.1"
$env:ADMIN_PORT="4174"
$env:ADMIN_SESSION_SECRET="segredo-longo-aleatorio"
```

Nao exponha `admin-server.js` diretamente na internet sem VPN, allowlist de IP ou proxy com TLS.

Credenciais obrigatorias:

- `ADMIN_USERNAME`: usuario do painel.
- `ADMIN_PASSWORD`: senha do painel.
- `ADMIN_SESSION_SECRET`: segredo HMAC para cookie de sessao.

Variavel obrigatoria para dados reais:

- `FIREBASE_SERVICE_ACCOUNT`: JSON da service account ou caminho para o arquivo JSON.

Variaveis opcionais:

- `FIREBASE_PROJECT_ID`: necessario apenas se o JSON nao tiver `project_id`.
- `ADMIN_PORT`: porta local. Padrao `4174`.
- `ADMIN_HOST`: host de bind. Padrao `127.0.0.1`.
- `ADMIN_SESSION_SECRET`: segredo fixo para manter sessoes validas entre reinicios.
