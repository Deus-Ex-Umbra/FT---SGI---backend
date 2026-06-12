import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContenedorActivo } from './entidades/contenedor-activo.entidad';
import { Usuario } from '@/modulos/usuario/entidades/usuario.entidad';
import { InventarioEntidad } from '@/modulos/inventario/entidades/inventario.entidad';
import { ContenedorCompartidoServicio } from './contenedor.servicio';
import { ContenedorCompartidoControlador } from './contenedor.controlador';

@Module({
    imports: [TypeOrmModule.forFeature([ContenedorActivo, Usuario, InventarioEntidad])],
    providers: [ContenedorCompartidoServicio],
    controllers: [ContenedorCompartidoControlador],
    exports: [ContenedorCompartidoServicio],
})
export class ContenedorModulo {}