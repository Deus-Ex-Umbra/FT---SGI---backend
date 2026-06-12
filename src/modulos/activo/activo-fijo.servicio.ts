import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ContenedorActivo } from '@/modulos/contenedor/entidades/contenedor-activo.entidad';
import { DocenteEntidad } from '@/modulos/docente/entidades/docente.entidad';
import { EstudianteEntidad } from '@/modulos/estudiante/entidades/estudiante.entidad';
import { InventarioEntidad } from '@/modulos/inventario/entidades/inventario.entidad';
import { ActivoFijo } from './entidades/activo-fijo.entidad';
import { ItemActivoFijo } from './entidades/item-activo-fijo.entidad';
import { TRANSICIONES_ESTADO_ITEM, normalizarEstadoItem, requiereJustificacionTransicion } from './dominio/reglas-estado-item';
import { normalizarEstadoFisicoItem } from './dominio/reglas-estado-fisico-item';

type ItemActivoFijoApi = {
    id: string;
    codigoInventario?: string | null;
    codigoUnico?: string | null;
    codigoSistema?: string | null;
    ubicacion?: string;
    ue?: string;
    descripcion?: string;
    fechaEntrega?: string;
    fechaRetiro?: string;
    estado: string;
    estadoFisico?: string;
    observaciones?: string;
    precio?: number;
};

type ContenedorActivoApi = {
    id: number;
    nombre: string;
    ubicacion: string;
};

type ActivoFijoApi = {
    id: number;
    nombre: string;
    categoria: string;
    descripcion?: string;
    contenedor?: ContenedorActivoApi | null;
    items: ItemActivoFijoApi[];
};

type UsuarioAutenticado = {
    id: number;
    rol: string;
    id_inventario?: number | null;
};

type ContextoInventario = {
    esAdmin: boolean;
    idInventario: number | null;
};

const serializarFechaApi = (valor?: unknown): string | undefined => {
    if (!valor) return undefined;
    if (valor instanceof Date) return valor.toISOString();
    if (typeof valor === 'string') return valor;
    if (typeof valor === 'number') return new Date(valor).toISOString();
    return String(valor);
};

@Injectable()
export class ActivoFijoServicio {
    private readonly registrarEventoInterno = async (_input: unknown) => undefined;

    constructor(
        @InjectRepository(ContenedorActivo)
        private readonly contenedorActivoRepositorio: Repository<ContenedorActivo>,
        @InjectRepository(ActivoFijo)
        private readonly activoFijoRepositorio: Repository<ActivoFijo>,
        @InjectRepository(ItemActivoFijo)
        private readonly itemActivoRepositorio: Repository<ItemActivoFijo>,
        @InjectRepository(InventarioEntidad)
        private readonly inventarioRepositorio: Repository<InventarioEntidad>,
    ) {}

    public async resolverContextoInventario(usuario: UsuarioAutenticado): Promise<ContextoInventario & { permitidosIds?: number[] }> {
        if (usuario.rol === 'administrador') {
            return { esAdmin: true, idInventario: null, permitidosIds: [] };
        }

        if (usuario.rol === 'docente' || usuario.rol === 'estudiante') {
            const permitidosIds = await this.obtenerInventariosPermitidosParaUsuario(usuario);
            return {
                esAdmin: false,
                idInventario: null,
                permitidosIds,
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

    private async obtenerInventariosPermitidosParaUsuario(usuario: UsuarioAutenticado): Promise<number[]> {
        const ids: number[] = [];
        if (usuario.rol === 'docente') {
            const docenteRepo = this.activoFijoRepositorio.manager.getRepository(DocenteEntidad);
            const docente = await docenteRepo.findOne({
                where: { usuario: { id: usuario.id } },
                relations: ['carreras', 'carreras.inventarios'],
            });
            if (docente?.carreras) {
                for (const carrera of docente.carreras) {
                    if (carrera.inventarios) {
                        for (const inv of carrera.inventarios) {
                            if (inv.id && !ids.includes(inv.id)) {
                                ids.push(inv.id);
                            }
                        }
                    }
                }
            }
        } else if (usuario.rol === 'estudiante') {
            const estudianteRepo = this.activoFijoRepositorio.manager.getRepository(EstudianteEntidad);
            const estudiante = await estudianteRepo.findOne({
                where: { usuario: { id: usuario.id } },
                relations: [
                    'carreraRef',
                    'carreraRef.inventarios',
                    'cus',
                    'cus.carreras',
                    'cus.carreras.inventarios',
                ],
            });
            if (estudiante) {
                if (estudiante.carreraRef?.inventarios) {
                    for (const inv of estudiante.carreraRef.inventarios) {
                        if (inv.id && !ids.includes(inv.id)) {
                            ids.push(inv.id);
                        }
                    }
                }
                if (estudiante.asignacionesCarrera) {
                    for (const asignacion of estudiante.asignacionesCarrera) {
                        if (asignacion.carrera?.inventarios) {
                            for (const inv of asignacion.carrera.inventarios) {
                                if (inv.id && !ids.includes(inv.id)) {
                                    ids.push(inv.id);
                                }
                            }
                        }
                    }
                }
            }
        }
        return ids;
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

    public validarAccesoRecursoPorInventario(
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

    private validarTransicionEstado(item: ItemActivoFijo, nuevoEstadoRaw: string, fechaRetiroNueva?: Date, justificacion?: string) {
        const estadoActual = normalizarEstadoItem(item.estado);
        const nuevoEstado = normalizarEstadoItem(nuevoEstadoRaw);

        if (!nuevoEstado) {
            throw new BadRequestException('Estado no valido para el item activo.');
        }
        if (!estadoActual) {
            throw new BadRequestException(`El estado actual del item (${item.estado}) no es valido en la plantilla de transiciones.`);
        }
        if (estadoActual === nuevoEstado) return nuevoEstado;

        const permitidos = TRANSICIONES_ESTADO_ITEM[estadoActual];
        if (!permitidos.includes(nuevoEstado)) {
            throw new BadRequestException(
                `Transicion de estado no permitida: ${estadoActual} -> ${nuevoEstado}. Permitidos: ${permitidos.join(', ') || 'ninguno'}`,
            );
        }

        if (requiereJustificacionTransicion(estadoActual, nuevoEstado) && !justificacion?.trim()) {
            throw new BadRequestException(
                `La transicion ${estadoActual} -> ${nuevoEstado} requiere nota de justificacion obligatoria.`,
            );
        }

        const fechaRetiroEfectiva = fechaRetiroNueva ?? item.fecha_retiro;
        if (nuevoEstado === 'dado_de_baja' && !fechaRetiroEfectiva) {
            throw new BadRequestException('Para estado dado_de_baja debes registrar fecha de retiro.');
        }
        if (nuevoEstado === 'dado_de_baja') {
            const fisico = normalizarEstadoFisicoItem(item.estado_fisico);
            if (fisico !== 'malo') {
                throw new BadRequestException('Para dar de baja el equipo, el estado físico debe ser "malo".');
            }
        }

        return nuevoEstado;
    }

    async obtenerTodosFijos(usuario: UsuarioAutenticado): Promise<ActivoFijoApi[]> {
        const contexto = await this.resolverContextoInventario(usuario);
        const consulta = this.activoFijoRepositorio
            .createQueryBuilder('af')
            .leftJoinAndSelect('af.inventario', 'inv')
            .leftJoinAndSelect('af.contenedor', 'ca', 'ca.deleted_at IS NULL')
            .leftJoinAndSelect('af.items', 'it', 'it.deleted_at IS NULL')
            .where('af.deleted_at IS NULL');

        if (!contexto.esAdmin) {
            if (usuario.rol === 'docente' || usuario.rol === 'estudiante') {
                const pIds = (contexto as any).permitidosIds ?? [];
                if (pIds.length === 0) return [];
                consulta.andWhere('af.id_inventario IN (:...pIds)', { pIds });
            } else {
                if (!contexto.idInventario) return [];
                consulta.andWhere('af.id_inventario = :idInventario', { idInventario: contexto.idInventario });
            }
        }
        const fijos = await consulta.getMany();
        for (const af of fijos) {
            af.items = (af.items ?? []).filter((it) => normalizarEstadoItem(it.estado) !== 'extraviado');
        }

        return fijos.map((af) => ({
            id: af.id,
            nombre: af.nombre,
            categoria: af.categoria,
            descripcion: af.descripcion,
            idInventario: af.inventario?.id ?? null,
            contenedor: af.contenedor
                ? {
                    id: af.contenedor.id,
                    nombre: af.contenedor.nombre,
                    ubicacion: af.contenedor.ubicacion,
                }
                : null,
            items: (af.items ?? []).map((it) => ({
                id: it.id,
                codigoInventario: it.codigo_inventario ?? null,
                codigoUnico: it.codigo_unico ?? null,
                codigoSistema: it.codigo_sistema ?? (!it.codigo_unico && !it.codigo_inventario ? it.id : null),
                ubicacion: it.ubicacion,
                ue: it.ue,
                descripcion: it.descripcion,
                fechaEntrega: serializarFechaApi(it.fecha_entrega),
                fechaRetiro: serializarFechaApi(it.fecha_retiro),
                estado: it.estado,
                estadoFisico: it.estado_fisico,
                observaciones: it.observaciones,
                precio: Number(it.precio ?? 0),
            })),
        }));
    }

    async obtenerFijosPorInventario(idInventario: number, usuario: UsuarioAutenticado): Promise<ActivoFijoApi[]> {
        const contexto = await this.resolverContextoInventario(usuario);
        if (!contexto.esAdmin) {
            if (usuario.rol === 'docente' || usuario.rol === 'estudiante') {
                const pIds = (contexto as any).permitidosIds ?? [];
                if (!pIds.includes(idInventario)) {
                    throw new ForbiddenException('No tienes acceso a los activos de este inventario.');
                }
            } else if (contexto.idInventario !== idInventario) {
                throw new ForbiddenException('No tienes acceso a los activos de este inventario.');
            }
        }

        const consulta = this.activoFijoRepositorio
            .createQueryBuilder('af')
            .leftJoinAndSelect('af.inventario', 'inv')
            .leftJoinAndSelect('af.contenedor', 'ca', 'ca.deleted_at IS NULL')
            .leftJoinAndSelect('af.items', 'it', 'it.deleted_at IS NULL')
            .where('af.deleted_at IS NULL')
            .andWhere('af.id_inventario = :idInventario', { idInventario });

        const fijos = await consulta.getMany();
        for (const af of fijos) {
            af.items = (af.items ?? []).filter((it) => normalizarEstadoItem(it.estado) !== 'extraviado');
        }

        return fijos.map((af) => ({
            id: af.id,
            nombre: af.nombre,
            categoria: af.categoria,
            descripcion: af.descripcion,
            idInventario: af.inventario?.id ?? null,
            contenedor: af.contenedor
                ? {
                    id: af.contenedor.id,
                    nombre: af.contenedor.nombre,
                    ubicacion: af.contenedor.ubicacion,
                }
                : null,
            items: (af.items ?? []).map((it) => ({
                id: it.id,
                codigoInventario: it.codigo_inventario ?? null,
                codigoUnico: it.codigo_unico ?? null,
                codigoSistema: it.codigo_sistema ?? (!it.codigo_unico && !it.codigo_inventario ? it.id : null),
                ubicacion: it.ubicacion,
                ue: it.ue,
                descripcion: it.descripcion,
                fechaEntrega: serializarFechaApi(it.fecha_entrega),
                fechaRetiro: serializarFechaApi(it.fecha_retiro),
                estado: it.estado,
                estadoFisico: it.estado_fisico,
                observaciones: it.observaciones,
                precio: Number(it.precio ?? 0),
            })),
        }));
    }

    async obtenerItems(usuario: UsuarioAutenticado): Promise<ItemActivoFijo[]> {
        const contexto = await this.resolverContextoInventario(usuario);
        const consulta = this.itemActivoRepositorio
            .createQueryBuilder('it')
            .leftJoinAndSelect('it.activo', 'af', 'af.deleted_at IS NULL')
            .leftJoinAndSelect('af.inventario', 'inv')
            .where('it.deleted_at IS NULL');

        if (!contexto.esAdmin) {
            if (usuario.rol === 'docente' || usuario.rol === 'estudiante') {
                const pIds = (contexto as any).permitidosIds ?? [];
                if (pIds.length === 0) return [];
                consulta.andWhere('af.id_inventario IN (:...pIds)', { pIds });
            } else {
                if (!contexto.idInventario) return [];
                consulta.andWhere('af.id_inventario = :idInventario', { idInventario: contexto.idInventario });
            }
        }
        const items = await consulta.getMany();
        return items.filter((it) => normalizarEstadoItem(it.estado) !== 'extraviado');
    }

    async crearActivoFijo(
        datos: {
            nombre: string;
            idContenedor?: number;
            idInventario?: number;
            categoria?: string;
            descripcion?: string;
        },
        usuario: UsuarioAutenticado,
    ): Promise<ActivoFijo> {
        const contexto = await this.resolverContextoInventario(usuario);
        const nombre = datos.nombre?.trim();
        if (!nombre) {
            throw new BadRequestException('El nombre del activo fijo es obligatorio.');
        }

        const contenedor = await this.obtenerContenedorPorId(datos.idContenedor);

        let inventario: InventarioEntidad | null = null;
        if (contexto.esAdmin) {
            const idInventarioObjetivo = datos.idInventario ?? contenedor?.inventario?.id ?? null;
            inventario = await this.obtenerInventarioPorId(idInventarioObjetivo);
            if (!inventario) {
                throw new BadRequestException('Debes seleccionar un inventario para crear el activo fijo.');
            }
        } else {
            if (!contexto.idInventario) {
                throw new ForbiddenException('No tienes un inventario asignado para crear activos.');
            }
            if (datos.idInventario && Number(datos.idInventario) !== contexto.idInventario) {
                throw new ForbiddenException('No puedes crear activos en otro inventario.');
            }
            inventario = await this.obtenerInventarioPorId(contexto.idInventario);
        }

        if (!inventario) {
            throw new BadRequestException('Debes seleccionar un inventario para crear el activo fijo.');
        }

        if (contenedor?.inventario?.id && contenedor.inventario.id !== inventario.id) {
            throw new BadRequestException('El contenedor pertenece a otro inventario.');
        }

        if (contenedor && !contenedor.inventario) {
            contenedor.inventario = inventario;
            await this.contenedorActivoRepositorio.save(contenedor);
        }

        const categoria = typeof datos.categoria === 'string' && datos.categoria.trim() ? datos.categoria.trim() : 'General';
        const descripcion = typeof datos.descripcion === 'string' && datos.descripcion.trim() ? datos.descripcion.trim() : undefined;

        const activo = this.activoFijoRepositorio.create({
            nombre,
            inventario,
            contenedor,
            categoria,
            descripcion,
        });
        const guardado = await this.activoFijoRepositorio.save(activo);
        await this.registrarEventoInterno({
            entidad: 'ActivoFijo',
            entidadId: guardado.id,
            accion: 'crear',
            detalle: { id: guardado.id, nombre: guardado.nombre },
        });
        return guardado;
    }

    async crearItemActivo(
        datos: {
            idActivo: string | number;
            codigoInventario?: string;
            codigoUnico?: string;
            codigoSistema?: string;
            ubicacion?: string;
            ue?: string;
            descripcion?: string;
            fechaEntrega?: string | null;
            fechaRetiro?: string | null;
            estado?: string;
            estadoFisico?: string;
            observaciones?: string;
            precio?: number;
        },
        usuario: UsuarioAutenticado,
    ): Promise<ItemActivoFijo> {
        const contexto = await this.resolverContextoInventario(usuario);
        const idActivo = Number(datos.idActivo);
        if (!Number.isFinite(idActivo) || idActivo <= 0) {
            throw new BadRequestException('El idActivo debe ser un número válido.');
        }

        const activo = await this.activoFijoRepositorio.findOne({
            where: { id: idActivo },
            relations: ['contenedor', 'inventario'],
        });
        if (!activo) {
            throw new NotFoundException('Activo fijo no encontrado para asociar el item.');
        }

        this.validarAccesoRecursoPorInventario(
            contexto,
            activo.inventario?.id ?? null,
            'No tienes un inventario asignado para crear ítems.',
            'No puedes crear ítems en activos de otro inventario.',
        );

        const codigoInventario = typeof datos.codigoInventario === 'string' ? datos.codigoInventario.trim() : '';
        const codigoInventarioFinal = codigoInventario || null;
        const codigoUnico = typeof datos.codigoUnico === 'string' ? datos.codigoUnico.trim() : '';
        const codigoUnicoFinal = codigoUnico || null;
        const codigoSistema = typeof datos.codigoSistema === 'string' ? datos.codigoSistema.trim() : '';
        const codigoSistemaFinal = codigoSistema || null;

        const estadoNormalizado = normalizarEstadoItem(datos.estado ?? 'disponible');
        if (!estadoNormalizado) {
            throw new BadRequestException('Estado no válido para el item activo.');
        }

        const estadoFisicoNormalizado = normalizarEstadoFisicoItem(datos.estadoFisico ?? 'bueno');
        if (!estadoFisicoNormalizado) {
            throw new BadRequestException('Estado físico no válido para el item activo.');
        }

        const ue = typeof datos.ue === 'string' && datos.ue.trim()
            ? datos.ue.trim()
            : (activo.contenedor?.ubicacion?.trim() || undefined);
        const descripcion = typeof datos.descripcion === 'string' && datos.descripcion.trim()
            ? datos.descripcion.trim()
            : undefined;

        const item = this.itemActivoRepositorio.create({
            activo,
            codigo_inventario: codigoInventarioFinal,
            codigo_unico: codigoUnicoFinal,
            codigo_sistema: codigoSistemaFinal,
            ubicacion: typeof datos.ubicacion === 'string' && datos.ubicacion.trim() ? datos.ubicacion.trim() : undefined,
            ue,
            descripcion,
            fecha_entrega: datos.fechaEntrega ? new Date(datos.fechaEntrega) : undefined,
            fecha_retiro: datos.fechaRetiro ? new Date(datos.fechaRetiro) : undefined,
            estado: estadoNormalizado,
            estado_fisico: estadoFisicoNormalizado,
            observaciones: datos.observaciones?.trim() || '',
            precio: Number(datos.precio ?? 0),
        });

        const guardado = await this.itemActivoRepositorio.save(item);
        await this.registrarEventoInterno({
            entidad: 'ItemActivo',
            entidadId: guardado.id,
            accion: 'crear',
            detalle: {
                id: guardado.id,
                idActivo: activo.id,
                codigoInventario: guardado.codigo_inventario ?? null,
                estado: guardado.estado,
            },
        });
        return guardado;
    }

    async editarActivoFijo(
        id: number,
        datos: Partial<{ nombre: string; categoria: string; descripcion: string; idInventario: number; idContenedor?: number }>,
        usuario: UsuarioAutenticado,
    ): Promise<ActivoFijo> {
        const contexto = await this.resolverContextoInventario(usuario);
        const activo = await this.activoFijoRepositorio.findOne({
            where: { id: Number(id) },
            relations: ['items', 'inventario', 'contenedor', 'contenedor.inventario'],
        });
        if (!activo) throw new NotFoundException('Activo fijo no encontrado.');

        if (!contexto.esAdmin) {
            if (!contexto.idInventario) {
                throw new ForbiddenException('No tienes inventario asignado para editar activos.');
            }
            if (activo.inventario?.id && activo.inventario.id !== contexto.idInventario) {
                throw new ForbiddenException('No puedes editar activos de otro inventario.');
            }
            if (!activo.inventario) {
                activo.inventario = await this.obtenerInventarioPorId(contexto.idInventario);
            }
        }

        if (contexto.esAdmin && datos.idInventario !== undefined) {
            const inventarioNuevo = await this.obtenerInventarioPorId(datos.idInventario ?? null);
            if (!inventarioNuevo) {
                throw new BadRequestException('Debes seleccionar un inventario válido.');
            }
            if (activo.contenedor?.inventario?.id && activo.contenedor.inventario.id !== inventarioNuevo.id) {
                throw new BadRequestException('El contenedor actual pertenece a otro inventario.');
            }
            activo.inventario = inventarioNuevo;
        }

        if (datos.idContenedor !== undefined) {
            const contenedor = await this.obtenerContenedorPorId(datos.idContenedor || undefined);
            if (contenedor?.inventario?.id && activo.inventario?.id && contenedor.inventario.id !== activo.inventario.id) {
                throw new BadRequestException('El contenedor seleccionado pertenece a otro inventario.');
            }
            activo.contenedor = contenedor;
        }

        const nombreAnterior = activo.nombre;
        const categoriaAnterior = activo.categoria;
        const descripcionAnterior = activo.descripcion;
        const contenedorAnteriorId = activo.contenedor?.id;

        if (typeof datos.nombre === 'string' && datos.nombre.trim()) {
            activo.nombre = datos.nombre.trim();
        }
        if (typeof datos.categoria === 'string') {
            activo.categoria = datos.categoria.trim() || 'General';
        }
        if (typeof datos.descripcion === 'string') {
            activo.descripcion = datos.descripcion.trim() || undefined;
        }

        const actualizado = await this.activoFijoRepositorio.save(activo);
        await this.registrarEventoInterno({
            entidad: 'ActivoFijo',
            entidadId: actualizado.id,
            accion: 'actualizar',
            detalle: {
                antes: {
                    nombre: nombreAnterior,
                    categoria: categoriaAnterior,
                    descripcion: descripcionAnterior,
                    idContenedor: contenedorAnteriorId,
                },
                despues: {
                    nombre: actualizado.nombre,
                    categoria: actualizado.categoria,
                    descripcion: actualizado.descripcion,
                    idContenedor: actualizado.contenedor?.id,
                },
            },
        });
        return actualizado;
    }

    async editarItemActivo(
        id: string,
        datos: Partial<{
            codigoInventario: string;
            codigoUnico: string;
            codigoSistema: string;
            fechaEntrega: string | null;
            fechaRetiro: string | null;
            estado: string;
            estadoFisico: string;
            ubicacion: string;
            ue: string;
            descripcion: string;
            observaciones: string;
            precio: number;
            justificacion: string;
        }>,
        usuario: UsuarioAutenticado,
    ): Promise<ItemActivoFijo> {
        const contexto = await this.resolverContextoInventario(usuario);
        const item = await this.itemActivoRepositorio.findOne({ where: { id }, relations: ['activo', 'activo.inventario'] });
        if (!item) throw new NotFoundException('Item de activo no encontrado.');

        this.validarAccAccess(contexto, item);

        const snapshotAntes = {
            codigoInventario: item.codigo_inventario,
            codigoUnico: item.codigo_unico,
            codigoSistema: item.codigo_sistema,
            fechaEntrega: item.fecha_entrega,
            fechaRetiro: item.fecha_retiro,
            estado: item.estado,
            estadoFisico: item.estado_fisico,
            ubicacion: item.ubicacion,
            ue: item.ue,
            descripcion: item.descripcion,
            observaciones: item.observaciones,
            precio: item.precio,
        };

        if (typeof datos.codigoInventario === 'string') {
            item.codigo_inventario = datos.codigoInventario.trim() || null;
        }
        if (typeof datos.codigoUnico === 'string') {
            item.codigo_unico = datos.codigoUnico.trim() || null;
        }
        if (typeof datos.codigoSistema === 'string') {
            item.codigo_sistema = datos.codigoSistema.trim() || null;
        }
        if (typeof datos.ubicacion === 'string') {
            item.ubicacion = datos.ubicacion.trim() || undefined;
        }
        if (typeof datos.ue === 'string') {
            item.ue = datos.ue.trim() || undefined;
        }
        if (typeof datos.descripcion === 'string') {
            item.descripcion = datos.descripcion.trim() || undefined;
        }
        if (datos.fechaEntrega !== undefined) {
            item.fecha_entrega = datos.fechaEntrega ? new Date(datos.fechaEntrega) : undefined;
        }
        const fechaRetiroNueva = datos.fechaRetiro !== undefined
            ? (datos.fechaRetiro ? new Date(datos.fechaRetiro) : undefined)
            : undefined;
        if (datos.fechaRetiro !== undefined) {
            item.fecha_retiro = fechaRetiroNueva;
        }

        if (typeof datos.estadoFisico === 'string' && datos.estadoFisico.trim()) {
            const fisico = normalizarEstadoFisicoItem(datos.estadoFisico);
            if (!fisico) {
                throw new BadRequestException('Estado físico no válido para el item activo.');
            }
            item.estado_fisico = fisico;
        }

        if (typeof datos.estado === 'string' && datos.estado.trim()) {
            const estadoValidado = this.validarTransicionEstado(item, datos.estado.trim(), fechaRetiroNueva, datos.justificacion ?? datos.observaciones);
            item.estado = estadoValidado;
        }
        if (typeof datos.observaciones === 'string') {
            item.observaciones = datos.observaciones;
        }
        if (datos.precio !== undefined) {
            const precio = Number(datos.precio);
            if (Number.isFinite(precio)) item.precio = precio;
        }
        const actualizado = await this.itemActivoRepositorio.save(item);
        if (normalizarEstadoItem(actualizado.estado) === 'dado_de_baja') {
            await this.itemActivoRepositorio.softRemove(actualizado);
        }
        await this.registrarEventoInterno({
            entidad: 'ItemActivo',
            entidadId: actualizado.id,
            accion: 'actualizar',
            detalle: {
                antes: snapshotAntes,
                despues: {
                    codigoInventario: actualizado.codigo_inventario ?? null,
                    codigoUnico: actualizado.codigo_unico ?? null,
                    codigoSistema: actualizado.codigo_sistema ?? null,
                    fechaEntrega: actualizado.fecha_entrega,
                    fechaRetiro: actualizado.fecha_retiro,
                    estado: actualizado.estado,
                    estadoFisico: actualizado.estado_fisico,
                    ubicacion: actualizado.ubicacion,
                    ue: actualizado.ue,
                    descripcion: actualizado.descripcion,
                    observaciones: actualizado.observaciones,
                    precio: actualizado.precio,
                },
                justificacion: datos.justificacion ?? null,
            },
        });
        return actualizado;
    }

    private validarAccAccess(contexto: ContextoInventario, item: ItemActivoFijo) {
        this.validarAccesoRecursoPorInventario(
            contexto,
            item.activo?.inventario?.id ?? null,
            'No tienes inventario asignado para editar ítems.',
            'No puedes editar ítems de otro inventario.',
        );
    }

    async eliminarActivoFijo(id: number, usuario: UsuarioAutenticado): Promise<void> {
        const contexto = await this.resolverContextoInventario(usuario);
        const activo = await this.activoFijoRepositorio.findOne({ where: { id: Number(id) }, relations: ['items', 'inventario'] });
        if (!activo) throw new NotFoundException('Activo fijo no encontrado.');

        this.validarAccesoRecursoPorInventario(
            contexto,
            activo.inventario?.id ?? null,
            'No tienes inventario asignado para eliminar activos.',
            'No puedes eliminar activos de otro inventario.',
        );

        const items = activo.items ?? [];
        if (items.length > 0) {
            await this.itemActivoRepositorio.softRemove(items);
        }

        await this.activoFijoRepositorio.softRemove(activo);
        await this.registrarEventoInterno({
            entidad: 'ActivoFijo',
            entidadId: activo.id,
            accion: 'eliminar',
            detalle: {
                id: activo.id,
                nombre: activo.nombre,
                itemsDescartados: items.length,
            },
        });
    }

    async eliminarItemActivo(id: string, usuario: UsuarioAutenticado): Promise<void> {
        const contexto = await this.resolverContextoInventario(usuario);
        const item = await this.itemActivoRepositorio.findOne({ where: { id }, relations: ['activo', 'activo.inventario'] });
        if (!item) throw new NotFoundException('Item de activo no encontrado.');

        this.validarAccesoRecursoPorInventario(
            contexto,
            item.activo?.inventario?.id ?? null,
            'No tienes inventario asignado para eliminar ítems.',
            'No puedes eliminar ítems de otro inventario.',
        );

        await this.itemActivoRepositorio.softRemove(item);
        await this.registrarEventoInterno({
            entidad: 'ItemActivo',
            entidadId: item.id,
            accion: 'eliminar',
            detalle: {
                id: item.id,
                idActivo: item.activo?.id,
                codigoInventario: item.codigo_inventario ?? null,
                codigoUnico: item.codigo_unico ?? null,
                codigoSistema: item.codigo_sistema ?? null,
            },
        });
    }

    async obtenerTransicionesPermitidas(id: string, usuario: UsuarioAutenticado) {
        const contexto = await this.resolverContextoInventario(usuario);
        const item = await this.itemActivoRepositorio.findOne({ where: { id }, relations: ['activo', 'activo.inventario'] });
        if (!item) throw new NotFoundException('Item de activo no encontrado.');

        this.validarAccesoRecursoPorInventario(
            contexto,
            item.activo?.inventario?.id ?? null,
            'No tienes inventario asignado para consultar transiciones de ítems.',
            'No puedes consultar transiciones de ítems de otro inventario.',
        );

        const estadoActual = normalizarEstadoItem(item.estado);
        if (!estadoActual) {
            throw new BadRequestException(`Estado actual no reconocido en plantilla: ${item.estado}`);
        }
        const estadoFisico = normalizarEstadoFisicoItem(item.estado_fisico) ?? 'bueno';

        return {
            itemId: item.id,
            codigoInventario: item.codigo_inventario ?? '',
            estadoActual,
            estadoFisico,
            transiciones: (TRANSICIONES_ESTADO_ITEM[estadoActual] ?? []).map((estadoDestino) => ({
                estadoDestino,
                requiereJustificacion: requiereJustificacionTransicion(estadoActual, estadoDestino),
            })),
        };
    }
}
