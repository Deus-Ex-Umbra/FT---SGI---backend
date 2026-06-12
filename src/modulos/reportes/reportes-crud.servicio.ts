import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReporteEntidad } from './entidades/reporte.entidad';
import { Usuario } from '@/modulos/usuario/entidades/usuario.entidad';
import { GeminiServicio } from '@/modulos/gemini/gemini.servicio';
import { ReportesGeneradorServicio } from './reportes-generador.servicio';
import { CrearReporteDto } from './dto/crear-reporte.dto';
import { ActualizarReporteDto } from './dto/actualizar-reporte.dto';

@Injectable()
export class ReportesCrudServicio {
  constructor(
    @InjectRepository(ReporteEntidad) private readonly repoReporte: Repository<ReporteEntidad>,
    @InjectRepository(Usuario) private readonly repoUsuario: Repository<Usuario>,
    private readonly gemini: GeminiServicio,
    private readonly generador: ReportesGeneradorServicio,
  ) {}

  async crear(usuarioId: number, dto: CrearReporteDto) {
    const usuario = await this.repoUsuario.findOne({ where: { id: usuarioId } });
    const areasNormalizadas = dto.tipo === 'blanco' ? undefined : this.generador.normalizarAreas(dto.areas);
    const titulo = this.generador.construirTituloConSufijo(dto.tituloBase, areasNormalizadas);

    if (dto.tipo === 'blanco') {
      const hoy = this.generador.isoHoy();
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

    if (!dto.fechaInicio || !dto.fechaFin) {
      throw new Error('fechaInicio y fechaFin son requeridas para reportes pre-creados.');
    }
    const inicio = new Date(dto.fechaInicio);
    const fin = new Date(dto.fechaFin);
    fin.setHours(23, 59, 59, 999);
    const areas = areasNormalizadas!;
    const usarIA = Boolean(dto.usarIA);

    const data = await this.generador.construirDatosPreCreado({ inicio, fin, areas });
    const htmlBase = this.generador.buildHtmlPreCreado({ titulo, inicio: dto.fechaInicio, fin: dto.fechaFin, areas, data });

    let html = htmlBase;
    if (usarIA) {
      const salida = await this.gemini.generarTexto(usuarioId, this.generador.buildPromptPreCreado({ titulo, inicio: dto.fechaInicio, fin: dto.fechaFin, areas, data }));
      const htmlIA = this.generador.normalizarSalidaIAComoHtml(salida);
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

  async listar(usuarioId: number) {
    const lista = await this.repoReporte.find({ where: { usuario: { id: usuarioId } }, order: { creadoEn: 'DESC' }, relations: ['usuario'] });
    return lista.map(r => ({ id: r.id, titulo: r.titulo, fechaInicio: r.fechaInicio, fechaFin: r.fechaFin, metadata: r.metadata ?? null, creadoEn: r.creadoEn }));
  }

  async obtener(usuarioId: number, id: number) {
    const rep = await this.repoReporte.findOne({ where: { id, usuario: { id: usuarioId } }, relations: ['usuario'] });
    return rep ? { id: rep.id, titulo: rep.titulo, html: rep.html, fechaInicio: rep.fechaInicio, fechaFin: rep.fechaFin, metadata: rep.metadata ?? null, creadoEn: rep.creadoEn } : null;
  }
}
