import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Request, UseGuards } from '@nestjs/common';
import { JwtAutenticacionGuardia } from '@/modulos/autenticacion/guardias/jwt-autenticacion.guardia';
import { RolesGuardia } from '@/modulos/autenticacion/guardias/roles.guardia';
import { Roles } from '@/modulos/autenticacion/guardias/roles.decorador';
import { EstudianteServicio } from './estudiante.servicio';
import { PrestamoServicio } from '@/modulos/prestamo/prestamo.servicio';
import { CrearEstudianteDto } from './dto/crear-estudiante.dto';
import { EditarEstudianteDto } from './dto/editar-estudiante.dto';

@Controller('prestamos/estudiantes')
@UseGuards(JwtAutenticacionGuardia, RolesGuardia)
export class EstudiantesControlador {
  constructor(
    private readonly estudianteServicio: EstudianteServicio,
    private readonly prestamoServicio: PrestamoServicio,
  ) {}

  @Get()
  @Roles('administrador', 'encargado_inventario', 'docente')
  async listarEstudiantes(@Request() req: any) {
    return this.estudianteServicio.listarEstudiantes(req.user);
  }

  @Post()
  @Roles('administrador')
  async crearEstudiante(@Body() dto: CrearEstudianteDto) {
    return this.estudianteServicio.crearEstudiante(dto);
  }

  @Put(':id')
  @Roles('administrador')
  async editarEstudiante(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EditarEstudianteDto,
  ) {
    return this.estudianteServicio.editarEstudiante(id, dto as any);
  }

  @Delete(':id')
  @Roles('administrador')
  async eliminarEstudiante(@Param('id', ParseIntPipe) id: number) {
    await this.estudianteServicio.eliminarEstudiante(id);
    return { ok: true };
  }

  @Get('solicitudes')
  @Roles('administrador', 'encargado_inventario')
  async listarSolicitudesPendientes(@Request() req: any) {
    return this.estudianteServicio.listarSolicitudesPendientes(req.user);
  }

  @Post(':id/aprobar')
  @Roles('administrador', 'encargado_inventario')
  async aprobarEstudiante(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
  ) {
    await this.estudianteServicio.aprobarEstudiante(id, req.user);
    return { ok: true };
  }

  @Post(':id/rechazar')
  @Roles('administrador', 'encargado_inventario')
  async rechazarEstudiante(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
  ) {
    await this.estudianteServicio.rechazarEstudiante(id, req.user);
    return { ok: true };
  }

  @Get('mi-dashboard')
  @Roles('estudiante')
  async obtenerMiDashboard(@Request() req: any) {
    return this.prestamoServicio.obtenerDashboardEstudiante(req.user.id);
  }
}
