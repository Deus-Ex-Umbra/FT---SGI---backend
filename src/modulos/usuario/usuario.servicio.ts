import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ROLES_USUARIO, RolUsuario, Usuario } from './entidades/usuario.entidad';

interface CrearUsuarioEntrada {
    nombre_usuario: string;
    contrasena: string;
    rol: RolUsuario;
}

export interface UsuarioPublico {
    id: number;
    nombre_usuario: string;
    rol: RolUsuario;
}

@Injectable()
export class UsuarioServicio {
    constructor(
        @InjectRepository(Usuario)
        private readonly repositorioUsuario: Repository<Usuario>,
    ) { }

    private esRolValido(rol: string): rol is RolUsuario {
        return (ROLES_USUARIO as readonly string[]).includes(rol);
    }

    private esCorreoValido(correo: string): boolean {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
    }

    private serializarUsuario(usuario: Usuario): UsuarioPublico {
        return {
            id: usuario.id,
            nombre_usuario: usuario.nombre_usuario,
            rol: usuario.rol,
        };
    }

    async ensureAdministrador(): Promise<void> {
        const nombreUsuario =
            process.env.ADMIN_EMAIL?.trim()
            || process.env.ADMIN_USERNAME?.trim()
            || 'admin@sgi.local';
        const contrasenaPlano = process.env.ADMIN_PASSWORD?.trim() || 'Admin@2026!';

        const existe = await this.repositorioUsuario.findOne({
            where: { nombre_usuario: nombreUsuario },
        });
        if (existe) return;

        const contrasenaHash = await bcrypt.hash(contrasenaPlano, 10);
        await this.repositorioUsuario.save({
            nombre_usuario: nombreUsuario,
            contrasena: contrasenaHash,
            rol: 'administrador',
        });
    }

    async buscarPorNombreUsuario(nombre_usuario: string): Promise<Usuario | null> {
        return this.repositorioUsuario.findOne({ where: { nombre_usuario } });
    }

    async listarUsuarios(): Promise<UsuarioPublico[]> {
        const usuarios = await this.repositorioUsuario.find({
            order: { id: 'ASC' },
        });
        return usuarios.map((usuario) => this.serializarUsuario(usuario));
    }

    async crearUsuario(entrada: CrearUsuarioEntrada): Promise<UsuarioPublico> {
        const nombre_usuario = entrada.nombre_usuario.trim();
        const rol = entrada.rol;

        if (!nombre_usuario) {
            throw new BadRequestException('El nombre de usuario es obligatorio.');
        }

        if (!this.esCorreoValido(nombre_usuario)) {
            throw new BadRequestException('El usuario debe tener formato de correo electrónico.');
        }

        if (!entrada.contrasena?.trim() || entrada.contrasena.length < 6) {
            throw new BadRequestException('La contraseña debe tener al menos 6 caracteres.');
        }

        if (!this.esRolValido(rol)) {
            throw new BadRequestException('Rol de usuario inválido.');
        }

        const existe = await this.repositorioUsuario.findOne({
            where: { nombre_usuario },
        });
        if (existe) {
            throw new ConflictException('Ya existe un usuario con ese nombre.');
        }

        const contrasena = await bcrypt.hash(entrada.contrasena, 10);
        const creado = await this.repositorioUsuario.save({
            nombre_usuario,
            contrasena,
            rol,
        });

        return this.serializarUsuario(creado);
    }
}
