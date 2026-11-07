'use client';

import { useEffect, useRef, useState, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes } from 'react';
import { ChevronLeft, ChevronRight, X, Check, AlertTriangle, Info } from 'lucide-react';
import { clsx } from 'clsx';
import { ouvirAvisos, type Aviso } from '@/lib/toast';
import { dinheiro, mesAtual, rotuloMes, somarMeses, cap } from '@/lib/format';
import { COR_PESSOA } from '@/lib/defaults';
import type { Quem } from '@/lib/types';

export const cx = clsx;

// ---------------- Estrutura ----------------

export function Painel({
  titulo,
  sub,
  acao,
  children,
  className,
  corpo = true,
}: {
  titulo?: ReactNode;
  sub?: ReactNode;
  acao?: ReactNode;
  children: ReactNode;
  className?: string;
  corpo?: boolean;
}) {
  return (
    <section className={cx('min-w-0 rounded-2xl border border-linha-suave bg-painel', className)}>
      {(titulo || acao) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-1">
          <div className="min-w-0">
            {titulo && <h3 className="text-[15px] font-semibold text-texto">{titulo}</h3>}
            {sub && <p className="mt-0.5 text-[13px] text-suave">{sub}</p>}
          </div>
          {acao && <div className="shrink-0">{acao}</div>}
        </header>
      )}
      {corpo ? <div className="px-5 pt-3 pb-5">{children}</div> : children}
    </section>
  );
}

export function Cabecalho({ titulo, sub, acoes }: { titulo: ReactNode; sub?: ReactNode; acoes?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="display text-[28px] leading-tight font-semibold text-texto md:text-[34px]">{titulo}</h1>
        {sub && <p className="mt-1 text-sm text-suave">{sub}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  );
}

// ---------------- Botões ----------------

type VarianteBotao = 'primario' | 'secundario' | 'fantasma' | 'perigo';

export function Botao({
  variante = 'secundario',
  tamanho = 'md',
  icone,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: VarianteBotao; tamanho?: 'sm' | 'md' | 'lg'; icone?: ReactNode }) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        'inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        tamanho === 'sm' && 'h-8 px-3 text-[13px]',
        tamanho === 'md' && 'h-10 px-4 text-sm',
        tamanho === 'lg' && 'h-12 px-5 text-[15px]',
        variante === 'primario' && 'bg-papel text-[#1a1b20] hover:bg-white',
        variante === 'secundario' && 'border border-linha bg-elevado text-texto hover:border-[#3a404d] hover:bg-[#2a2e39]',
        variante === 'fantasma' && 'text-suave hover:bg-elevado hover:text-texto',
        variante === 'perigo' && 'border border-saida/30 bg-saida/10 text-saida hover:bg-saida/20',
        className,
      )}
    >
      {icone}
      {children}
    </button>
  );
}

export function BotaoIcone({ rotulo, className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { rotulo: string }) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={rotulo}
      {...props}
      className={cx('inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-suave transition-colors hover:bg-elevado hover:text-texto', className)}
    >
      {children}
    </button>
  );
}

// ---------------- Formulários ----------------

export function Campo({ rotulo, dica, children, className }: { rotulo: string; dica?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-suave">{rotulo}</span>
      {children}
      {dica && <span className="mt-1 block text-xs text-fraco">{dica}</span>}
    </label>
  );
}

const estiloCampo =
  'w-full rounded-xl border border-linha bg-campo px-3.5 text-[15px] text-texto placeholder:text-fraco transition-colors focus:border-[#4a5263] focus:outline-none';

export function Entrada({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(estiloCampo, 'h-11', className)} />;
}

export function Seletor({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cx(estiloCampo, 'h-11 cursor-pointer appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9', className)} style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236f7685' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")` }}>
      {children}
    </select>
  );
}

export function Segmentado<T extends string>({
  valor,
  opcoes,
  aoMudar,
  className,
  tamanho = 'md',
}: {
  valor: T;
  opcoes: { valor: T; rotulo: ReactNode; cor?: string }[];
  aoMudar: (v: T) => void;
  className?: string;
  tamanho?: 'sm' | 'md';
}) {
  return (
    <div role="radiogroup" className={cx('flex rounded-xl border border-linha bg-campo p-1', className)}>
      {opcoes.map((o) => {
        const ativo = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={ativo}
            onClick={() => aoMudar(o.valor)}
            className={cx(
              'flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-colors',
              tamanho === 'sm' ? 'h-7 px-2.5 text-[13px]' : 'h-9 px-3 text-sm',
              ativo ? 'bg-elevado text-texto shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]' : 'text-fraco hover:text-suave',
            )}
            style={ativo && o.cor ? { color: o.cor } : undefined}
          >
            {o.rotulo}
          </button>
        );
      })}
    </div>
  );
}

export function Chip({ ativo, cor, children, onClick, className }: { ativo?: boolean; cor?: string; children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cx(
        'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[13px] whitespace-nowrap transition-colors',
        ativo ? 'border-transparent text-texto' : 'border-linha text-suave hover:border-[#3a404d] hover:text-texto',
        className,
      )}
      style={ativo ? { backgroundColor: `${cor || '#ece6d8'}26`, boxShadow: `inset 0 0 0 1px ${cor || '#ece6d8'}66` } : undefined}
    >
      {cor && <Ponto cor={cor} />}
      {children}
    </button>
  );
}

export function Alternar({ ligado, aoMudar, rotulo }: { ligado: boolean; aoMudar: (v: boolean) => void; rotulo: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={ligado} onClick={() => aoMudar(!ligado)} className="flex w-full cursor-pointer items-center justify-between gap-3 text-left text-sm text-texto">
      <span>{rotulo}</span>
      <span className={cx('relative h-6 w-10 shrink-0 rounded-full transition-colors', ligado ? 'bg-papel' : 'bg-linha')}>
        <span className={cx('absolute top-0.5 h-5 w-5 rounded-full transition-all', ligado ? 'left-[18px] bg-[#1a1b20]' : 'left-0.5 bg-suave')} />
      </span>
    </button>
  );
}

// ---------------- Dados ----------------

export const Ponto = ({ cor, tamanho = 8 }: { cor: string; tamanho?: number }) => (
  <span className="inline-block shrink-0 rounded-full" style={{ backgroundColor: cor, width: tamanho, height: tamanho }} />
);

export function Avatar({ quem, tamanho = 24 }: { quem: Quem; tamanho?: number }) {
  const cor = COR_PESSOA[quem] || '#8F96A3';
  const letra = quem === 'Ambos' ? 'CL' : quem[0];
  return (
    <span
      title={quem}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{ width: tamanho, height: tamanho, fontSize: quem === 'Ambos' ? tamanho * 0.36 : tamanho * 0.45, backgroundColor: `${cor}24`, color: cor }}
    >
      {letra}
    </span>
  );
}

export function Valor({ v, tipo, className, sinal = true }: { v: number; tipo?: 'receita' | 'despesa' | 'neutro'; className?: string; sinal?: boolean }) {
  const cor = tipo === 'receita' ? 'text-entrada' : tipo === 'despesa' ? 'text-texto' : '';
  const pre = !sinal || !tipo || tipo === 'neutro' ? '' : tipo === 'receita' ? '+ ' : '− ';
  return (
    <span className={cx('num whitespace-nowrap', cor, className)}>
      {pre}
      {dinheiro(Math.abs(v))}
    </span>
  );
}

export function Barra({ valor, max, cor, altura = 8, marca }: { valor: number; max: number; cor: string; altura?: number; marca?: number }) {
  const pct = max > 0 ? Math.min(valor / max, 1) * 100 : 0;
  const estourou = max > 0 && valor > max;
  return (
    <div className="relative w-full overflow-hidden rounded-full bg-linha-suave" style={{ height: altura }}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, backgroundColor: estourou ? '#f08a7e' : cor }} />
      {marca !== undefined && max > 0 && marca < max && (
        <div className="absolute top-0 h-full w-px bg-texto/50" style={{ left: `${(marca / max) * 100}%` }} title="Onde deveria estar hoje" />
      )}
    </div>
  );
}

/** Barra dividida em várias cores (ex.: quanto cada pessoa gastou) */
export function BarraDividida({ partes, altura = 10 }: { partes: { valor: number; cor: string; rotulo?: string }[]; altura?: number }) {
  const total = partes.reduce((a, p) => a + p.valor, 0);
  return (
    <div className="flex w-full gap-[3px] overflow-hidden rounded-full" style={{ height: altura }}>
      {total === 0 ? (
        <div className="h-full w-full bg-linha-suave" />
      ) : (
        partes
          .filter((p) => p.valor > 0)
          .map((p, i) => <div key={i} title={p.rotulo} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(p.valor / total) * 100}%`, backgroundColor: p.cor }} />)
      )}
    </div>
  );
}

export function Vazio({ titulo, texto, acao }: { titulo: string; texto?: string; acao?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <p className="text-[15px] font-medium text-texto">{titulo}</p>
      {texto && <p className="mt-1 max-w-sm text-sm text-suave">{texto}</p>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  );
}

export function MesNavegador({ mes, aoMudar }: { mes: string; aoMudar: (m: string) => void }) {
  const atual = mesAtual();
  return (
    <div className="flex items-center gap-1">
      <BotaoIcone rotulo="Mês anterior" onClick={() => aoMudar(somarMeses(mes, -1))}>
        <ChevronLeft className="h-5 w-5" />
      </BotaoIcone>
      <button type="button" onClick={() => aoMudar(atual)} title="Voltar para o mês atual" className="min-w-[132px] cursor-pointer rounded-lg px-2 py-1 text-center text-[15px] font-medium text-texto hover:bg-elevado">
        {cap(rotuloMes(mes))}
      </button>
      <BotaoIcone rotulo="Próximo mês" onClick={() => aoMudar(somarMeses(mes, 1))}>
        <ChevronRight className="h-5 w-5" />
      </BotaoIcone>
    </div>
  );
}

// ---------------- Folha / modal ----------------

export function Folha({ aberta, aoFechar, titulo, children, rodape, largura = 'md' }: { aberta: boolean; aoFechar: () => void; titulo: ReactNode; children: ReactNode; rodape?: ReactNode; largura?: 'md' | 'lg' }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberta) return;
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    document.addEventListener('keydown', tecla);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', tecla);
      document.body.style.overflow = overflow;
    };
  }, [aberta, aoFechar]);
  if (!aberta) return null;
  return (
    <div className="anim-fundo fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-[2px] md:items-center md:p-6" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        className={cx(
          'anim-folha flex max-h-[92dvh] w-full flex-col rounded-t-3xl border border-linha bg-painel shadow-2xl md:rounded-3xl',
          largura === 'md' ? 'md:max-w-lg' : 'md:max-w-2xl',
        )}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-linha md:hidden" />
        <header className="flex items-center justify-between gap-3 px-5 pt-3 pb-2 md:px-6 md:pt-5">
          <h2 className="display text-xl font-semibold text-texto">{titulo}</h2>
          <BotaoIcone rotulo="Fechar" onClick={aoFechar}>
            <X className="h-5 w-5" />
          </BotaoIcone>
        </header>
        <div className="flex-1 overflow-y-auto px-5 pt-2 pb-5 md:px-6">{children}</div>
        {rodape && <footer className="pb-seguro border-t border-linha-suave px-5 py-4 md:px-6">{rodape}</footer>}
      </div>
    </div>
  );
}

// ---------------- Avisos (toasts) ----------------

export function Avisos() {
  const [lista, setLista] = useState<Aviso[]>([]);
  useEffect(
    () =>
      ouvirAvisos((a) => {
        setLista((l) => [...l, a]);
        setTimeout(() => setLista((l) => l.filter((x) => x.id !== a.id)), a.tipo === 'erro' ? 7000 : 3500);
      }),
    [],
  );
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[200] flex flex-col items-center gap-2 px-4" aria-live="polite">
      {lista.map((a) => (
        <div key={a.id} className="anim-folha pointer-events-auto flex max-w-md items-start gap-2.5 rounded-xl border border-linha bg-elevado px-4 py-3 text-sm text-texto shadow-xl">
          {a.tipo === 'ok' && <Check className="mt-0.5 h-4 w-4 shrink-0 text-entrada" />}
          {a.tipo === 'erro' && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-saida" />}
          {a.tipo === 'aviso' && <Info className="mt-0.5 h-4 w-4 shrink-0 text-alerta" />}
          <span>{a.texto}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------- Confirmação ----------------

interface PedidoConfirmacao {
  titulo: string;
  texto?: string;
  acao: string;
  resolver: (ok: boolean) => void;
}
let abrirConfirmacao: ((p: PedidoConfirmacao) => void) | null = null;

export function confirmar(titulo: string, opcoes: { texto?: string; acao?: string } = {}): Promise<boolean> {
  return new Promise((resolver) => {
    if (!abrirConfirmacao) return resolver(window.confirm(titulo));
    abrirConfirmacao({ titulo, texto: opcoes.texto, acao: opcoes.acao || 'Apagar', resolver });
  });
}

export function Confirmacoes() {
  const [pedido, setPedido] = useState<PedidoConfirmacao | null>(null);
  useEffect(() => {
    abrirConfirmacao = setPedido;
    return () => {
      abrirConfirmacao = null;
    };
  }, []);
  const fechar = (ok: boolean) => {
    pedido?.resolver(ok);
    setPedido(null);
  };
  return (
    <Folha
      aberta={!!pedido}
      aoFechar={() => fechar(false)}
      titulo={pedido?.titulo || ''}
      rodape={
        <div className="flex gap-2">
          <Botao className="flex-1" onClick={() => fechar(false)}>
            Cancelar
          </Botao>
          <Botao variante="perigo" className="flex-1" onClick={() => fechar(true)} autoFocus>
            {pedido?.acao}
          </Botao>
        </div>
      }
    >
      {pedido?.texto ? <p className="text-sm text-suave">{pedido.texto}</p> : <span />}
    </Folha>
  );
}
