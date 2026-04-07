import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAutenticacionGuardia } from '@/modulos/autenticacion/guardias/jwt-autenticacion.guardia';
import { Roles } from '@/modulos/autenticacion/guardias/roles.decorador';
import { RolesGuardia } from '@/modulos/autenticacion/guardias/roles.guardia';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { UsuarioServicio } from './usuario.servicio';

@Controller('usuarios')
export class UsuarioControlador {
    constructor(private readonly usuarioServicio: UsuarioServicio) {}

    @Get()
    @UseGuards(JwtAutenticacionGuardia, RolesGuardia)
    @Roles('administrador')
    async listarUsuarios() {
        return this.usuarioServicio.listarUsuarios();
    }

    @Post()
    @UseGuards(JwtAutenticacionGuardia, RolesGuardia)
    @Roles('administrador')
    async crearUsuario(@Body() dto: CrearUsuarioDto) {
        return this.usuarioServicio.crearUsuario(dto);
    }
}
