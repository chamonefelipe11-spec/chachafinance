"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useDados, TABELAS_NOVAS, TABELAS_PROJETOS } from "@/lib/store";
import {
  definirContas,
  mapaCategorias,
  previstosFaltando,
  situacaoDisciplina,
} from "@/lib/finance";
import { dataBR, definirOcultar, mesAtual } from "@/lib/format";
import { avisar } from "@/lib/toast";
import type {
  Aba,
  Disciplina,
  Evento,
  Meta,
  Pessoa,
  Transacao,
} from "@/lib/types";
import { Ctx, type Contexto } from "@/components/contexto";
import Shell from "@/components/Shell";
import { Avisos, Botao, Confirmacoes, Entrada } from "@/components/ui";
import TransacaoForm from "@/components/forms/TransacaoForm";
import {
  DisciplinaForm,
  EventoForm,
  MetaForm,
} from "@/components/forms/OutrosForms";
import Inicio from "@/views/Inicio";
import Lancamentos from "@/views/Lancamentos";
import Cartoes from "@/views/Cartoes";
import Orcamento from "@/views/Orcamento";
import Metas from "@/views/Metas";
import Casal from "@/views/Casal";
import Analises from "@/views/Analises";
import Faculdade from "@/views/Faculdade";
import Agenda from "@/views/Agenda";
import Ajustes from "@/views/Ajustes";
import Patrimonio from "@/views/Patrimonio";
import ContasFixas from "@/views/ContasFixas";
import Importar from "@/views/Importar";
import Projetos, { EVENTO_NOVO_CARD } from "@/views/Projetos";

const ABAS: Aba[] = [
  "inicio",
  "lancamentos",
  "contasfixas",
  "cartoes",
  "patrimonio",
  "orcamento",
  "metas",
  "casal",
  "analises",
  "importar",
  "faculdade",
  "agenda",
  "projetos",
  "ajustes",
];

type Formulario =
  | {
      tipo: "transacao";
      editando: Transacao | null;
      inicial?: Partial<Transacao>;
    }
  | { tipo: "disciplina"; editando: Disciplina | null; aluno: Pessoa }
  | { tipo: "evento"; editando: Evento | null; inicial?: Partial<Evento> }
  | { tipo: "meta"; editando: Meta | null };

const abaDoHash = (): Aba => {
  if (typeof window === "undefined") return "inicio";
  const h = window.location.hash.replace("#", "") as Aba;
  return ABAS.includes(h) ? h : "inicio";
};

/** Navegação pelo # da URL: o botão "voltar" do celular funciona */
function ouvirHash(aviso: () => void) {
  window.addEventListener("hashchange", aviso);
  return () => window.removeEventListener("hashchange", aviso);
}

export default function App() {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [verificando, setVerificando] = useState(true);
  const { dados, carregando, faltando, carregar, limpar } = useDados();

  const aba = useSyncExternalStore(ouvirHash, abaDoHash, () => "inicio" as Aba);
  const [mes, setMes] = useState(mesAtual());
  const [aluno, setAluno] = useState<Pessoa>("Chamone");
  const [form, setForm] = useState<Formulario | null>(null);
  // "Ocultar valores": lembrado por aparelho
  const [oculto, setOculto] = useState(() => {
    let v = false;
    try {
      v =
        typeof window !== "undefined" &&
        localStorage.getItem("chacha-ocultar") === "1";
    } catch {}
    definirOcultar(v);
    return v;
  });
  const alternarOculto = useCallback(() => {
    setOculto((o) => {
      const n = !o;
      definirOcultar(n);
      try {
        localStorage.setItem("chacha-ocultar", n ? "1" : "0");
      } catch {}
      return n;
    });
  }, []);

  // App instalável: o service worker só cuida das notificações
  useEffect(() => {
    if ("serviceWorker" in navigator && location.protocol === "https:")
      navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  const tentadas = useRef(new Set<string>());
  // Contas fixas: cria os lançamentos do mês atual e do próximo que ainda não existem
  useEffect(() => {
    definirContas(dados.contas);
    if (
      carregando ||
      faltando.includes("recorrencias") ||
      !dados.recorrencias.length
    )
      return;
    // Cada conta fixa/mês é tentada uma vez por sessão (evita repetir se o banco recusar)
    const novas = previstosFaltando(
      dados.recorrencias,
      dados.transacoes,
      dados.contas,
    ).filter((n) => {
      const k = `${n.recorrencia_id}|${n.competencia}`;
      if (tentadas.current.has(k)) return false;
      tentadas.current.add(k);
      return true;
    });
    if (!novas.length) return;
    supabase
      .from("financas")
      .upsert(novas, {
        onConflict: "recorrencia_id,competencia",
        ignoreDuplicates: true,
      })
      .then(({ error }) => {
        if (!error) carregar(true);
      });
  }, [dados, carregando, faltando, carregar]);
  const [chaveForm, setChaveForm] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessao(session);
      setVerificando(false);
      if (session) carregar();
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((evento, session) => {
      setSessao(session);
      if (evento === "SIGNED_IN") carregar();
    });
    return () => subscription.unsubscribe();
  }, [carregar]);

  const irPara = useCallback((a: Aba) => {
    if (window.location.hash !== `#${a}`) window.location.hash = a;
    window.scrollTo({ top: 0 });
  }, []);

  const abrir = useCallback((f: Formulario) => {
    setChaveForm((k) => k + 1);
    setForm(f);
  }, []);
  const fechar = useCallback(() => setForm(null), []);
  const recarregar = useCallback(() => carregar(true), [carregar]);

  const novo = useCallback(() => {
    if (aba === "faculdade")
      abrir({ tipo: "disciplina", editando: null, aluno });
    else if (aba === "agenda") abrir({ tipo: "evento", editando: null });
    else if (aba === "metas") abrir({ tipo: "meta", editando: null });
    else if (aba === "projetos")
      window.dispatchEvent(new Event(EVENTO_NOVO_CARD));
    else abrir({ tipo: "transacao", editando: null });
  }, [aba, aluno, abrir]);

  // Atalho do ícone instalado: "Novo lançamento"
  useEffect(() => {
    if (!sessao || carregando) return;
    const u = new URL(window.location.href);
    if (u.searchParams.get("novo")) {
      u.searchParams.delete("novo");
      history.replaceState(null, "", u.pathname + u.hash);
      setTimeout(() => abrir({ tipo: "transacao", editando: null }), 0);
    }
  }, [sessao, carregando, abrir]);

  // Atalho: tecla "n" abre um novo lançamento
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement;
      if (
        form ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        /INPUT|TEXTAREA|SELECT/.test(alvo.tagName)
      )
        return;
      if (e.key === "n") {
        e.preventDefault();
        novo();
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [form, novo]);

  const ctx: Contexto = useMemo(
    () => ({
      dados,
      cats: mapaCategorias(dados.categorias),
      contasPorNome: new Map(dados.contas.map((c) => [c.nome, c])),
      recarregar,
      mes,
      setMes,
      irPara,
      faltando,
      novaTransacao: (inicial) =>
        abrir({ tipo: "transacao", editando: null, inicial }),
      editarTransacao: (t) => abrir({ tipo: "transacao", editando: t }),
      novaDisciplina: (a) =>
        abrir({ tipo: "disciplina", editando: null, aluno: a }),
      editarDisciplina: (d) =>
        abrir({ tipo: "disciplina", editando: d, aluno: d.aluno }),
      novoEvento: (inicial) =>
        abrir({ tipo: "evento", editando: null, inicial }),
      editarEvento: (e) => abrir({ tipo: "evento", editando: e }),
      novaMeta: () => abrir({ tipo: "meta", editando: null }),
      editarMeta: (m) => abrir({ tipo: "meta", editando: m }),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dados, recarregar, mes, irPara, faltando, abrir, oculto],
  );

  async function sair() {
    await supabase.auth.signOut();
    limpar();
  }

  async function exportar() {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const add = (nome: string, linhas: Record<string, unknown>[]) =>
      linhas.length &&
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas), nome);
    add(
      "Lançamentos",
      dados.transacoes.map((f) => ({
        Data: dataBR(f.data),
        Descrição: f.descricao,
        Tipo: f.tipo,
        Categoria: f.categoria,
        Conta: f.cartao,
        Quem: f.quem,
        Classificação: f.tipo_gasto,
        "Valor (R$)": f.valor,
        Parcela:
          (f.total_parcelas || 1) > 1
            ? `${f.parcela_atual}/${f.total_parcelas}`
            : "",
        "Dividido (% do outro)": f.divisao_pct || "",
      })),
    );
    add(
      "Faculdade",
      dados.disciplinas.map((d) => {
        const s = situacaoDisciplina(d);
        return {
          Aluno: d.aluno,
          Disciplina: d.nome,
          Semestre: d.semestre,
          P1: d.nota_p1 ?? "",
          P2: d.nota_p2 ?? "",
          P3: d.nota_p3 ?? "",
          "Pontos garantidos": Number(s.media.toFixed(1)),
          Faltas: d.faltas,
          "Máx. faltas": d.max_faltas,
          Situação: s.status,
        };
      }),
    );
    add(
      "Agenda",
      dados.eventos.map((e) => ({
        Data: dataBR(e.data),
        Hora: e.hora || "",
        Compromisso: e.titulo,
        Tipo: e.categoria,
        Quem: e.quem,
        Feito: e.concluido ? "sim" : "não",
      })),
    );
    add(
      "Metas",
      dados.metas.map((m) => ({
        Meta: m.nome,
        Alvo: m.valor_alvo,
        Guardado: m.valor_atual,
        Prazo: m.prazo ? dataBR(m.prazo) : "",
        Quem: m.quem,
      })),
    );
    add(
      "Acertos",
      dados.acertos.map((a) => ({
        Data: dataBR(a.data),
        De: a.de,
        Para: a.para,
        Valor: a.valor,
        Obs: a.obs || "",
      })),
    );
    if (!wb.SheetNames.length)
      return avisar("Ainda não há dados para exportar.", "aviso");
    XLSX.writeFile(
      wb,
      `chachafinance_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  }

  if (verificando) return <Carregando />;
  if (!sessao) return <Login />;

  // O quadro de projetos tem o próprio aviso, dentro da tela
  const faltandoBase = faltando.filter((t) => !TABELAS_PROJETOS.includes(t));
  const faltaMigracao =
    faltandoBase.length > 0 && faltandoBase.length <= TABELAS_NOVAS.length;
  const qualSql = faltandoBase.includes("contas")
    ? "migracao.sql e depois fase2a5.sql"
    : "fase2a5.sql";

  return (
    <Ctx.Provider value={ctx}>
      <div inert={!!form}>
        <Shell
          aba={aba}
          irPara={irPara}
          email={sessao.user.email || ""}
          aoSair={sair}
          aoNovo={novo}
          aoExportar={exportar}
          oculto={oculto}
          aoAlternarOculto={alternarOculto}
          aviso={
            faltaMigracao && aba !== "ajustes" ? (
              <div className="mx-4 mt-4 rounded-2xl border border-alerta/30 bg-alerta/8 px-4 py-3 text-sm text-texto md:mx-10 md:mt-6">
                Para liberar as telas novas, rode{" "}
                <code className="rounded bg-elevado px-1.5 py-0.5 text-[13px]">
                  supabase/{qualSql}
                </code>{" "}
                no SQL Editor do Supabase.
              </div>
            ) : null
          }
        >
          {carregando ? (
            <Carregando embutido />
          ) : (
            <>
              {aba === "inicio" && <Inicio />}
              {aba === "lancamentos" && <Lancamentos />}
              {aba === "cartoes" && <Cartoes />}
              {aba === "orcamento" && <Orcamento />}
              {aba === "metas" && <Metas />}
              {aba === "casal" && <Casal />}
              {aba === "analises" && <Analises />}
              {aba === "faculdade" && (
                <Faculdade aluno={aluno} setAluno={setAluno} />
              )}
              {aba === "agenda" && <Agenda />}
              {aba === "ajustes" && <Ajustes />}
              {aba === "patrimonio" && <Patrimonio />}
              {aba === "contasfixas" && <ContasFixas />}
              {aba === "importar" && <Importar />}
              {aba === "projetos" && <Projetos />}
            </>
          )}
        </Shell>
      </div>

      {form?.tipo === "transacao" && (
        <TransacaoForm
          key={chaveForm}
          aberta
          aoFechar={fechar}
          editando={form.editando}
          inicial={form.inicial}
        />
      )}
      {form?.tipo === "disciplina" && (
        <DisciplinaForm
          key={chaveForm}
          aberta
          aoFechar={fechar}
          editando={form.editando}
          aluno={form.aluno}
        />
      )}
      {form?.tipo === "evento" && (
        <EventoForm
          key={chaveForm}
          aberta
          aoFechar={fechar}
          editando={form.editando}
          inicial={form.inicial}
        />
      )}
      {form?.tipo === "meta" && (
        <MetaForm
          key={chaveForm}
          aberta
          aoFechar={fechar}
          editando={form.editando}
        />
      )}
      <Confirmacoes />
      <Avisos />
    </Ctx.Provider>
  );
}

function Carregando({ embutido }: { embutido?: boolean }) {
  return (
    <div
      className={
        embutido
          ? "flex h-[60vh] items-center justify-center"
          : "flex min-h-dvh items-center justify-center"
      }
    >
      <div className="flex items-center gap-3 text-sm text-suave">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-linha border-t-papel" />
        Carregando…
      </div>
    </div>
  );
}

function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [entrando, setEntrando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setEntrando(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });
    setEntrando(false);
    if (error) setErro("E-mail ou senha incorretos.");
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <span className="relative mb-8 flex h-12 w-16">
          <span className="absolute left-0 h-12 w-12 rounded-full bg-chamone" />
          <span className="absolute left-5 h-12 w-12 rounded-full bg-leticia mix-blend-screen" />
        </span>
        <h1 className="display text-4xl font-semibold">chachafinance</h1>
        <p className="mt-2 text-[15px] text-suave">
          O dinheiro, a faculdade e a agenda do Chamone e da Letícia.
        </p>
        <form onSubmit={entrar} className="mt-8 space-y-3">
          <Entrada
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail"
            aria-label="E-mail"
          />
          <Entrada
            type="password"
            required
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Senha"
            aria-label="Senha"
          />
          {erro && <p className="text-sm text-saida">{erro}</p>}
          <Botao
            type="submit"
            variante="primario"
            tamanho="lg"
            className="w-full"
            disabled={entrando}
          >
            {entrando ? "Entrando…" : "Entrar"}
          </Botao>
        </form>
      </div>
      <Avisos />
    </div>
  );
}
