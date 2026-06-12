import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAutenticacionGuardia } from '@/modulos/autenticacion/guardias/jwt-autenticacion.guardia';
import { RolesGuardia } from '@/modulos/autenticacion/guardias/roles.guardia';
import { Roles } from '@/modulos/autenticacion/guardias/roles.decorador';
import { PrestamoServicio } from '@/modulos/prestamo/prestamo.servicio';

@Controller('prestamos/materias')
export class MateriasControlador {
  constructor(private readonly prestamoServicio: PrestamoServicio) {}

  @Get()
  async obtenerMaterias() {
    return this.prestamoServicio.obtenerMaterias();
  }

  @Post()
  @UseGuards(JwtAutenticacionGuardia, RolesGuardia)
  @Roles('administrador')
  async crearMateria(
    @Body()
    body: {
      codigo: string;
      nombre?: string;
      descripcion?: string | null;
      carrerasIds?: Array<string | number>;
      docentesIds?: Array<string | number>;
    },
  ) {
    return this.prestamoServicio.crearMateria(body);
  }

  @Put(':id')
  @UseGuards(JwtAutenticacionGuardia, RolesGuardia)
  @Roles('administrador')
  async editarMateria(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: Partial<{
      codigo: string;
      nombre: string;
      descripcion: string | null;
      carrerasIds: Array<string | number>;
      docentesIds: Array<string | number>;
    }>,
  ) {
    return this.prestamoServicio.editarMateria(id, body);
  }

  @Delete(':id')
  @UseGuards(JwtAutenticacionGuardia, RolesGuardia)
  @Roles('administrador')
  async eliminarMateria(@Param('id', ParseIntPipe) id: number) {
    await this.prestamoServicio.eliminarMateria(id);
    return { ok: true };
  }
}
