import { Injectable, OnModuleDestroy } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { GenerarPdfDto } from './dto/generar-pdf.dto';

const BUFFER_CORTE_PX = 4;

const SELECTOR_EVITAR_CORTE = 'li, h1, h2, h3, h4, h5, h6';

const MAX_ITERACIONES_ESPACIADORES = 8;

const ESTILOS_DOCUMENTO = `
  html, body {
    margin: 0;
    padding: 0;
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
    font-size: 16px;
    line-height: 1.55;
    color: #0f172a;
  }

  /* Reset estilo por defecto de headings (equivalente a Tailwind preflight):
     en el frontend se ven como texto normal, y el PDF debe ser fiel a eso. */
  .renderizador-contenido h1,
  .renderizador-contenido h2,
  .renderizador-contenido h3,
  .renderizador-contenido h4,
  .renderizador-contenido h5,
  .renderizador-contenido h6 {
    font-size: inherit;
    font-weight: inherit;
  }

  .renderizador-contenido {
    line-height: 1.55;
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: anywhere;
    width: 100%;
    box-sizing: border-box;
    padding-right: 1px;
  }

  .renderizador-contenido p {
    margin: 0.5em 0;
    min-height: 1em;
  }

  .renderizador-contenido h1,
  .renderizador-contenido h2,
  .renderizador-contenido h3 {
    line-height: 1.3;
    margin: 0.6em 0 0.35em;
  }

  .renderizador-contenido ul,
  .renderizador-contenido ol {
    padding-left: 1.5rem;
    margin: 0.5rem 0;
    list-style-position: outside;
    color: currentColor;
  }

  .renderizador-contenido ul { list-style-type: disc; display: block; }
  .renderizador-contenido ol { list-style-type: decimal; display: block; }

  .renderizador-contenido ul li,
  .renderizador-contenido ol li {
    margin: 0.25rem 0;
    display: list-item;
    color: currentColor;
  }

  .renderizador-contenido ul li::marker,
  .renderizador-contenido ol li::marker {
    color: currentColor;
  }

  .renderizador-contenido ul[style*="text-align: center"],
  .renderizador-contenido ol[style*="text-align: center"],
  .renderizador-contenido ul[style*="text-align:center"],
  .renderizador-contenido ol[style*="text-align:center"] {
    display: table;
    text-align: left;
    list-style-position: outside;
    padding-left: 1.5rem;
    margin-left: auto;
    margin-right: auto;
  }

  .renderizador-contenido ul[style*="text-align: right"],
  .renderizador-contenido ol[style*="text-align: right"],
  .renderizador-contenido ul[style*="text-align:right"],
  .renderizador-contenido ol[style*="text-align:right"] {
    display: table;
    text-align: left;
    list-style-position: outside;
    padding-left: 1.5rem;
    margin-left: auto;
    margin-right: 0;
  }

  .renderizador-contenido table {
    width: 100%;
    border-collapse: collapse;
    margin: 0.5rem 0;
  }

  .renderizador-contenido table td,
  .renderizador-contenido table th {
    border: 1px solid #cbd5e1;
    padding: 2px 4px;
    vertical-align: top;
    word-break: break-word;
  }
`;

@Injectable()
export class PdfServicio implements OnModuleDestroy {
  private browser: puppeteer.Browser | null = null;
  private browserLaunching: Promise<puppeteer.Browser> | null = null;

  private mmToPx(mm: number): number {
    return Math.round((mm / 25.4) * 96);
  }

  private async getBrowser(): Promise<puppeteer.Browser> {
    if (this.browser && this.browser.isConnected()) return this.browser;
    if (this.browserLaunching) return await this.browserLaunching;

    this.browserLaunching = puppeteer
      .launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      })
      .then((b) => {
        this.browser = b;
        return b;
      })
      .finally(() => {
        this.browserLaunching = null;
      });

    return await this.browserLaunching;
  }

  async onModuleDestroy() {
    try {
      if (this.browser) await this.browser.close();
    } finally {
      this.browser = null;
      this.browserLaunching = null;
    }
  }

  async generarPdfBufferDesdeHtml(dto: GenerarPdfDto): Promise<Buffer> {
    const { contenido_html, config } = dto;
    const { widthMm, heightMm, margenes } = config;

    const pageWidthPx = this.mmToPx(widthMm);
    const pageHeightPx = this.mmToPx(heightMm);
    const paddingLeft = this.mmToPx(margenes.left);
    const paddingRight = this.mmToPx(margenes.right);
    const paddingTop = this.mmToPx(margenes.top);
    const paddingBottom = this.mmToPx(margenes.bottom);
    const contentAreaWidth = Math.max(1, pageWidthPx - paddingLeft - paddingRight);
    const contentAreaHeight = Math.max(1, pageHeightPx - paddingTop - paddingBottom);
    // El viewport real (para medir/cortar) debe ser el mismo “paso” entre páginas para no solapar.
    const contentAreaHeightEfectiva = Math.max(1, contentAreaHeight - BUFFER_CORTE_PX);

    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: pageWidthPx, height: pageHeightPx, deviceScaleFactor: 1 });
      page.setDefaultNavigationTimeout(15000);

      const htmlBase = `<!doctype html><html><head><meta charset="utf-8" /><style>
        ${ESTILOS_DOCUMENTO}
        @page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }
        body { margin: 0; padding: 0; }
        .pdf-page {
          width: ${pageWidthPx}px;
          height: ${pageHeightPx}px;
          box-sizing: border-box;
          break-inside: avoid;
        }
        .pdf-page-inner {
          width: 100%;
          height: 100%;
          box-sizing: border-box;
          padding: ${paddingTop}px ${paddingRight}px ${paddingBottom}px ${paddingLeft}px;
        }
        .pdf-viewport {
          width: ${contentAreaWidth}px;
          height: ${contentAreaHeightEfectiva}px;
          overflow: hidden;
        }
      </style></head><body>
        <div id="__measurer" class="renderizador-contenido" style="width:${contentAreaWidth}px; box-sizing:border-box;">${contenido_html}</div>
        <div id="__pages"></div>
      </body></html>`;

      await page.setContent(htmlBase, { waitUntil: 'domcontentloaded', timeout: 15000 });

      await page.evaluate((params) => {
        const {
          contentAreaWidth,
          contentAreaHeight,
          contentAreaHeightEfectiva,
          pageWidthPx,
          pageHeightPx,
          paddingTop,
          paddingRight,
          paddingBottom,
          paddingLeft,
          selectorEvitarCorte,
          maxIteraciones,
        } = params;

        const container = document.getElementById('__measurer') as HTMLDivElement | null;
        const pagesRoot = document.getElementById('__pages') as HTMLDivElement | null;
        if (!container || !pagesRoot) return;

        // 1) Remover espaciadores previos (si existieran).
        container.querySelectorAll('[data-page-spacer="1"]').forEach((n) => n.remove());

        // 2) Insertar espaciadores para empujar bloques que no caben (listas/encabezados).
        //    Esto evita que un <li> quede "partido" y se perciba como repetido.
        const insertarEspaciadores = () => {
          let iter = 0;
          while (iter < maxIteraciones) {
            let changed = false;
            const elementos = Array.from(container.querySelectorAll(selectorEvitarCorte)) as HTMLElement[];
            const containerRect = container.getBoundingClientRect();

            for (const el of elementos) {
              const rect = el.getBoundingClientRect();
              const top = rect.top - containerRect.top;
              const bottom = rect.bottom - containerRect.top;
              const height = rect.height;

              const pageIndex = Math.floor(top / contentAreaHeightEfectiva);
              const pageEnd = (pageIndex + 1) * contentAreaHeightEfectiva;

              if (bottom > pageEnd && height <= contentAreaHeightEfectiva) {
                const spacerHeight = pageEnd - top;
                if (spacerHeight > 0.5) {
                  const spacer = document.createElement('div');
                  spacer.setAttribute('data-page-spacer', '1');
                  spacer.style.display = 'block';
                  spacer.style.width = '100%';
                  spacer.style.height = `${Math.ceil(spacerHeight)}px`;
                  (el.parentElement ?? container).insertBefore(spacer, el);
                  changed = true;
                  break; // Recalcular layout y reintentar.
                }
              }
            }

            if (!changed) break;
            iter++;
          }
        };

        insertarEspaciadores();

        const contenido = container.innerHTML;

        // 3) Paginación sin solape: cada página es un "ventana" de alto fijo (viewport efectivo).
        const totalHeight = container.scrollHeight;
        const paso = Math.max(1, contentAreaHeightEfectiva);
        const numPages = Math.max(1, Math.ceil(totalHeight / paso));
        const nextBreaks: number[] = [];
        for (let i = 0; i < numPages; i++) nextBreaks.push(i * paso);

        pagesRoot.innerHTML = '';
        const frag = document.createDocumentFragment();

        nextBreaks.forEach((top, idx) => {
          const breakAfter = idx === nextBreaks.length - 1 ? 'auto' : 'page';

          const pageEl = document.createElement('div');
          pageEl.className = 'pdf-page';
          pageEl.style.breakAfter = breakAfter;
          pageEl.style.width = `${pageWidthPx}px`;
          pageEl.style.height = `${pageHeightPx}px`;

          const inner = document.createElement('div');
          inner.className = 'pdf-page-inner';
          inner.style.paddingTop = `${paddingTop}px`;
          inner.style.paddingRight = `${paddingRight}px`;
          inner.style.paddingBottom = `${paddingBottom}px`;
          inner.style.paddingLeft = `${paddingLeft}px`;

          const viewport = document.createElement('div');
          viewport.className = 'pdf-viewport';
          viewport.style.width = `${contentAreaWidth}px`;
          viewport.style.height = `${contentAreaHeightEfectiva}px`;
          viewport.style.overflow = 'hidden';

          const content = document.createElement('div');
          content.className = 'renderizador-contenido';
          content.style.width = `${contentAreaWidth}px`;
          content.style.transform = `translateY(-${Math.max(0, top)}px)`;
          content.innerHTML = contenido;

          viewport.appendChild(content);
          inner.appendChild(viewport);
          pageEl.appendChild(inner);
          frag.appendChild(pageEl);
        });

        pagesRoot.appendChild(frag);
        container.remove();
      }, {
        contentAreaWidth,
        contentAreaHeight,
        contentAreaHeightEfectiva,
        pageWidthPx,
        pageHeightPx,
        paddingTop,
        paddingRight,
        paddingBottom,
        paddingLeft,
        selectorEvitarCorte: SELECTOR_EVITAR_CORTE,
        maxIteraciones: MAX_ITERACIONES_ESPACIADORES,
      });

      const pdf = await page.pdf({
        printBackground: true,
        width: `${widthMm}mm`,
        height: `${heightMm}mm`,
        margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
        preferCSSPageSize: true,
      });

      return Buffer.from(pdf);
    } finally {
      await page.close();
    }
  }
}
