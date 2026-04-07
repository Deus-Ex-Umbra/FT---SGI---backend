import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContenedorActivo } from './entidades/contenedor-activo.entidad';
import { ContenedorMaterial } from '@/modulos/material/entidades/contenedor_material.entidad';
import { ContenedorCompartidoServicio } from './contenedor.servicio';
import { ContenedorCompartidoControlador } from './contenedor.controlador';

@Module({
    imports: [TypeOrmModule.forFeature([ContenedorActivo, ContenedorMaterial])],
    providers: [ContenedorCompartidoServicio],
    controllers: [ContenedorCompartidoControlador],
    exports: [ContenedorCompartidoServicio],
})
export class ContenedorModulo {}