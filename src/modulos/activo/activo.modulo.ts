import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivoFijo } from './entidades/activo-fijo.entidad';
import { ActivoFungible } from './entidades/activo-fungible.entidad';
import { ItemActivoFijo } from './entidades/item-activo-fijo.entidad';
import { ItemActivoFungible } from './entidades/item-activo-fungible.entidad';
import { ContenedorActivo } from '@/modulos/contenedor/entidades/contenedor-activo.entidad';
import { ActivoServicio } from './activo.servicio';
import { ActivoControlador } from './activo.controlador';

@Module({
    imports: [TypeOrmModule.forFeature([ContenedorActivo, ActivoFijo, ItemActivoFijo, ActivoFungible, ItemActivoFungible])],
    providers: [ActivoServicio],
    controllers: [ActivoControlador],
    exports: [ActivoServicio, TypeOrmModule],
})
export class ActivoModulo { }
