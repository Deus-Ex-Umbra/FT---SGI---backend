import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportesControlador } from './reportes.controlador';
import { ReportesServicio } from './reportes.servicio';
import { ReporteEntidad } from './entidades/reporte.entidad';
import { Usuario } from '@/modulos/usuario/entidades/usuario.entidad';
import { PrestamoEntidad } from '@/modulos/prestamo/entidades/prestamo.entidad';
import { ItemActivoFijo } from '@/modulos/activo/entidades/item-activo-fijo.entidad';
import { LoteMaterial } from '@/modulos/material/entidades/lote_material.entidad';
import { MovimientoMaterial } from '@/modulos/material/entidades/movimiento_material.entidad';
import { MaterialFungible } from '@/modulos/material/entidades/material_fungible.entidad';
import { GeminiModulo } from '@/modulos/gemini/gemini.modulo';
import { PdfModulo } from '@/modulos/pdf/pdf.modulo';
import { ReportePdfEntidad } from './entidades/reporte-pdf.entidad';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReporteEntidad,
      ReportePdfEntidad,
      Usuario,
      PrestamoEntidad,
      ItemActivoFijo,
      MaterialFungible,
      LoteMaterial,
      MovimientoMaterial,
    ]),
    GeminiModulo,
    PdfModulo,
  ],
  providers: [ReportesServicio],
  controllers: [ReportesControlador],
})
export class ReportesModulo {}
