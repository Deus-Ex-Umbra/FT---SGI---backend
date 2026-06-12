import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { EncargadoInventarioEntidad } from './entidades/encargado-inventario.entidad';
import { UsuarioServicio } from '@/modulos/usuario/usuario.servicio';
import { InventarioEntidad } from '@/modulos/inventario/entidades/inventario.entidad';
import { CrearEncargadoDto } from './dto/crear-encargado.dto';
import { Usuario } from '@/modulos/usuario/entidades/usuario.entidad';

export interface EncargadoPublico {
    id: number;
    rol: 'encargado_inventario';
    correo: string;
    nombre?: string | null;
    apellido?: string | null;
    id_inventario: number | null;
    puedeEditarFijos: boolean;
    puedeEditarFungibles: boolean;
    estado: boolean;
    inventario?: {
        id: number;
        nombre: string;
        puedeEditarFijos: boolean;
        puedeEditarFungibles: boolean;
    } | null;
}

@Injectable()
export class EncargadoInventarioServicio {
    constructor(
        @InjectRepository(EncargadoInventarioEntidad)
        private readonly repositorioEncargado: Repository<EncargadoInventarioEntidad>,
        @InjectRepository(InventarioEntidad)
        private readonly repositorioInventario: Repository<InventarioEntidad>,
        private readonly usuarioServicio: UsuarioServicio,
    ) { }

    private async resolverInventarioOpcional(idInventario?: number | null): Promise<InventarioEntidad | null> {
        if (idInventario == null) return null;
        const inventario = await this.repositorioInventario.findOne({
            where: { id: idInventario, deleted_at: IsNull() },
        });
        if (!inventario) throw new BadRequestException('El inventario seleccionado no existe.');
        return inventario;
    }

    private resolverPermisos(inventario?: InventarioEntidad | null, encargado?: EncargadoInventarioEntidad | null) {
        return {
            puedeEditarFijos: inventario?.puedeEditarFijos ?? encargado?.puedeEditarFijos ?? false,
            puedeEditarFungibles: inventario?.puedeEditarFungibles ?? encargado?.puedeEditarFungibles ?? false,
        };
    }

    private mapearEncargado(encargado: EncargadoInventarioEntidad, usuario: Usuario, inventario: InventarioEntidad | null | undefined): EncargadoPublico {
        const permisos = this.resolverPermisos(inventario, encargado);

        return {
            id: usuario.id,
            rol: 'encargado_inventario',
            correo: usuario.correo ?? '',
            nombre: encargado.nombre ?? null,
            apellido: encargado.apellido ?? null,
            id_inventario: inventario?.id ?? null,
            puedeEditarFijos: permisos.puedeEditarFijos,
            puedeEditarFungibles: permisos.puedeEditarFungibles,
            estado: usuario.estado,
            inventario: inventario
                ? {
                    id: inventario.id,
                    nombre: inventario.nombre,
                    puedeEditarFijos: permisos.puedeEditarFijos,
                    puedeEditarFungibles: permisos.puedeEditarFungibles,
                }
                : null,
        };
    }

    async crearEncargado(dto: CrearEncargadoDto): Promise<EncargadoPublico> {
        const correo = dto.correo.trim().toLowerCase();
        const { contrasena, idInventario, nombre, apellido, fechaNacimiento } = dto;

        const nombreNorm = String(nombre ?? '').trim();
        if (!nombreNorm) {
            throw new BadRequestException('El nombre del encargado es obligatorio.');
        }

        const existeCorreo = await this.usuarioServicio.buscarPorCorreo(correo);
        if (existeCorreo) throw new ConflictException('Ya existe un usuario con ese correo electrónico.');

        const inventario = await this.resolverInventarioOpcional(idInventario);

        const usuario = await this.usuarioServicio.crearUsuarioBase({
            correo,
            contrasena: contrasena || this.usuarioServicio.construirContrasenaTemporalConFecha('encargado_inventario', fechaNacimiento),
            rol: 'encargado_inventario',
        });

        const encargado = await this.repositorioEncargado.save({
            usuario,
            inventario: inventario ?? undefined,
            nombre: nombreNorm,
            apellido: apellido?.trim() || null,
        });

        return this.mapearEncargado(encargado, usuario, inventario);
    }

    async obtenerPerfilEncargado(usuarioId: number): Promise<EncargadoPublico | null> {
        const encargado = await this.repositorioEncargado.findOne({
            where: { usuario: { id: usuarioId } },
            relations: ['usuario', 'inventario'],
        });
        if (!encargado) return null;

        return this.mapearEncargado(encargado, encargado.usuario!, encargado.inventario);
    }

    async listarEncargados(): Promise<EncargadoPublico[]> {
        const encargados = await this.repositorioEncargado.find({
            relations: ['usuario', 'inventario'],
        });

        return encargados.map(encargado =>
            this.mapearEncargado(encargado, encargado.usuario!, encargado.inventario),
        );
    }

    async asignarInventario(
        idUsuario: number,
        idInventario: number | null,
    ): Promise<EncargadoPublico> {
        const usuario = await this.usuarioServicio.buscarPorId(idUsuario);
        if (!usuario) throw new NotFoundException('No se encontró el usuario.');

        if (usuario.rol !== 'encargado_inventario') {
            throw new BadRequestException('Solo se puede asignar inventario a encargados.');
        }

        let encargado = await this.repositorioEncargado.findOne({
            where: { usuario: { id: idUsuario } },
            relations: ['inventario', 'usuario'],
        });

        const nuevoInventario = await this.resolverInventarioOpcional(idInventario);

        if (!encargado) {
            encargado = this.repositorioEncargado.create({ usuario });
        }

        encargado.inventario = nuevoInventario;

        await this.repositorioEncargado.save(encargado);

        return this.mapearEncargado(encargado, usuario, nuevoInventario);
    }

    async editarEncargado(
        usuarioId: number,
        datos: Partial<{ correo: string; nombre: string; apellido: string }>,
    ): Promise<EncargadoPublico> {
        const encargado = await this.repositorioEncargado.findOne({
            where: { usuario: { id: usuarioId } },
            relations: ['usuario', 'inventario'],
        });
        if (!encargado || !encargado.usuario) {
            throw new NotFoundException('No se encontró el encargado de inventario.');
        }

        if (datos.correo !== undefined) {
            const correo = String(datos.correo ?? '').trim().toLowerCase();
            if (!correo) {
                throw new BadRequestException('El correo electrónico es obligatorio.');
            }
            const existeOtro = await this.usuarioServicio.buscarPorCorreo(correo);
            if (existeOtro && existeOtro.id !== encargado.usuario.id) {
                throw new ConflictException('Ya existe un usuario con ese correo electrónico.');
            }
            await this.usuarioServicio.actualizarCorreo(encargado.usuario.id, correo);
            encargado.usuario.correo = correo;
        }

        if (datos.nombre !== undefined) {
            const nombre = String(datos.nombre ?? '').trim();
            if (!nombre) {
                throw new BadRequestException('El nombre es obligatorio.');
            }
            encargado.nombre = nombre;
        }

        if (datos.apellido !== undefined) {
            encargado.apellido = String(datos.apellido ?? '').trim() || null;
        }

        const guardado = await this.repositorioEncargado.save(encargado);
        return this.mapearEncargado(guardado, encargado.usuario, encargado.inventario);
    }
}
