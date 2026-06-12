import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository, In } from 'typeorm';
import { ActivoFijo } from '@/modulos/activo/entidades/activo-fijo.entidad';
import { ActivoFungible } from '@/modulos/activo/entidades/activo-fungible.entidad';
import { ContenedorActivo } from '@/modulos/contenedor/entidades/contenedor-activo.entidad';
import { EncargadoInventarioEntidad } from '@/modulos/encargado-inventario/entidades/encargado-inventario.entidad';
import { Usuario } from '@/modulos/usuario/entidades/usuario.entidad';
import { InventarioEntidad } from './entidades/inventario.entidad';

export interface InventarioResumenApi {
    id: number;
    nombre: string;
    descripcion?: string | null;
    puedeEditarFijos: boolean;
    puedeEditarFungibles: boolean;
    totalEncargados: number;
    encargados: Array<{ id: number; correo: string }>;
}

@Injectable()
export class InventarioServicio {
    constructor(
        @InjectRepository(InventarioEntidad)
        private readonly inventarioRepositorio: Repository<InventarioEntidad>,
        @InjectRepository(Usuario)
        private readonly usuarioRepositorio: Repository<Usuario>,
        @InjectRepository(EncargadoInventarioEntidad)
        private readonly encargadoRepositorio: Repository<EncargadoInventarioEntidad>,
        @InjectRepository(ActivoFijo)
        private readonly activoFijoRepositorio: Repository<ActivoFijo>,
        @InjectRepository(ActivoFungible)
        private readonly activoFungibleRepositorio: Repository<ActivoFungible>,
        @InjectRepository(ContenedorActivo)
        private readonly contenedorActivoRepositorio: Repository<ContenedorActivo>,
    ) {}

    private resolverPermisosInventario(inventario: InventarioEntidad, encargados: EncargadoInventarioEntidad[] = []) {
        return {
            puedeEditarFijos: inventario.puedeEditarFijos ?? encargados.some((encargado) => encargado.puedeEditarFijos === true),
            puedeEditarFungibles: inventario.puedeEditarFungibles ?? encargados.some((encargado) => encargado.puedeEditarFungibles === true),
        };
    }

    private mapearInventarioResumen(inventario: InventarioEntidad): InventarioResumenApi {
        const encargadosRelacionados = inventario.encargados ?? [];
        const encargados = encargadosRelacionados
            .filter((enc: EncargadoInventarioEntidad) => enc.usuario)
            .sort((a: EncargadoInventarioEntidad, b: EncargadoInventarioEntidad) => a.id - b.id)
            .map((enc: EncargadoInventarioEntidad) => ({
                id: enc.usuario!.id,
                correo: enc.usuario!.correo ?? '',
            }));

        const permisos = this.resolverPermisosInventario(inventario, encargadosRelacionados);

        return {
            id: inventario.id,
            nombre: inventario.nombre,
            descripcion: inventario.descripcion ?? null,
            puedeEditarFijos: permisos.puedeEditarFijos,
            puedeEditarFungibles: permisos.puedeEditarFungibles,
            totalEncargados: encargados.length,
            encargados,
        };
    }

    async obtenerInventarioPorId(id: number): Promise<InventarioEntidad> {
        const inventario = await this.inventarioRepositorio.findOne({
            where: { id, deleted_at: IsNull() },
        });

        if (!inventario) {
            throw new NotFoundException('Inventario no encontrado.');
        }

        return inventario;
    }

    async listarInventarios(): Promise<InventarioResumenApi[]> {
        const inventarios = await this.inventarioRepositorio.find({
            where: { deleted_at: IsNull() },
            relations: ['encargados', 'encargados.usuario'],
            order: { id: 'ASC' },
        });

        return inventarios.map((inventario) => this.mapearInventarioResumen(inventario));
    }

    async crearInventario(datos: { nombre: string; descripcion?: string; puedeEditarFijos?: boolean; puedeEditarFungibles?: boolean }): Promise<InventarioResumenApi> {
        const nombre = String(datos.nombre ?? '').trim();
        const descripcion = typeof datos.descripcion === 'string' ? datos.descripcion.trim() : '';

        if (!nombre) {
            throw new BadRequestException('El nombre del inventario es obligatorio.');
        }

        const existente = await this.inventarioRepositorio
            .createQueryBuilder('inv')
            .where('inv.deleted_at IS NULL')
            .andWhere('LOWER(TRIM(inv.nombre)) = LOWER(:nombre)', { nombre })
            .getOne();

        if (existente) {
            throw new BadRequestException('Ya existe un inventario con ese nombre.');
        }

        const inventario = this.inventarioRepositorio.create({
            nombre,
            descripcion: descripcion || null,
            puedeEditarFijos: datos.puedeEditarFijos ?? false,
            puedeEditarFungibles: datos.puedeEditarFungibles ?? false,
        });

        await this.inventarioRepositorio.save(inventario);
        const guardado = await this.inventarioRepositorio.findOne({
            where: { id: inventario.id, deleted_at: IsNull() },
            relations: ['encargados', 'encargados.usuario'],
        });

        if (!guardado) {
            throw new NotFoundException('Inventario no encontrado.');
        }

        return this.mapearInventarioResumen(guardado);
    }

    async editarInventario(id: number, datos: Partial<{ nombre: string; descripcion: string; puedeEditarFijos: boolean; puedeEditarFungibles: boolean }>): Promise<InventarioResumenApi> {
        const inventario = await this.obtenerInventarioPorId(id);

        if (typeof datos.nombre === 'string') {
            const nuevoNombre = datos.nombre.trim();
            if (!nuevoNombre) {
                throw new BadRequestException('El nombre del inventario es obligatorio.');
            }
            inventario.nombre = nuevoNombre;
        }

        if (typeof datos.descripcion === 'string') {
            inventario.descripcion = datos.descripcion.trim() || null;
        }

        if (typeof datos.puedeEditarFijos === 'boolean') {
            inventario.puedeEditarFijos = datos.puedeEditarFijos;
        }

        if (typeof datos.puedeEditarFungibles === 'boolean') {
            inventario.puedeEditarFungibles = datos.puedeEditarFungibles;
        }

        const duplicado = await this.inventarioRepositorio
            .createQueryBuilder('inv')
            .where('inv.deleted_at IS NULL')
            .andWhere('inv.id <> :id', { id: inventario.id })
            .andWhere('LOWER(TRIM(inv.nombre)) = LOWER(:nombre)', { nombre: inventario.nombre })
            .getOne();

        if (duplicado) {
            throw new BadRequestException('Ya existe un inventario con ese nombre.');
        }

        await this.inventarioRepositorio.save(inventario);
        const actualizado = await this.inventarioRepositorio.findOne({
            where: { id: inventario.id, deleted_at: IsNull() },
            relations: ['encargados', 'encargados.usuario'],
        });

        if (!actualizado) {
            throw new NotFoundException('Inventario no encontrado.');
        }

        return this.mapearInventarioResumen(actualizado);
    }

    async eliminarInventario(id: number): Promise<void> {
        const inventario = await this.obtenerInventarioPorId(id);

        const [encargados, activosFijos, activosFungibles, contenedores] = await Promise.all([
            this.encargadoRepositorio.count({
                where: {
                    inventario: { id: inventario.id },
                },
            }),
            this.activoFijoRepositorio.count({
                where: {
                    inventario: { id: inventario.id },
                    deleted_at: IsNull(),
                },
            }),
            this.activoFungibleRepositorio.count({
                where: {
                    inventario: { id: inventario.id },
                    deleted_at: IsNull(),
                },
            }),
            this.contenedorActivoRepositorio.count({
                where: {
                    inventario: { id: inventario.id },
                    deleted_at: IsNull(),
                },
            }),
        ]);

        if (encargados > 0 || activosFijos > 0 || activosFungibles > 0 || contenedores > 0) {
            throw new BadRequestException('No se puede eliminar el inventario porque tiene encargados, contenedores o activos asociados.');
        }

        await this.inventarioRepositorio.softRemove(inventario);
    }

    async obtenerInventariosAutorizados(usuario: { id: number; rol: string; id_inventario?: number | null }): Promise<InventarioResumenApi[]> {
        if (usuario.rol === 'administrador') {
            return this.listarInventarios();
        }

        const inventariosIds: number[] = [];
        if (usuario.rol === 'encargado_inventario') {
            if (usuario.id_inventario) {
                inventariosIds.push(Number(usuario.id_inventario));
            }
        } else if (usuario.rol === 'docente') {
            const docente = await this.usuarioRepositorio.manager.findOne('DocenteEntidad', {
                where: { usuario: { id: usuario.id } },
                relations: ['carreras', 'carreras.inventarios'],
            }) as any;
            if (docente?.carreras) {
                for (const carrera of docente.carreras) {
                    if (carrera.inventarios) {
                        for (const inv of carrera.inventarios) {
                            inventariosIds.push(inv.id);
                        }
                    }
                }
            }
        } else if (usuario.rol === 'estudiante') {
            const estudiante = await this.usuarioRepositorio.manager.findOne('EstudianteEntidad', {
                where: { usuario: { id: usuario.id } },
                relations: ['carreraRef', 'carreraRef.inventarios', 'cus', 'cus.carreras', 'cus.carreras.inventarios'],
            }) as any;
            if (estudiante) {
                if (estudiante.carreraRef?.inventarios) {
                    for (const inv of estudiante.carreraRef.inventarios) {
                        inventariosIds.push(inv.id);
                    }
                }
                if (estudiante.asignacionesCarrera) {
                    for (const asignacion of estudiante.asignacionesCarrera) {
                        if (asignacion.carrera?.inventarios) {
                            for (const inv of asignacion.carrera.inventarios) {
                                inventariosIds.push(inv.id);
                            }
                        }
                    }
                }
            }
        }

        const idsUnicos = Array.from(new Set(inventariosIds));
        if (idsUnicos.length === 0) {
            return [];
        }

        const inventarios = await this.inventarioRepositorio.find({
            where: { id: In(idsUnicos), deleted_at: IsNull() },
            relations: ['encargados', 'encargados.usuario'],
            order: { id: 'ASC' },
        });

        return inventarios.map((inventario) => this.mapearInventarioResumen(inventario));
    }
}
