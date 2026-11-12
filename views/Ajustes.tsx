"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useApp } from "@/components/contexto";
import {
  PainelAvisos,
  PainelBackup,
  PainelRegras,
} from "@/components/AjustesExtras";
import {
  Alternar,
  Botao,
  Cabecalho,
  Campo,
  Entrada,
  Folha,
  Painel,
  Ponto,
  Segmentado,
  confirmar,
  cx,
} from "@/components/ui";
import { dinheiro, lerValor, valorParaCampo } from "@/lib/format";
import { PALETA } from "@/lib/defaults";
import { db } from "@/lib/store";
import { avisar } from "@/lib/toast";
import type { Categoria, Conta, TipoCategoria, TipoConta } from "@/lib/types";

const TIPOS_CONTA: { valor: TipoConta; rotulo: string }[] = [
  { valor: "corrente", rotulo: "Conta" },
  { valor: "credito", rotulo: "Crédito" },
  { valor: "beneficio", rotulo: "Vale" },
  { valor: "investimento", rotulo: "Investimento" },
];
const TITULO_TIPO: Record<TipoConta, string> = {
  corrente: "Contas",
  credito: "Cartões de crédito",
  beneficio: "Vales e benefícios",
  investimento: "Investimentos",
};
const TITULO_CAT: Record<TipoCategoria, string> = {
  despesa: "Despesas",
  receita: "Receitas",
  investimento: "Investimentos",
};

export default function Ajustes() {
  const { dados, faltando } = useApp();
  const [conta, setConta] = useState<Conta | "nova" | null>(null);
  const [cat, setCat] = useState<Categoria | "nova" | null>(null);
  const semTabelas =
    faltando.includes("contas") || faltando.includes("categorias");

  return (
    <div className="space-y-6">
      <Cabecalho
        titulo="Ajustes"
        sub="Contas, categorias, avisos, backup e regras de importação. Renomear uma conta ou categoria atualiza os lançamentos antigos."
      />

      {semTabelas && (
        <div className="rounded-2xl border border-alerta/30 bg-alerta/8 p-4 text-sm text-texto">
          As tabelas de contas e categorias ainda não existem. Abra o Supabase →
          SQL Editor, cole o arquivo{" "}
          <code className="rounded bg-elevado px-1.5 py-0.5 text-[13px]">
            supabase/migracao.sql
          </code>{" "}
          e clique em Run. Até lá o app usa a lista padrão.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Painel
          titulo="Contas e cartões"
          acao={
            <Botao
              tamanho="sm"
              icone={<Plus className="h-4 w-4" />}
              onClick={() => setConta("nova")}
              disabled={semTabelas}
            >
              Nova
            </Botao>
          }
          corpo={false}
        >
          <div className="px-3 pb-3">
            {(
              [
                "corrente",
                "credito",
                "beneficio",
                "investimento",
              ] as TipoConta[]
            ).map((t) => {
              const lista = dados.contas.filter((c) => c.tipo === t);
              if (!lista.length) return null;
              return (
                <div key={t} className="pt-3">
                  <p className="px-2 pb-1 text-[13px] text-fraco">
                    {TITULO_TIPO[t]}
                  </p>
                  {lista.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      disabled={semTabelas}
                      onClick={() => setConta(c)}
                      className={cx(
                        "flex w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-elevado/70 disabled:cursor-default",
                        !c.ativo && "opacity-50",
                      )}
                    >
                      <Ponto cor={c.cor} tamanho={10} />
                      <span className="flex-1 truncate text-[15px]">
                        {c.nome}
                      </span>
                      <span className="text-[12.5px] text-fraco">
                        {c.tipo === "credito"
                          ? c.dia_fechamento
                            ? `fecha dia ${c.dia_fechamento} · vence dia ${c.dia_vencimento}`
                            : "sem datas"
                          : !c.ativo
                            ? "arquivada"
                            : ""}
                      </span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </Painel>

        <Painel
          titulo="Categorias"
          acao={
            <Botao
              tamanho="sm"
              icone={<Plus className="h-4 w-4" />}
              onClick={() => setCat("nova")}
              disabled={semTabelas}
            >
              Nova
            </Botao>
          }
          corpo={false}
        >
          <div className="px-3 pb-3">
            {(["despesa", "receita", "investimento"] as TipoCategoria[]).map(
              (t) => {
                const lista = dados.categorias.filter((c) => c.tipo === t);
                if (!lista.length) return null;
                return (
                  <div key={t} className="pt-3">
                    <p className="px-2 pb-1 text-[13px] text-fraco">
                      {TITULO_CAT[t]}
                    </p>
                    {lista.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        disabled={semTabelas}
                        onClick={() => setCat(c)}
                        className={cx(
                          "flex w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-elevado/70 disabled:cursor-default",
                          !c.ativo && "opacity-50",
                        )}
                      >
                        <Ponto cor={c.cor} tamanho={10} />
                        <span className="flex-1 truncate text-[15px]">
                          {c.nome}
                        </span>
                        <span className="num text-[12.5px] text-fraco">
                          {c.orcamento
                            ? `limite ${dinheiro(c.orcamento)}`
                            : !c.ativo
                              ? "arquivada"
                              : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                );
              },
            )}
          </div>
        </Painel>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PainelAvisos />
        <div className="space-y-6">
          <PainelBackup />
          <PainelRegras />
        </div>
      </div>

      {conta && (
        <ContaForm
          key={conta === "nova" ? "nova" : conta.id}
          conta={conta === "nova" ? null : conta}
          aoFechar={() => setConta(null)}
        />
      )}
      {cat && (
        <CategoriaForm
          key={cat === "nova" ? "nova" : cat.id}
          cat={cat === "nova" ? null : cat}
          aoFechar={() => setCat(null)}
        />
      )}
    </div>
  );
}

function SeletorCor({
  cor,
  setCor,
}: {
  cor: string;
  setCor: (c: string) => void;
}) {
  return (
    <div>
      <span className="mb-2 block text-[13px] font-medium text-suave">Cor</span>
      <div className="flex flex-wrap gap-2">
        {PALETA.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Cor ${c}`}
            onClick={() => setCor(c)}
            className="h-8 w-8 cursor-pointer rounded-full"
            style={{
              backgroundColor: c,
              boxShadow:
                cor.toLowerCase() === c.toLowerCase()
                  ? `0 0 0 2px #1b1e25, 0 0 0 4px ${c}`
                  : undefined,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ContaForm({
  conta,
  aoFechar,
}: {
  conta: Conta | null;
  aoFechar: () => void;
}) {
  const { dados, recarregar } = useApp();
  const [nome, setNome] = useState(conta?.nome || "");
  const [tipo, setTipo] = useState<TipoConta>(conta?.tipo || "corrente");
  const [cor, setCor] = useState(conta?.cor || PALETA[0]);
  const [fech, setFech] = useState(
    conta?.dia_fechamento ? String(conta.dia_fechamento) : "",
  );
  const [venc, setVenc] = useState(
    conta?.dia_vencimento ? String(conta.dia_vencimento) : "",
  );
  const [limite, setLimite] = useState(valorParaCampo(conta?.limite));
  const [ativo, setAtivo] = useState(conta?.ativo ?? true);
  const [salvando, setSalvando] = useState(false);
  const usos = conta
    ? dados.transacoes.filter((t) => t.cartao === conta.nome).length
    : 0;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const n = nome.trim();
    if (!n) return avisar("Dê um nome à conta.", "erro");
    if (dados.contas.some((c) => c.nome === n && c.id !== conta?.id))
      return avisar("Já existe uma conta com esse nome.", "erro");
    const dia = (s: string) =>
      s ? Math.min(Math.max(parseInt(s) || 1, 1), 31) : null;
    const payload = {
      nome: n,
      tipo,
      cor,
      dia_fechamento: tipo === "credito" ? dia(fech) : null,
      dia_vencimento: tipo === "credito" ? dia(venc) : null,
      limite: tipo === "credito" && limite ? lerValor(limite) : null,
      ativo,
      ordem: conta?.ordem ?? dados.contas.length,
    };
    setSalvando(true);
    let ok = conta
      ? await db.atualizar("contas", conta.id, payload)
      : await db.inserir("contas", payload);
    if (ok && conta && conta.nome !== n) {
      // Renomeia em todo lugar que guarda o nome da conta (inclusive transferências que chegam nela)
      const r = await Promise.all([
        db.atualizarOnde("financas", "cartao", conta.nome, { cartao: n }),
        db.atualizarOnde("financas", "conta_destino", conta.nome, { conta_destino: n }, true),
        db.atualizarOnde("faturas_pagas", "conta", conta.nome, { conta: n }),
        db.atualizarOnde("recorrencias", "cartao", conta.nome, { cartao: n }, true),
        db.atualizarOnde("regras", "transferir_para", conta.nome, { transferir_para: n }, true),
      ]);
      ok = r.every(Boolean);
    }
    setSalvando(false);
    if (ok) {
      avisar(conta ? "Conta atualizada." : "Conta criada.");
      aoFechar();
      recarregar();
    }
  }

  async function apagar() {
    if (!conta) return;
    if (usos > 0)
      return avisar(
        `Essa conta tem ${usos} lançamentos. Desligue “Em uso” para arquivá-la.`,
        "aviso",
      );
    if (!(await confirmar(`Apagar ${conta.nome}?`))) return;
    if (await db.remover("contas", conta.id)) {
      avisar("Conta apagada.");
      aoFechar();
      recarregar();
    }
  }

  return (
    <Folha
      aberta
      aoFechar={aoFechar}
      titulo={conta ? conta.nome : "Nova conta"}
      rodape={
        <div className="flex gap-2">
          {conta && (
            <Botao variante="fantasma" onClick={apagar}>
              Apagar
            </Botao>
          )}
          <Botao
            variante="primario"
            tamanho="lg"
            className="flex-1"
            type="submit"
            form="form-conta"
            disabled={salvando}
          >
            {conta ? "Salvar alterações" : "Criar conta"}
          </Botao>
        </div>
      }
    >
      <form id="form-conta" onSubmit={salvar} className="space-y-4">
        <Campo
          rotulo="Nome"
          dica={
            conta && usos
              ? `${usos} lançamentos usam esta conta; serão renomeados junto.`
              : undefined
          }
        >
          <Entrada
            autoFocus={!conta}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Cartão Nubank"
          />
        </Campo>
        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-suave">
            Tipo
          </span>
          <Segmentado
            tamanho="sm"
            valor={tipo}
            aoMudar={setTipo}
            opcoes={TIPOS_CONTA}
          />
        </div>
        {tipo === "credito" && (
          <div className="grid grid-cols-3 gap-3 rounded-2xl border border-linha-suave bg-campo/60 p-4">
            <Campo rotulo="Fecha dia">
              <Entrada
                type="number"
                min={1}
                max={31}
                value={fech}
                onChange={(e) => setFech(e.target.value)}
                placeholder="3"
              />
            </Campo>
            <Campo rotulo="Vence dia">
              <Entrada
                type="number"
                min={1}
                max={31}
                value={venc}
                onChange={(e) => setVenc(e.target.value)}
                placeholder="10"
              />
            </Campo>
            <Campo rotulo="Limite (R$)">
              <Entrada
                inputMode="decimal"
                value={limite}
                onChange={(e) => setLimite(e.target.value)}
                placeholder="opcional"
              />
            </Campo>
            <p className="col-span-3 text-xs text-fraco">
              Compras a partir do dia de fechamento entram na fatura do mês
              seguinte.
            </p>
          </div>
        )}
        <SeletorCor cor={cor} setCor={setCor} />
        <Alternar
          ligado={ativo}
          aoMudar={setAtivo}
          rotulo="Em uso (aparece nos formulários)"
        />
      </form>
    </Folha>
  );
}

function CategoriaForm({
  cat,
  aoFechar,
}: {
  cat: Categoria | null;
  aoFechar: () => void;
}) {
  const { dados, recarregar } = useApp();
  const [nome, setNome] = useState(cat?.nome || "");
  const [tipo, setTipo] = useState<TipoCategoria>(cat?.tipo || "despesa");
  const [cor, setCor] = useState(cat?.cor || PALETA[2]);
  const [orcamento, setOrcamento] = useState(valorParaCampo(cat?.orcamento));
  const [ativo, setAtivo] = useState(cat?.ativo ?? true);
  const [salvando, setSalvando] = useState(false);
  const usos = cat
    ? dados.transacoes.filter((t) => t.categoria === cat.nome).length
    : 0;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const n = nome.trim();
    if (!n) return avisar("Dê um nome à categoria.", "erro");
    if (dados.categorias.some((c) => c.nome === n && c.id !== cat?.id))
      return avisar("Já existe uma categoria com esse nome.", "erro");
    const v = orcamento ? lerValor(orcamento) : null;
    const payload = {
      nome: n,
      tipo,
      cor,
      orcamento: tipo === "despesa" && v && v > 0 ? v : null,
      ativo,
      ordem: cat?.ordem ?? dados.categorias.length,
    };
    setSalvando(true);
    let ok = cat
      ? await db.atualizar("categorias", cat.id, payload)
      : await db.inserir("categorias", payload);
    if (ok && cat && cat.nome !== n) {
      // Renomeia em todo lugar que guarda o nome: lançamentos, regras, contas fixas e cards
      const r = await Promise.all([
        db.atualizarOnde("financas", "categoria", cat.nome, { categoria: n }),
        db.atualizarOnde("regras", "categoria", cat.nome, { categoria: n }, true),
        db.atualizarOnde("recorrencias", "categoria", cat.nome, { categoria: n }, true),
        db.atualizarOnde("cards", "categoria", cat.nome, { categoria: n }, true),
      ]);
      ok = r.every(Boolean);
    }
    setSalvando(false);
    if (ok) {
      avisar(cat ? "Categoria atualizada." : "Categoria criada.");
      aoFechar();
      recarregar();
    }
  }

  async function apagar() {
    if (!cat) return;
    if (usos > 0)
      return avisar(
        `Essa categoria tem ${usos} lançamentos. Desligue “Em uso” para arquivá-la.`,
        "aviso",
      );
    if (!(await confirmar(`Apagar ${cat.nome}?`))) return;
    if (await db.remover("categorias", cat.id)) {
      avisar("Categoria apagada.");
      aoFechar();
      recarregar();
    }
  }

  return (
    <Folha
      aberta
      aoFechar={aoFechar}
      titulo={cat ? cat.nome : "Nova categoria"}
      rodape={
        <div className="flex gap-2">
          {cat && (
            <Botao variante="fantasma" onClick={apagar}>
              Apagar
            </Botao>
          )}
          <Botao
            variante="primario"
            tamanho="lg"
            className="flex-1"
            type="submit"
            form="form-cat"
            disabled={salvando}
          >
            {cat ? "Salvar alterações" : "Criar categoria"}
          </Botao>
        </div>
      }
    >
      <form id="form-cat" onSubmit={salvar} className="space-y-4">
        <Campo
          rotulo="Nome"
          dica={
            cat && usos
              ? `${usos} lançamentos usam esta categoria; serão renomeados junto.`
              : undefined
          }
        >
          <Entrada
            autoFocus={!cat}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Pets"
          />
        </Campo>
        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-suave">
            Tipo
          </span>
          <Segmentado
            tamanho="sm"
            valor={tipo}
            aoMudar={setTipo}
            opcoes={[
              { valor: "despesa", rotulo: "Despesa" },
              { valor: "receita", rotulo: "Receita" },
              { valor: "investimento", rotulo: "Investimento" },
            ]}
          />
          {tipo === "investimento" && (
            <p className="mt-1.5 text-xs text-fraco">
              Lançamentos nesta categoria contam como aporte, fora do saldo do
              mês.
            </p>
          )}
        </div>
        {tipo === "despesa" && (
          <Campo
            rotulo="Limite por mês (R$)"
            dica="Opcional. Aparece em Orçamento."
          >
            <Entrada
              inputMode="decimal"
              value={orcamento}
              onChange={(e) => setOrcamento(e.target.value)}
              placeholder="sem limite"
            />
          </Campo>
        )}
        <SeletorCor cor={cor} setCor={setCor} />
        <Alternar
          ligado={ativo}
          aoMudar={setAtivo}
          rotulo="Em uso (aparece nos formulários)"
        />
      </form>
    </Folha>
  );
}
