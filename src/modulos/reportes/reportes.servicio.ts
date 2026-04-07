import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { createHash } from 'crypto';
import { GeminiServicio } from '@/modulos/gemini/gemini.servicio';
import { PdfServicio } from '@/modulos/pdf/pdf.servicio';
import { ReporteEntidad } from './entidades/reporte.entidad';
import { ReportePdfEntidad } from './entidades/reporte-pdf.entidad';
import { Usuario } from '@/modulos/usuario/entidades/usuario.entidad';
import { PrestamoEntidad } from '@/modulos/prestamo/entidades/prestamo.entidad';
import { ItemActivoFijo } from '@/modulos/activo/entidades/item-activo-fijo.entidad';
import { MaterialFungible } from '@/modulos/material/entidades/material_fungible.entidad';
import { LoteMaterial } from '@/modulos/material/entidades/lote_material.entidad';
import { MovimientoMaterial } from '@/modulos/material/entidades/movimiento_material.entidad';
import { GenerarPreReporteDto } from './dto/generar-pre-reporte.dto';
import { CrearReporteDto } from './dto/crear-reporte.dto';
import { ActualizarReporteDto } from './dto/actualizar-reporte.dto';

@Injectable()
export class ReportesServicio {
  constructor(
    @InjectRepository(ReporteEntidad) private readonly repoReporte: Repository<ReporteEntidad>,
    @InjectRepository(ReportePdfEntidad) private readonly repoReportePdf: Repository<ReportePdfEntidad>,
    @InjectRepository(Usuario) private readonly repoUsuario: Repository<Usuario>,
    @InjectRepository(PrestamoEntidad) private readonly repoPrestamo: Repository<PrestamoEntidad>,
    @InjectRepository(ItemActivoFijo) private readonly repoItemActivo: Repository<ItemActivoFijo>,
    @InjectRepository(MaterialFungible) private readonly repoMaterial: Repository<MaterialFungible>,
    @InjectRepository(LoteMaterial) private readonly repoLote: Repository<LoteMaterial>,
    @InjectRepository(MovimientoMaterial) private readonly repoMov: Repository<MovimientoMaterial>,
    private readonly gemini: GeminiServicio,
    private readonly pdf: PdfServicio,
  ) {}

  private isoHoy() {
    return new Date().toISOString().slice(0, 10);
  }

  private fechaHoraLocalLegible(d: Date = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${hh}:${mm}`;
  }

  private fechaHoraLocalParaArchivo(d: Date = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${day}_${hh}-${mm}-${ss}`;
  }

  private siglasAreas(areas?: string[]) {
    const lista = Array.isArray(areas) ? areas : [];
    const cleaned = lista
      .map((a) => String(a || '').trim().toLowerCase())
      .filter(Boolean);
    const set = new Set<string>(cleaned);
    if (set.size === 0) return '';

    const mapSigla = (area: string) => {
      if (area.startsWith('mov')) return 'V'; // movimientos
      if (area.startsWith('mat')) return 'M'; // materiales
      if (area.startsWith('pre')) return 'P'; // prestamos
      if (area.startsWith('act')) return 'A'; // activos
      if (area.startsWith('con')) return 'C'; // contenedores
      if (area.startsWith('usu')) return 'U'; // usuarios
      return area[0]?.toUpperCase() ?? '';
    };

    const siglas = Array.from(set)
      .map(mapSigla)
      .filter(Boolean)
      .join('');

    return siglas;
  }

  private isoYmdLocal(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private limitesMesActualIso() {
    const now = new Date();
    const inicio = new Date(now.getFullYear(), now.getMonth(), 1);
    const fin = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { inicio: this.isoYmdLocal(inicio), fin: this.isoYmdLocal(fin) };
  }

  private construirTituloConSufijo(tituloBase: string, areas?: string[]) {
    const base = (tituloBase ?? '').trim();
    const fechaHora = this.fechaHoraLocalLegible();
    const siglas = this.siglasAreas(areas);

    const titulo = base ? `${base} - ${fechaHora}` : `Reporte - ${fechaHora}`;
    return siglas ? `${titulo} - ${siglas}` : titulo;
  }

  private normalizarAreas(areas?: string[]) {
    const lista = Array.isArray(areas) ? areas : [];
    const cleaned = lista
      .map(a => String(a || '').trim().toLowerCase())
      .filter(Boolean);
    const set = new Set<string>(cleaned);
    // Siempre incluir préstamos.
    set.add('prestamos');
    return Array.from(set);
  }

  async crear(usuarioId: number, dto: CrearReporteDto) {
    const usuario = await this.repoUsuario.findOne({ where: { id: usuarioId } });
    const areasNormalizadas = dto.tipo === 'blanco' ? undefined : this.normalizarAreas(dto.areas);
    const titulo = this.construirTituloConSufijo(dto.tituloBase, areasNormalizadas);

    if (dto.tipo === 'blanco') {
      const hoy = this.isoHoy();
      const entidad = this.repoReporte.create({
        usuario: usuario!,
        titulo,
        html: '<p></p>',
        fechaInicio: hoy,
        fechaFin: hoy,
        metadata: { tipo: 'blanco' },
      });
      const guardado = await this.repoReporte.save(entidad);
      return {
        id: guardado.id,
        titulo: guardado.titulo,
        html: guardado.html,
        fechaInicio: guardado.fechaInicio,
        fechaFin: guardado.fechaFin,
        metadata: guardado.metadata ?? null,
        creadoEn: guardado.creadoEn,
      };
    }

    // precreado
    if (!dto.fechaInicio || !dto.fechaFin) {
      throw new Error('fechaInicio y fechaFin son requeridas para reportes pre-creados.');
    }
    const inicio = new Date(dto.fechaInicio);
    const fin = new Date(dto.fechaFin);
    fin.setHours(23, 59, 59, 999);
    const areas = areasNormalizadas!;
    const usarIA = Boolean(dto.usarIA);

    const data = await this.construirDatosPreCreado({ inicio, fin, areas });
    const htmlBase = this.buildHtmlPreCreado({ titulo, inicio: dto.fechaInicio, fin: dto.fechaFin, areas, data });

    let html = htmlBase;
    if (usarIA) {
      // IA se usa solo como análisis/narrativa; el detalle (listas) se mantiene determinístico.
      const salida = await this.gemini.generarTexto(usuarioId, this.buildPromptPreCreado({ titulo, inicio: dto.fechaInicio, fin: dto.fechaFin, areas, data }));
      const htmlIA = this.normalizarSalidaIAComoHtml(salida);
      html = `${htmlIA}<hr/>${htmlBase}`;
    }

    const entidad = this.repoReporte.create({
      usuario: usuario!,
      titulo,
      html,
      fechaInicio: dto.fechaInicio,
      fechaFin: dto.fechaFin,
      metadata: { tipo: 'precreado', areas, usarIA },
    });
    const guardado = await this.repoReporte.save(entidad);
    return {
      id: guardado.id,
      titulo: guardado.titulo,
      html: guardado.html,
      fechaInicio: guardado.fechaInicio,
      fechaFin: guardado.fechaFin,
      metadata: guardado.metadata ?? null,
      creadoEn: guardado.creadoEn,
    };
  }

  async actualizar(usuarioId: number, id: number, dto: ActualizarReporteDto) {
    const rep = await this.repoReporte.findOne({ where: { id, usuario: { id: usuarioId } }, relations: ['usuario'] });
    if (!rep) return null;

    if (dto.titulo != null) rep.titulo = dto.titulo;
    if (dto.html != null) rep.html = dto.html;
    if (dto.fechaInicio != null) rep.fechaInicio = dto.fechaInicio;
    if (dto.fechaFin != null) rep.fechaFin = dto.fechaFin;

    const guardado = await this.repoReporte.save(rep);
    return {
      id: guardado.id,
      titulo: guardado.titulo,
      html: guardado.html,
      fechaInicio: guardado.fechaInicio,
      fechaFin: guardado.fechaFin,
      metadata: guardado.metadata ?? null,
      creadoEn: guardado.creadoEn,
    };
  }

  async eliminar(usuarioId: number, id: number) {
    const rep = await this.repoReporte.findOne({ where: { id, usuario: { id: usuarioId } }, relations: ['usuario'] });
    if (!rep) return { ok: false };
    await this.repoReporte.remove(rep);
    return { ok: true };
  }

  async generarPreReporte(usuarioId: number, dto: GenerarPreReporteDto) {
    const inicio = new Date(dto.fechaInicio);
    const fin = new Date(dto.fechaFin);
    fin.setHours(23, 59, 59, 999);

    const [prestamos, activos, lotes, movimientos] = await Promise.all([
      this.repoPrestamo.find({ where: { fechaPrestamo: Between(inicio, fin) } as any, relations: [] }),
      this.repoItemActivo.count(),
      this.repoLote.count(),
      this.repoMov.find({ where: { fecha: Between(inicio, fin) } as any }),
    ]);

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

  async convertirHtmlAPdfBuffer(html: string, config: any): Promise<Buffer> {
    return await this.pdf.generarPdfBufferDesdeHtml({ contenido_html: html, config } as any);
  }

  async generarPdfDesdeReporte(usuarioId: number, reporteId: number, config: any) {
    const rep = await this.repoReporte.findOne({ where: { id: reporteId, usuario: { id: usuarioId } }, relations: ['usuario'] });
    if (!rep) return null;

    const pdfBuffer = await this.convertirHtmlAPdfBuffer(rep.html, config);
    const sha256 = createHash('sha256').update(pdfBuffer).digest('hex');
    const fechaHora = this.fechaHoraLocalParaArchivo();
    const metadataAreas = (rep.metadata as any)?.areas as string[] | undefined;
    const siglas = this.siglasAreas(metadataAreas);
    const sufijoAreas = siglas ? `-${siglas}` : '';
    const filename = `reporte-${reporteId}-${rep.fechaInicio}-a-${rep.fechaFin}-${fechaHora}${sufijoAreas}.pdf`;

    const entidad = this.repoReportePdf.create({
      usuario: rep.usuario,
      reporte: rep,
      filename,
      mime: 'application/pdf',
      sizeBytes: pdfBuffer.length,
      sha256,
      contenido: pdfBuffer,
    });
    const guardado = await this.repoReportePdf.save(entidad);
    return {
      id: guardado.id,
      reporteId: rep.id,
      filename: guardado.filename,
      sizeBytes: guardado.sizeBytes,
      sha256: guardado.sha256,
      creadoEn: guardado.creadoEn,
      pdfBuffer,
    };
  }

  async listarPdfs(usuarioId: number) {
    const lista = await this.repoReportePdf.find({
      where: { usuario: { id: usuarioId } },
      order: { creadoEn: 'DESC' },
      relations: ['reporte'],
    });
    return lista.map((p) => ({
      id: p.id,
      reporteId: (p.reporte as any)?.id,
      filename: p.filename,
      mime: p.mime,
      sizeBytes: p.sizeBytes,
      sha256: p.sha256,
      creadoEn: p.creadoEn,
    }));
  }

  async obtenerPdfParaDescarga(usuarioId: number, pdfId: number) {
    const pdf = await this.repoReportePdf.findOne({ where: { id: pdfId, usuario: { id: usuarioId } }, relations: ['reporte'] });
    if (!pdf) return null;
    return {
      id: pdf.id,
      filename: pdf.filename,
      mime: pdf.mime,
      buffer: pdf.contenido,
    };
  }

  async listar(usuarioId: number) {
    const lista = await this.repoReporte.find({ where: { usuario: { id: usuarioId } }, order: { creadoEn: 'DESC' }, relations: ['usuario'] });
    return lista.map(r => ({ id: r.id, titulo: r.titulo, fechaInicio: r.fechaInicio, fechaFin: r.fechaFin, metadata: r.metadata ?? null, creadoEn: r.creadoEn }));
  }

  async obtener(usuarioId: number, id: number) {
    const rep = await this.repoReporte.findOne({ where: { id, usuario: { id: usuarioId } }, relations: ['usuario'] });
    return rep ? { id: rep.id, titulo: rep.titulo, html: rep.html, fechaInicio: rep.fechaInicio, fechaFin: rep.fechaFin, metadata: rep.metadata ?? null, creadoEn: rep.creadoEn } : null;
  }

  async obtenerDatosPreCreado(usuarioId: number, input: { fechaInicio?: string; fechaFin?: string; areas?: string[] }) {
    // usuarioId reservado por si luego agregas control multi-sede.
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

  private async construirDatosPreCreado(input: { inicio: Date; fin: Date; areas: string[] }) {
    const incluir = (area: string) => input.areas.includes(area);

    const data: any = { areas: input.areas };

    // Prestamos (requerido)
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
          semestre: p.estudiante.semestre,
          carnetRetenido: p.estudiante.carnetRetenido,
        } : null,
        docente: p.docente ? {
          codigo: p.docente.codigo,
          nombre: p.docente.nombre,
          apellido: p.docente.apellido,
          carnet: p.docente.carnet,
          materia: p.docente.materia,
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
      const materiales = await this.repoMaterial
        .createQueryBuilder('m')
        .leftJoin('m.lotes', 'l', 'l.deleted_at IS NULL')
        .select('m.id', 'id')
        .addSelect('m.nombre', 'nombre')
        .addSelect('m.stockMinimo', 'stockMinimo')
        .addSelect('COALESCE(SUM(l.cantidadDisponible), 0)', 'cantidadTotal')
        .groupBy('m.id')
        .addGroupBy('m.nombre')
        .addGroupBy('m.stockMinimo')
        .getRawMany<{ id: string; nombre: string; stockMinimo: string; cantidadTotal: string }>();
      const listado = materiales
        .map(x => ({
          id: Number(x.id),
          nombre: x.nombre,
          stockMinimo: Number(x.stockMinimo),
          cantidadTotal: Number(x.cantidadTotal),
          bajoStock: Number(x.cantidadTotal) <= Number(x.stockMinimo),
        }))
        .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));
      const bajoStock = listado
        .filter(x => x.bajoStock)
        .sort((a, b) => Number(a.cantidadTotal) - Number(b.cantidadTotal));
      data.materiales = {
        totalMateriales: listado.length,
        bajoStockCount: bajoStock.length,
        listado,
        bajoStock,
      };
    }

    if (incluir('movimientos')) {
      const movimientos = await this.repoMov.find({
        where: { fecha: Between(input.inicio, input.fin) } as any,
        order: { fecha: 'ASC' } as any,
        relations: ['lote', 'lote.material'],
      });

      const resumen: any = { entrada: { count: 0, cantidad: 0 }, salida: { count: 0, cantidad: 0 } };
      for (const mv of movimientos) {
        if (!resumen[mv.tipo]) resumen[mv.tipo] = { count: 0, cantidad: 0 };
        resumen[mv.tipo].count += 1;
        resumen[mv.tipo].cantidad += Number(mv.cantidad ?? 0);
      }

      data.movimientos = {
        resumen,
        total: movimientos.length,
        listado: movimientos.map(mv => ({
          id: mv.id,
          fecha: mv.fecha,
          tipo: mv.tipo,
          cantidad: mv.cantidad,
          motivo: mv.motivo,
          referencia: mv.referencia ?? null,
          lote: (mv as any).lote ? {
            id: (mv as any).lote.id,
            lote: (mv as any).lote.lote,
            materialNombre: (mv as any).lote.material?.nombre ?? null,
          } : null,
        })),
      };
    }

    return data;
  }

  private buildPromptPreCreado(input: { titulo: string; inicio: string; fin: string; areas: string[]; data: any }) {
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

  private buildHtmlPreCreado(input: { titulo: string; inicio: string; fin: string; areas: string[]; data: any }) {
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

    // Prestamos
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

  private normalizarSalidaIAComoHtml(salida: string) {
    const t = String(salida ?? '').trim();
    if (!t) return '<p></p>';

    // Si ya parece HTML, lo devolvemos tal cual.
    if (/<\s*(h1|h2|h3|p|ul|ol|li|div|section|article|table|thead|tbody|tr|td|strong|em)\b/i.test(t)) {
      return t;
    }
    return this.toHtml(t);
  }

  private buildPrompt(input: { inicio: string; fin: string; instrucciones?: string; stats: Record<string, number> }) {
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

  private toHtml(texto: string) {
    const escapado = texto
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const parrafos = escapado.split(/\n\n+/).map(p => `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('');
    return parrafos;
  }
}
