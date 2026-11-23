# Conversor MD

App web que transforma PDF, Word, PowerPoint e Excel em Markdown (.md) usando o MarkItDown da Microsoft. Roda no serverchacha e abre em qualquer aparelho que esteja no Tailscale.

Para que serve: mandar o .md para o Claude no lugar do arquivo original. O .md é só texto, sem as imagens das páginas, e por isso gasta bem menos tokens.

## Instalar no serverchacha

1. Abra um terminal no servidor (Cockpit em `:9090` > Terminal, ou `tailscale ssh`).
2. Copie o `instalar.sh` para o servidor. O jeito mais simples é abrir o arquivo, copiar todo o conteúdo e colar no terminal dentro de:
   ```
   nano instalar.sh
   ```
   Salve com Ctrl+O, Enter, Ctrl+X.
3. Rode:
   ```
   bash instalar.sh
   ```
   Ele cria `~/conversor-md`, sobe o container `conversor-md` (porta 8090) e libera HTTPS no Tailscale na porta 10000. No fim mostra o endereço, algo como `https://serverchacha.xxxx.ts.net:10000`.

O container aparece no Portainer como qualquer outro e reinicia sozinho com o servidor.

Por que HTTPS: sem ele, o iPhone não deixa usar o botão "Compartilhar" nem o "Copiar texto" moderno. O `tailscale serve` cuida do certificado. O acesso continua só dentro da sua tailnet, nada fica exposto na internet.

## Usar pelo navegador (PC, notebook, iPhone)

Abra o endereço, toque em "Escolher arquivos" (ou arraste) e espere. Para cada arquivo aparecem:

- número de páginas e tokens estimados do .md;
- **Compartilhar** (no iPhone): manda o .md direto para o app do Claude;
- **Baixar .md** e **Copiar texto**;
- um aviso quando o PDF parece escaneado. Nesse caso o .md sai vazio e é melhor mandar o PDF original.

No iPhone, vale adicionar à Tela de Início: no Safari, Compartilhar > Adicionar à Tela de Início. Vira um ícone de app.

## Atalho do iPhone (converter direto do menu Compartilhar)

Com isso, você abre um PDF em qualquer app (Arquivos, e-mail, WhatsApp), toca em Compartilhar > Converter para MD e manda o resultado para o Claude.

No app Atalhos, crie um atalho novo:

1. Nos detalhes do atalho (ícone ⓘ), ative **Mostrar na Folha de Compartilhamento** e deixe aceitar só **Arquivos** e **PDFs**.
2. Ação **Obter Conteúdo do URL**:
   - URL: `https://SEU-ENDERECO.ts.net:10000/api/convert?formato=texto`
   - Método: **POST**
   - Corpo da Requisição: **Formulário**
   - Adicione um campo do tipo **Arquivo**, com chave `file` e valor **Entrada do Atalho**.
3. Ação **Definir Nome**: nome = `Entrada do Atalho` (o nome do arquivo) seguido de `.md`. Se preferir simples, use um nome fixo, como `documento.md`.
4. Ação **Compartilhar** (abre a lista de apps, escolha o Claude) ou **Salvar Arquivo** (guarda no app Arquivos).
5. Dê o nome "Converter para MD".

O Tailscale precisa estar ligado no iPhone para o atalho alcançar o servidor.

## Dentro do chachafinance

A aba **Conversor** do chachafinance usa este mesmo servidor. Na primeira vez em cada aparelho, toque em **Servidor**
e cole o endereço (`https://SEU-ENDERECO.ts.net:10000`). O conversor já aceita chamadas do chachafinance na Vercel
(produção e prévias). Se o app ganhar um domínio próprio, coloque-o em `CORS_ORIGINS` no `docker-compose.yml`.

## API (para scripts)

```
curl -F "file=@contrato.pdf" https://SEU-ENDERECO.ts.net:10000/api/convert
```

Devolve JSON com `markdown`, `paginas`, `tokens_estimados` e `aviso`. Com `?formato=texto`, devolve só o Markdown.

## Limites

- PDF escaneado não tem texto para extrair. O app avisa. Não há OCR, de propósito, porque o OCR do MarkItDown manda as páginas para um modelo de IA externo, e documentos da Exxata não devem sair do servidor.
- Figuras, gráficos, carimbos e desenhos somem no .md. Para cronogramas, diagramas e desenhos técnicos, mande o original.
- Tabelas muito grandes (medições, cronogramas no Excel) viram tabelas Markdown difíceis de ler.
- Limite de 100 MB por arquivo. Para mudar, edite `MAX_MB` no `docker-compose.yml` e rode `docker compose up -d`.

## Manutenção

- Atualizar ou reiniciar: `cd ~/conversor-md && docker compose up -d --build`
- Ver erros: `docker logs conversor-md --tail 50`
- Remover: `cd ~/conversor-md && docker compose down`, depois `sudo tailscale serve --https=10000 off`
