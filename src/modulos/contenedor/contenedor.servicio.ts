import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { InventarioEntidad } from '@/modulos/inventario/entidades/inventario.entidad';
import { Usuario } from '@/modulos/usuario/entidades/usuario.entidad';
import { ContenedorActivo } from './entidades/contenedor-activo.entidad';

export interface ContenedorCompartido {
    id: string;
    nombre: string;
    descripcion: string;
    idActivo?: number;
    idMaterial?: number;
    visible: boolean;
}

type UsuarioAutenticado = {
    id: number;
    rol: string;
    id_inventario?: number | null;
};

type ContextoInventario = {
    esAdmin: boolean;
    idInventario: number | null;
};

@Injectable()
export class ContenedorCompartidoServicio {
    constructor(
        @InjectDataSource()
        private readonly dataSource: DataSource,
        @InjectRepository(ContenedorActivo)
        private readonly contenedorActivoRepositorio: Repository<ContenedorActivo>,
        @InjectRepository(Usuario)
        private readonly usuarioRepositorio: Repository<Usuario>,
        @InjectRepository(InventarioEntidad)
        private readonly inventarioRepositorio: Repository<InventarioEntidad>,
    ) {}

    private claveContenedor(nombre: string, descripcion: string): string {
        return `${nombre.trim().toLowerCase()}::${descripcion.trim().toLowerCase()}`;
    }

    private async resolverContextoInventario(usuario: UsuarioAutenticado): Promise<ContextoInventario> {
        if (usuario.rol === 'administrador') {
            return { esAdmin: true, idInventario: null };
        }

        if (usuario.rol !== 'encargado_inventario') {
            throw new ForbiddenException('No tienes permisos para gestionar contenedores.');
        }

        return {
            esAdmin: false,
            idInventario: usuario.id_inventario ?? null,
        };
    }

    private async obtenerInventarioPorId(idInventario?: number | null): Promise<InventarioEntidad | null> {
        if (idInventario == null) return null;

        const id = Number(idInventario);
        if (!Number.isFinite(id) || id <= 0) {
            throw new BadRequestException('El inventario seleccionado no es válido.');
        }

        const inventario = await this.inventarioRepositorio.findOne({
            where: { id, deleted_at: IsNull() },
        });
        if (!inventario) {
            throw new NotFoundException('Inventario no encontrado.');
        }

        return inventario;
    }

    async obtenerTodos(usuario: UsuarioAutenticado): Promise<ContenedorCompartido[]> {
        const contexto = await this.resolverContextoInventario(usuario);

        const consultaActivos = this.contenedorActivoRepositorio
            .createQueryBuilder('ca')
            .where('ca.deleted_at IS NULL')
            .orderBy('ca.id', 'ASC');

        if (!contexto.esAdmin) {
            if (!contexto.idInventario) return [];
            consultaActivos.andWhere('ca.id_inventario = :idInventario', { idInventario: contexto.idInventario });
        }

        const contenedoresActivos = await consultaActivos.getMany();

        return contenedoresActivos.map((contenedor) => ({
            id: `CA${contenedor.id}-CM0-${this.claveContenedor(contenedor.nombre, contenedor.ubicacion)}`,
            nombre: contenedor.nombre,
            descripcion: contenedor.ubicacion,
            idActivo: contenedor.id,
            visible: contenedor.visible,
        })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    }

    async crear(
        datos: { nombre: string; descripcion: string; idInventario?: number; visible?: boolean },
        usuario: UsuarioAutenticado,
    ): Promise<ContenedorCompartido> {
        const contexto = await this.resolverContextoInventario(usuario);

        const nombre = datos.nombre?.trim();
        if (!nombre) {
            throw new BadRequestException('El nombre es obligatorio para crear un contenedor.');
        }

        const descripcion = datos.descripcion?.trim() ?? '';

        let inventario: InventarioEntidad | null = null;
        if (contexto.esAdmin) {
            inventario = await this.obtenerInventarioPorId(datos.idInventario ?? null);
        } else {
            if (!contexto.idInventario) {
                throw new ForbiddenException('No tienes inventario asignado para crear contenedores.');
            }
            if (datos.idInventario && Number(datos.idInventario) !== contexto.idInventario) {
                throw new ForbiddenException('No puedes crear contenedores en otro inventario.');
            }
            inventario = await this.obtenerInventarioPorId(contexto.idInventario);
        }

        return this.dataSource.transaction(async (manager) => {
            const activoRepositorio = manager.getRepository(ContenedorActivo);

            const consultaActivo = activoRepositorio
                .createQueryBuilder('ca')
                .where('ca.deleted_at IS NULL')
                .andWhere('LOWER(TRIM(ca.nombre)) = LOWER(:nombre)', { nombre })
                .andWhere('LOWER(TRIM(ca.ubicacion)) = LOWER(:descripcion)', { descripcion });

            if (inventario) {
                consultaActivo.andWhere('ca.id_inventario = :idInventario', { idInventario: inventario.id });
            } else {
                consultaActivo.andWhere('ca.id_inventario IS NULL');
            }

            const existenteActivo = await consultaActivo.getOne();

            const visible = datos.visible ?? true;

            const contenedorActivo = existenteActivo ?? await activoRepositorio.save(
                activoRepositorio.create({ nombre, ubicacion: descripcion, inventario, visible }),
            );

            return {
                id: `CA${contenedorActivo.id}-CM0-${this.claveContenedor(nombre, descripcion)}`,
                nombre,
                descripcion,
                idActivo: contenedorActivo.id,
                visible: contenedorActivo.visible,
            };
        });
    }

    async editar(
        datos: { idActivo?: number; idMaterial?: number; nombre: string; descripcion: string; idInventario?: number; visible?: boolean },
        usuario: UsuarioAutenticado,
    ): Promise<ContenedorCompartido> {
        const contexto = await this.resolverContextoInventario(usuario);

        const nombre = datos.nombre?.trim();
        if (!nombre) {
            throw new BadRequestException('El nombre es obligatorio para editar un contenedor.');
        }

        const descripcion = datos.descripcion?.trim() ?? '';

        return this.dataSource.transaction(async (manager) => {
            const activoRepositorio = manager.getRepository(ContenedorActivo);

            const contenedorActivo = datos.idActivo
                ? await activoRepositorio.findOne({
                    where: { id: Number(datos.idActivo), deleted_at: IsNull() },
                    relations: ['inventario'],
                })
                : null;

            if (!contenedorActivo) {
                throw new NotFoundException('Contenedor no encontrado para editar.');
            }

            if (!contexto.esAdmin) {
                if (!contexto.idInventario) {
                    throw new ForbiddenException('No tienes inventario asignado para editar contenedores.');
                }
                if (contenedorActivo.inventario?.id !== contexto.idInventario) {
                    throw new ForbiddenException('No puedes editar contenedores de otro inventario.');
                }
            }

            contenedorActivo.nombre = nombre;
            contenedorActivo.ubicacion = descripcion;
            if (datos.visible !== undefined) {
                contenedorActivo.visible = datos.visible;
            }

            if (contexto.esAdmin && datos.idInventario !== undefined) {
                contenedorActivo.inventario = await this.obtenerInventarioPorId(datos.idInventario ?? null);
            }

            await activoRepositorio.save(contenedorActivo);

            return {
                id: `CA${contenedorActivo.id}-CM0-${this.claveContenedor(nombre, descripcion)}`,
                nombre,
                descripcion,
                idActivo: contenedorActivo.id,
                visible: contenedorActivo.visible,
            };
        });
    }

    async eliminar(datos: { idActivo?: number; idMaterial?: number }, usuario: UsuarioAutenticado): Promise<void> {
        const contexto = await this.resolverContextoInventario(usuario);

        await this.dataSource.transaction(async (manager) => {
            const activoRepositorio = manager.getRepository(ContenedorActivo);

            const contenedorActivo = datos.idActivo
                ? await activoRepositorio.findOne({
                    where: { id: Number(datos.idActivo), deleted_at: IsNull() },
                    relations: ['inventario'],
                })
                : null;

            if (!contenedorActivo) {
                throw new NotFoundException('Contenedor no encontrado para eliminar.');
            }

            if (!contexto.esAdmin) {
                if (!contexto.idInventario) {
                    throw new ForbiddenException('No tienes inventario asignado para eliminar contenedores.');
                }
                if (contenedorActivo.inventario?.id !== contexto.idInventario) {
                    throw new ForbiddenException('No puedes eliminar contenedores de otro inventario.');
                }
            }

            await activoRepositorio.softRemove(contenedorActivo);
        });
    }
}
