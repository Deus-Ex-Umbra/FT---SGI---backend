import { Body, Controller, Get, Put, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAutenticacionGuardia } from '@/modulos/autenticacion/guardias/jwt-autenticacion.guardia';
import { Roles } from '@/modulos/autenticacion/guardias/roles.decorador';
import { RolesGuardia } from '@/modulos/autenticacion/guardias/roles.guardia';
import { ConfiguracionServicio } from './configuracion.servicio';
import { ActualizarConfiguracionIADto } from './dto/actualizar-configuracion-ia.dto';
import { ActualizarConfiguracionRegistroEstudianteDto } from './dto/actualizar-configuracion-registro-estudiante.dto';

@ApiTags('Configuracion')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAutenticacionGuardia)
@Controller('configuracion')
export class ConfiguracionControlador {
  constructor(private readonly servicio: ConfiguracionServicio) {}

  @Get('ia')
  @ApiOperation({ summary: 'Obtener configuración IA del usuario' })
  async obtenerIA(@Request() req: any) {
    const cfg = await this.servicio.obtenerIA(req.user.id);
    return {
      geminiApiUrl: cfg.geminiApiUrl,
      geminiApiKeyConfigurada: Boolean(cfg.geminiApiKey),
    };
  }

  @Put('ia')
  @ApiOperation({ summary: 'Actualizar configuración IA del usuario' })
  async actualizarIA(@Request() req: any, @Body() dto: ActualizarConfiguracionIADto) {
    return await this.servicio.actualizarIA(req.user.id, dto);
  }

  @Get('registro-estudiante')
  @UseGuards(RolesGuardia)
  @Roles('administrador')
  @ApiOperation({ summary: 'Obtener estado de habilitación del registro de estudiantes' })
  async obtenerRegistroEstudiante() {
    return await this.servicio.obtenerRegistroEstudiante();
  }

  @Put('registro-estudiante')
  @UseGuards(RolesGuardia)
  @Roles('administrador')
  @ApiOperation({ summary: 'Habilitar o deshabilitar el registro público de estudiantes' })
  async actualizarRegistroEstudiante(@Body() dto: ActualizarConfiguracionRegistroEstudianteDto) {
    return await this.servicio.actualizarRegistroEstudiante(dto.habilitado);
  }
}
