# Admin independente no Vercel

O painel admin foi preparado para rodar independente do servidor local.

No Vercel:

- `/admin` serve `public/admin/index.html`.
- `/admin/css/*` serve CSS do admin.
- `/admin/js/*` serve JS do admin.
- `/admin/login`, `/admin/session`, `/admin/logout`, `/admin/data` usam `api/admin.js`.

Variaveis obrigatorias no Vercel:

```text
ADMIN_USERNAME=admin
ADMIN_PASSWORD=AEDB2025
ADMIN_SESSION_SECRET=use-um-segredo-longo
FIREBASE_PROJECT_ID=caronas-aqui
ADMIN_FIREBASE_EMAIL=admin@caronasaqui.internal
```

Opcional e recomendado para acesso admin completo:

```text
FIREBASE_SERVICE_ACCOUNT={JSON_DA_SERVICE_ACCOUNT}
```

Sem service account, a API entra no Firebase Auth como `ADMIN_FIREBASE_EMAIL` e le o Firestore pelas regras publicadas.
Com service account, a API le o Firestore via REST Admin/OAuth.

Acesso escondido:

```text
Ctrl + Alt + A
```

Login:

```text
admin
AEDB2025
```

Os graficos e tabelas usam somente `/admin/data`; nao ha dados simulados no deploy.
