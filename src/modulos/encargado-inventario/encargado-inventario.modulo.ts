import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EncargadoInventarioEntidad } from './entidades/encargado-inventario.entidad';
import { EncargadoInventarioServicio } from './encargado-inventario.servicio';
import { UsuarioModulo } from '@/modulos/usuario/usuario.modulo';
import { InventarioEntidad } from '@/modulos/inventario/entidades/inventario.entidad';

@Module({
  imports: [
    TypeOrmModule.forFeature([EncargadoInventarioEntidad, InventarioEntidad]),
    UsuarioModulo,
  ],
  controllers: [],
  providers: [EncargadoInventarioServicio],
  exports: [EncargadoInventarioServicio],
})
export class EncargadoInventarioModulo {}
