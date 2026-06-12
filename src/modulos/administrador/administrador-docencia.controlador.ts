import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAutenticacionGuardia } from '@/modulos/autenticacion/guardias/jwt-autenticacion.guardia';
import { RolesGuardia } from '@/modulos/autenticacion/guardias/roles.guardia';
import { Roles } from '@/modulos/autenticacion/guardias/roles.decorador';
import { DocenciaServicio } from '@/modulos/docencia/docencia.servicio';
import { CrearGrupoAdminDto } from '@/modulos/docencia/dto/crear-grupo-admin.dto';

@Controller('administrador/docencia')
@UseGuards(JwtAutenticacionGuardia, RolesGuardia)
@Roles('administrador')
export class AdministradorDocenciaControlador {
  constructor(private readonly servicioDocencia: DocenciaServicio) {}

  @Post('grupos')
  async crearGrupo(@Request() req: any, @Body() dto: CrearGrupoAdminDto) {
    return await this.servicioDocencia.crearGrupoPorAdmin(req.user.id, dto);
  }

  @Get('solicitudes-grupo')
  async listarSolicitudesGrupo(
    @Query('estado') estado?: 'pendiente' | 'aprobado' | 'rechazado',
  ) {
    return await this.servicioDocencia.listarSolicitudesGrupo(
      estado ?? 'pendiente',
    );
  }

  @Post('solicitudes-grupo/:id/aprobar')
  async aprobarSolicitudGrupo(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return await this.servicioDocencia.aprobarSolicitudGrupo(req.user.id, id);
  }

  @Post('solicitudes-grupo/:id/rechazar')
  async rechazarSolicitudGrupo(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { motivo?: string | null },
  ) {
    return await this.servicioDocencia.rechazarSolicitudGrupo(
      req.user.id,
      id,
      body?.motivo,
    );
  }
}
