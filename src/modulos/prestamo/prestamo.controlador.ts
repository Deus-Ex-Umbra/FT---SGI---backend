import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { PrestamoServicio } from './prestamo.servicio';

@Controller('prestamos')
export class PrestamoControlador {
  constructor(private readonly prestamoServicio: PrestamoServicio) {}

  @Get()
  async obtenerPrestamos() {
    return this.prestamoServicio.obtenerPrestamos();
  }

  @Get('canastas')
  async obtenerCanastas() {
    return this.prestamoServicio.obtenerCanastasPrestamo();
  }

  @Post()
  async crearPrestamo(
    @Body()
    body: {
      carnetEstudiante: string;
      idDocente: number;
      idHerramienta: string;
      fechaPrestamo: string;
      fechaDevolucion: string;
      observaciones?: string;
    },
  ) {
    return this.prestamoServicio.crearPrestamo(body);
  }

  @Post('canasta')
  async crearCanastaPrestamo(
    @Body()
    body: {
      carnetEstudiante: string;
      idDocente: number;
      fechaPrestamo: string;
      fechaDevolucion: string;
      observaciones?: string;
      equipos: string[];
      consumibles: Array<{ idLote: number; cantidad: number; motivo: string }>;
    },
  ) {
    return this.prestamoServicio.crearCanastaPrestamo(body);
  }

  @Put(':id')
  async editarPrestamo(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: Partial<{
      carnetEstudiante: string;
      idHerramienta: string;
      fechaPrestamo: string;
      fechaDevolucion: string | null;
      observaciones: string;
      idDocente: number;
      estado: 'activo' | 'pendiente' | 'devuelto' | 'vencido' | 'devuelto_fuera_de_fecha_limite';
    }>,
  ) {
    return this.prestamoServicio.editarPrestamo(id, body);
  }

  @Post(':id/extender')
  async extenderPrestamo(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { fechaDevolucion: string },
  ) {
    return this.prestamoServicio.extenderFechaDevolucion(id, body.fechaDevolucion);
  }

  @Post(':id/devolver')
  async devolverPrestamo(@Param('id', ParseIntPipe) id: number) {
    return this.prestamoServicio.marcarDevuelto(id);
  }

  @Delete(':id')
  async eliminarPrestamo(@Param('id', ParseIntPipe) id: number) {
    await this.prestamoServicio.eliminarPrestamo(id);
    return { ok: true };
  }

  @Put('canastas/:id')
  async editarCanasta(
    @Param('id') canastaId: string,
    @Body()
    body: Partial<{
      carnetEstudiante: string;
      fechaPrestamo: string;
      fechaDevolucion: string | null;
      observaciones: string;
      idDocente: number;
      estado: 'activo' | 'pendiente' | 'devuelto' | 'vencido' | 'devuelto_fuera_de_fecha_limite';
    }>,
  ) {
    return this.prestamoServicio.editarCanastaPrestamo(canastaId, body);
  }

  @Post('canastas/:id/extender')
  async extenderCanasta(
    @Param('id') canastaId: string,
    @Body() body: { fechaDevolucion: string },
  ) {
    return this.prestamoServicio.extenderCanastaPrestamo(canastaId, body.fechaDevolucion);
  }

  @Post('canastas/:id/devolver')
  async devolverCanasta(@Param('id') canastaId: string) {
    return this.prestamoServicio.devolverCanastaPrestamo(canastaId);
  }

  @Delete('canastas/:id')
  async eliminarCanasta(@Param('id') canastaId: string) {
    await this.prestamoServicio.eliminarCanastaPrestamo(canastaId);
    return { ok: true };
  }

  @Get('estudiantes')
  async obtenerEstudiantes() {
    return this.prestamoServicio.obtenerEstudiantes();
  }

  @Post('estudiantes')
  async crearEstudiante(
    @Body() body: { carnet: string; nombre: string; apellido: string; carrera: string; semestre: number; carnetRetenido?: boolean },
  ) {
    return this.prestamoServicio.crearEstudiante(body);
  }

  @Put('estudiantes/:id')
  async editarEstudiante(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Partial<{ carnet: string; nombre: string; apellido: string; carrera: string; semestre: number; carnetRetenido: boolean }>,
  ) {
    return this.prestamoServicio.editarEstudiante(id, body);
  }

  @Delete('estudiantes/:id')
  async eliminarEstudiante(@Param('id', ParseIntPipe) id: number) {
    await this.prestamoServicio.eliminarEstudiante(id);
    return { ok: true };
  }

  @Get('docentes')
  async obtenerDocentes() {
    return this.prestamoServicio.obtenerDocentes();
  }

  @Post('docentes')
  async crearDocente(
    @Body() body: { codigo: string; nombre: string; apellido: string; materia: string; carnet: string },
  ) {
    return this.prestamoServicio.crearDocente(body);
  }

  @Put('docentes/:id')
  async editarDocente(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Partial<{ codigo: string; nombre: string; apellido: string; materia: string; carnet: string }>,
  ) {
    return this.prestamoServicio.editarDocente(id, body);
  }

  @Delete('docentes/:id')
  async eliminarDocente(@Param('id', ParseIntPipe) id: number) {
    await this.prestamoServicio.eliminarDocente(id);
    return { ok: true };
  }
}
