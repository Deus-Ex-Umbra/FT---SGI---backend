import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsuarioServicio } from '@/modulos/usuario/usuario.servicio';
import { InicioSesionDto } from './dto/inicio-sesion.dto';

@Injectable()
export class AutenticacionServicio {
    private readonly logger = new Logger(AutenticacionServicio.name);

    constructor(
        private readonly usuarioServicio: UsuarioServicio,
        private readonly jwtService: JwtService,
    ) { }

    async iniciarSesion(dto: InicioSesionDto) {
        this.logger.log(`Intento de inicio de sesión para el usuario: "${dto.nombre_usuario}"`);
        const usuario = await this.usuarioServicio.buscarPorNombreUsuario(dto.nombre_usuario);

        if (!usuario) {
            this.logger.warn(`Inicio de sesión fallido: El usuario "${dto.nombre_usuario}" no existe.`);
            throw new UnauthorizedException('Credenciales inválidas');
        }

        const contrasenaValida = await bcrypt.compare(dto.contrasena, usuario.contrasena);
        if (!contrasenaValida) {
            this.logger.warn(`Inicio de sesión fallido: Contraseña incorrecta para el usuario "${dto.nombre_usuario}".`);
            throw new UnauthorizedException('Credenciales inválidas');
        }

        this.logger.log(`Inicio de sesión exitoso para el usuario: "${dto.nombre_usuario}"`);

        const carga = { sub: usuario.id, nombre_usuario: usuario.nombre_usuario, rol: usuario.rol };
        return {
            token_acceso: this.jwtService.sign(carga),
            usuario: { id: usuario.id, nombre_usuario: usuario.nombre_usuario, rol: usuario.rol },
        };
    }
}
