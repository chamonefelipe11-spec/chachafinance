export type TipoAviso = 'ok' | 'erro' | 'aviso';
export interface Aviso {
  id: number;
  texto: string;
  tipo: TipoAviso;
}

type Ouvinte = (a: Aviso) => void;
const ouvintes = new Set<Ouvinte>();
let seq = 0;

export function avisar(texto: string, tipo: TipoAviso = 'ok') {
  const a = { id: ++seq, texto, tipo };
  ouvintes.forEach((o) => o(a));
}

export function ouvirAvisos(o: Ouvinte) {
  ouvintes.add(o);
  return () => {
    ouvintes.delete(o);
  };
}
