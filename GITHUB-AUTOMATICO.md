# Publicação automática pelo GitHub

Depois de configurar uma vez, não é necessário compilar ou publicar pelo Termux.

## 1. Enviar os arquivos ao repositório

Suba o conteúdo para:

```text
https://github.com/LLGGJ/venix-cli
```

O workflow `.github/workflows/release.yml` já:

1. compila os binários Go com GoReleaser;
2. cria a GitHub Release;
3. prepara a versão do pacote npm;
4. publica `venix` no npm usando Trusted Publishing/OIDC.

## 2. Configurar Trusted Publisher no npm

Na página do pacote `venix` no npm, abra **Settings → Trusted Publisher → GitHub Actions** e informe exatamente:

```text
Organization or user: LLGGJ
Repository: venix-cli
Workflow filename: release.yml
Environment name: deixe vazio
Allowed actions: npm publish
```

O arquivo deve existir em `.github/workflows/release.yml`. O nome é sensível a maiúsculas/minúsculas.

## 3. Criar uma release

No GitHub, abra **Releases → Draft a new release**.

Use uma tag nova, por exemplo:

```text
v0.7.3
```

Publique a release. O workflow será executado automaticamente.

Também é possível criar a tag pelo GitHub CLI ou Git:

```bash
git tag v0.7.3
git push origin v0.7.3
```

## 4. Acompanhar

Abra no GitHub:

```text
Actions → Release
```

A execução só estará concluída quando os passos **GoReleaser** e **Publicar instalador npm** ficarem verdes.

## 5. Instalação depois da publicação

Em qualquer computador com Node.js/npm:

```bash
npm install -g venix
venix --version
venix login
```

No Termux, o npm baixa o binário Linux arm64 da release; não é necessário executar `go build` manualmente.

## Observações

- O pacote npm só deve ser publicado depois que os artefatos da release Go existirem.
- Nunca coloque `.env`, Client Secret, senha ou token no GitHub.
- O `id-token: write` do workflow é necessário para OIDC.
- Se o workflow falhar com `ENEEDAUTH`, confira principalmente o nome exato `release.yml`, o usuário `LLGGJ`, o repositório `venix-cli` e se `npm publish` está permitido em **Allowed actions**.
