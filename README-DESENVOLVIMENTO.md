# Desenvolvendo a sua hospedagem + CLI

Este projeto é a CLI cliente da sua própria hospedagem. A hospedagem ainda precisa expor os endpoints esperados pela CLI.

## Preparar

```bash
cp .env.example .env
# edite .env
npm link
venix help
```

A CLI agora carrega `.env` do diretório atual. Variáveis já exportadas no shell têm prioridade sobre o arquivo. Se o backend exigir segredo, preencha `VENIX_CLIENT_SECRET`; ele será enviado somente na troca do `authorization_code` e na renovação do token.

## Backend mínimo esperado

A configuração padrão aponta para um backend local em `http://localhost:3000` e espera:

- `GET /v1/me`
- `GET /v1/apps/status`
- `POST /v1/apps/create` como multipart
- `POST /v1/apps/:id/action`
- `DELETE /v1/apps/:id`
- `PATCH /v1/apps/:id`
- `POST /v1/snapshots`
- `POST /v1/apps/:id/deploy/trigger`
- `POST /v1/apps/:id/files/upload` como multipart
- `POST /v1/apps/:id/files/extract`
- `GET /v1/instances/stream/:id` como SSE
- `GET /auth/bridge` para autorizar
- `POST /v1/oauth2/token` para trocar o code e renovar refresh token

O backend deve aceitar `Authorization: Bearer <token>` e responder JSON no formato usado em `src/api.js`, por exemplo:

```json
{"status":"success","response":{"user":{"plan":"free"},"applications":[]}}
```

Para login, o app OAuth2 da CLI deve ser público, usar PKCE S256 e cadastrar:

```text
http://127.0.0.1:53682/callback
```

## Teste sem API pronta

`venix help` e `venix --version` funcionam sem backend. `venix login`, `venix apps` e os demais comandos só funcionarão quando os endpoints e o OAuth estiverem implementados.

## Segurança

- `.env` não deve entrar no Git nem ser enviado para aplicações.
- `credentials.json` contém tokens e deve permanecer privado.
- Se esta CLI for distribuída para terceiros, prefira PKCE sem segredo; um `client_secret` embutido em uma CLI pode ser extraído. Para o ambiente atual, ele é suportado porque a API está exigindo esse campo.
- Para mudar o arquivo carregado, use `VENIX_ENV_FILE=/caminho/arquivo.env`.
