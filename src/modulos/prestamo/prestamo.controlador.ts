import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { PrestamoServicio } from './prestamo.servicio';

@Controller('prestamos')
export class PrestamoControlador {
  constructor(private readonly prestamoServicio: PrestamoServicio) {}

  @Get()
  async obtenerPrestamos() {
    return this.prestamoServicio.obtenerPrestamos();
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
      estado: 'pendiente' | 'devuelto' | 'vencido';
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
