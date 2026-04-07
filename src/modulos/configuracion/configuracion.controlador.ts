import { Body, Controller, Get, Put, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAutenticacionGuardia } from '@/modulos/autenticacion/guardias/jwt-autenticacion.guardia';
import { ConfiguracionServicio } from './configuracion.servicio';
import { ActualizarConfiguracionIADto } from './dto/actualizar-configuracion-ia.dto';

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
}
