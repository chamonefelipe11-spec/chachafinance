#!/usr/bin/env bash
# Instala (ou atualiza) o Conversor MD no serverchacha. Rode com: bash instalar.sh
set -euo pipefail
DESTINO="$HOME/conversor-md"
mkdir -p "$DESTINO" && cd "$DESTINO"

cat > app.py <<'__FIM_ARQUIVO__'
"""Conversor MD: converte PDF, Word, PowerPoint, Excel etc. em Markdown com o MarkItDown.

Uso pelo navegador (pagina /) ou por API (POST /api/convert), pensado para o atalho do iPhone.
"""

import os
import re
import tempfile
from pathlib import Path
from urllib.parse import quote

from fastapi import FastAPI, File, HTTPException, Query, Request, Response, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse, PlainTextResponse
from markitdown import MarkItDown

MAX_MB = int(os.environ.get("MAX_MB", "100"))
EXTENSOES = {
    ".pdf", ".docx", ".pptx", ".xlsx", ".xls", ".html", ".htm",
    ".csv", ".json", ".xml", ".txt", ".md", ".epub", ".zip",
}

app = FastAPI(title="Conversor MD")
md = MarkItDown(enable_plugins=False)

# Quem pode chamar a API pelo navegador: o chachafinance na Vercel (produção e prévias)
# e o que vier em CORS_ORIGINS (separado por vírgula), por exemplo um domínio próprio.
ORIGENS = {o.strip().rstrip("/") for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()}
PADRAO_ORIGEM = re.compile(
    os.environ.get("CORS_REGEX", r"^https://(chachafinance|central-pessoal)[a-z0-9-]*\.vercel\.app$")
)


def origem_permitida(origem: str | None) -> bool:
    return bool(origem) and (origem in ORIGENS or bool(PADRAO_ORIGEM.match(origem)))


@app.middleware("http")
async def cors(request: Request, chamar_proximo):
    origem = request.headers.get("origin")
    if request.method == "OPTIONS" and origem:
        if not origem_permitida(origem):
            return Response(status_code=403)
        resposta = Response(status_code=204)
    else:
        resposta = await chamar_proximo(request)
    if origem_permitida(origem):
        resposta.headers["Access-Control-Allow-Origin"] = origem
        resposta.headers["Vary"] = "Origin"
        resposta.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        resposta.headers["Access-Control-Allow-Headers"] = "*"
        resposta.headers["Access-Control-Max-Age"] = "600"
        # Chrome pede isso quando um site público chama um endereço de rede privada (Tailscale)
        resposta.headers["Access-Control-Allow-Private-Network"] = "true"
    return resposta
INDEX = (Path(__file__).parent / "index.html").read_text(encoding="utf-8")


def estimar_tokens(texto: str) -> int:
    # Regra pratica: cerca de 4 caracteres por token em texto comum.
    return max(1, len(texto) // 4)


def contar_paginas_pdf(caminho: str) -> int | None:
    try:
        from pdfminer.pdfpage import PDFPage

        with open(caminho, "rb") as f:
            return sum(1 for _ in PDFPage.get_pages(f))
    except Exception:
        return None


def limpar(texto: str) -> str:
    # Remove linhas em branco em excesso, que so gastam tokens.
    texto = re.sub(r"[ \t]+\n", "\n", texto)
    texto = re.sub(r"\n{3,}", "\n\n", texto)
    return texto.strip() + "\n"


async def converter(arquivo: UploadFile) -> dict:
    nome = arquivo.filename or "arquivo"
    ext = Path(nome).suffix.lower()
    if ext not in EXTENSOES:
        raise HTTPException(400, f"Formato {ext or '(sem extensão)'} não suportado.")

    conteudo = await arquivo.read()
    if len(conteudo) > MAX_MB * 1024 * 1024:
        raise HTTPException(413, f"Arquivo maior que {MAX_MB} MB.")

    with tempfile.TemporaryDirectory() as pasta:
        caminho = os.path.join(pasta, "entrada" + ext)
        with open(caminho, "wb") as f:
            f.write(conteudo)
        try:
            resultado = md.convert_local(caminho)
        except Exception as e:
            raise HTTPException(422, f"Não consegui converter: {e}")
        paginas = contar_paginas_pdf(caminho) if ext == ".pdf" else None

    texto = limpar(resultado.markdown or "")
    aviso = None
    if ext == ".pdf" and paginas:
        if len(texto) < 200 * paginas:
            aviso = (
                "Saiu pouco texto para o número de páginas. O PDF parece escaneado "
                "(imagem). Nesse caso, mande o PDF original para o Claude."
            )

    return {
        "nome": Path(nome).stem + ".md",
        "markdown": texto,
        "caracteres": len(texto),
        "tokens_estimados": estimar_tokens(texto),
        "paginas": paginas,
        "tamanho_original_kb": round(len(conteudo) / 1024, 1),
        "aviso": aviso,
    }


@app.get("/", response_class=HTMLResponse)
def pagina():
    return INDEX


@app.post("/api/convert")
async def api_convert(
    file: UploadFile = File(...),
    formato: str = Query("json", pattern="^(json|texto)$"),
):
    dados = await converter(file)
    if formato == "texto":
        # Resposta crua em Markdown, mais facil de usar no atalho do iPhone.
        return PlainTextResponse(
            dados["markdown"],
            media_type="text/markdown; charset=utf-8",
            headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(dados['nome'])}"},
        )
    return JSONResponse(dados)


@app.get("/saude")
def saude():
    return {"ok": True}
__FIM_ARQUIVO__

cat > index.html <<'__FIM_ARQUIVO__'
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Conversor MD">
<meta name="theme-color" content="#1f2328">
<title>Conversor MD</title>
<style>
  :root {
    --bg: #f6f6f4; --card: #fff; --txt: #1f2328; --sub: #646a73;
    --borda: #dcdcd8; --acento: #2f6f4f; --aviso: #8a5a00; --aviso-bg: #fff6e0;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #15171a; --card: #1e2126; --txt: #e8e8e6; --sub: #9aa0a8;
            --borda: #33373e; --acento: #6fbf95; --aviso: #f0c060; --aviso-bg: #3a3020; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; font: 16px/1.45 -apple-system, "Segoe UI", Roboto, sans-serif;
         background: var(--bg); color: var(--txt); }
  main { max-width: 720px; margin: 0 auto; padding: 24px 16px 48px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .sub { color: var(--sub); margin: 0 0 20px; font-size: 14px; }
  #zona { display: block; border: 2px dashed var(--borda); border-radius: 12px;
          background: var(--card); padding: 32px 16px; text-align: center; cursor: pointer; }
  #zona.ativa { border-color: var(--acento); }
  #zona strong { display: block; font-size: 17px; margin-bottom: 4px; }
  #zona span { color: var(--sub); font-size: 14px; }
  input[type=file] { display: none; }
  .item { background: var(--card); border: 1px solid var(--borda); border-radius: 12px;
          padding: 14px 16px; margin-top: 14px; }
  .topo { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
  .nome { font-weight: 600; word-break: break-all; }
  .status { color: var(--sub); font-size: 14px; white-space: nowrap; }
  .numeros { color: var(--sub); font-size: 14px; margin: 6px 0 10px; }
  .aviso { background: var(--aviso-bg); color: var(--aviso); border-radius: 8px;
           padding: 8px 10px; font-size: 14px; margin-bottom: 10px; }
  .erro { color: #c0392b; font-size: 14px; margin-top: 6px; }
  .botoes { display: flex; flex-wrap: wrap; gap: 8px; }
  button { font: inherit; font-size: 15px; border: 1px solid var(--borda); background: var(--bg);
           color: var(--txt); border-radius: 8px; padding: 8px 14px; cursor: pointer; }
  button.prim { background: var(--acento); border-color: var(--acento); color: #fff; }
  details { margin-top: 10px; }
  summary { color: var(--sub); font-size: 14px; cursor: pointer; }
  pre { white-space: pre-wrap; word-break: break-word; max-height: 300px; overflow: auto;
        background: var(--bg); padding: 10px; border-radius: 8px; font-size: 13px; }
</style>
</head>
<body>
<main>
  <h1>Conversor MD</h1>
  <p class="sub">PDF, Word, PowerPoint e Excel viram Markdown. Mande o .md para o Claude no lugar do original e gaste menos tokens.</p>

  <label id="zona">
    <strong>Escolher arquivos</strong>
    <span>ou arraste aqui (PDF, DOCX, PPTX, XLSX, HTML, CSV, EPUB)</span>
    <input id="entrada" type="file" multiple
           accept=".pdf,.docx,.pptx,.xlsx,.xls,.html,.htm,.csv,.json,.xml,.txt,.md,.epub,.zip">
  </label>

  <div id="lista"></div>
</main>

<script>
const zona = document.getElementById("zona");
const entrada = document.getElementById("entrada");
const lista = document.getElementById("lista");
const podeCompartilhar = !!(navigator.canShare && navigator.canShare({ files: [new File(["x"], "x.md", { type: "text/markdown" })] }));

entrada.addEventListener("change", () => { processar(entrada.files); entrada.value = ""; });
["dragenter", "dragover"].forEach(ev => zona.addEventListener(ev, e => { e.preventDefault(); zona.classList.add("ativa"); }));
["dragleave", "drop"].forEach(ev => zona.addEventListener(ev, e => { e.preventDefault(); zona.classList.remove("ativa"); }));
zona.addEventListener("drop", e => processar(e.dataTransfer.files));

function el(tag, cls, texto) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (texto != null) n.textContent = texto;
  return n;
}

function fmt(n) { return n.toLocaleString("pt-BR"); }

async function processar(arquivos) {
  for (const arq of arquivos) converter(arq);
}

async function converter(arq) {
  const item = el("div", "item");
  const topo = el("div", "topo");
  topo.append(el("span", "nome", arq.name), el("span", "status", "convertendo..."));
  item.append(topo);
  lista.prepend(item);
  const status = topo.querySelector(".status");

  const form = new FormData();
  form.append("file", arq);
  try {
    const r = await fetch("api/convert", { method: "POST", body: form });
    const dados = await r.json();
    if (!r.ok) throw new Error(dados.detail || "Falha na conversão");
    status.textContent = "pronto";
    mostrar(item, dados);
  } catch (e) {
    status.textContent = "erro";
    item.append(el("div", "erro", e.message));
  }
}

function mostrar(item, d) {
  const partes = [];
  if (d.paginas) partes.push(fmt(d.paginas) + " páginas");
  partes.push(fmt(d.tamanho_original_kb) + " KB no original");
  partes.push("~" + fmt(d.tokens_estimados) + " tokens no .md");
  item.append(el("div", "numeros", partes.join(" · ")));
  if (d.aviso) item.append(el("div", "aviso", d.aviso));

  const blob = new Blob([d.markdown], { type: "text/markdown" });
  const botoes = el("div", "botoes");

  if (podeCompartilhar) {
    const b = el("button", "prim", "Compartilhar");
    b.onclick = () => navigator.share({ files: [new File([blob], d.nome, { type: "text/markdown" })] }).catch(() => {});
    botoes.append(b);
  }
  const baixar = el("button", podeCompartilhar ? "" : "prim", "Baixar .md");
  baixar.onclick = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = d.nome;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  const copiar = el("button", "", "Copiar texto");
  copiar.onclick = async () => {
    try {
      await navigator.clipboard.writeText(d.markdown);
    } catch {
      // Sem HTTPS o navegador bloqueia a API de copiar; usa o metodo antigo.
      const t = document.createElement("textarea");
      t.value = d.markdown; document.body.append(t); t.select();
      document.execCommand("copy"); t.remove();
    }
    copiar.textContent = "Copiado";
    setTimeout(() => copiar.textContent = "Copiar texto", 1500);
  };
  botoes.append(baixar, copiar);
  item.append(botoes);

  const det = el("details");
  det.append(el("summary", "", "Ver prévia"), el("pre", "", d.markdown.slice(0, 5000) + (d.markdown.length > 5000 ? "\n\n[...]" : "")));
  item.append(det);
}
</script>
</body>
</html>
__FIM_ARQUIVO__

cat > Dockerfile <<'__FIM_ARQUIVO__'
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

RUN pip install --no-cache-dir 'markitdown[pdf,docx,pptx,xlsx,xls]==0.1.7' \
    fastapi uvicorn python-multipart

COPY app.py index.html ./

RUN useradd --create-home conversor
USER conversor

EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
__FIM_ARQUIVO__

cat > docker-compose.yml <<'__FIM_ARQUIVO__'
services:
  conversor-md:
    build: .
    container_name: conversor-md
    restart: unless-stopped
    ports:
      - "8090:8000"
    environment:
      - MAX_MB=100
      # Endereços extras que podem usar a API pelo navegador (além do chachafinance na Vercel)
      - CORS_ORIGINS=
    mem_limit: 1g
__FIM_ARQUIVO__

echo "Construindo e subindo o container..."
# Usa sudo só se o usuário não estiver no grupo docker
if docker info >/dev/null 2>&1; then DOCKER="docker"; else DOCKER="sudo docker"; fi
$DOCKER compose up -d --build

echo "Liberando HTTPS dentro do Tailscale na porta 10000..."
sudo tailscale serve --bg --https=10000 http://127.0.0.1:8090

NOME=$(tailscale status --json | python3 -c "import json,sys; print(json.load(sys.stdin)['Self']['DNSName'].rstrip('.'))")
echo
echo "Pronto. Abra em qualquer aparelho com Tailscale:"
echo "  https://$NOME:10000"
