// Backup semanal do chachafinance (roda no GitHub Actions).
// Lê todas as tabelas pela API do Supabase com a chave service_role e grava um arquivo
// criptografado com BACKUP_SENHA, no mesmo formato que o app sabe restaurar
// (Contas e categorias → Backup → Restaurar).
import { webcrypto as crypto } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const URL_SB = process.env.SUPABASE_URL;
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SENHA = process.env.BACKUP_SENHA;

if (!URL_SB || !CHAVE || !SENHA) {
  console.log('Backup desligado: cadastre SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e BACKUP_SENHA em Settings → Secrets do repositório.');
  process.exit(0);
}

const TABELAS = [
  'financas', 'disciplinas', 'agenda', 'contas', 'categorias', 'metas', 'acertos', 'faturas_pagas',
  'recorrencias', 'regras', 'importacoes', 'aulas', 'presencas',
];

async function lerTabela(t) {
  const linhas = [];
  for (let de = 0; ; de += 1000) {
    const r = await fetch(`${URL_SB}/rest/v1/${t}?select=*&order=id.asc&offset=${de}&limit=1000`, {
      headers: { apikey: CHAVE, Authorization: `Bearer ${CHAVE}` },
    });
    if (r.status === 404) return null; // tabela ainda não criada
    if (!r.ok) throw new Error(`${t}: ${r.status} ${await r.text()}`);
    const pagina = await r.json();
    linhas.push(...pagina);
    if (pagina.length < 1000) return linhas;
  }
}

const tabelas = {};
for (const t of TABELAS) {
  const linhas = await lerTabela(t);
  if (linhas) {
    tabelas[t] = linhas;
    console.log(`${t}: ${linhas.length} linhas`);
  }
}
if (!tabelas.financas) throw new Error('A tabela financas não foi lida; confira a URL e a chave.');

const texto = JSON.stringify({ app: 'chachafinance', versao: 1, criado_em: new Date().toISOString(), tabelas });
const b64 = (b) => Buffer.from(b).toString('base64');
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(SENHA), 'PBKDF2', false, ['deriveKey']);
const chave = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
const dados = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chave, new TextEncoder().encode(texto));

const nome = `chachafinance-backup-${new Date().toISOString().slice(0, 10)}.json`;
writeFileSync(nome, JSON.stringify({ formato: 'chachafinance-cripto-v1', salt: b64(salt), iv: b64(iv), dados: b64(dados) }));
console.log(`Gravado ${nome}`);
