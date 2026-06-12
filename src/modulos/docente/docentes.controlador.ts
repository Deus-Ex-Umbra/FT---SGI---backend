import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAutenticacionGuardia } from '@/modulos/autenticacion/guardias/jwt-autenticacion.guardia';
import { RolesGuardia } from '@/modulos/autenticacion/guardias/roles.guardia';
import { Roles } from '@/modulos/autenticacion/guardias/roles.decorador';
import { DocenteServicio } from './docente.servicio';
import { CrearDocenteDto } from './dto/crear-docente.dto';
import { EditarDocenteDto } from './dto/editar-docente.dto';

@Controller('prestamos/docentes')
export class DocentesControlador {
  constructor(private readonly docenteServicio: DocenteServicio) {}

  @Get()
  async obtenerDocentes() {
    return this.docenteServicio.listarDocentes();
  }

  @Post()
  @UseGuards(JwtAutenticacionGuardia, RolesGuardia)
  @Roles('administrador')
  async crearDocente(@Body() dto: CrearDocenteDto) {
    return this.docenteServicio.crearDocente(dto);
  }

  @Put(':id')
  @UseGuards(JwtAutenticacionGuardia, RolesGuardia)
  @Roles('administrador')
  async editarDocente(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EditarDocenteDto,
  ) {
    return this.docenteServicio.editarDocente(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAutenticacionGuardia, RolesGuardia)
  @Roles('administrador')
  async eliminarDocente(@Param('id', ParseIntPipe) id: number) {
    await this.docenteServicio.eliminarDocente(id);
    return { ok: true };
  }
}
