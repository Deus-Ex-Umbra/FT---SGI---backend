import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContenedorActivo } from '@/modulos/contenedor/entidades/contenedor-activo.entidad';
import { InventarioEntidad } from '@/modulos/inventario/entidades/inventario.entidad';

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
export class ActivoContenedorServicio {
    constructor(
        @InjectRepository(ContenedorActivo)
        private readonly contenedorActivoRepositorio: Repository<ContenedorActivo>,
        @InjectRepository(InventarioEntidad)
        private readonly inventarioRepositorio: Repository<InventarioEntidad>,
    ) {}

    public async resolverContextoInventario(usuario: UsuarioAutenticado): Promise<ContextoInventario> {
        if (usuario.rol === 'administrador') {
            return { esAdmin: true, idInventario: null };
        }

        if (usuario.rol !== 'encargado_inventario') {
            throw new ForbiddenException('No tienes permisos para gestionar activos.');
        }

        return {
            esAdmin: false,
            idInventario: usuario.id_inventario ?? null,
        };
    }

    public async obtenerInventarioPorId(idInventario?: number | null): Promise<InventarioEntidad | null> {
        if (idInventario == null) return null;
        const id = Number(idInventario);
        if (!Number.isFinite(id) || id <= 0) {
            throw new BadRequestException('El inventario seleccionado no es válido.');
        }
        const inventario = await this.inventarioRepositorio.findOne({ where: { id } });
        if (!inventario) {
            throw new NotFoundException('Inventario no encontrado.');
        }
        return inventario;
    }

    public async obtenerContenedorPorId(idContenedor?: number): Promise<ContenedorActivo | null> {
        if (!idContenedor) return null;
        const contenedor = await this.contenedorActivoRepositorio.findOne({
            where: { id: Number(idContenedor) },
            relations: ['inventario'],
        });
        if (!contenedor) throw new NotFoundException('Contenedor de activos no encontrado.');
        return contenedor;
    }

    async obtenerContenedores(usuario: UsuarioAutenticado): Promise<ContenedorActivo[]> {
        const contexto = await this.resolverContextoInventario(usuario);
        const consulta = this.contenedorActivoRepositorio
            .createQueryBuilder('ca')
            .leftJoinAndSelect('ca.inventario', 'inv')
            .where('ca.deleted_at IS NULL')
            .orderBy('ca.id', 'ASC');

        if (!contexto.esAdmin) {
            if (!contexto.idInventario) return [];
            consulta.andWhere('ca.id_inventario = :idInventario', { idInventario: contexto.idInventario });
        }

        return consulta.getMany();
    }

    async obtenerContenedoresPorInventario(idInventario: number): Promise<ContenedorActivo[]> {
        return this.contenedorActivoRepositorio.find({
            where: { inventario: { id: idInventario } },
            order: { id: 'ASC' },
        });
    }

    async crearContenedor(
        datos: { nombre: string; ubicacion: string; idInventario?: number; visible?: boolean },
        usuario: UsuarioAutenticado,
    ): Promise<ContenedorActivo> {
        const contexto = await this.resolverContextoInventario(usuario);
        const nombre = datos.nombre?.trim();
        if (!nombre) {
            throw new BadRequestException('El nombre es obligatorio para crear contenedor.');
        }
        const ubicacion = datos.ubicacion?.trim() ?? '';

        let inventario: InventarioEntidad | null = null;
        if (contexto.esAdmin) {
            inventario = await this.obtenerInventarioPorId(datos.idInventario ?? null);
        } else {
            if (!contexto.idInventario) {
                throw new ForbiddenException('No tienes un inventario asignado para crear contenedores.');
            }
            if (datos.idInventario && Number(datos.idInventario) !== contexto.idInventario) {
                throw new ForbiddenException('No puedes crear contenedores en otro inventario.');
            }
            inventario = await this.obtenerInventarioPorId(contexto.idInventario);
        }

        const existenteConsulta = this.contenedorActivoRepositorio
            .createQueryBuilder('ca')
            .where('ca.deleted_at IS NULL')
            .andWhere('LOWER(TRIM(ca.nombre)) = LOWER(:nombre)', { nombre })
            .andWhere('LOWER(TRIM(ca.ubicacion)) = LOWER(:ubicacion)', { ubicacion });

        if (inventario) {
            existenteConsulta.andWhere('ca.id_inventario = :idInventario', { idInventario: inventario.id });
        } else {
            existenteConsulta.andWhere('ca.id_inventario IS NULL');
        }

        const existente = await existenteConsulta.getOne();
        if (existente) return existente;

        const visible = datos.visible ?? true;

        const contenedor = this.contenedorActivoRepositorio.create({ nombre, ubicacion, inventario, visible });
        return this.contenedorActivoRepositorio.save(contenedor);
    }

    async editarContenedor(
        id: number,
        datos: Partial<{ nombre: string; ubicacion: string; idInventario: number; visible: boolean }>,
        usuario: UsuarioAutenticado,
    ): Promise<ContenedorActivo> {
        const contexto = await this.resolverContextoInventario(usuario);
        const contenedor = await this.contenedorActivoRepositorio.findOne({ where: { id }, relations: ['inventario'] });
        if (!contenedor) throw new NotFoundException('Contenedor de activos no encontrado.');

        if (!contexto.esAdmin) {
            if (!contexto.idInventario) {
                throw new ForbiddenException('No tienes inventario asignado.');
            }
            if (contenedor.inventario?.id && contenedor.inventario.id !== contexto.idInventario) {
                throw new ForbiddenException('No puedes editar contenedores de otro inventario.');
            }
            if (!contenedor.inventario) {
                contenedor.inventario = await this.obtenerInventarioPorId(contexto.idInventario);
            }
        }

        if (typeof datos.nombre === 'string' && datos.nombre.trim()) {
            contenedor.nombre = datos.nombre.trim();
        }
        if (typeof datos.ubicacion === 'string' && datos.ubicacion.trim()) {
            contenedor.ubicacion = datos.ubicacion.trim();
        }
        if (datos.visible !== undefined) {
            contenedor.visible = datos.visible;
        }
        if (contexto.esAdmin && datos.idInventario !== undefined) {
            contenedor.inventario = await this.obtenerInventarioPorId(datos.idInventario ?? null);
        }

        const duplicadoConsulta = this.contenedorActivoRepositorio
            .createQueryBuilder('ca')
            .where('ca.deleted_at IS NULL')
            .andWhere('ca.id <> :id', { id })
            .andWhere('LOWER(TRIM(ca.nombre)) = LOWER(:nombre)', { nombre: contenedor.nombre })
            .andWhere('LOWER(TRIM(ca.ubicacion)) = LOWER(:ubicacion)', { ubicacion: contenedor.ubicacion });

        if (contenedor.inventario?.id) {
            duplicadoConsulta.andWhere('ca.id_inventario = :idInventario', { idInventario: contenedor.inventario.id });
        } else {
            duplicadoConsulta.andWhere('ca.id_inventario IS NULL');
        }

        const duplicado = await duplicadoConsulta.getOne();
        if (duplicado) {
            throw new BadRequestException('Ya existe un contenedor de activos con ese nombre y ubicación para ese inventario.');
        }

        return this.contenedorActivoRepositorio.save(contenedor);
    }
}
