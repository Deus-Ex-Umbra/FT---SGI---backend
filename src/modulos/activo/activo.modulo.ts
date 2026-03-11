import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivoFijo } from './activo_fijo.entidad';
import { ItemActivo } from './item_activo.entidad';
import { ActivoServicio } from './activo.servicio';
import { ActivoControlador } from './activo.controlador';
import { AuditoriaModulo } from '../auditoria/auditoria.modulo';

@Module({
    imports: [TypeOrmModule.forFeature([ActivoFijo, ItemActivo]), AuditoriaModulo],
    providers: [ActivoServicio],
    controllers: [ActivoControlador],
    exports: [ActivoServicio, TypeOrmModule],
})
export class ActivoModulo { }
