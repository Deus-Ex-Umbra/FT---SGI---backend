import { Injectable, UnauthorizedException, Logger, BadRequestException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsuarioServicio } from '@/modulos/usuario/usuario.servicio';
import { ConfiguracionServicio } from '@/modulos/configuracion/configuracion.servicio';
import { EnlaceFirmadoServicio } from '@/modulos/enlace-firmado/enlace-firmado.servicio';
import { InicioSesionDto } from './dto/inicio-sesion.dto';
import { CambiarContrasenaDto } from './dto/cambiar-contrasena.dto';
import { CambiarCorreoDto } from './dto/cambiar-correo.dto';
import { CrearEstudianteDto } from '@/modulos/estudiante/dto/crear-estudiante.dto';
import { CrearDocenteDto } from '@/modulos/docente/dto/crear-docente.dto';

import { DocenteServicio } from '@/modulos/docente/docente.servicio';
import { EstudianteServicio } from '@/modulos/estudiante/estudiante.servicio';
import { EncargadoInventarioServicio } from '@/modulos/encargado-inventario/encargado-inventario.servicio';

@Injectable()
export class AutenticacionServicio {
    private readonly logger = new Logger(AutenticacionServicio.name);

    constructor(
        private readonly usuarioServicio: UsuarioServicio,
        private readonly docenteServicio: DocenteServicio,
        private readonly estudianteServicio: EstudianteServicio,
        private readonly encargadoServicio: EncargadoInventarioServicio,
        private readonly configuracionServicio: ConfiguracionServicio,
        private readonly enlaceFirmadoServicio: EnlaceFirmadoServicio,
        private readonly jwtService: JwtService,
    ) { }

    private construirUsuarioSesion(usuario: { id: number; correo: string | null; rol: string; estado: boolean }, perfil: any) {
        return {
            id: usuario.id,
            correo: usuario.correo,
            rol: usuario.rol,
            estado: usuario.estado,
            id_inventario: perfil?.id_inventario ?? null,
            puedeEditarFijos: perfil?.puedeEditarFijos ?? false,
            puedeEditarFungibles: perfil?.puedeEditarFungibles ?? false,
            inventario: perfil?.inventario ?? null,
        };
    }

    async iniciarSesion(dto: InicioSesionDto) {
        const identificador = String(dto.identificador ?? '').trim();
        this.logger.log(`Intento de inicio de sesión para: "${identificador}"`);
        
        let usuario: any = null;

        if (identificador.includes('@')) {
            usuario = await this.usuarioServicio.buscarPorCorreo(identificador.toLowerCase());
        } else {
            const estudiante = await this.estudianteServicio.buscarPorIdentificador(identificador);
            if (estudiante && estudiante.usuario) {
                usuario = estudiante.usuario;
            }
        }

        if (!usuario) {
            this.logger.warn(`Inicio de sesión fallido: El usuario "${identificador}" no existe.`);
            throw new UnauthorizedException('Credenciales inválidas');
        }

        const contrasenaValida = await bcrypt.compare(dto.contrasena, usuario.contrasena);
        if (!contrasenaValida) {
            this.logger.warn(`Inicio de sesión fallido: Contraseña incorrecta para el usuario "${identificador}".`);
            throw new UnauthorizedException('Credenciales inválidas');
        }

        if (usuario.estado === false) {
            if (usuario.rol === 'estudiante') {
                const estudiante = await this.estudianteServicio.buscarPorIdUsuario(usuario.id).catch(() => null);
                if (estudiante) {
                    if (estudiante.estadoAprobacion === 'pendiente') {
                        throw new UnauthorizedException('Tu registro está pendiente de aprobación por el encargado de inventario.');
                    }
                    if (estudiante.estadoAprobacion === 'rechazado') {
                        throw new UnauthorizedException('Tu solicitud de registro ha sido rechazada.');
                    }
                }
            }
            if (usuario.rol === 'docente') {
                const docente = await this.docenteServicio.buscarPorIdUsuario(usuario.id).catch(() => null);
                if (docente) {
                    if (docente.estadoAprobacion === 'pendiente') {
                        throw new UnauthorizedException('Tu registro está pendiente de aprobación por el encargado de inventario.');
                    }
                    if (docente.estadoAprobacion === 'rechazado') {
                        throw new UnauthorizedException('Tu solicitud de registro ha sido rechazada.');
                    }
                }
            }
            this.logger.warn(`Inicio de sesión fallido: El usuario "${identificador}" está inhabilitado.`);
            throw new UnauthorizedException('Cuenta inhabilitada, comuníquese con el administrador.');
        }
        this.logger.log(`Inicio de sesión exitoso para: "${identificador}"`);
        const perfil = await this.obtenerPerfilUsuarioActual(usuario.id);

        const carga = {
            sub: usuario.id,
            correo: usuario.correo,
            rol: usuario.rol,
            id_inventario: (perfil as any)?.id_inventario ?? null,
            puedeEditarFijos: (perfil as any)?.puedeEditarFijos ?? false,
            puedeEditarFungibles: (perfil as any)?.puedeEditarFungibles ?? false,
        };
        return {
            token_acceso: this.jwtService.sign(carga),
            usuario: this.construirUsuarioSesion(usuario, perfil),
        };
    }



    async obtenerPerfilUsuarioActual(usuarioId: number) {
        const usuario = await this.usuarioServicio.buscarPorId(usuarioId);
        if (!usuario) throw new UnauthorizedException('No se encontró el usuario.');

        if (usuario.rol === 'docente') {
            return this.docenteServicio.buscarPorIdUsuario(usuarioId);
        }
        if (usuario.rol === 'estudiante') {
            return this.estudianteServicio.buscarPorIdUsuario(usuarioId);
        }
        if (usuario.rol === 'encargado_inventario') {
            return this.encargadoServicio.obtenerPerfilEncargado(usuarioId);
        }
        
        return {
            id: usuario.id,
            correo: usuario.correo,
            rol: usuario.rol,
            estado: usuario.estado,
        };
    }

    async generarUrlFirmadaRegistroEstudiante(creadoPorUsuarioId?: number) {
        const estado = await this.configuracionServicio.obtenerRegistroEstudiante();
        if (!estado.habilitado) {
            return {
                ok: false,
                message: 'El registro público de estudiantes está deshabilitado.',
            };
        }

        const invitacion = await this.enlaceFirmadoServicio.habilitarInvitacionRegistro(creadoPorUsuarioId);

        return {
            ok: true,
            ...invitacion,
        };
    }

    async obtenerUrlFirmadaRegistroEstudianteActiva() {
        const estado = await this.configuracionServicio.obtenerRegistroEstudiante();
        if (!estado.habilitado) {
            return {
                ok: false,
                message: 'El registro público de estudiantes está deshabilitado.',
            };
        }

        const invitacion = await this.enlaceFirmadoServicio.obtenerInvitacionRegistroActiva();
        if (!invitacion) {
            return {
                ok: false,
                message: 'No hay un enlace de registro activo.',
            };
        }

        return {
            ok: true,
            ...invitacion,
        };
    }

    async deshabilitarUrlFirmadaRegistroEstudiante() {
        await this.enlaceFirmadoServicio.deshabilitarInvitacionRegistro();

        return {
            ok: true,
            message: 'La invitación de registro fue deshabilitada.',
        };
    }

    async verificarRegistroEstudianteConEnlaceFirmado(
        firma: { eid: string; exp: string; nonce: string; sig: string },
    ) {
        const estado = await this.configuracionServicio.obtenerRegistroEstudiante();
        if (!estado.habilitado) {
            return {
                ok: false,
                message: 'El registro público de estudiantes está deshabilitado.',
            };
        }

        const validacion = await this.enlaceFirmadoServicio.validarInvitacionFirmada(
            {
                eid: String(firma.eid ?? ''),
                exp: String(firma.exp ?? ''),
                nonce: String(firma.nonce ?? ''),
                sig: String(firma.sig ?? ''),
                tipo: 'registro_estudiante',
                permiso: 'registro_estudiante_publico',
                recursoId: null,
            },
            { registrarUso: false },
        );

        if (!validacion.ok) {
            return {
                ok: false,
                message: validacion.message ?? 'El enlace de registro no está disponible.',
            };
        }

        return {
            ok: true,
            message: 'Enlace válido.',
        };
    }

    async registrarEstudianteConEnlaceFirmado(
        dto: CrearEstudianteDto,
        firma: { eid: string; exp: string; nonce: string; sig: string },
    ) {
        const estado = await this.configuracionServicio.obtenerRegistroEstudiante();
        if (!estado.habilitado) {
            return {
                ok: false,
                message: 'El registro público de estudiantes está deshabilitado.',
            };
        }

        const tieneAsignacionesCarrera = Array.isArray(dto.asignacionesCarrera) && dto.asignacionesCarrera.length > 0;
        if (!tieneAsignacionesCarrera && !dto.carreraId && !String(dto.carrera ?? '').trim()) {
            return {
                ok: false,
                message: 'Selecciona una carrera válida.',
            };
        }

        const validacion = await this.enlaceFirmadoServicio.validarInvitacionFirmada({
            eid: String(firma.eid ?? ''),
            exp: String(firma.exp ?? ''),
            nonce: String(firma.nonce ?? ''),
            sig: String(firma.sig ?? ''),
            tipo: 'registro_estudiante',
            permiso: 'registro_estudiante_publico',
            recursoId: null,
        });
        if (!validacion.ok) {
            return {
                ok: false,
                message: validacion.message ?? 'No se pudo validar el enlace de registro.',
            };
        }

        try {
            const usuario = await this.estudianteServicio.crearEstudiante(dto, false);
            return {
                ok: true,
                message: 'Registro completado correctamente.',
                usuario,
            };
        } catch (error: any) {
            return {
                ok: false,
                message: error?.message ?? 'No se pudo completar el registro.',
            };
        }
    }

    async generarUrlFirmadaRegistroDocente(creadoPorUsuarioId?: number) {
        const estado = await this.configuracionServicio.obtenerRegistroDocente();
        if (!estado.habilitado) {
            return {
                ok: false,
                message: 'El registro público de docentes está deshabilitado.',
            };
        }

        const invitacion = await this.enlaceFirmadoServicio.habilitarInvitacionRegistroDocente(creadoPorUsuarioId);

        return {
            ok: true,
            ...invitacion,
        };
    }

    async obtenerUrlFirmadaRegistroDocenteActiva() {
        const estado = await this.configuracionServicio.obtenerRegistroDocente();
        if (!estado.habilitado) {
            return {
                ok: false,
                message: 'El registro público de docentes está deshabilitado.',
            };
        }

        const invitacion = await this.enlaceFirmadoServicio.obtenerInvitacionRegistroDocenteActiva();
        if (!invitacion) {
            return {
                ok: false,
                message: 'No hay un enlace de registro activo.',
            };
        }

        return {
            ok: true,
            ...invitacion,
        };
    }

    async deshabilitarUrlFirmadaRegistroDocente() {
        await this.enlaceFirmadoServicio.deshabilitarInvitacionRegistroDocente();

        return {
            ok: true,
            message: 'La invitación de registro fue deshabilitada.',
        };
    }

    async verificarRegistroDocenteConEnlaceFirmado(
        firma: { eid: string; exp: string; nonce: string; sig: string },
    ) {
        const estado = await this.configuracionServicio.obtenerRegistroDocente();
        if (!estado.habilitado) {
            return {
                ok: false,
                message: 'El registro público de docentes está deshabilitado.',
            };
        }

        const validacion = await this.enlaceFirmadoServicio.validarInvitacionFirmada(
            {
                eid: String(firma.eid ?? ''),
                exp: String(firma.exp ?? ''),
                nonce: String(firma.nonce ?? ''),
                sig: String(firma.sig ?? ''),
                tipo: 'registro_docente',
                permiso: 'registro_docente_publico',
                recursoId: null,
            },
            { registrarUso: false },
        );

        if (!validacion.ok) {
            return {
                ok: false,
                message: validacion.message ?? 'El enlace de registro no está disponible.',
            };
        }

        return {
            ok: true,
            message: 'Enlace válido.',
        };
    }

    async registrarDocenteConEnlaceFirmado(
        dto: CrearDocenteDto,
        firma: { eid: string; exp: string; nonce: string; sig: string },
    ) {
        const estado = await this.configuracionServicio.obtenerRegistroDocente();
        if (!estado.habilitado) {
            return {
                ok: false,
                message: 'El registro público de docentes está deshabilitado.',
            };
        }

        const validacion = await this.enlaceFirmadoServicio.validarInvitacionFirmada({
            eid: String(firma.eid ?? ''),
            exp: String(firma.exp ?? ''),
            nonce: String(firma.nonce ?? ''),
            sig: String(firma.sig ?? ''),
            tipo: 'registro_docente',
            permiso: 'registro_docente_publico',
            recursoId: null,
        });
        if (!validacion.ok) {
            return {
                ok: false,
                message: validacion.message ?? 'No se pudo validar el enlace de registro.',
            };
        }

        try {
            const usuario = await this.docenteServicio.crearDocente(dto, false);
            return {
                ok: true,
                message: 'Registro completado correctamente.',
                usuario,
            };
        } catch (error: any) {
            return {
                ok: false,
                message: error?.message ?? 'No se pudo completar el registro.',
            };
        }
    }

    async cambiarContrasena(usuarioId: number, dto: CambiarContrasenaDto) {
        return this.usuarioServicio.cambiarContrasena(usuarioId, dto.contrasenaActual, dto.nuevaContrasena);
    }

    async cambiarCorreo(usuarioId: number, dto: CambiarCorreoDto) {
        const usuario = await this.usuarioServicio.buscarPorId(usuarioId);
        if (!usuario) {
            throw new UnauthorizedException('No se encontró el usuario.');
        }
        if (usuario.rol !== 'administrador') {
            throw new UnauthorizedException('Solo el administrador puede cambiar su correo.');
        }

        const contrasenaValida = await bcrypt.compare(dto.contrasenaActual, usuario.contrasena);
        if (!contrasenaValida) {
            throw new BadRequestException('La contraseña actual es incorrecta.');
        }

        const nuevoCorreo = dto.nuevoCorreo.trim().toLowerCase();
        if (!nuevoCorreo) {
            throw new BadRequestException('El nuevo correo electrónico es obligatorio.');
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nuevoCorreo)) {
            throw new BadRequestException('El formato del correo es inválido.');
        }

        const existeOtro = await this.usuarioServicio.buscarPorCorreo(nuevoCorreo);
        if (existeOtro && existeOtro.id !== usuario.id) {
            throw new ConflictException('Ya existe un usuario con ese correo electrónico.');
        }

        await this.usuarioServicio.actualizarCorreo(usuario.id, nuevoCorreo);

        const usuarioActualizado = await this.usuarioServicio.buscarPorId(usuario.id);
        const perfil = await this.obtenerPerfilUsuarioActual(usuario.id);

        const carga = {
            sub: usuarioActualizado!.id,
            correo: usuarioActualizado!.correo,
            rol: usuarioActualizado!.rol,
            id_inventario: (perfil as any)?.id_inventario ?? null,
            puedeEditarFijos: (perfil as any)?.puedeEditarFijos ?? false,
            puedeEditarFungibles: (perfil as any)?.puedeEditarFungibles ?? false,
        };

        return {
            ok: true,
            message: 'Correo electrónico cambiado exitosamente.',
            token_acceso: this.jwtService.sign(carga),
            usuario: this.construirUsuarioSesion(usuarioActualizado!, perfil),
        };
    }
}
