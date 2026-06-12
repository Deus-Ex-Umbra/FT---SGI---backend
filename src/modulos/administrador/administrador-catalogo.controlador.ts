import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAutenticacionGuardia } from '@/modulos/autenticacion/guardias/jwt-autenticacion.guardia';
import { RolesGuardia } from '@/modulos/autenticacion/guardias/roles.guardia';
import { Roles } from '@/modulos/autenticacion/guardias/roles.decorador';
import { PrestamoServicio } from '@/modulos/prestamo/prestamo.servicio';

@Controller('administrador/catalogo')
@UseGuards(JwtAutenticacionGuardia, RolesGuardia)
@Roles('administrador')
export class AdministradorCatalogoControlador {
  constructor(private readonly prestamoServicio: PrestamoServicio) {}

  @Get('materias')
  async obtenerMaterias() {
    return this.prestamoServicio.obtenerMaterias();
  }

  @Post('materias')
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

  @Put('materias/:id')
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

  @Delete('materias/:id')
  async eliminarMateria(@Param('id', ParseIntPipe) id: number) {
    await this.prestamoServicio.eliminarMateria(id);
    return { ok: true };
  }

  @Get('carreras')
  async obtenerCarreras() {
    return this.prestamoServicio.obtenerCarreras();
  }

  @Post('carreras')
  async crearCarrera(@Body() body: { nombre: string; prefijoCu: string }) {
    return this.prestamoServicio.crearCarrera(body);
  }

  @Put('carreras/:id')
  async editarCarrera(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Partial<{ nombre: string; prefijoCu: string }>,
  ) {
    return this.prestamoServicio.editarCarrera(id, body);
  }

  @Delete('carreras/:id')
  async eliminarCarrera(@Param('id', ParseIntPipe) id: number) {
    await this.prestamoServicio.eliminarCarrera(id);
    return { ok: true };
  }
}
