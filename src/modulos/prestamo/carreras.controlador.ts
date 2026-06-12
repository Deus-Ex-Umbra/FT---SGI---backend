import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAutenticacionGuardia } from '@/modulos/autenticacion/guardias/jwt-autenticacion.guardia';
import { RolesGuardia } from '@/modulos/autenticacion/guardias/roles.guardia';
import { Roles } from '@/modulos/autenticacion/guardias/roles.decorador';
import { PrestamoServicio } from '@/modulos/prestamo/prestamo.servicio';

@Controller('prestamos/carreras')
export class CarrerasControlador {
  constructor(private readonly prestamoServicio: PrestamoServicio) {}

  @Get()
  async obtenerCarreras() {
    return this.prestamoServicio.obtenerCarreras();
  }

  @Post()
  @UseGuards(JwtAutenticacionGuardia, RolesGuardia)
  @Roles('administrador')
  async crearCarrera(@Body() body: { nombre: string; prefijoCu: string; inventariosIds?: number[] }) {
    return this.prestamoServicio.crearCarrera(body);
  }

  @Put(':id')
  @UseGuards(JwtAutenticacionGuardia, RolesGuardia)
  @Roles('administrador')
  async editarCarrera(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Partial<{ nombre: string; prefijoCu: string; inventariosIds: number[] }>,
  ) {
    return this.prestamoServicio.editarCarrera(id, body);
  }

  @Delete(':id')
  @UseGuards(JwtAutenticacionGuardia, RolesGuardia)
  @Roles('administrador')
  async eliminarCarrera(@Param('id', ParseIntPipe) id: number) {
    await this.prestamoServicio.eliminarCarrera(id);
    return { ok: true };
  }
}
