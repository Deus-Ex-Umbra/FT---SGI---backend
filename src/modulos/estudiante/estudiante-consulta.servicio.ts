import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository, Brackets } from 'typeorm';
import { EstudianteEntidad } from './entidades/estudiante.entidad';
import { CarreraEntidad } from '@/modulos/prestamo/entidades/carrera.entidad';
import { CuEntidad } from './entidades/cu.entidad';
import { EncargadoInventarioEntidad } from '@/modulos/encargado-inventario/entidades/encargado-inventario.entidad';
import { ItemActivoFungible } from '@/modulos/activo/entidades/item-activo-fungible.entidad';

export interface EstudianteCarreraPublica {
    carreraId: number | null;
    carrera: string;
    cu: string;
    prefijoCu?: string | null;
}

export interface EstudiantePublico {
    id: number;
    rol: 'estudiante';
    correo: string;
    carnet: string;
    nombre: string;
    apellido: string;
    cu: string;
    carrera?: string | null;
    cus: string[];
    carreras: string[];
    asignacionesCarrera: EstudianteCarreraPublica[];
    carnetRetenido: boolean;
    carnetRetenidoOverride: boolean | null;
    fechaNacimiento: string;
    estadoAprobacion: 'pendiente' | 'aprobado' | 'rechazado';
}

@Injectable()
export class EstudianteConsultaServicio {
    constructor(
        @InjectRepository(EstudianteEntidad)
        private readonly repositorioEstudiante: Repository<EstudianteEntidad>,
        @InjectRepository(CarreraEntidad)
        private readonly repositorioCarrera: Repository<CarreraEntidad>,
        @InjectRepository(CuEntidad)
        private readonly repositorioCu: Repository<CuEntidad>,
    ) { }

    normalizarCu(cu: string | undefined | null): string {
        return String(cu ?? '').trim().toUpperCase();
    }

    construirAsignacionesLegado(estudiante: EstudianteEntidad): EstudianteCarreraPublica[] {
        const carreraNombre = String(estudiante.carrera ?? '').trim();
        const cu = this.normalizarCu(estudiante.cu ?? null);
        if (!carreraNombre || !cu) return [];

        return [{
            carreraId: estudiante.carreraRef?.id ?? null,
            carrera: estudiante.carreraRef?.nombre ?? carreraNombre,
            cu,
            prefijoCu: estudiante.carreraRef?.prefijoCu ?? null,
        }];
    }

    obtenerAsignacionesPublicas(estudiante: EstudianteEntidad): EstudianteCarreraPublica[] {
        const asignaciones = (estudiante.asignacionesCarrera ?? [])
            .filter((asignacion) => asignacion?.carrera && this.normalizarCu(asignacion.cu))
            .map((asignacion) => ({
                carreraId: asignacion.carrera?.id ?? null,
                carrera: asignacion.carrera?.nombre ?? '',
                cu: this.normalizarCu(asignacion.cu),
                prefijoCu: asignacion.carrera?.prefijoCu ?? null,
            }));

        if (asignaciones.length > 0) return asignaciones;
        return this.construirAsignacionesLegado(estudiante);
    }

    async listarEstudiantes(usuarioActual?: { id: number; rol: string }): Promise<EstudiantePublico[]> {
        let estudiantes: EstudianteEntidad[] = [];

        if (usuarioActual && usuarioActual.rol === 'encargado_inventario') {
            const encargado = await this.repositorioEstudiante.manager.getRepository(EncargadoInventarioEntidad).findOne({
                where: { usuario: { id: usuarioActual.id } },
                relations: ['inventario'],
            });
            if (encargado && encargado.inventario) {
                const inventarioId = encargado.inventario.id;

                const fungiblesInventario = await this.repositorioEstudiante.manager.getRepository(ItemActivoFungible).find({
                    where: { activo: { inventario: { id: inventarioId } } },
                    select: ['id'],
                });
                const idsFungibles = fungiblesInventario.map(f => f.id);

                const activeLoansQuery = this.repositorioEstudiante.manager.createQueryBuilder()
                    .select('DISTINCT p.id_estudiante', 'estudianteId')
                    .from('prestamos', 'p')
                    .leftJoin('p.itemActivo', 'itemActivo')
                    .leftJoin('itemActivo.activo', 'activo')
                    .where('p.estado NOT IN (:...estadosCerrados)', { estadosCerrados: ['devuelto', 'devuelto_fuera_de_fecha_limite', 'rechazado'] })
                    .andWhere('p.deleted_at IS NULL')
                    .andWhere('(p.id_inventario = :inventarioId OR activo.id_inventario = :inventarioId)', { inventarioId });

                const activeLoanStudentIds = (await activeLoansQuery.getRawMany()).map(r => r.estudianteId).filter(Boolean);

                const activeGroupLoansQuery = this.repositorioEstudiante.manager.createQueryBuilder()
                    .select('DISTINCT ce.id_estudiante', 'estudianteId')
                    .from('canasta_estudiantes', 'ce')
                    .innerJoin('prestamos', 'p', 'p.grupo_canasta = ce.grupo_canasta')
                    .leftJoin('p.itemActivo', 'itemActivo')
                    .leftJoin('itemActivo.activo', 'activo')
                    .where('p.estado NOT IN (:...estadosCerrados)', { estadosCerrados: ['devuelto', 'devuelto_fuera_de_fecha_limite', 'rechazado'] })
                    .andWhere('p.deleted_at IS NULL')
                    .andWhere('(p.id_inventario = :inventarioId OR activo.id_inventario = :inventarioId)', { inventarioId });

                const activeGroupLoanStudentIds = (await activeGroupLoansQuery.getRawMany()).map(r => r.estudianteId).filter(Boolean);

                const allActiveStudentIds = Array.from(new Set([...activeLoanStudentIds, ...activeGroupLoanStudentIds]));

                const qb = this.repositorioEstudiante.createQueryBuilder('e')
                    .leftJoinAndSelect('e.usuario', 'usuario')
                    .leftJoinAndSelect('e.carreraRef', 'carreraRef')
                    .leftJoinAndSelect('e.cus', 'cus')
                    .leftJoinAndSelect('cus.carreras', 'cusCarreras')
                    .leftJoin('carreraRef.inventarios', 'invPrimary')
                    .leftJoin('cusCarreras.inventarios', 'invCu')
                    .where('usuario.rol = :rol', { rol: 'estudiante' });

                if (allActiveStudentIds.length > 0) {
                    qb.andWhere(new Brackets(outerQb => {
                        outerQb.where('e.id IN (:...allActiveStudentIds)', { allActiveStudentIds })
                            .orWhere(new Brackets(innerQb => {
                                innerQb.where('invPrimary.id = :inventarioId', { inventarioId })
                                    .orWhere('invCu.id = :inventarioId', { inventarioId });
                            }));
                    }));
                } else {
                    qb.andWhere(new Brackets(invQb => {
                        invQb.where('invPrimary.id = :inventarioId', { inventarioId })
                            .orWhere('invCu.id = :inventarioId', { inventarioId });
                    }));
                }

                estudiantes = await qb.orderBy('e.id', 'ASC').getMany();
            }
        } else {
            estudiantes = await this.repositorioEstudiante.find({
                where: { usuario: { rol: 'estudiante' } },
                relations: ['usuario', 'carreraRef', 'cus', 'cus.carreras'],
                order: { id: 'ASC' },
            });
        }

        return estudiantes
            .map((e) => {
                const asignacionesCarrera = this.obtenerAsignacionesPublicas(e);
                return {
                    id: e.id,
                    rol: 'estudiante' as const,
                    correo: e.usuario!.correo ?? '',
                    carnet: e.carnet,
                    nombre: e.nombre,
                    apellido: e.apellido,
                    cu: asignacionesCarrera[0]?.cu ?? this.normalizarCu(e.cu ?? null),
                    carrera: asignacionesCarrera[0]?.carrera ?? e.carrera ?? null,
                    cus: asignacionesCarrera.map((asignacion) => asignacion.cu),
                    carreras: asignacionesCarrera.map((asignacion) => asignacion.carrera),
                    asignacionesCarrera,
                    carnetRetenido: e.carnetRetenido,
                    carnetRetenidoOverride: e.carnetRetenidoOverride ?? null,
                    fechaNacimiento: e.fechaNacimiento
                        ? (e.fechaNacimiento instanceof Date
                            ? e.fechaNacimiento.toISOString().slice(0, 10)
                            : String(e.fechaNacimiento))
                        : '',
                    estadoAprobacion: e.estadoAprobacion,
                };
            })
            .filter((e) => e.correo && e.carnet);
    }

    async buscarPorIdUsuario(usuarioId: number): Promise<EstudianteEntidad> {
        const estudiante = await this.repositorioEstudiante.findOne({
            where: { usuario: { id: usuarioId } },
            relations: ['usuario', 'carreraRef', 'cus', 'cus.carreras'],
        });
        if (!estudiante) throw new NotFoundException('No se encontró el perfil de estudiante.');
        return estudiante;
    }

    async buscarPorIdentificador(identificador: string): Promise<EstudianteEntidad | null> {
        const iden = identificador.trim().toUpperCase();
        const carnet = identificador.trim();
        return this.repositorioEstudiante.findOne({
            where: [
                { carnet },
                { cu: iden },
                { cus: { codigo: iden } }
            ],
            relations: ['usuario', 'carreraRef', 'cus', 'cus.carreras'],
        });
    }

    async resolverCarrera(entrada: { carreraId?: number; carrera?: string }): Promise<CarreraEntidad | null> {
        const carreraId = Number(entrada.carreraId ?? 0);
        const nombreCarrera = String(entrada.carrera ?? '').trim();

        if (!carreraId && !nombreCarrera) return null;

        if (carreraId) {
            const carrera = await this.repositorioCarrera.findOne({
                where: { id: carreraId, deletedAt: IsNull() },
            });
            if (!carrera) throw new BadRequestException('La carrera seleccionada no existe.');
            return carrera;
        }

        const carrera = await this.repositorioCarrera.findOne({
            where: { nombre: nombreCarrera, deletedAt: IsNull() },
        });
        if (!carrera) throw new BadRequestException('La carrera seleccionada no existe.');
        return carrera;
    }

    async listarSolicitudesPendientes(usuarioActual: { id: number; rol: string }): Promise<EstudiantePublico[]> {
        const qb = this.repositorioEstudiante.createQueryBuilder('e')
            .leftJoinAndSelect('e.usuario', 'usuario')
            .leftJoinAndSelect('e.carreraRef', 'carreraRef')
            .leftJoinAndSelect('e.cus', 'cus')
            .leftJoinAndSelect('cus.carreras', 'cusCarreras')
            .where('e.estadoAprobacion = :estado', { estado: 'pendiente' });

        if (usuarioActual.rol === 'encargado_inventario') {
            const encargado = await this.repositorioEstudiante.manager.getRepository(EncargadoInventarioEntidad).findOne({
                where: { usuario: { id: usuarioActual.id } },
                relations: ['inventario'],
            });

            if (!encargado || !encargado.inventario) {
                return [];
            }
            const inventarioId = encargado.inventario.id;

            qb.leftJoin('carreraRef.inventarios', 'invPrimary')
                .leftJoin('cusCarreras.inventarios', 'invCu')
                .andWhere(new Brackets(innerQb => {
                    innerQb.where('invPrimary.id = :inventarioId', { inventarioId })
                        .orWhere('invCu.id = :inventarioId', { inventarioId });
                }));
        }

        const estudiantes = await qb.getMany();

        return estudiantes.map((e) => {
            const asignacionesCarrera = this.obtenerAsignacionesPublicas(e);
            return {
                id: e.id,
                rol: 'estudiante' as const,
                correo: e.usuario!.correo ?? '',
                carnet: e.carnet,
                nombre: e.nombre,
                apellido: e.apellido,
                cu: asignacionesCarrera[0]?.cu ?? this.normalizarCu(e.cu ?? null),
                carrera: asignacionesCarrera[0]?.carrera ?? e.carrera ?? null,
                cus: asignacionesCarrera.map((asignacion) => asignacion.cu),
                carreras: asignacionesCarrera.map((asignacion) => asignacion.carrera),
                asignacionesCarrera,
                carnetRetenido: e.carnetRetenido,
                carnetRetenidoOverride: e.carnetRetenidoOverride ?? null,
                fechaNacimiento: e.fechaNacimiento
                    ? (e.fechaNacimiento instanceof Date
                        ? e.fechaNacimiento.toISOString().slice(0, 10)
                        : String(e.fechaNacimiento))
                    : '',
                estadoAprobacion: e.estadoAprobacion,
            };
        });
    }
}

