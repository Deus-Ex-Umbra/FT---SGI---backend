import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContenedorMaterial } from './entidades/contenedor_material.entidad';
import { MaterialFungible } from './entidades/material_fungible.entidad';
import { LoteMaterial } from './entidades/lote_material.entidad';
import { MovimientoMaterial } from './entidades/movimiento_material.entidad';
import { MaterialServicio } from './material.servicio';
import { MaterialControlador } from './material.controlador';

@Module({
    imports: [TypeOrmModule.forFeature([ContenedorMaterial, MaterialFungible, LoteMaterial, MovimientoMaterial])],
    providers: [MaterialServicio],
    controllers: [MaterialControlador],
    exports: [MaterialServicio, TypeOrmModule],
})
export class MaterialModulo { }
