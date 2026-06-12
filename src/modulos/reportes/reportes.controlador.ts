import { Body, Controller, Delete, Get, Param, Post, Put, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAutenticacionGuardia } from '@/modulos/autenticacion/guardias/jwt-autenticacion.guardia';
import { ReportesServicio } from './reportes.servicio';
import { GenerarPreReporteDto } from './dto/generar-pre-reporte.dto';
import { CrearReporteDto } from './dto/crear-reporte.dto';
import { ActualizarReporteDto } from './dto/actualizar-reporte.dto';
import { ObtenerDatosReporteDto } from './dto/obtener-datos-reporte.dto';

@ApiTags('Reportes')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAutenticacionGuardia)
@Controller('reportes')
export class ReportesControlador {
  constructor(private readonly servicio: ReportesServicio) {}

  @Post()
  @ApiOperation({ summary: 'Crear reporte (blanco o pre-creado)' })
  async crear(@Request() req: any, @Body() dto: CrearReporteDto) {
    return await this.servicio.crear(req.user.id, dto);
  }

  @Post('ia')
  @ApiOperation({ summary: 'Generar pre-reporte con IA (HTML) por intervalo' })
  async generarIA(@Request() req: any, @Body() dto: GenerarPreReporteDto) {
    return await this.servicio.generarPreReporte(req.user.id, dto);
  }

  @Post('datos')
  @ApiOperation({ summary: 'Obtener datos completos (JSON) para un reporte pre-creado' })
  async datos(@Request() req: any, @Body() dto: ObtenerDatosReporteDto) {
    return await this.servicio.obtenerDatosPreCreado(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar reportes guardados' })
  async listar(@Request() req: any) {
    return await this.servicio.listar(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener reporte (incluye HTML)' })
  async obtener(@Request() req: any, @Param('id') id: string) {
    const rep = await this.servicio.obtener(req.user.id, Number(id));
    return rep;
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar reporte (título/HTML/fechas)' })
  async actualizar(@Request() req: any, @Param('id') id: string, @Body() dto: ActualizarReporteDto) {
    return await this.servicio.actualizar(req.user.id, Number(id), dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar reporte' })
  async eliminar(@Request() req: any, @Param('id') id: string) {
    return await this.servicio.eliminar(req.user.id, Number(id));
  }

}
