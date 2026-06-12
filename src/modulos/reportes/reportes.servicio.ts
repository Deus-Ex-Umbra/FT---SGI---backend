import { Injectable } from '@nestjs/common';
import { ReportesCrudServicio } from './reportes-crud.servicio';
import { ReportesGeneradorServicio } from './reportes-generador.servicio';
import { CrearReporteDto } from './dto/crear-reporte.dto';
import { ActualizarReporteDto } from './dto/actualizar-reporte.dto';
import { GenerarPreReporteDto } from './dto/generar-pre-reporte.dto';

@Injectable()
export class ReportesServicio {
  constructor(
    private readonly crudServicio: ReportesCrudServicio,
    private readonly generadorServicio: ReportesGeneradorServicio,
  ) {}

  async crear(usuarioId: number, dto: CrearReporteDto) {
    return this.crudServicio.crear(usuarioId, dto);
  }

  async actualizar(usuarioId: number, id: number, dto: ActualizarReporteDto) {
    return this.crudServicio.actualizar(usuarioId, id, dto);
  }

  async eliminar(usuarioId: number, id: number) {
    return this.crudServicio.eliminar(usuarioId, id);
  }

  async generarPreReporte(usuarioId: number, dto: GenerarPreReporteDto) {
    return this.generadorServicio.generarPreReporte(usuarioId, dto);
  }

  async listar(usuarioId: number) {
    return this.crudServicio.listar(usuarioId);
  }

  async obtener(usuarioId: number, id: number) {
    return this.crudServicio.obtener(usuarioId, id);
  }

  async obtenerDatosPreCreado(usuarioId: number, input: { fechaInicio?: string; fechaFin?: string; areas?: string[] }) {
    return this.generadorServicio.obtenerDatosPreCreado(usuarioId, input);
  }
}
