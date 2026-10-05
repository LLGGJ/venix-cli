# Venix CLI pública

A CLI usa o Client ID público padrão:

```text
venix_cac3c2ea21c362d0a7
```

Usuários não precisam de Client Secret. O login usa OAuth2 Authorization Code + PKCE S256.

## Instalação local

```bash
npm link
venix --version
venix login
```

## Instalação pelo GitHub

```bash
npm install -g venix
venix login
```

## Redirect URI

Cadastre exatamente no app OAuth2 público:

```text
http://127.0.0.1:53682/callback
```

## Configuração opcional

A CLI funciona com os padrões oficiais. Se quiser usar um arquivo local, copie o modelo:

```bash
cp .env.example .env
```

O `.env` não deve ser enviado ao GitHub. Nunca inclua `VENIX_CLIENT_SECRET`, senha, token ou chave privada no repositório.

## Requisito do backend

O app público precisa aceitar a troca do `authorization_code` e do `refresh_token` sem `client_secret`, validando o `code_verifier` PKCE.
