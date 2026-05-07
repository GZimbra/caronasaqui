# Service account do Firebase para o admin

O painel admin le dados reais do Firestore pelo backend em `/admin/data`.
Ele nao usa dados simulados.

Configure no `.env` local:

```text
FIREBASE_PROJECT_ID=caronas-aqui
FIREBASE_SERVICE_ACCOUNT=C:\caminho\service-account.json
```

Ou configure `FIREBASE_SERVICE_ACCOUNT` com o JSON inteiro em uma variavel de ambiente no provedor.

No Firebase Console:

1. Abra Project settings.
2. Va em Service accounts.
3. Gere uma nova private key.
4. Salve o JSON fora do repositorio.
5. Aponte `FIREBASE_SERVICE_ACCOUNT` para esse arquivo local.

Colecoes carregadas pelo admin:

- `usuarios`
- `caronas`
- `solicitacoes`
- `chats`

Fallback sem service account:

- O backend tenta entrar no Firebase Auth com `ADMIN_FIREBASE_EMAIL`.
- Padrao: `admin@caronasaqui.internal`.
- Senha usada: `ADMIN_PASSWORD`.
- Isso so funciona se esse usuario existir no Firebase Auth e as Firestore Rules permitirem leitura autenticada.

Sem `FIREBASE_SERVICE_ACCOUNT` e sem usuario Firebase Auth admin valido, o painel mostra erro de configuracao, nao dados falsos.
