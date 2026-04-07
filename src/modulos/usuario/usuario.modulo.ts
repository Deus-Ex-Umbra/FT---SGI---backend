import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from './entidades/usuario.entidad';
import { UsuarioServicio } from './usuario.servicio';
import { UsuarioControlador } from './usuario.controlador';
import { JwtAutenticacionGuardia } from '@/modulos/autenticacion/guardias/jwt-autenticacion.guardia';
import { RolesGuardia } from '@/modulos/autenticacion/guardias/roles.guardia';

@Module({
    imports: [TypeOrmModule.forFeature([Usuario])],
    controllers: [UsuarioControlador],
    providers: [UsuarioServicio, JwtAutenticacionGuardia, RolesGuardia],
    exports: [UsuarioServicio],
})
export class UsuarioModulo { }
