import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { ROLES_USUARIO, RolUsuario, Usuario } from './entidades/usuario.entidad';
import { CarreraEntidad } from '@/modulos/prestamo/entidades/carrera.entidad';
import { InventarioEntidad } from '@/modulos/inventario/entidades/inventario.entidad';
import { DocenteEntidad } from '@/modulos/docente/entidades/docente.entidad';
import { EstudianteEntidad } from '@/modulos/estudiante/entidades/estudiante.entidad';
import { EncargadoInventarioEntidad } from '@/modulos/encargado-inventario/entidades/encargado-inventario.entidad';

interface CrearUsuarioEntrada {
    correo?: string | null;
    contrasena: string;
    rol: RolUsuario;
    estado?: boolean;
}

export interface UsuarioPublico {
    id: number;
    correo: string;
    rol: RolUsuario;
    estado: boolean;
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

    private async hashContrasena(contrasena: string): Promise<string> {
        if (contrasena.trim().length < 6) {
            throw new BadRequestException('La contraseña debe tener al menos 6 caracteres.');
        }
        return bcrypt.hash(contrasena.trim(), 10);
    }

    public construirContrasenaTemporalPorDefecto(rol: RolUsuario): string {
        const hoy = new Date();
        const dia = String(hoy.getDate()).padStart(2, '0');
        const mes = String(hoy.getMonth() + 1).padStart(2, '0');
        const anio = String(hoy.getFullYear());
        const sufijo = rol === 'encargado_inventario' ? 'encargado' : rol;
        return `usfx-${dia}/${mes}/${anio}-${sufijo}`;
    }

    public construirContrasenaTemporalConFecha(rol: RolUsuario, fechaNacimiento: string | null | undefined): string {
        const sufijo = rol === 'encargado_inventario' ? 'encargado' : rol;
        if (fechaNacimiento) {
            const partes = fechaNacimiento.replace(/T.*$/, '').split('-');
            if (partes.length === 3) {
                const [anio, mes, dia] = partes;
                return `usfx-${dia}/${mes}/${anio}-${sufijo}`;
            }
        }
        return this.construirContrasenaTemporalPorDefecto(rol);
    }

    async ensureAdministrador(): Promise<void> {
        const correo =
            process.env.ADMIN_EMAIL?.trim().toLowerCase()
            || process.env.ADMIN_USERNAME?.trim()
            || 'admin@sgi.local';
        const contrasenaPlano = process.env.ADMIN_PASSWORD?.trim() || 'Admin@2026!';

        const existe = await this.repositorioUsuario.findOne({
            where: { correo },
        });
        if (existe) return;

        const contrasenaHash = await bcrypt.hash(contrasenaPlano, 10);
        const administradorLegacy = await this.repositorioUsuario.findOne({
            where: [
                { rol: 'administrador', correo: IsNull() },
                { rol: 'administrador', correo: '' },
            ],
            order: { id: 'ASC' },
        });

        if (administradorLegacy) {
            administradorLegacy.correo = correo;
            administradorLegacy.contrasena = contrasenaHash;
            administradorLegacy.estado = true;
            administradorLegacy.rol = 'administrador';
            await this.repositorioUsuario.save(administradorLegacy);
            return;
        }

        await this.repositorioUsuario.save({
            correo,
            contrasena: contrasenaHash,
            rol: 'administrador',
            estado: true,
        });
    }

    async buscarPorCorreo(correo: string): Promise<Usuario | null> {
        return this.repositorioUsuario.findOne({ where: { correo } });
    }

    async buscarPorId(id: number): Promise<Usuario | null> {
        return this.repositorioUsuario.findOne({ where: { id } });
    }

    async listarUsuarios(): Promise<Usuario[]> {
        return this.repositorioUsuario.find({ order: { id: 'ASC' } });
    }

    async crearUsuarioBase(entrada: CrearUsuarioEntrada): Promise<Usuario> {
        const correo = entrada.correo?.trim() || null;
        const rol = entrada.rol;

        if (rol !== 'estudiante' && !correo) throw new BadRequestException('El correo es obligatorio.');
        if (correo && !this.esCorreoValido(correo)) throw new BadRequestException('El formato del correo es inválido.');
        if (!this.esRolValido(rol)) throw new BadRequestException('Rol de usuario inválido.');

        if (correo) {
            const existe = await this.repositorioUsuario.findOne({ where: { correo } });
            if (existe) throw new ConflictException('Ya existe un usuario con ese correo.');
        }

        const contrasena = await this.hashContrasena(entrada.contrasena);
        
        return this.repositorioUsuario.save({ 
            correo, 
            contrasena, 
            rol,
            estado: entrada.estado !== undefined ? entrada.estado : true 
        });
    }

    async restablecerContrasenaUsuario(id: number): Promise<{ ok: true; message: string; contrasenaTemporal: string }> {
        const usuario = await this.repositorioUsuario.findOne({ where: { id } });
        if (!usuario) throw new NotFoundException('No se encontró el usuario.');

        const contrasenaTemporal = this.construirContrasenaTemporalPorDefecto(usuario.rol);
        usuario.contrasena = await bcrypt.hash(contrasenaTemporal, 10);
        await this.repositorioUsuario.save(usuario);

        return {
            ok: true,
            message: `Contraseña restablecida para ${usuario.correo}.`,
            contrasenaTemporal,
        };
    }

    async cambiarEstadoUsuario(id: number, estado: boolean): Promise<{ ok: true; message: string }> {
        const usuario = await this.repositorioUsuario.findOne({ where: { id } });
        if (!usuario) throw new NotFoundException('No se encontró el usuario.');

        usuario.estado = estado;
        await this.repositorioUsuario.save(usuario);

        return {
            ok: true,
            message: `Usuario ${usuario.correo} ${estado ? 'habilitado' : 'inhabilitado'}.`,
        };
    }

    async actualizarCorreo(id: number, correo: string | null): Promise<void> {
        const usuario = await this.repositorioUsuario.findOne({ where: { id } });
        if (!usuario) throw new NotFoundException('No se encontró el usuario.');
        usuario.correo = correo ? correo.trim().toLowerCase() : null;
        await this.repositorioUsuario.save(usuario);
    }

    async cambiarContrasena(usuarioId: number, contrasenaActual: string, nuevaContrasena: string): Promise<{ ok: boolean; message: string }> {
        const usuario = await this.repositorioUsuario.findOne({ where: { id: usuarioId } });
        if (!usuario) throw new NotFoundException('No se encontró el usuario.');

        const contrasenaValida = await bcrypt.compare(contrasenaActual, usuario.contrasena);
        if (!contrasenaValida) {
            throw new BadRequestException('La contraseña actual es incorrecta.');
        }

        if (nuevaContrasena.trim().length < 6) {
            throw new BadRequestException('La nueva contraseña debe tener al menos 6 caracteres.');
        }

        usuario.contrasena = await bcrypt.hash(nuevaContrasena.trim(), 10);
        await this.repositorioUsuario.save(usuario);

        return {
            ok: true,
            message: 'Contraseña actualizada correctamente.',
        };
    }
}
