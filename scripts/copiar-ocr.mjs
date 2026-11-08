// Copia para public/ocr/ os arquivos da leitura de prints (OCR) e de PDFs,
// para o app não depender de CDN de terceiros. Roda antes do build e no npm install.
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const destino = join(process.cwd(), 'public', 'ocr');
mkdirSync(destino, { recursive: true });

const pasta = (pacote) => dirname(require.resolve(`${pacote}/package.json`));
const arquivos = [
  [join(pasta('tesseract.js'), 'dist', 'worker.min.js'), 'worker.min.js'],
  ...['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js'].map((f) => [join(pasta('tesseract.js-core'), f), f]),
  [join(pasta('@tesseract.js-data/por'), '4.0.0_best_int', 'por.traineddata.gz'), 'por.traineddata.gz'],
  [join(pasta('pdfjs-dist'), 'build', 'pdf.min.mjs'), 'pdf.min.mjs'],
  [join(pasta('pdfjs-dist'), 'build', 'pdf.worker.min.mjs'), 'pdf.worker.min.mjs'],
];
for (const [de, nome] of arquivos) {
  if (!existsSync(de)) throw new Error(`Arquivo do OCR não encontrado: ${de}`);
  copyFileSync(de, join(destino, nome));
}
console.log(`OCR: ${arquivos.length} arquivos copiados para public/ocr`);
