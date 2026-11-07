// Lê prints e PDFs de extrato/fatura/comprovante com a API do Claude e devolve
// os lançamentos encontrados. Nada é guardado: o arquivo só passa por aqui.
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;

interface Arquivo {
  nome: string;
  tipo: string; // image/jpeg, image/png, application/pdf
  base64: string;
}

const MODELO = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

const FERRAMENTA = {
  name: "registrar_lancamentos",
  description:
    "Registra os lançamentos financeiros encontrados nas imagens ou PDFs.",
  input_schema: {
    type: "object",
    properties: {
      lancamentos: {
        type: "array",
        items: {
          type: "object",
          properties: {
            data: {
              type: "string",
              description: "Data do lançamento no formato YYYY-MM-DD",
            },
            descricao: {
              type: "string",
              description: "Nome do estabelecimento ou descrição, como aparece",
            },
            valor: {
              type: "number",
              description: "Valor em reais, sempre positivo",
            },
            direcao: {
              type: "string",
              enum: ["saida", "entrada"],
              description:
                "saida = gasto/pagamento/compra; entrada = dinheiro recebido, estorno, crédito",
            },
            parcela_atual: {
              type: "integer",
              description: "Número da parcela, se aparecer (ex.: 3 em 3/10)",
            },
            parcela_total: {
              type: "integer",
              description: "Total de parcelas, se aparecer (ex.: 10 em 3/10)",
            },
          },
          required: ["data", "descricao", "valor", "direcao"],
        },
      },
      observacao: {
        type: "string",
        description:
          "Algo que impediu de ler parte do arquivo (corte, borrado, ano incerto)",
      },
    },
    required: ["lancamentos"],
  },
};

async function usuarioDoCasal(token: string | null): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anon) return false;
  const sb = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return false;
  // Com a Fase 0 rodada, só os membros passam; sem ela, basta estar logado
  const r = await sb.rpc("eh_do_casal");
  if (r.error) return true;
  return r.data === true;
}

export async function POST(req: Request) {
  const token =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || null;
  if (!(await usuarioDoCasal(token)))
    return Response.json(
      { erro: "Entre no app para usar a leitura de arquivos." },
      { status: 401 },
    );

  const chave = process.env.ANTHROPIC_API_KEY;
  if (!chave) {
    return Response.json(
      {
        erro: "A leitura de prints e PDFs ainda não foi configurada: falta a variável ANTHROPIC_API_KEY na Vercel.",
      },
      { status: 501 },
    );
  }

  let corpo: {
    arquivos: Arquivo[];
    conta: string;
    tipoConta: string;
    hoje: string;
  };
  try {
    corpo = await req.json();
  } catch {
    return Response.json({ erro: "Envio inválido." }, { status: 400 });
  }
  const arquivos = (corpo.arquivos || []).slice(0, 8);
  if (!arquivos.length)
    return Response.json({ erro: "Nenhum arquivo enviado." }, { status: 400 });

  const conteudo: unknown[] = arquivos.map((a) =>
    a.tipo === "application/pdf"
      ? {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: a.base64,
          },
        }
      : {
          type: "image",
          source: { type: "base64", media_type: a.tipo, data: a.base64 },
        },
  );
  conteudo.push({
    type: "text",
    text: [
      `Hoje é ${corpo.hoje}. Os arquivos são da conta "${corpo.conta}" (${corpo.tipoConta === "credito" ? "cartão de crédito" : corpo.tipoConta}).`,
      "Extraia cada lançamento individual: compras, pagamentos, Pix, transferências, salários, estornos.",
      "Não inclua totais, saldos, limites, valor mínimo, juros projetados nem linhas de resumo.",
      "Se a data não mostrar o ano, use o ano mais provável para que a data não fique no futuro em relação a hoje (exceto parcelas futuras de fatura).",
      "Um comprovante de Pix, recibo ou nota fiscal vira um único lançamento com o valor total.",
      "Se o mesmo lançamento aparecer em dois prints sobrepostos, registre só uma vez.",
      "Mantenha a descrição como aparece no arquivo, sem inventar nomes.",
    ].join(" "),
  });

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": chave,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODELO,
      max_tokens: 8000,
      tools: [FERRAMENTA],
      tool_choice: { type: "tool", name: FERRAMENTA.name },
      messages: [{ role: "user", content: conteudo }],
    }),
  });

  if (!r.ok) {
    const txt = await r.text();
    return Response.json(
      { erro: `A leitura falhou (${r.status}). ${txt.slice(0, 300)}` },
      { status: 502 },
    );
  }
  const resposta = await r.json();
  const uso = resposta.content?.find(
    (c: { type: string }) => c.type === "tool_use",
  );
  const entrada = uso?.input || { lancamentos: [] };
  return Response.json({
    lancamentos: entrada.lancamentos || [],
    observacao: entrada.observacao || null,
  });
}
