"use client";

import { supabase } from "./supabase";
import { lerTudo, TABELAS_NOVAS } from "./store";

/** Ordem de restauração: tabelas de cadastro antes das que apontam para elas. */
export const TABELAS_BACKUP = [
  "financas",
  "disciplinas",
  "agenda",
  ...TABELAS_NOVAS,
] as const;
const ORDEM_RESTAURAR = [
  "contas",
  "categorias",
  "recorrencias",
  "regras",
  "importacoes",
  "financas",
  "metas",
  "acertos",
  "faturas_pagas",
  "disciplinas",
  "aulas",
  "presencas",
  "agenda",
];

export interface Backup {
  app: "chachafinance";
  versao: 1;
  criado_em: string;
  tabelas: Record<string, Record<string, unknown>[]>;
}

export interface BackupCifrado {
  formato: "chachafinance-cripto-v1";
  salt: string;
  iv: string;
  dados: string;
}

export async function gerarBackup(): Promise<Backup> {
  const tabelas: Backup["tabelas"] = {};
  for (const t of TABELAS_BACKUP) {
    const { data, error } = await lerTudo<Record<string, unknown>>(t);
    if (!error) tabelas[t] = data;
  }
  return {
    app: "chachafinance",
    versao: 1,
    criado_em: new Date().toISOString(),
    tabelas,
  };
}

export function baixarArquivo(
  nome: string,
  conteudo: string,
  tipo = "application/json",
) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- Criptografia (mesmo formato do backup semanal do GitHub) ----------

const b64 = (b: ArrayBuffer | Uint8Array) =>
  btoa(
    String.fromCharCode(
      ...new Uint8Array(b instanceof Uint8Array ? b : new Uint8Array(b)),
    ),
  );
const deB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function chave(senha: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(senha),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: 210_000,
      hash: "SHA-256",
    },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function cifrar(
  texto: string,
  senha: string,
): Promise<BackupCifrado> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const dados = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await chave(senha, salt),
    new TextEncoder().encode(texto),
  );
  return {
    formato: "chachafinance-cripto-v1",
    salt: b64(salt),
    iv: b64(iv),
    dados: b64(dados),
  };
}

export async function decifrar(
  c: BackupCifrado,
  senha: string,
): Promise<string> {
  const dados = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: deB64(c.iv) as BufferSource },
    await chave(senha, deB64(c.salt)),
    deB64(c.dados) as BufferSource,
  );
  return new TextDecoder().decode(dados);
}

export const ehCifrado = (x: unknown): x is BackupCifrado =>
  !!x && (x as BackupCifrado).formato === "chachafinance-cripto-v1";
export const ehBackup = (x: unknown): x is Backup =>
  !!x &&
  (x as Backup).app === "chachafinance" &&
  typeof (x as Backup).tabelas === "object";

/**
 * Restaura gravando por cima pelo id (upsert): o que foi apagado volta, o que mudou volta a ser
 * como estava. Não apaga nada que exista hoje e não esteja no backup.
 */
export async function restaurar(
  b: Backup,
  progresso?: (t: string) => void,
): Promise<{ tabela: string; linhas: number; erro?: string }[]> {
  const resultado: { tabela: string; linhas: number; erro?: string }[] = [];
  const nomes = [
    ...ORDEM_RESTAURAR,
    ...Object.keys(b.tabelas).filter((t) => !ORDEM_RESTAURAR.includes(t)),
  ];
  for (const t of nomes) {
    const linhas = b.tabelas[t];
    if (!linhas?.length) continue;
    progresso?.(t);
    let erro: string | undefined;
    for (let i = 0; i < linhas.length; i += 500) {
      const { error } = await supabase
        .from(t)
        .upsert(linhas.slice(i, i + 500), { onConflict: "id" });
      if (error) {
        erro = error.message;
        break;
      }
    }
    resultado.push({ tabela: t, linhas: linhas.length, erro });
  }
  return resultado;
}
