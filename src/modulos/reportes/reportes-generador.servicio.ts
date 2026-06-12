import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { GeminiServicio } from '@/modulos/gemini/gemini.servicio';
import { ReporteEntidad } from './entidades/reporte.entidad';
import { Usuario } from '@/modulos/usuario/entidades/usuario.entidad';
import { PrestamoEntidad } from '@/modulos/prestamo/entidades/prestamo.entidad';
import { ItemActivoFijo } from '@/modulos/activo/entidades/item-activo-fijo.entidad';
import { ActivoFungible } from '@/modulos/activo/entidades/activo-fungible.entidad';
import { ItemActivoFungible } from '@/modulos/activo/entidades/item-activo-fungible.entidad';
import { GenerarPreReporteDto } from './dto/generar-pre-reporte.dto';

@Injectable()
export class ReportesGeneradorServicio {
  constructor(
    @InjectRepository(ReporteEntidad) private readonly repoReporte: Repository<ReporteEntidad>,
    @InjectRepository(Usuario) private readonly repoUsuario: Repository<Usuario>,
    @InjectRepository(PrestamoEntidad) private readonly repoPrestamo: Repository<PrestamoEntidad>,
    @InjectRepository(ItemActivoFijo) private readonly repoItemActivo: Repository<ItemActivoFijo>,
    @InjectRepository(ActivoFungible) private readonly repoActivoFungible: Repository<ActivoFungible>,
    @InjectRepository(ItemActivoFungible) private readonly repoItemActivoFungible: Repository<ItemActivoFungible>,
    private readonly gemini: GeminiServicio,
  ) {}

  isoHoy() {
    return new Date().toISOString().slice(0, 10);
  }

  fechaHoraLocalLegible(d: Date = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${hh}:${mm}`;
  }

  fechaHoraLocalParaArchivo(d: Date = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${day}_${hh}-${mm}-${ss}`;
  }

  siglasAreas(areas?: string[]) {
    const lista = Array.isArray(areas) ? areas : [];
    const cleaned = lista
      .map((a) => String(a || '').trim().toLowerCase())
      .filter(Boolean);
    const set = new Set<string>(cleaned);
    if (set.size === 0) return '';

    const mapSigla = (area: string) => {
      if (area.startsWith('mov')) return 'V';
      if (area.startsWith('mat')) return 'M';
      if (area.startsWith('pre')) return 'P';
      if (area.startsWith('act')) return 'A';
      if (area.startsWith('con')) return 'C';
      if (area.startsWith('usu')) return 'U';
      return area[0]?.toUpperCase() ?? '';
    };

    const siglas = Array.from(set)
      .map(mapSigla)
      .filter(Boolean)
      .join('');

    return siglas;
  }

  isoYmdLocal(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  limitesMesActualIso() {
    const now = new Date();
    const inicio = new Date(now.getFullYear(), now.getMonth(), 1);
    const fin = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { inicio: this.isoYmdLocal(inicio), fin: this.isoYmdLocal(fin) };
  }

  construirTituloConSufijo(tituloBase: string, areas?: string[]) {
    const base = (tituloBase ?? '').trim();
    const fechaHora = this.fechaHoraLocalLegible();
    const siglas = this.siglasAreas(areas);

    const titulo = base ? `${base} - ${fechaHora}` : `Reporte - ${fechaHora}`;
    return siglas ? `${titulo} - ${siglas}` : titulo;
  }

  normalizarAreas(areas?: string[]) {
    const lista = Array.isArray(areas) ? areas : [];
    const cleaned = lista
      .map(a => String(a || '').trim().toLowerCase())
      .filter(Boolean);
    const set = new Set<string>(cleaned);
    set.add('prestamos');
    return Array.from(set);
  }

  async generarPreReporte(usuarioId: number, dto: GenerarPreReporteDto) {
    const inicio = new Date(dto.fechaInicio);
    const fin = new Date(dto.fechaFin);
    fin.setHours(23, 59, 59, 999);

    const [prestamos, activos, lotes] = await Promise.all([
      this.repoPrestamo.find({ where: { fechaPrestamo: Between(inicio, fin) } as any, relations: [] }),
      this.repoItemActivo.count(),
      this.repoItemActivoFungible.count(),
    ]);
    const movimientos: any[] = [];

    const prompt = this.buildPrompt({
      inicio: dto.fechaInicio,
      fin: dto.fechaFin,
      instrucciones: dto.instrucciones,
      stats: {
        prestamosEnPeriodo: prestamos.length,
        totalItemsActivos: activos,
        totalLotesMaterial: lotes,
        movimientosEnPeriodo: movimientos.length,
      },
    });

    const texto = await this.gemini.generarTexto(usuarioId, prompt);
    const html = this.toHtml(texto);
    const siglas = this.siglasAreas(['prestamos', 'activos', 'materiales', 'movimientos']);
    const titulo = `Reporte IA (${dto.fechaInicio} a ${dto.fechaFin}) - ${this.fechaHoraLocalLegible()}${siglas ? ` - ${siglas}` : ''}`;

    const usuario = await this.repoUsuario.findOne({ where: { id: usuarioId } });
    const entidad = this.repoReporte.create({
      usuario: usuario!,
      titulo,
      html,
      fechaInicio: dto.fechaInicio,
      fechaFin: dto.fechaFin,
      metadata: { tipo: 'precreado', areas: ['prestamos', 'activos', 'materiales', 'movimientos'], usarIA: true },
    });
    const guardado = await this.repoReporte.save(entidad);
    return { id: guardado.id, titulo: guardado.titulo, html: guardado.html, fechaInicio: guardado.fechaInicio, fechaFin: guardado.fechaFin, metadata: guardado.metadata ?? null, creadoEn: guardado.creadoEn };
  }

  async obtenerDatosPreCreado(usuarioId: number, input: { fechaInicio?: string; fechaFin?: string; areas?: string[] }) {
    const lim = this.limitesMesActualIso();
    const fechaInicio = input.fechaInicio ?? lim.inicio;
    const fechaFin = input.fechaFin ?? lim.fin;

    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    fin.setHours(23, 59, 59, 999);

    const areas = this.normalizarAreas(input.areas);
    const data = await this.construirDatosPreCreado({ inicio, fin, areas });
    return {
      fechaInicio,
      fechaFin,
      areas,
      data,
    };
  }

  async construirDatosPreCreado(input: { inicio: Date; fin: Date; areas: string[] }) {
    const incluir = (area: string) => input.areas.includes(area);
    const data: any = { areas: input.areas };
    const prestamos = await this.repoPrestamo.find({
      where: { fechaPrestamo: Between(input.inicio, input.fin) } as any,
      order: { fechaPrestamo: 'ASC' } as any,
      relations: ['estudiante', 'docente', 'itemActivo', 'itemActivo.activo'],
    });
    const porEstado: Record<string, number> = {};
    for (const p of prestamos) porEstado[p.estado] = (porEstado[p.estado] ?? 0) + 1;
    data.prestamos = {
      total: prestamos.length,
      porEstado,
      listado: prestamos.map(p => ({
        id: p.id,
        codigoHerramienta: p.codigoHerramienta,
        grupoCanasta: (p as any).grupoCanasta ?? null,
        fechaPrestamo: p.fechaPrestamo,
        fechaDevolucion: p.fechaDevolucion ?? null,
        estado: p.estado,
        observaciones: (p as any).observaciones ?? null,
        estudiante: p.estudiante ? {
          carnet: p.estudiante.carnet,
          nombre: p.estudiante.nombre,
          apellido: p.estudiante.apellido,
          carrera: p.estudiante.carrera,
          carnetRetenido: p.estudiante.carnetRetenido,
        } : null,
        docente: p.docente ? {
          codigo: (p.docente as any).codigo ?? null,
          nombre: (p.docente as any).nombre ?? null,
          apellido: (p.docente as any).apellido ?? '',
          carnet: (p.docente as any).ci ?? null,
          materia: (p.docente as any).materia ?? null,
        } : null,
        itemActivo: p.itemActivo ? {
          codigoInventario: (p.itemActivo as any).codigo_inventario,
          activoNombre: (p.itemActivo as any).activo?.nombre ?? null,
          estado: p.itemActivo.estado,
          estadoFisico: (p.itemActivo as any).estado_fisico,
          ubicacion: p.itemActivo.ubicacion ?? null,
        } : null,
      })),
    };

    if (incluir('activos')) {
      const items = await this.repoItemActivo.find({
        relations: ['activo'],
        order: { codigo_inventario: 'ASC' } as any,
      });
      const porEstadoActivos: Record<string, number> = {};
      const porEstadoFisico: Record<string, number> = {};
      for (const i of items) {
        porEstadoActivos[i.estado] = (porEstadoActivos[i.estado] ?? 0) + 1;
        porEstadoFisico[(i as any).estado_fisico] = (porEstadoFisico[(i as any).estado_fisico] ?? 0) + 1;
      }
      data.activos = {
        total: items.length,
        porEstado: porEstadoActivos,
        porEstadoFisico,
        listado: items.map(i => ({
          id: i.id,
          codigoInventario: (i as any).codigo_inventario,
          activoNombre: (i as any).activo?.nombre ?? null,
          ubicacion: i.ubicacion ?? null,
          estado: i.estado,
          estadoFisico: (i as any).estado_fisico,
          fechaEntrega: (i as any).fecha_entrega ?? null,
          fechaRetiro: (i as any).fecha_retiro ?? null,
          observaciones: i.observaciones ?? null,
          precio: i.precio ?? null,
        })),
      };
    }

    if (incluir('materiales')) {
      const materiales = await this.repoActivoFungible
        .createQueryBuilder('m')
        .leftJoin('m.items', 'l', 'l.deleted_at IS NULL')
        .select('m.id', 'id')
        .addSelect('m.nombre', 'nombre')
        .addSelect('COALESCE(SUM(l.cantidad), 0)', 'cantidadTotal')
        .groupBy('m.id')
        .addGroupBy('m.nombre')
        .getRawMany<{ id: string; nombre: string; cantidadTotal: string }>();
      const listado = materiales
        .map(x => ({
          id: Number(x.id),
          nombre: x.nombre,
          stockMinimo: 0,
          cantidadTotal: Number(x.cantidadTotal),
          bajoStock: false,
        }))
        .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));
      data.materiales = {
        totalMateriales: listado.length,
        bajoStockCount: 0,
        listado,
        bajoStock: [],
      };
    }

    if (incluir('movimientos')) {
      data.movimientos = {
        resumen: { entrada: { count: 0, cantidad: 0 }, salida: { count: 0, cantidad: 0 } },
        total: 0,
        listado: [],
      };
    }

    return data;
  }

  buildPromptPreCreado(input: { titulo: string; inicio: string; fin: string; areas: string[]; data: any }) {
    return [
      'Eres un asistente que redacta reportes de gestión de inventarios para un laboratorio.',
      `Título del reporte: ${input.titulo}.`,
      `Periodo: ${input.inicio} a ${input.fin}.`,
      `Áreas incluidas: ${input.areas.join(', ')}.`,
      'Devuelve SOLO el análisis (no repitas listados exhaustivos) en español, en HTML simple con encabezados y listas.',
      'No inventes datos: usa únicamente los datos provistos. Si algo no está en los datos, indica "No disponible".',
      'Estructura mínima: Resumen ejecutivo, Riesgos, Recomendaciones.',
      'Datos agregados (JSON):',
      JSON.stringify(input.data, null, 2),
    ].join('\n');
  }

  buildHtmlPreCreado(input: { titulo: string; inicio: string; fin: string; areas: string[]; data: any }) {
    const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const iso = (d: any) => {
      if (!d) return '';
      const dt = d instanceof Date ? d : new Date(d);
      if (Number.isNaN(dt.getTime())) return '';
      return dt.toISOString().slice(0, 10);
    };
    const areas = input.areas;

    const parts: string[] = [];
    parts.push(`<h1>${esc(input.titulo)}</h1>`);
    parts.push(`<p><strong>Periodo:</strong> ${esc(input.inicio)} a ${esc(input.fin)}</p>`);
    parts.push(`<p><strong>Áreas:</strong> ${esc(areas.join(', '))}</p>`);
    const prestamos = input.data?.prestamos;
    if (prestamos) {
      parts.push('<h2>Préstamos</h2>');
      parts.push(`<p>Total en el periodo: <strong>${esc(prestamos.total)}</strong></p>`);
      const porEstado = prestamos.porEstado ?? {};
      const estados = Object.keys(porEstado).sort();
      parts.push('<h3>Por estado</h3>');
      parts.push(`<ul>${estados.length ? estados.map(k => `<li>${esc(k)}: <strong>${esc(porEstado[k])}</strong></li>`).join('') : '<li>Sin datos</li>'}</ul>`);

      const listado = Array.isArray(prestamos.listado) ? prestamos.listado : [];
      parts.push(`<h3>Listado de préstamos (${esc(listado.length)})</h3>`);
      parts.push(
        `<ol>${listado
          .map((p: any) => {
            const estudiante = p.estudiante ? `${esc(p.estudiante.nombre)} ${esc(p.estudiante.apellido)} (${esc(p.estudiante.carnet)})` : 'No disponible';
            const docente = p.docente ? `${esc(p.docente.nombre)} ${esc(p.docente.apellido)} (${esc(p.docente.codigo)})` : 'No disponible';
            const item = p.itemActivo?.codigoInventario ? ` · Item: ${esc(p.itemActivo.codigoInventario)}${p.itemActivo.activoNombre ? ` (${esc(p.itemActivo.activoNombre)})` : ''}` : '';
            const grupo = p.grupoCanasta ? ` · Grupo: ${esc(p.grupoCanasta)}` : '';
            const dev = p.fechaDevolucion ? ` · Devolución: ${esc(iso(p.fechaDevolucion))}` : '';
            const obs = p.observaciones ? ` · Obs: ${esc(p.observaciones)}` : '';
            return `<li>${esc(iso(p.fechaPrestamo))} · Código: <strong>${esc(p.codigoHerramienta)}</strong>${grupo}${item} · Estado: <strong>${esc(p.estado)}</strong>${dev} · Estudiante: ${estudiante} · Docente: ${docente}${obs}</li>`;
          })
          .join('')}</ol>`
      );
    }

    if (areas.includes('activos')) {
      const activos = input.data?.activos;
      parts.push('<h2>Activos fijos</h2>');
      parts.push(`<p>Total de ítems: <strong>${esc(activos?.total ?? 0)}</strong></p>`);
      const porEstado = activos?.porEstado ?? {};
      const estados = Object.keys(porEstado).sort();
      parts.push('<h3>Por estado operativo</h3>');
      parts.push(`<ul>${estados.length ? estados.map(k => `<li>${esc(k)}: <strong>${esc(porEstado[k])}</strong></li>`).join('') : '<li>Sin datos</li>'}</ul>`);

      const porEstadoFisico = activos?.porEstadoFisico ?? {};
      const estadosF = Object.keys(porEstadoFisico).sort();
      parts.push('<h3>Por estado físico</h3>');
      parts.push(`<ul>${estadosF.length ? estadosF.map(k => `<li>${esc(k)}: <strong>${esc(porEstadoFisico[k])}</strong></li>`).join('') : '<li>Sin datos</li>'}</ul>`);

      const listado = Array.isArray(activos?.listado) ? activos.listado : [];
      parts.push(`<h3>Listado de ítems (${esc(listado.length)})</h3>`);
      parts.push(
        `<ol>${listado
          .map((i: any) => {
            const ubic = i.ubicacion ? ` · Ubicación: ${esc(i.ubicacion)}` : '';
            const obs = i.observaciones ? ` · Obs: ${esc(i.observaciones)}` : '';
            const activoNombre = i.activoNombre ? ` (${esc(i.activoNombre)})` : '';
            return `<li>Código: <strong>${esc(i.codigoInventario)}</strong>${activoNombre} · Estado: <strong>${esc(i.estado)}</strong> · Físico: <strong>${esc(i.estadoFisico)}</strong>${ubic}${obs}</li>`;
          })
          .join('')}</ol>`
      );
    }

    if (areas.includes('materiales')) {
      const materiales = input.data?.materiales;
      parts.push('<h2>Materiales fungibles</h2>');
      parts.push(`<p>Total materiales: <strong>${esc(materiales?.totalMateriales ?? 0)}</strong> · Bajo stock: <strong>${esc(materiales?.bajoStockCount ?? 0)}</strong></p>`);
      const listado = Array.isArray(materiales?.listado) ? materiales.listado : [];
      parts.push(`<h3>Listado de materiales (${esc(listado.length)})</h3>`);
      parts.push(
        `<ol>${listado
          .map((m: any) => {
            const flag = m.bajoStock ? ' <strong>(Bajo stock)</strong>' : '';
            return `<li>${esc(m.nombre)}: Disponible <strong>${esc(m.cantidadTotal)}</strong> · Mínimo <strong>${esc(m.stockMinimo)}</strong>${flag}</li>`;
          })
          .join('')}</ol>`
      );
    }

    if (areas.includes('movimientos')) {
      const mov = input.data?.movimientos;
      parts.push('<h2>Movimientos de materiales</h2>');
      const resumen = mov?.resumen ?? { entrada: { count: 0, cantidad: 0 }, salida: { count: 0, cantidad: 0 } };
      const entrada = resumen.entrada ?? { count: 0, cantidad: 0 };
      const salida = resumen.salida ?? { count: 0, cantidad: 0 };
      parts.push(`<p>Total en el periodo: <strong>${esc(mov?.total ?? 0)}</strong></p>`);
      parts.push(`<ul><li>Entradas: <strong>${esc(entrada.count)}</strong> (cantidad: <strong>${esc(entrada.cantidad)}</strong>)</li><li>Salidas: <strong>${esc(salida.count)}</strong> (cantidad: <strong>${esc(salida.cantidad)}</strong>)</li></ul>`);

      const listado = Array.isArray(mov?.listado) ? mov.listado : [];
      parts.push(`<h3>Listado de movimientos (${esc(listado.length)})</h3>`);
      parts.push(
        `<ol>${listado
          .map((m: any) => {
            const lote = m.lote?.lote ? ` · Lote: ${esc(m.lote.lote)}` : '';
            const mat = m.lote?.materialNombre ? ` · Material: <strong>${esc(m.lote.materialNombre)}</strong>` : '';
            const ref = m.referencia ? ` · Ref: ${esc(m.referencia)}` : '';
            return `<li>${esc(iso(m.fecha))} · Tipo: <strong>${esc(m.tipo)}</strong> · Cantidad: <strong>${esc(m.cantidad)}</strong>${mat}${lote} · Motivo: ${esc(m.motivo)}${ref}</li>`;
          })
          .join('')}</ol>`
      );
    }

    parts.push('<h2>Riesgos</h2><p>No se generaron riesgos automáticos.</p>');
    parts.push('<h2>Recomendaciones</h2><p>No se generaron recomendaciones automáticas.</p>');
    return parts.join('');
  }

  normalizarSalidaIAComoHtml(salida: string) {
    const t = String(salida ?? '').trim();
    if (!t) return '<p></p>';
    if (/<\s*(h1|h2|h3|p|ul|ol|li|div|section|article|table|thead|tbody|tr|td|strong|em)\b/i.test(t)) {
      return t;
    }
    return this.toHtml(t);
  }

  buildPrompt(input: { inicio: string; fin: string; instrucciones?: string; stats: Record<string, number> }) {
    const instrucciones = input.instrucciones?.trim();
    return [
      'Eres un asistente que redacta reportes de gestión de inventarios para un laboratorio.',
      `Periodo: ${input.inicio} a ${input.fin}.`,
      'Usa los datos agregados para crear un pre-reporte claro y accionable.',
      'Devuelve en español y con estructura: Resumen ejecutivo, Hallazgos, Riesgos, Recomendaciones.',
      'Datos:',
      JSON.stringify(input.stats, null, 2),
      instrucciones ? `Instrucciones adicionales del usuario: ${instrucciones}` : '',
    ].filter(Boolean).join('\n');
  }

  toHtml(texto: string) {
    const escapado = texto
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const parrafos = escapado.split(/\n\n+/).map(p => `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('');
    return parrafos;
  }
}
