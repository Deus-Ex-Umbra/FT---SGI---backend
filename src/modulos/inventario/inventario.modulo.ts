import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventarioControlador } from './inventario.controlador';
import { InventarioServicio } from './inventario.servicio';
import { InventarioEntidad } from './entidades/inventario.entidad';
import { Usuario } from '@/modulos/usuario/entidades/usuario.entidad';
import { EncargadoInventarioEntidad } from '@/modulos/encargado-inventario/entidades/encargado-inventario.entidad';
import { ActivoFijo } from '@/modulos/activo/entidades/activo-fijo.entidad';
import { ActivoFungible } from '@/modulos/activo/entidades/activo-fungible.entidad';
import { ContenedorActivo } from '@/modulos/contenedor/entidades/contenedor-activo.entidad';

@Module({
    imports: [TypeOrmModule.forFeature([InventarioEntidad, Usuario, EncargadoInventarioEntidad, ActivoFijo, ActivoFungible, ContenedorActivo])],
    controllers: [InventarioControlador],
    providers: [InventarioServicio],
    exports: [InventarioServicio, TypeOrmModule],
})
export class InventarioModulo {}
