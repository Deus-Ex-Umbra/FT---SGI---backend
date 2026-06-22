import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, UseGuards, Request } from '@nestjs/common';
import { PrestamoServicio } from './prestamo.servicio';
import { JwtAutenticacionGuardia } from '@/modulos/autenticacion/guardias/jwt-autenticacion.guardia';
import { Roles } from '@/modulos/autenticacion/guardias/roles.decorador';
import { RolesGuardia } from '@/modulos/autenticacion/guardias/roles.guardia';
import type { RolUsuario } from '@/modulos/usuario/entidades/usuario.entidad';

@Controller('prestamos')
@UseGuards(JwtAutenticacionGuardia, RolesGuardia)
export class PrestamoControlador {
  constructor(private readonly prestamoServicio: PrestamoServicio) {}

  @Get()
  async obtenerPrestamos(@Request() req: any) {
    return this.prestamoServicio.obtenerPrestamos(req.user);
  }

  @Post()
  async crearPrestamo(
    @Request() req: any,
    @Body()
    body: {
      carnetEstudiante: string;
      idDocente: number;
      idHerramienta: string;
      fechaPrestamo: string;
      fechaDevolucion: string;
      observaciones?: string;
      carnetRetenido?: boolean;
    },
  ) {
    return this.prestamoServicio.crearPrestamo(body, req.user);
  }

  @Put(':id')
  async editarPrestamo(
    @Request() req: any,
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
      carnetRetenido: boolean;
    }>,
  ) {
    return this.prestamoServicio.editarPrestamo(id, body, req.user);
  }

  @Post(':id/extender')
  async extenderPrestamo(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { fechaDevolucion: string },
  ) {
    return this.prestamoServicio.extenderFechaDevolucion(id, body.fechaDevolucion, req.user);
  }

  @Put(':id/aceptar')
  async aceptarPrestamo(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.prestamoServicio.aceptarPrestamo(id, req.user);
  }

  @Put(':id/rechazar')
  async rechazarPrestamo(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { motivo: string },
  ) {
    return this.prestamoServicio.rechazarPrestamo(id, body.motivo, req.user);
  }

  @Put(':id/despachar')
  async despacharPrestamo(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { estadoFisicoEntrega?: string; carnetRetenido?: boolean },
  ) {
    return this.prestamoServicio.despacharPrestamo(id, body, req.user);
  }

  @Put(':id/devolver')
  async devolverPrestamo(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { estadoFisicoDevolucion?: string; carnetDevuelto?: boolean; observaciones?: string },
  ) {
    return this.prestamoServicio.devolverPrestamoCompleto(id, body, req.user);
  }

  @Delete(':id')
  async eliminarPrestamo(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    await this.prestamoServicio.eliminarPrestamo(id, req.user);
    return { ok: true };
  }

  @Get(':id/historial')
  @Roles('administrador')
  async obtenerHistorialPrestamo(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.prestamoServicio.obtenerHistorialPrestamo(id, req.user);
  }

  @Put('estudiantes/:id')
  async editarEstudiante(
    @Param('id', ParseIntPipe) id: number,
    @Body() datos: Partial<{
      carnetRetenido: boolean;
      carnetRetenidoOverride: boolean | null;
    }>,
  ) {
    return this.prestamoServicio.editarEstudiante(id, datos);
  }

  @Get('canastas')
  async obtenerCanastas(@Request() req: any) {
    return this.prestamoServicio.obtenerCanastasPrestamo(req.user);
  }

  @Get('canastas/:id')
  async obtenerCanasta(@Request() req: any, @Param('id') canastaId: string) {
    return this.prestamoServicio.obtenerCanastaPrestamo(canastaId, req.user);
  }


  @Post('canastas')
  async crearCanastaPrestamo(
    @Request() req: any,
    @Body()
    body: {
      carnetEstudiante?: string;
      carnetsEstudiantes?: string[];
      idDocente: number;
      fechaPrestamo: string;
      fechaDevolucion: string;
      observaciones?: string;
      items?: Array<{ idItem?: string; idHerramienta?: string; registrado?: boolean }>;
      equipos: string[];
      consumibles: Array<{ idLote: string; cantidad: number; motivo: string }>;
    },
  ) {
    return this.prestamoServicio.crearCanastaPrestamo(body, req.user);
  }

  @Put('canastas/:id')
  async editarCanasta(
    @Request() req: any,
    @Param('id') canastaId: string,
    @Body()
    body: Partial<{
      carnetEstudiante: string;
      carnetsEstudiantes: string[];
      fechaPrestamo: string;
      fechaDevolucion: string | null;
      observaciones: string;
      idDocente: number;
      items: Array<{ idItem?: string; idHerramienta?: string; registrado?: boolean }>;
      estado: 'activo' | 'pendiente' | 'devuelto' | 'vencido' | 'devuelto_fuera_de_fecha_limite';
    }>,
  ) {
    return this.prestamoServicio.editarCanastaPrestamo(canastaId, body, req.user);
  }

  @Post('canastas/:id/extender')
  async extenderCanasta(
    @Request() req: any,
    @Param('id') canastaId: string,
    @Body() body: { fechaDevolucion: string },
  ) {
    return this.prestamoServicio.extenderCanastaPrestamo(canastaId, body.fechaDevolucion, req.user);
  }

  @Put('canastas/:id/aceptar')
  async aceptarCanasta(@Request() req: any, @Param('id') canastaId: string) {
    return this.prestamoServicio.aceptarCanastaPrestamo(canastaId, req.user);
  }

  @Put('canastas/:id/rechazar')
  async rechazarCanasta(
    @Request() req: any,
    @Param('id') canastaId: string,
    @Body() body: { motivo: string },
  ) {
    return this.prestamoServicio.rechazarCanastaPrestamo(canastaId, body.motivo, req.user);
  }

  @Put('canastas/:id/despachar')
  async despacharCanasta(
    @Request() req: any,
    @Param('id') canastaId: string,
    @Body() body: {
      equipos?: Array<{ idHerramienta: string; registrado: boolean; estadoFisicoEntrega?: string }>;
      consumibles?: Array<{ idLote: string; cantidad: number }>;
      carnetsRetenidos?: string[];
    },
  ) {
    return this.prestamoServicio.despacharCanastaPrestamo(canastaId, body, req.user);
  }

  @Put('canastas/:id/devolver')
  async devolverCanasta(
    @Request() req: any,
    @Param('id') canastaId: string,
    @Body() body: {
      equipos?: Array<{ idHerramienta: string; estadoFisicoDevolucion: string; devuelto: boolean }>;
      consumibles?: Array<{ idLote: string; cantidadDevuelta: number; estadoDevuelto?: string }>;
      carnetsDevueltos?: string[];
      observaciones?: string;
    },
  ) {
    return this.prestamoServicio.devolverCanastaPrestamoCompleto(canastaId, body, req.user);
  }

  @Delete('canastas/:id')
  async eliminarCanasta(@Request() req: any, @Param('id') canastaId: string) {
    await this.prestamoServicio.eliminarCanastaPrestamo(canastaId, req.user);
    return { ok: true };
  }

  @Get('mi-dashboard')
  @Roles('estudiante' as RolUsuario)
  async obtenerMiDashboard(@Request() req: any) {
    return this.prestamoServicio.obtenerDashboardEstudiante(req.user.id);
  }
}
