import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivoFijo } from './entidades/activo-fijo.entidad';
import { ActivoFungible } from './entidades/activo-fungible.entidad';
import { ItemActivoFijo } from './entidades/item-activo-fijo.entidad';
import { ItemActivoFungible } from './entidades/item-activo-fungible.entidad';
import { ContenedorActivo } from '@/modulos/contenedor/entidades/contenedor-activo.entidad';
import { ActivoServicio } from './activo.servicio';
import { ActivoContenedorServicio } from './activo-contenedor.servicio';
import { ActivoFungibleServicio } from './activo-fungible.servicio';
import { ActivoFijoServicio } from './activo-fijo.servicio';
import { ActivoControlador } from './activo.controlador';
import { Usuario } from '@/modulos/usuario/entidades/usuario.entidad';
import { InventarioEntidad } from '@/modulos/inventario/entidades/inventario.entidad';

@Module({
    imports: [TypeOrmModule.forFeature([ContenedorActivo, ActivoFijo, ItemActivoFijo, ActivoFungible, ItemActivoFungible, Usuario, InventarioEntidad])],
    providers: [ActivoServicio, ActivoContenedorServicio, ActivoFungibleServicio, ActivoFijoServicio],
    controllers: [ActivoControlador],
    exports: [ActivoServicio, ActivoContenedorServicio, ActivoFungibleServicio, ActivoFijoServicio, TypeOrmModule],
})
export class ActivoModulo { }
