import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivoFijo } from './activo_fijo.entidad';
import { ItemActivo } from './item_activo.entidad';
import { ContenedorActivo } from './contenedor_activo.entidad';
import { ActivoServicio } from './activo.servicio';
import { ActivoControlador } from './activo.controlador';

@Module({
    imports: [TypeOrmModule.forFeature([ContenedorActivo, ActivoFijo, ItemActivo])],
    providers: [ActivoServicio],
    controllers: [ActivoControlador],
    exports: [ActivoServicio, TypeOrmModule],
})
export class ActivoModulo { }
