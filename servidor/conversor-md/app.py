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
