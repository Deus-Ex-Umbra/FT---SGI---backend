import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ActivoFungible } from './entidades/activo-fungible.entidad';
import { ItemActivoFungible } from './entidades/item-activo-fungible.entidad';
import { InventarioEntidad } from '@/modulos/inventario/entidades/inventario.entidad';
import { ContenedorActivo } from '@/modulos/contenedor/entidades/contenedor-activo.entidad';
import { ActivoContenedorServicio } from './activo-contenedor.servicio';

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
export class ActivoFungibleServicio {
    constructor(
        @InjectRepository(ActivoFungible)
        private readonly activoFungibleRepositorio: Repository<ActivoFungible>,
        @InjectRepository(ItemActivoFungible)
        private readonly itemActivoFungibleRepositorio: Repository<ItemActivoFungible>,
        @InjectRepository(InventarioEntidad)
        private readonly inventarioRepositorio: Repository<InventarioEntidad>,
        @InjectRepository(ContenedorActivo)
        private readonly contenedorActivoRepositorio: Repository<ContenedorActivo>,
        private readonly contenedorServicio: ActivoContenedorServicio,
    ) {}

    public async obtenerContenedorPorId(idContenedor?: number): Promise<ContenedorActivo | null> {
        if (!idContenedor) return null;
        const contenedor = await this.contenedorActivoRepositorio.findOne({
            where: { id: Number(idContenedor) },
            relations: ['inventario'],
        });
        if (!contenedor) throw new NotFoundException('Contenedor de activos no encontrado.');
        return contenedor;
    }

    private async resolverContextoInventario(usuario: UsuarioAutenticado): Promise<ContextoInventario & { permitidosIds?: number[] }> {
        if (usuario.rol === 'administrador') {
            return { esAdmin: true, idInventario: null, permitidosIds: [] };
        }

        if (usuario.rol === 'docente' || usuario.rol === 'estudiante') {
            const docenteRepo = this.activoFungibleRepositorio.manager.getRepository(require('@/modulos/docente/entidades/docente.entidad').DocenteEntidad);
            const estudianteRepo = this.activoFungibleRepositorio.manager.getRepository(require('@/modulos/estudiante/entidades/estudiante.entidad').EstudianteEntidad);
            const ids: number[] = [];

            if (usuario.rol === 'docente') {
                const docente = await docenteRepo.findOne({
                    where: { usuario: { id: usuario.id } },
                    relations: ['carreras', 'carreras.inventarios'],
                });
                if (docente?.carreras) {
                    for (const c of docente.carreras) {
                        if (c.inventarios) {
                            for (const inv of c.inventarios) {
                                if (inv.id && !ids.includes(inv.id)) ids.push(inv.id);
                            }
                        }
                    }
                }
            } else {
                const estudiante = await estudianteRepo.findOne({
                    where: { usuario: { id: usuario.id } },
                    relations: ['carreraRef', 'carreraRef.inventarios', 'cus', 'cus.carreras', 'cus.carreras.inventarios'],
                });
                if (estudiante) {
                    if (estudiante.carreraRef?.inventarios) {
                        for (const inv of estudiante.carreraRef.inventarios) {
                            if (inv.id && !ids.includes(inv.id)) ids.push(inv.id);
                        }
                    }
                }
            }

            return {
                esAdmin: false,
                idInventario: null,
                permitidosIds: ids,
            };
        }

        if (usuario.rol !== 'encargado_inventario') {
            throw new ForbiddenException('No tienes permisos para gestionar activos.');
        }

        return {
            esAdmin: false,
            idInventario: usuario.id_inventario ?? null,
            permitidosIds: usuario.id_inventario ? [usuario.id_inventario] : [],
        };
    }

    private validarAccesoRecursoPorInventario(
        contexto: ContextoInventario,
        idInventarioRecurso: number | null,
        mensajeSinInventario: string,
        mensajeSinAcceso: string,
    ) {
        if (contexto.esAdmin) return;
        if (!contexto.idInventario) {
            throw new ForbiddenException(mensajeSinInventario);
        }
        if (!idInventarioRecurso || idInventarioRecurso !== contexto.idInventario) {
            throw new ForbiddenException(mensajeSinAcceso);
        }
    }

    async obtenerPromedioSolicitado(idActivo: number): Promise<number> {
        try {
            const query = `
                SELECT AVG(CAST(x."cantidadSolicitada" AS numeric)) AS "promedio"
                FROM prestamos p
                CROSS JOIN LATERAL jsonb_to_recordset(p.consumibles) AS x("idLote" text, "idActivoFungible" text, "cantidadSolicitada" numeric)
                LEFT JOIN items_activos_fungibles iaf ON (x."idLote" IS NOT NULL AND iaf.id::text = x."idLote")
                WHERE p.deleted_at IS NULL AND (COALESCE(iaf.id_activo, CAST(x."idActivoFungible" AS integer)) = $1)
            `;
            const result = await this.activoFungibleRepositorio.query(query, [idActivo]);
            const prom = result[0]?.promedio;
            return prom ? Math.round(Number(prom)) : 1;
        } catch (err) {
            return 1;
        }
    }

    async obtenerPromediosSolicitadosMap(): Promise<Map<number, number>> {
        const map = new Map<number, number>();
        try {
            const query = `
                SELECT
                  COALESCE(iaf.id_activo, CAST(x."idActivoFungible" AS integer)) AS "idActivo",
                  AVG(CAST(x."cantidadSolicitada" AS numeric)) AS "promedio"
                FROM prestamos p
                CROSS JOIN LATERAL jsonb_to_recordset(p.consumibles) AS x("idLote" text, "idActivoFungible" text, "cantidadSolicitada" numeric)
                LEFT JOIN items_activos_fungibles iaf ON (x."idLote" IS NOT NULL AND iaf.id::text = x."idLote")
                WHERE p.deleted_at IS NULL
                GROUP BY COALESCE(iaf.id_activo, CAST(x."idActivoFungible" AS integer))
            `;
            const result = await this.activoFungibleRepositorio.query(query);
            for (const row of result) {
                if (row.idActivo) {
                    map.set(Number(row.idActivo), Math.round(Number(row.promedio)));
                }
            }
        } catch (err) {
            // Ignore error
        }
        return map;
    }

    async obtenerFungibles(usuario: UsuarioAutenticado) {
        const contexto = await this.resolverContextoInventario(usuario);
        let where = {};
        if (!contexto.esAdmin) {
            if (usuario.rol === 'docente' || usuario.rol === 'estudiante') {
                const pIds = (contexto as any).permitidosIds ?? [];
                if (pIds.length === 0) return [];
                where = { inventario: { id: In(pIds) } };
            } else {
                where = { inventario: { id: contexto.idInventario as number } };
            }
        }
        const activos = await this.activoFungibleRepositorio.find({
            where,
            relations: ['items', 'inventario', 'contenedor', 'items.contenedor'],
            order: { nombre: 'ASC' },
        });
        const promedios = await this.obtenerPromediosSolicitadosMap();
        return activos.map(a => this.serializarFungibleApi(a, promedios.get(a.id) ?? 1));
    }

    async crearActivoFungible(dto: any, usuario: UsuarioAutenticado) {
        const contexto = await this.resolverContextoInventario(usuario);
        const inventarioId = contexto.esAdmin ? (dto.idInventario ?? null) : contexto.idInventario;
        const inventario = inventarioId ? await this.inventarioRepositorio.findOne({ where: { id: Number(inventarioId) } }) : null;

        let contenedor = dto.idContenedor ? await this.obtenerContenedorPorId(dto.idContenedor) : null;
        if (contenedor) {
            if (contenedor.tipo === 'fijo') {
                throw new BadRequestException('El contenedor seleccionado está reservado para activos fijos.');
            }
            if (contenedor.tipo === 'indefinido') {
                contenedor.tipo = 'fungible';
                await this.contenedorActivoRepositorio.save(contenedor);
            }
        }

        const activo = this.activoFungibleRepositorio.create({
            nombre: dto.nombre,
            categoria: dto.categoria ?? 'General',
            descripcion: dto.descripcion,
            unidad_medida: dto.unidad ?? 'unidades',
            tipo_cantidad: dto.tipoCantidad ?? 'entero',
            tipo_identificacion: dto.tipoIdentificacion ?? 'solo_sistema',
            tiene_vencimiento: Boolean(dto.tieneVencimiento ?? false),
            inventario,
            contenedor,
        });

        const guardado = await this.activoFungibleRepositorio.save(activo);
        if (contenedor) {
            await this.contenedorServicio.actualizarTipoContenedor(null, contenedor.id);
        }
        const completo = await this.activoFungibleRepositorio.findOne({
            where: { id: guardado.id },
            relations: ['items', 'inventario', 'contenedor', 'items.contenedor']
        });
        const promedio = await this.obtenerPromedioSolicitado(guardado.id);
        return this.serializarFungibleApi(completo!, promedio);
    }

    async editarActivoFungible(id: number, dto: any, usuario: UsuarioAutenticado) {
        const contexto = await this.resolverContextoInventario(usuario);
        const activo = await this.activoFungibleRepositorio.findOne({
            where: { id },
            relations: ['inventario', 'contenedor']
        });
        if (!activo) throw new NotFoundException('Activo fungible no encontrado.');

        this.validarAccesoRecursoPorInventario(
            contexto,
            activo.inventario?.id ?? null,
            'No tienes inventario asignado para editar activos fungibles.',
            'No puedes editar activos fungibles de otro inventario.',
        );

        const anteriorContenedorId = activo.contenedor?.id;

        if (dto.nombre !== undefined) activo.nombre = dto.nombre;
        if (dto.categoria !== undefined) activo.categoria = dto.categoria;
        if (dto.descripcion !== undefined) activo.descripcion = dto.descripcion;
        if (dto.unidad !== undefined) activo.unidad_medida = dto.unidad;
        if (dto.tipoIdentificacion !== undefined) activo.tipo_identificacion = dto.tipoIdentificacion;
        if (dto.tieneVencimiento !== undefined) activo.tiene_vencimiento = Boolean(dto.tieneVencimiento);

        if (dto.idContenedor !== undefined) {
            const contenedor = dto.idContenedor ? await this.obtenerContenedorPorId(dto.idContenedor) : null;
            if (contenedor) {
                if (contenedor.tipo === 'fijo') {
                    throw new BadRequestException('El contenedor seleccionado está reservado para activos fijos.');
                }
                activo.contenedor = contenedor;
                if (contenedor.tipo === 'indefinido') {
                    contenedor.tipo = 'fungible';
                    await this.contenedorActivoRepositorio.save(contenedor);
                }
            } else {
                activo.contenedor = null;
            }
        }

        const guardado = await this.activoFungibleRepositorio.save(activo);

        if (anteriorContenedorId) {
            await this.contenedorServicio.actualizarTipoContenedor(null, anteriorContenedorId);
        }
        if (guardado.contenedor?.id) {
            await this.contenedorServicio.actualizarTipoContenedor(null, guardado.contenedor.id);
        }

        const completo = await this.activoFungibleRepositorio.findOne({
            where: { id: guardado.id },
            relations: ['items', 'inventario', 'contenedor', 'items.contenedor']
        });
        const promedio = await this.obtenerPromedioSolicitado(guardado.id);
        return this.serializarFungibleApi(completo!, promedio);
    }

    async eliminarActivoFungible(id: number, usuario: UsuarioAutenticado): Promise<void> {
        const contexto = await this.resolverContextoInventario(usuario);
        const activo = await this.activoFungibleRepositorio.findOne({
            where: { id },
            relations: ['items', 'inventario', 'contenedor', 'items.contenedor']
        });
        if (!activo) throw new NotFoundException('Activo fungible no encontrado.');

        this.validarAccesoRecursoPorInventario(
            contexto,
            activo.inventario?.id ?? null,
            'No tienes inventario asignado para eliminar activos fungibles.',
            'No puedes eliminar activos fungibles de otro inventario.',
        );

        const contenedorId = activo.contenedor?.id;
        const lotesContenedoresIds = (activo.items ?? [])
            .map(item => item.contenedor?.id)
            .filter((cid): cid is number => typeof cid === 'number');

        if (activo.items && activo.items.length > 0) {
            await this.itemActivoFungibleRepositorio.softRemove(activo.items);
        }
        await this.activoFungibleRepositorio.softRemove(activo);

        if (contenedorId) {
            await this.contenedorServicio.actualizarTipoContenedor(null, contenedorId);
        }
        for (const cid of lotesContenedoresIds) {
            await this.contenedorServicio.actualizarTipoContenedor(null, cid);
        }
    }

    async crearItemFungible(dto: any, usuario: UsuarioAutenticado) {
        const contexto = await this.resolverContextoInventario(usuario);
        const activoId = Number(dto.cajaId ?? dto.activoId);
        const activo = await this.activoFungibleRepositorio.findOne({ where: { id: activoId }, relations: ['inventario'] });
        if (!activo) throw new NotFoundException('Activo fungible principal no encontrado.');

        this.validarAccesoRecursoPorInventario(
            contexto,
            activo.inventario?.id ?? null,
            'No tienes inventario asignado para crear lotes.',
            'No puedes crear lotes en otro inventario.',
        );

        let contenedor = dto.idContenedor ? await this.obtenerContenedorPorId(dto.idContenedor) : null;
        if (contenedor) {
            if (contenedor.tipo === 'fijo') {
                throw new BadRequestException('El contenedor seleccionado está reservado para activos fijos.');
            }
            if (contenedor.tipo === 'indefinido') {
                contenedor.tipo = 'fungible';
                await this.contenedorActivoRepositorio.save(contenedor);
            }
        }

        const item = this.itemActivoFungibleRepositorio.create({
            activo,
            lote: dto.lote ?? null,
            serie: dto.serie ?? null,
            cantidad: Number(dto.cantidadDisponible ?? dto.cantidad ?? 0),
            fecha_vencimiento: dto.fechaCaducidad ? new Date(dto.fechaCaducidad) : null,
            precio: Number(dto.precio ?? 0),
            observaciones: dto.observaciones ?? '',
            estado: 'disponible',
            contenedor,
        });

        const guardado = await this.itemActivoFungibleRepositorio.save(item);
        if (contenedor) {
            await this.contenedorServicio.actualizarTipoContenedor(null, contenedor.id);
        }

        return {
            id: guardado.id,
            tipo: activo.tipo_identificacion,
            lote: guardado.lote ?? null,
            serie: guardado.serie ?? null,
            cantidadDisponible: Number(guardado.cantidad),
            fechaCaducidad: guardado.fecha_vencimiento ? guardado.fecha_vencimiento.toISOString() : null,
            precio: Number(guardado.precio),
            idContenedor: contenedor?.id ?? null,
        };
    }

    async editarItemFungible(id: string, dto: any, usuario: UsuarioAutenticado) {
        const contexto = await this.resolverContextoInventario(usuario);
        const item = await this.itemActivoFungibleRepositorio.findOne({
            where: { id },
            relations: ['activo', 'activo.inventario', 'contenedor']
        });
        if (!item) throw new NotFoundException('Item fungible no encontrado.');

        this.validarAccesoRecursoPorInventario(
            contexto,
            item.activo?.inventario?.id ?? null,
            'No tienes inventario asignado para editar lotes.',
            'No puedes editar lotes de otro inventario.',
        );

        const anteriorContenedorId = item.contenedor?.id;

        if (dto.lote !== undefined) item.lote = dto.lote;
        if (dto.serie !== undefined) item.serie = dto.serie;
        if (dto.cantidadDisponible !== undefined) item.cantidad = Number(dto.cantidadDisponible);
        if (dto.cantidad !== undefined) item.cantidad = Number(dto.cantidad);
        if (dto.fechaCaducidad !== undefined) item.fecha_vencimiento = dto.fechaCaducidad ? new Date(dto.fechaCaducidad) : null;
        if (dto.precio !== undefined) item.precio = Number(dto.precio);
        if (dto.observaciones !== undefined) item.observaciones = dto.observaciones;

        if (dto.idContenedor !== undefined) {
            const contenedor = dto.idContenedor ? await this.obtenerContenedorPorId(dto.idContenedor) : null;
            if (contenedor) {
                if (contenedor.tipo === 'fijo') {
                    throw new BadRequestException('El contenedor seleccionado está reservado para activos fijos.');
                }
                item.contenedor = contenedor;
                if (contenedor.tipo === 'indefinido') {
                    contenedor.tipo = 'fungible';
                    await this.contenedorActivoRepositorio.save(contenedor);
                }
            } else {
                item.contenedor = null;
            }
        }

        const guardado = await this.itemActivoFungibleRepositorio.save(item);

        if (anteriorContenedorId) {
            await this.contenedorServicio.actualizarTipoContenedor(null, anteriorContenedorId);
        }
        if (guardado.contenedor?.id) {
            await this.contenedorServicio.actualizarTipoContenedor(null, guardado.contenedor.id);
        }

        return {
            id: guardado.id,
            tipo: item.activo.tipo_identificacion,
            lote: guardado.lote ?? null,
            serie: guardado.serie ?? null,
            cantidadDisponible: Number(guardado.cantidad),
            fechaCaducidad: guardado.fecha_vencimiento ? guardado.fecha_vencimiento.toISOString() : null,
            precio: Number(guardado.precio),
            idContenedor: guardado.contenedor?.id ?? null,
        };
    }

    async eliminarItemFungible(id: string, usuario: UsuarioAutenticado): Promise<void> {
        const contexto = await this.resolverContextoInventario(usuario);
        const item = await this.itemActivoFungibleRepositorio.findOne({
            where: { id },
            relations: ['activo', 'activo.inventario', 'contenedor']
        });
        if (!item) throw new NotFoundException('Item fungible no encontrado.');

        this.validarAccesoRecursoPorInventario(
            contexto,
            item.activo?.inventario?.id ?? null,
            'No tienes inventario asignado para eliminar lotes.',
            'No puedes eliminar lotes de otro inventario.',
        );

        const contenedorId = item.contenedor?.id;

        await this.itemActivoFungibleRepositorio.softRemove(item);

        if (contenedorId) {
            await this.contenedorServicio.actualizarTipoContenedor(null, contenedorId);
        }
    }

    private serializarFungibleApi(activo: ActivoFungible, promedio = 1) {
        const contenedorObj = activo.contenedor
            ? {
                id: activo.contenedor.id,
                nombre: activo.contenedor.nombre,
                ubicacion: activo.contenedor.ubicacion,
                tipo: activo.contenedor.tipo,
              }
            : null;

        return {
            id: activo.id,
            nombre: activo.nombre,
            categoria: activo.categoria,
            descripcion: activo.descripcion ?? '',
            unidad: activo.unidad_medida,
            stockMinimoHabilitado: false,
            stockMinimo: 0,
            tipoIdentificacion: activo.tipo_identificacion,
            idInventario: activo.inventario?.id ?? null,
            contenedor: contenedorObj,
            promedioSolicitado: promedio,
            lotes: (activo.items ?? [])
                .filter(item => item.deleted_at === null)
                .map(item => ({
                    id: item.id,
                    tipo: activo.tipo_identificacion,
                    lote: item.lote ?? null,
                    serie: item.serie ?? null,
                    fechaEntrega: item.created_at,
                    fechaRetiro: null,
                    cantidadDisponible: Number(item.cantidad ?? 0),
                    fechaCaducidad: item.fecha_vencimiento ? item.fecha_vencimiento.toISOString() : null,
                    precio: Number(item.precio ?? 0),
                    contenedor: item.contenedor
                        ? {
                            id: item.contenedor.id,
                            nombre: item.contenedor.nombre,
                            ubicacion: item.contenedor.ubicacion,
                            tipo: item.contenedor.tipo,
                          }
                        : (contenedorObj ?? null)
                }))
        };
    }
}
