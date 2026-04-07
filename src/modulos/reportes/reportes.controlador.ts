import { Body, Controller, Delete, Get, Param, Post, Put, Request, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAutenticacionGuardia } from '@/modulos/autenticacion/guardias/jwt-autenticacion.guardia';
import type { Response } from 'express';
import { ReportesServicio } from './reportes.servicio';
import { GenerarPreReporteDto } from './dto/generar-pre-reporte.dto';
import { ConvertirHtmlAPdfDto } from './dto/convertir-a-pdf.dto';
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

  @Post('pdf')
  @ApiOperation({ summary: 'Convertir HTML a PDF (descarga)' })
  async convertirPdf(@Body() dto: ConvertirHtmlAPdfDto, @Res() res: Response) {
    const pdf = await this.servicio.convertirHtmlAPdfBuffer(dto.html, dto.config);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="reporte.pdf"');
    res.send(pdf);
  }

  @Post(':id/pdf')
  @ApiOperation({ summary: 'Generar PDF desde un reporte guardado, registrar y descargar' })
  async generarPdfDesdeReporte(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { config: any },
    @Res() res: Response,
  ) {
    const resultado = await this.servicio.generarPdfDesdeReporte(req.user.id, Number(id), body?.config);
    if (!resultado) {
      res.status(404).json({ message: 'Reporte no encontrado' });
      return;
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${resultado.filename}"`);
    res.send(resultado.pdfBuffer);
  }

  @Get('pdf/lista')
  @ApiOperation({ summary: 'Listar PDFs generados (registro)' })
  async listarPdfs(@Request() req: any) {
    return await this.servicio.listarPdfs(req.user.id);
  }

  @Get('pdf/:pdfId/descargar')
  @ApiOperation({ summary: 'Descargar un PDF generado por su id' })
  async descargarPdf(@Request() req: any, @Param('pdfId') pdfId: string, @Res() res: Response) {
    const pdf = await this.servicio.obtenerPdfParaDescarga(req.user.id, Number(pdfId));
    if (!pdf) {
      res.status(404).json({ message: 'PDF no encontrado' });
      return;
    }
    res.setHeader('Content-Type', pdf.mime);
    res.setHeader('Content-Disposition', `attachment; filename="${pdf.filename}"`);
    res.send(pdf.buffer);
  }
}
