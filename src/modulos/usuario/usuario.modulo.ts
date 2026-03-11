import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from './usuario.entidad';
import { UsuarioServicio } from './usuario.servicio';

@Module({
    imports: [TypeOrmModule.forFeature([Usuario])],
    providers: [UsuarioServicio],
    exports: [UsuarioServicio],
})
export class UsuarioModulo { }
