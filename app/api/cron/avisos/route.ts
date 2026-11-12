// Cron diário (vercel.json): manda os avisos do dia por notificação no celular.
// Protegido pelo CRON_SECRET, que a Vercel envia sozinha no cabeçalho Authorization.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import {
  hojeBrasilia,
  montarAvisos,
  resumoDoMes,
  type DadosAviso,
} from "@/lib/avisos";
import { definirContas } from "@/lib/finance";
import { somarMeses } from "@/lib/format";
import type { AvisoConfig, Card, ColunaQuadro, Conta, Pessoa } from "@/lib/types";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

async function lerTudo<T>(sb: SupabaseClient, tabela: string): Promise<T[]> {
  const todos: T[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await sb
      .from(tabela)
      .select("*")
      .order("id")
      .range(de, de + 999);
    if (error) return todos; // tabela ainda não criada
    todos.push(...((data as T[]) || []));
    if (!data || data.length < 1000) return todos;
  }
}

function pessoaDoEmail(
  email: string,
  membros: { email: string; nome: string | null }[],
): Pessoa | null {
  const n = membros.find((m) => m.email === email.toLowerCase())?.nome || "";
  if (/let/i.test(n)) return "Letícia";
  if (/cham|feli/i.test(n)) return "Chamone";
  return null;
}

export async function GET(req: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || req.headers.get("authorization") !== `Bearer ${segredo}`)
    return new Response("Não autorizado", { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!chave)
    return Response.json(
      { erro: "Falta SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 },
    );
  const sb = createClient(url, chave, { auth: { persistSession: false } });

  const [
    transacoes,
    contas,
    categorias,
    faturasPagas,
    disciplinas,
    eventos,
    acertos,
    metas,
    configs,
    inscricoes,
    membros,
    cards,
    colunasQuadro,
  ] = await Promise.all([
    lerTudo<DadosAviso["transacoes"][number]>(sb, "financas"),
    lerTudo<Conta>(sb, "contas"),
    lerTudo<DadosAviso["categorias"][number]>(sb, "categorias"),
    lerTudo<DadosAviso["faturasPagas"][number]>(sb, "faturas_pagas"),
    lerTudo<DadosAviso["disciplinas"][number]>(sb, "disciplinas"),
    lerTudo<DadosAviso["eventos"][number]>(sb, "agenda"),
    lerTudo<DadosAviso["acertos"][number]>(sb, "acertos"),
    lerTudo<DadosAviso["metas"][number]>(sb, "metas"),
    lerTudo<AvisoConfig & { id?: string }>(sb, "avisos_config"),
    lerTudo<{
      id: string;
      email: string;
      endpoint: string;
      p256dh: string;
      auth: string;
    }>(sb, "push_inscricoes"),
    lerTudo<{ email: string; nome: string | null }>(sb, "membros"),
    lerTudo<Card>(sb, "cards"),
    lerTudo<ColunaQuadro>(sb, "quadro_colunas"),
  ]);
  const num = <T extends { valor: unknown }>(t: T): T => ({
    ...t,
    valor: Number(t.valor) || 0,
  });
  const dados: DadosAviso = {
    transacoes: transacoes.map((t) => ({
      ...num(t),
      status:
        t.status === "previsto" ? ("previsto" as const) : ("pago" as const),
    })),
    contas,
    categorias: categorias.map((c) => ({
      ...c,
      orcamento: c.orcamento ? Number(c.orcamento) : null,
    })),
    faturasPagas: faturasPagas.map(num),
    disciplinas,
    eventos,
    acertos: acertos.map(num),
    metas,
    cards,
    colunasQuadro,
  };
  definirContas(contas);

  const hoje = hojeBrasilia();
  const forcarResumo = new URL(req.url).searchParams.get("resumo") === "1";
  const msgs = montarAvisos(dados, hoje);
  if (forcarResumo && !msgs.some((m) => m.tipo === "resumo"))
    msgs.push(resumoDoMes(dados, somarMeses(hoje.slice(0, 7), -1), hoje));

  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (pub && priv)
    webpush.setVapidDetails("mailto:chachafinance@example.com", pub, priv);

  const relatorio: Record<string, { push: number; avisos: number }> = {};
  for (const cfg of configs) {
    const quem = cfg.pessoa || pessoaDoEmail(cfg.email, membros);
    const escolhidos = new Set(cfg.avisos || []);
    const meus = msgs.filter(
      (m) =>
        escolhidos.has(m.tipo) &&
        (m.para === null || m.para === quem || quem === null),
    );
    const r = { push: 0, avisos: meus.length };
    if (meus.length && cfg.push && pub && priv) {
      // Até 2 avisos vão separados; mais que isso viram uma notificação só (o resumo sempre vai à parte)
      const resumo = meus.filter((m) => m.tipo === "resumo");
      const outros = meus.filter((m) => m.tipo !== "resumo");
      const envios =
        outros.length > 2
          ? [
              {
                titulo: `${outros.length} avisos para hoje e amanhã`,
                corpo: outros.map((m) => m.titulo).join(" · "),
                url: "/#inicio",
                tag: `avisos-${hoje}`,
              },
            ]
          : outros.map((m) => ({ titulo: m.titulo, corpo: m.corpo, url: m.url, tag: `${m.tipo}-${hoje}-${m.titulo}` }));
      envios.push(...resumo.map((m) => ({ titulo: m.titulo, corpo: m.corpo, url: m.url, tag: `resumo-${hoje}` })));
      for (const s of inscricoes.filter((i) => i.email === cfg.email)) {
        for (const e of envios) {
          try {
            await webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              JSON.stringify(e),
            );
            r.push += 1;
          } catch (erro) {
            const status = (erro as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410) {
              await sb.from("push_inscricoes").delete().eq("id", s.id); // aparelho desinstalou
              break;
            }
          }
        }
      }
    }
    relatorio[cfg.email] = r;
  }
  return Response.json({ hoje, avisos: msgs.length, relatorio });
}
