# Backend reservado

Este projeto ainda usa frontend estatico com Firebase Auth/Firestore.

Quando houver backend Node/Express publico, separar responsabilidades assim:

- `routes/`: declaracao de rotas e middlewares por endpoint.
- `controllers/`: entrada HTTP, status code e serializacao de resposta.
- `services/`: regras de negocio e integracoes externas.
- `models/`: acesso a dados e validacao de entidades.
- `middleware/`: auth, rate limit, CORS, headers e sanitizacao.

Nao coloque regra de negocio diretamente em `routes/`.
