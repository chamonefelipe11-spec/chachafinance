"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Download, Plus, Trash2, Upload } from "lucide-react";
import { useApp } from "./contexto";
import {
  Alternar,
  Botao,
  BotaoIcone,
  Campo,
  Chip,
  Entrada,
  Folha,
  Painel,
  Segmentado,
  Seletor,
  confirmar,
} from "./ui";
import { supabase } from "@/lib/supabase";
import { db } from "@/lib/store";
import { avisar } from "@/lib/toast";
import {
  baixarArquivo,
  cifrar,
  decifrar,
  ehBackup,
  ehCifrado,
  gerarBackup,
  restaurar,
  type Backup,
} from "@/lib/backup";
import { TIPOS_AVISO } from "@/lib/avisos";
import { hojeISO } from "@/lib/format";
import type { Pessoa, Quem } from "@/lib/types";

// ---------------- Backup ----------------

export function PainelBackup() {
  const { recarregar } = useApp();
  const [senha, setSenha] = useState("");
  const [comSenha, setComSenha] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [lido, setLido] = useState<Backup | null>(null);
  const [cifrado, setCifrado] = useState<unknown>(null);
  const [senhaRestaurar, setSenhaRestaurar] = useState("");
  const [restaurando, setRestaurando] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);

  async function baixar() {
    if (comSenha && senha.length < 8)
      return avisar("Use uma senha com pelo menos 8 caracteres.", "erro");
    setGerando(true);
    try {
      const b = await gerarBackup();
      const texto = JSON.stringify(b);
      const conteudo = comSenha
        ? JSON.stringify(await cifrar(texto, senha))
        : texto;
      baixarArquivo(
        `chachafinance-backup-${hojeISO()}${comSenha ? "-com-senha" : ""}.json`,
        conteudo,
      );
      const total = Object.values(b.tabelas).reduce((a, l) => a + l.length, 0);
      avisar(`Backup baixado: ${total} registros.`);
    } catch (e) {
      avisar(
        `Não consegui gerar o backup: ${e instanceof Error ? e.message : e}`,
        "erro",
      );
    }
    setGerando(false);
  }

  async function abrir(f: File | undefined) {
    if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      if (ehCifrado(j)) setCifrado(j);
      else if (ehBackup(j)) setLido(j);
      else avisar("Esse arquivo não é um backup do chachafinance.", "erro");
    } catch {
      avisar("Não consegui ler o arquivo.", "erro");
    }
    if (arquivo.current) arquivo.current.value = "";
  }

  async function abrirCifrado() {
    try {
      const j = JSON.parse(
        await decifrar(
          cifrado as Parameters<typeof decifrar>[0],
          senhaRestaurar,
        ),
      );
      if (!ehBackup(j)) throw new Error();
      setCifrado(null);
      setSenhaRestaurar("");
      setLido(j);
    } catch {
      avisar("Senha errada ou arquivo corrompido.", "erro");
    }
  }

  async function confirmarRestauracao() {
    if (!lido) return;
    setRestaurando(true);
    const r = await restaurar(lido);
    setRestaurando(false);
    const erros = r.filter((x) => x.erro);
    if (erros.length)
      avisar(
        `Restaurado com erros em: ${erros.map((e) => `${e.tabela} (${e.erro})`).join("; ")}`,
        "erro",
      );
    else
      avisar(
        `Backup restaurado: ${r.reduce((a, x) => a + x.linhas, 0)} registros.`,
      );
    setLido(null);
    recarregar();
  }

  return (
    <Painel
      titulo="Backup"
      sub="Uma cópia completa de tudo: lançamentos, faculdade, agenda, metas e cadastros."
    >
      <div className="space-y-4">
        <Alternar
          ligado={comSenha}
          aoMudar={setComSenha}
          rotulo="Proteger o arquivo com senha"
        />
        {comSenha && (
          <Entrada
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Senha (guarde bem: sem ela o arquivo não abre)"
            autoComplete="new-password"
          />
        )}
        <div className="flex flex-wrap gap-2">
          <Botao
            variante="primario"
            icone={<Download className="h-4 w-4" />}
            onClick={baixar}
            disabled={gerando}
          >
            {gerando ? "Gerando…" : "Baixar backup"}
          </Botao>
          <Botao
            icone={<Upload className="h-4 w-4" />}
            onClick={() => arquivo.current?.click()}
          >
            Restaurar de um arquivo
          </Botao>
          <input
            ref={arquivo}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => abrir(e.target.files?.[0])}
          />
        </div>
        <p className="text-xs text-fraco">
          O backup semanal do GitHub usa o mesmo formato, com senha. Restaurar
          grava por cima pelo identificador: o que foi apagado volta, e nada que
          existe hoje é apagado.
        </p>
      </div>

      <Folha
        aberta={!!cifrado}
        aoFechar={() => setCifrado(null)}
        titulo="Arquivo com senha"
        rodape={
          <Botao
            variante="primario"
            tamanho="lg"
            className="w-full"
            onClick={abrirCifrado}
          >
            Abrir
          </Botao>
        }
      >
        <Campo rotulo="Senha do backup">
          <Entrada
            autoFocus
            type="password"
            value={senhaRestaurar}
            onChange={(e) => setSenhaRestaurar(e.target.value)}
          />
        </Campo>
      </Folha>

      <Folha
        aberta={!!lido}
        aoFechar={() => setLido(null)}
        titulo="Restaurar este backup?"
        rodape={
          <Botao
            variante="perigo"
            tamanho="lg"
            className="w-full"
            onClick={confirmarRestauracao}
            disabled={restaurando}
          >
            {restaurando ? "Restaurando…" : "Restaurar"}
          </Botao>
        }
      >
        {lido && (
          <div className="space-y-3 text-sm">
            <p className="text-suave">
              Feito em {new Date(lido.criado_em).toLocaleString("pt-BR")}.
            </p>
            <ul className="num space-y-1">
              {Object.entries(lido.tabelas)
                .filter(([, l]) => l.length)
                .map(([t, l]) => (
                  <li key={t} className="flex justify-between">
                    <span className="text-suave">{t}</span>
                    <span>{l.length}</span>
                  </li>
                ))}
            </ul>
            <p className="text-xs text-fraco">
              Antes de restaurar, baixe um backup de agora, por garantia.
            </p>
          </div>
        )}
      </Folha>
    </Painel>
  );
}

// ---------------- Regras de importação ----------------

export function PainelRegras() {
  const { dados, recarregar, faltando } = useApp();
  const [nova, setNova] = useState(false);
  if (faltando.includes("regras")) return null;

  async function apagar(id: string, contem: string) {
    if (!(await confirmar(`Apagar a regra “${contem}”?`))) return;
    if (await db.remover("regras", id)) recarregar();
  }

  return (
    <Painel
      titulo="Regras de importação"
      sub="Quando a descrição de um extrato tiver o texto, o app já sugere a categoria e a pessoa."
      acao={
        <Botao
          tamanho="sm"
          icone={<Plus className="h-4 w-4" />}
          onClick={() => setNova(true)}
        >
          Nova
        </Botao>
      }
      corpo={false}
    >
      <ul className="px-3 pt-1 pb-3">
        {dados.regras.length === 0 && (
          <li className="px-2 py-4 text-sm text-fraco">
            Nenhuma regra ainda. Elas também nascem na revisão da importação, em
            “Sempre assim?”.
          </li>
        )}
        {dados.regras.map((r) => (
          <li
            key={r.id}
            className="flex items-center gap-3 rounded-xl px-2 py-2"
          >
            <div className="min-w-0 flex-1 text-sm">
              <span className="text-texto">“{r.contem}”</span>
              <span className="text-fraco">
                {" "}
                →{" "}
                {r.ignorar
                  ? "ignorar"
                  : r.transferir_para
                    ? `transferência para ${r.transferir_para}`
                    : [r.categoria, r.quem === "Ambos" ? "conjunta" : r.quem]
                        .filter(Boolean)
                        .join(" · ")}
              </span>
            </div>
            <BotaoIcone
              rotulo="Apagar regra"
              className="h-8 w-8"
              onClick={() => apagar(r.id, r.contem)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </BotaoIcone>
          </li>
        ))}
      </ul>
      {nova && <NovaRegra aoFechar={() => setNova(false)} />}
    </Painel>
  );
}

function NovaRegra({ aoFechar }: { aoFechar: () => void }) {
  const { dados, recarregar } = useApp();
  const [contem, setContem] = useState("");
  const [acao, setAcao] = useState<"categoria" | "transferir" | "ignorar">(
    "categoria",
  );
  const [categoria, setCategoria] = useState(
    dados.categorias[0]?.nome || "Outros",
  );
  const [quem, setQuem] = useState<Quem | "">("");
  const [destino, setDestino] = useState(
    dados.contas.find((c) => c.tipo === "credito")?.nome || "",
  );

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const c = contem.trim().toLowerCase();
    if (c.length < 3) return avisar("Use pelo menos 3 letras.", "erro");
    const ok = await db.inserir("regras", {
      contem: c,
      categoria: acao === "categoria" ? categoria : null,
      quem: acao === "categoria" && quem ? quem : null,
      divisao_pct: null,
      transferir_para: acao === "transferir" ? destino : null,
      ignorar: acao === "ignorar",
      ordem: dados.regras.length,
    });
    if (ok) {
      avisar("Regra criada.");
      aoFechar();
      recarregar();
    }
  }

  return (
    <Folha
      aberta
      aoFechar={aoFechar}
      titulo="Nova regra"
      rodape={
        <Botao
          variante="primario"
          tamanho="lg"
          className="w-full"
          type="submit"
          form="form-nova-regra"
        >
          Criar regra
        </Botao>
      }
    >
      <form id="form-nova-regra" onSubmit={salvar} className="space-y-4">
        <Campo
          rotulo="Quando a descrição tiver"
          dica="Sem diferença entre maiúsculas e acentos."
        >
          <Entrada
            autoFocus
            value={contem}
            onChange={(e) => setContem(e.target.value)}
            placeholder="Ex.: ifood, posto shell, aplicacao"
          />
        </Campo>
        <Segmentado
          tamanho="sm"
          valor={acao}
          aoMudar={setAcao}
          opcoes={[
            { valor: "categoria", rotulo: "Categoria" },
            { valor: "transferir", rotulo: "Transferência" },
            { valor: "ignorar", rotulo: "Ignorar" },
          ]}
        />
        {acao === "categoria" && (
          <>
            <div className="flex flex-wrap gap-1.5">
              {dados.categorias
                .filter((c) => c.ativo)
                .map((c) => (
                  <Chip
                    key={c.id}
                    ativo={c.nome === categoria}
                    cor={c.cor}
                    onClick={() => setCategoria(c.nome)}
                  >
                    {c.nome}
                  </Chip>
                ))}
            </div>
            <Segmentado
              tamanho="sm"
              valor={quem}
              aoMudar={setQuem}
              opcoes={[
                { valor: "", rotulo: "Qualquer um" },
                { valor: "Chamone", rotulo: "Chamone" },
                { valor: "Letícia", rotulo: "Letícia" },
                { valor: "Ambos", rotulo: "Conjunta" },
              ]}
            />
          </>
        )}
        {acao === "transferir" && (
          <Campo rotulo="Para a conta">
            <Seletor
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
            >
              {dados.contas.map((c) => (
                <option key={c.id} value={c.nome}>
                  {c.nome}
                </option>
              ))}
            </Seletor>
          </Campo>
        )}
      </form>
    </Folha>
  );
}

// ---------------- Avisos ----------------

const base64ParaBytes = (b64: string) => {
  const p = "=".repeat((4 - (b64.length % 4)) % 4);
  const s = atob((b64 + p).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};
const bytesParaBase64 = (buf: ArrayBuffer | null) =>
  buf ? btoa(String.fromCharCode(...new Uint8Array(buf))) : "";

export function PainelAvisos() {
  const { faltando } = useApp();
  const [email, setEmail] = useState("");
  const [pessoa, setPessoa] = useState<Pessoa | "">("");
  const [emailAtivo, setEmailAtivo] = useState(false);
  const [destino, setDestino] = useState("");
  const [avisos, setAvisos] = useState<string[]>(TIPOS_AVISO.map((t) => t.id));
  const [push, setPush] = useState(false);
  const [aparelho, setAparelho] = useState<
    "ativo" | "inativo" | "sem-suporte" | "instalar"
  >("inativo");
  const [carregado, setCarregado] = useState(false);
  const chavePublica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const e = data.user?.email?.toLowerCase() || "";
      setEmail(e);
      if (!e) return;
      const { data: cfg } = await supabase
        .from("avisos_config")
        .select("*")
        .eq("email", e)
        .maybeSingle();
      if (cfg) {
        setPessoa(cfg.pessoa || "");
        setEmailAtivo(!!cfg.email_ativo);
        setDestino(cfg.email_destino || "");
        setAvisos(cfg.avisos || []);
        setPush(!!cfg.push);
      }
      const ios = /iphone|ipad/i.test(navigator.userAgent);
      const instalado =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as unknown as { standalone?: boolean }).standalone;
      if (!("serviceWorker" in navigator) || !("PushManager" in window))
        setAparelho(ios && !instalado ? "instalar" : "sem-suporte");
      else {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        setAparelho(sub ? "ativo" : "inativo");
      }
      setCarregado(true);
    })();
  }, []);

  if (faltando.includes("recorrencias")) return null; // SQL da v3 ainda não rodado

  async function salvar(extra: Partial<{ push: boolean }> = {}) {
    const ok = await db.upsert(
      "avisos_config",
      [
        {
          email,
          pessoa: pessoa || null,
          push: extra.push ?? push,
          email_ativo: emailAtivo,
          email_destino: destino.trim() || null,
          avisos,
        },
      ],
      "email",
    );
    if (ok) avisar("Avisos salvos.");
  }

  async function ativarAparelho() {
    if (!chavePublica)
      return avisar(
        "Falta a chave NEXT_PUBLIC_VAPID_PUBLIC_KEY na Vercel.",
        "erro",
      );
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted")
        return avisar(
          "A permissão de notificação foi negada. Libere nas configurações do navegador.",
          "erro",
        );
      const reg =
        (await navigator.serviceWorker.getRegistration()) ||
        (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64ParaBytes(chavePublica) as BufferSource,
      });
      const ok = await db.upsert(
        "push_inscricoes",
        [
          {
            email,
            endpoint: sub.endpoint,
            p256dh: bytesParaBase64(sub.getKey("p256dh")),
            auth: bytesParaBase64(sub.getKey("auth")),
          },
        ],
        "endpoint",
      );
      if (ok) {
        setAparelho("ativo");
        setPush(true);
        await salvar({ push: true });
      }
    } catch (e) {
      avisar(
        `Não consegui ligar as notificações: ${e instanceof Error ? e.message : e}`,
        "erro",
      );
    }
  }

  async function testar() {
    const { data: s } = await supabase.auth.getSession();
    const r = await fetch("/api/avisos/teste", {
      method: "POST",
      headers: { authorization: `Bearer ${s.session?.access_token || ""}` },
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) avisar(j.erro || "Falhou.", "erro");
    else
      avisar(
        j.enviados ? "Notificação enviada." : "Nenhum aparelho ligado ainda.",
        j.enviados ? "ok" : "aviso",
      );
  }

  return (
    <Painel
      titulo="Avisos"
      sub={
        email
          ? `Preferências de ${email}. Cada um configura no próprio login.`
          : undefined
      }
    >
      {!carregado ? (
        <p className="text-sm text-fraco">Carregando…</p>
      ) : (
        <div className="space-y-5">
          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-suave">
              Eu sou
            </span>
            <Segmentado
              tamanho="sm"
              valor={pessoa}
              aoMudar={setPessoa}
              opcoes={[
                { valor: "Chamone", rotulo: "Chamone" },
                { valor: "Letícia", rotulo: "Letícia" },
              ]}
            />
            <p className="mt-1 text-xs text-fraco">
              Para receber só as suas provas e contas, mais as da conta
              conjunta.
            </p>
          </div>

          <div className="space-y-2">
            <span className="block text-[13px] font-medium text-suave">
              O que avisar
            </span>
            {TIPOS_AVISO.map((t) => (
              <label
                key={t.id}
                className="flex cursor-pointer items-center gap-2.5 text-sm"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#ece6d8]"
                  checked={avisos.includes(t.id)}
                  onChange={(e) =>
                    setAvisos((a) =>
                      e.target.checked
                        ? [...a, t.id]
                        : a.filter((x) => x !== t.id),
                    )
                  }
                />
                {t.nome}
              </label>
            ))}
          </div>

          <div className="rounded-2xl border border-linha-suave bg-campo/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm">
                <Bell className="h-4 w-4 text-fraco" /> Notificação neste
                aparelho
              </span>
              {aparelho === "ativo" ? (
                <div className="flex gap-2">
                  <span className="text-sm text-entrada">Ligada</span>
                  <Botao tamanho="sm" onClick={testar}>
                    Testar
                  </Botao>
                </div>
              ) : aparelho === "inativo" ? (
                <Botao
                  tamanho="sm"
                  variante="primario"
                  onClick={ativarAparelho}
                >
                  Ligar
                </Botao>
              ) : null}
            </div>
            {aparelho === "instalar" && (
              <p className="mt-2 text-xs text-fraco">
                No iPhone, primeiro adicione o app à tela de início (Safari →
                Compartilhar → Adicionar à Tela de Início) e abra por lá.
              </p>
            )}
            {aparelho === "sem-suporte" && (
              <p className="mt-2 text-xs text-fraco">
                Este navegador não aceita notificações.
              </p>
            )}
            {aparelho === "ativo" && (
              <p className="mt-2 text-xs text-fraco">
                Ligue em cada aparelho onde quer receber.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-linha-suave bg-campo/60 p-4">
            <Alternar
              ligado={emailAtivo}
              aoMudar={setEmailAtivo}
              rotulo="Também por e-mail (o resumo do mês sempre vai por e-mail)"
            />
            {emailAtivo && (
              <Entrada
                className="mt-3"
                type="email"
                value={destino}
                onChange={(e) => setDestino(e.target.value)}
                placeholder={email}
              />
            )}
          </div>

          <Botao variante="primario" onClick={() => salvar()}>
            Salvar avisos
          </Botao>
        </div>
      )}
    </Painel>
  );
}
