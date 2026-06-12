import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportesControlador } from './reportes.controlador';
import { ReportesServicio } from './reportes.servicio';
import { ReportesCrudServicio } from './reportes-crud.servicio';
import { ReportesGeneradorServicio } from './reportes-generador.servicio';
import { ReporteEntidad } from './entidades/reporte.entidad';
import { Usuario } from '@/modulos/usuario/entidades/usuario.entidad';
import { PrestamoEntidad } from '@/modulos/prestamo/entidades/prestamo.entidad';
import { ItemActivoFijo } from '@/modulos/activo/entidades/item-activo-fijo.entidad';
import { ActivoFungible } from '@/modulos/activo/entidades/activo-fungible.entidad';
import { ItemActivoFungible } from '@/modulos/activo/entidades/item-activo-fungible.entidad';
import { GeminiModulo } from '@/modulos/gemini/gemini.modulo';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReporteEntidad,
      Usuario,
      PrestamoEntidad,
      ItemActivoFijo,
      ActivoFungible,
      ItemActivoFungible,
    ]),
    GeminiModulo,
  ],
  providers: [ReportesServicio, ReportesCrudServicio, ReportesGeneradorServicio],
  controllers: [ReportesControlador],
})
export class ReportesModulo {}
