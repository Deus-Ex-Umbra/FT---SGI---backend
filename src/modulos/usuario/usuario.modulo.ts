import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from './entidades/usuario.entidad';
import { CarreraEntidad } from '@/modulos/prestamo/entidades/carrera.entidad';
import { InventarioEntidad } from '@/modulos/inventario/entidades/inventario.entidad';
import { DocenteEntidad } from '@/modulos/docente/entidades/docente.entidad';
import { EstudianteEntidad } from '@/modulos/estudiante/entidades/estudiante.entidad';
import { EncargadoInventarioEntidad } from '@/modulos/encargado-inventario/entidades/encargado-inventario.entidad';
import { UsuarioServicio } from './usuario.servicio';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Usuario,
            CarreraEntidad,
            InventarioEntidad,
            DocenteEntidad,
            EstudianteEntidad,
            EncargadoInventarioEntidad,
        ]),
    ],
    controllers: [],
    providers: [UsuarioServicio],
    exports: [UsuarioServicio],
})
export class UsuarioModulo { }
