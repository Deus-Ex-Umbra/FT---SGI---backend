import { BadRequestException, ConflictException, Injectable, NotFoundException, Inject, forwardRef, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { EstudianteEntidad } from './entidades/estudiante.entidad';
import { CuEntidad } from './entidades/cu.entidad';
import { CarreraEntidad } from '@/modulos/prestamo/entidades/carrera.entidad';
import { UsuarioServicio } from '@/modulos/usuario/usuario.servicio';
import { EstudianteConsultaServicio, EstudiantePublico } from './estudiante-consulta.servicio';
import { CrearEstudianteDto } from './dto/crear-estudiante.dto';
import { PrestamoUtilServicio } from '@/modulos/prestamo/prestamo-util.servicio';
import { EncargadoInventarioEntidad } from '@/modulos/encargado-inventario/entidades/encargado-inventario.entidad';

interface AsignacionCarreraResuelta {
    carrera: CarreraEntidad;
    cu: string;
}

@Injectable()
export class EstudianteMutacionServicio {
    constructor(
        @InjectRepository(EstudianteEntidad)
        private readonly repositorioEstudiante: Repository<EstudianteEntidad>,
        @InjectRepository(CarreraEntidad)
        private readonly repositorioCarrera: Repository<CarreraEntidad>,
        @InjectRepository(CuEntidad)
        private readonly repositorioCu: Repository<CuEntidad>,
        private readonly usuarioServicio: UsuarioServicio,
        private readonly consultaServicio: EstudianteConsultaServicio,
        @Inject(forwardRef(() => PrestamoUtilServicio))
        private readonly prestamoUtilServicio: PrestamoUtilServicio,
    ) {}

    private async validarCusDisponibles(cus: string[], estudianteIdExcluir?: number): Promise<void> {
        if (cus.length === 0) return;

        const qbLegacy = this.repositorioEstudiante
            .createQueryBuilder('estudiante')
            .where('estudiante.cu IN (:...cus)', { cus });
        if (estudianteIdExcluir) {
            qbLegacy.andWhere('estudiante.id != :estudianteIdExcluir', { estudianteIdExcluir });
        }
        const existenteLegacy = await qbLegacy.getOne();
        if (existenteLegacy?.cu) {
            throw new ConflictException(`Ya existe un estudiante con el CU ${existenteLegacy.cu}.`);
        }

        const qbAsignacion = this.repositorioCu
            .createQueryBuilder('cu')
            .leftJoin('cu.estudiante', 'estudiante')
            .where('cu.codigo IN (:...cus)', { cus });
        if (estudianteIdExcluir) {
            qbAsignacion.andWhere('estudiante.id != :estudianteIdExcluir', { estudianteIdExcluir });
        }
        const existenteAsignacion = await qbAsignacion.getOne();
        if (existenteAsignacion?.codigo) {
            throw new ConflictException(`Ya existe un estudiante con el CU ${existenteAsignacion.codigo}.`);
        }
    }

    private async resolverAsignacionesCarrera(dto: CrearEstudianteDto): Promise<AsignacionCarreraResuelta[]> {
        const entradas = Array.isArray(dto.asignacionesCarrera) && dto.asignacionesCarrera.length > 0
            ? dto.asignacionesCarrera
            : [{ carreraId: dto.carreraId, carrera: dto.carrera, cu: dto.cu }];

        const carrerasVistas = new Set<number>();
        const asignaciones: AsignacionCarreraResuelta[] = [];

        for (const entrada of entradas) {
            const carrera = await this.consultaServicio.resolverCarrera({
                carreraId: entrada?.carreraId,
                carrera: entrada?.carrera,
            });
            if (!carrera) continue;

            const cu = this.consultaServicio.normalizarCu(entrada?.cu);
            if (!cu) {
                throw new BadRequestException('El CU es obligatorio para cada carrera asignada.');
            }
            if (carrerasVistas.has(carrera.id)) {
                throw new BadRequestException('No se puede asignar la misma carrera más de una vez.');
            }

            const prefijoCarrera = String(carrera.prefijoCu ?? '').trim().toUpperCase() || '111';
            
            if (!cu.startsWith(`${prefijoCarrera}-`) && !cu.startsWith('CU-')) {
                if (cu.startsWith(prefijoCarrera) && cu.length > prefijoCarrera.length && cu[prefijoCarrera.length] !== '-') {
                     const codigoRestante = cu.substring(prefijoCarrera.length);
                     const cuNormalizado = `${prefijoCarrera}-${codigoRestante}`;
                     asignaciones.push({ carrera, cu: cuNormalizado });
                     carrerasVistas.add(carrera.id);
                     continue;
                }

                if (cu.startsWith('CU') && cu.length > 2 && cu[2] !== '-') {
                     const codigoRestante = cu.substring(2);
                     const cuNormalizado = `CU-${codigoRestante}`;
                     asignaciones.push({ carrera, cu: cuNormalizado });
                     carrerasVistas.add(carrera.id);
                     continue;
                }
                
                throw new BadRequestException(`El CU ${cu} debe tener el formato ${prefijoCarrera}-CODIGO o CU-CODIGO para la carrera ${carrera.nombre}.`);
            }

            carrerasVistas.add(carrera.id);
            asignaciones.push({ carrera, cu });
        }

        return asignaciones;
    }

    async crearEstudiante(dto: CrearEstudianteDto, aprobadoPorDefecto: boolean = true): Promise<EstudiantePublico> {
        const ci = dto.ci.trim();
        const correo = dto.correo?.trim().toLowerCase() || `estudiante-${ci}@sgi.usfx`;
        const { nombre, apellido, fechaNacimiento, contrasena } = dto;
        const asignaciones = await this.resolverAsignacionesCarrera(dto);

        const existeCorreo = await this.usuarioServicio.buscarPorCorreo(correo);
        if (existeCorreo) throw new ConflictException('Ya existe un usuario con ese correo electrónico.');

        const existeCi = await this.repositorioEstudiante.findOne({ where: { carnet: ci }, withDeleted: true });
        if (existeCi) throw new ConflictException('Ya existe un estudiante con ese CI.');

        await this.validarCusDisponibles(asignaciones.map((asignacion) => asignacion.cu));

        const usuario = await this.usuarioServicio.crearUsuarioBase({
            correo,
            contrasena: contrasena || this.usuarioServicio.construirContrasenaTemporalConFecha('estudiante', fechaNacimiento),
            rol: 'estudiante',
            estado: aprobadoPorDefecto,
        });

        const principal = asignaciones[0] ?? null;

        const estudiante = await this.repositorioEstudiante.save({
            usuario,
            carnet: ci,
            cu: principal?.cu ?? null,
            carrera: principal?.carrera.nombre ?? null,
            carreraRef: principal?.carrera ?? null,
            carnetRetenido: false,
            fechaNacimiento: new Date(`${fechaNacimiento}T00:00:00`),
            nombre: String(nombre || '').trim(),
            apellido: String(apellido || '').trim(),
            estadoAprobacion: aprobadoPorDefecto ? 'aprobado' : 'pendiente',
        });
        const cusMap = new Map<string, CarreraEntidad[]>();
        for (const { carrera, cu } of asignaciones) {
            if (!cusMap.has(cu)) {
                cusMap.set(cu, []);
            }
            cusMap.get(cu)!.push(carrera);
        }
        for (const [cuCodigo, carreras] of cusMap.entries()) {
            const cuEntidad = this.repositorioCu.create({
                codigo: cuCodigo,
                estudiante,
                carreras,
            });
            await this.repositorioCu.save(cuEntidad);
        }

        const asignacionesCarrera = asignaciones.map(({ carrera, cu }) => ({
            carreraId: carrera.id,
            carrera: carrera.nombre,
            cu,
            prefijoCu: carrera.prefijoCu ?? null,
        }));

        return {
            id: estudiante.id,
            rol: 'estudiante',
            correo: correo || '',
            carnet: ci,
            nombre: estudiante.nombre,
            apellido: estudiante.apellido,
            cu: principal?.cu ?? '',
            carrera: principal?.carrera.nombre ?? null,
            cus: asignacionesCarrera.map((asignacion) => asignacion.cu),
            carreras: asignacionesCarrera.map((asignacion) => asignacion.carrera),
            asignacionesCarrera,
            carnetRetenido: estudiante.carnetRetenido,
            carnetRetenidoOverride: estudiante.carnetRetenidoOverride ?? null,
            fechaNacimiento,
            estadoAprobacion: estudiante.estadoAprobacion,
        };
    }

    async editarEstudiante(
        id: number,
        dto: Partial<{
            correo: string;
            ci: string;
            nombre: string;
            apellido: string;
            fechaNacimiento: string | null;
            asignacionesCarrera: Array<{ carreraId: number | string; cu: string }>;
            carnetRetenido?: boolean;
            carnetRetenidoOverride?: boolean | null;
        }>,
    ): Promise<EstudiantePublico> {
        const estudiante = await this.repositorioEstudiante.findOne({
            where: { id },
            relations: ['usuario', 'carreraRef'],
        });
        if (!estudiante) throw new NotFoundException('Estudiante no encontrado.');
        const usuario = estudiante.usuario!;

        let finalCi = estudiante.carnet;
        if (dto.ci && dto.ci.trim() !== estudiante.carnet) {
            finalCi = dto.ci.trim();
            const existe = await this.repositorioEstudiante.findOne({ where: { carnet: finalCi }, withDeleted: true });
            if (existe && existe.id !== estudiante.id) {
                throw new ConflictException('Ya existe un estudiante con ese CI.');
            }
            estudiante.carnet = finalCi;
        }

        if (dto.correo !== undefined || (dto.ci !== undefined && usuario.correo?.startsWith('estudiante-') && usuario.correo?.endsWith('@sgi.usfx'))) {
            let correo = dto.correo !== undefined ? dto.correo.trim().toLowerCase() : null;
            if (!correo) {
                correo = `estudiante-${finalCi}@sgi.usfx`;
            }
            if (correo !== usuario.correo) {
                const existe = await this.usuarioServicio.buscarPorCorreo(correo);
                if (existe && existe.id !== usuario.id) {
                    throw new ConflictException('Ya existe un usuario con ese correo electrónico.');
                }
                await this.usuarioServicio.actualizarCorreo(usuario.id, correo);
                usuario.correo = correo;
            }
        }

        if (dto.nombre !== undefined) estudiante.nombre = dto.nombre.trim();
        if (dto.apellido !== undefined) estudiante.apellido = dto.apellido.trim();
        
        if (dto.fechaNacimiento !== undefined) {
            if (dto.fechaNacimiento === null || !dto.fechaNacimiento.trim()) {
                estudiante.fechaNacimiento = undefined;
            } else {
                estudiante.fechaNacimiento = new Date(`${dto.fechaNacimiento.trim()}T00:00:00`);
            }
        }

        if (dto.asignacionesCarrera !== undefined) {
            const nuevasAsignaciones = await this.resolverAsignacionesCarrera({
                asignacionesCarrera: dto.asignacionesCarrera.map(a => ({
                    carreraId: Number(a.carreraId),
                    cu: a.cu
                })),
                correo: '', ci: '', nombre: '', apellido: '' 
            } as any);

            const cusMap = new Map<string, CarreraEntidad[]>();
            for (const { carrera, cu } of nuevasAsignaciones) {
                if (!cusMap.has(cu)) {
                    cusMap.set(cu, []);
                }
                cusMap.get(cu)!.push(carrera);
            }
            await this.validarCusDisponibles(Array.from(cusMap.keys()), estudiante.id);
            await this.repositorioEstudiante.manager.transaction(async (transactionalManager) => {
                await transactionalManager.delete(CuEntidad, { estudiante: { id: estudiante.id } });
                for (const [cuCodigo, carreras] of cusMap.entries()) {
                    const cuEntidad = transactionalManager.create(CuEntidad, {
                        codigo: cuCodigo,
                        estudiante,
                        carreras,
                    });
                    await transactionalManager.save(CuEntidad, cuEntidad);
                }
                if (nuevasAsignaciones.length > 0) {
                    const principal = nuevasAsignaciones[0];
                    estudiante.cu = principal.cu;
                    estudiante.carrera = principal.carrera.nombre;
                    estudiante.carreraRef = principal.carrera;
                } else {
                    estudiante.cu = null;
                    estudiante.carrera = null;
                    estudiante.carreraRef = null;
                }
                await transactionalManager.save(EstudianteEntidad, estudiante);
            });

        }

        if (dto.carnetRetenidoOverride !== undefined) {
            estudiante.carnetRetenidoOverride = dto.carnetRetenidoOverride;
            if (typeof dto.carnetRetenidoOverride === 'boolean') {
                estudiante.carnetRetenido = dto.carnetRetenidoOverride;
            }
        } else if (dto.carnetRetenido !== undefined) {
            estudiante.carnetRetenidoOverride = dto.carnetRetenido;
            estudiante.carnetRetenido = dto.carnetRetenido;
        }

        await this.repositorioEstudiante.save(estudiante);

        if (dto.carnetRetenidoOverride === null) {
            await this.prestamoUtilServicio.sincronizarCarnetRetenidoEstudiante(estudiante.id);
        }
        const actualizado = await this.repositorioEstudiante.findOne({
            where: { id: estudiante.id },
            relations: ['usuario', 'carreraRef', 'cus', 'cus.carreras'],
        });

        const asignacionesCarrera = this.consultaServicio.obtenerAsignacionesPublicas(actualizado!);
        return {
            id: actualizado!.id,
            rol: 'estudiante',
            correo: actualizado!.usuario!.correo ?? '',
            carnet: actualizado!.carnet,
            nombre: actualizado!.nombre,
            apellido: actualizado!.apellido,
            cu: asignacionesCarrera[0]?.cu ?? this.consultaServicio.normalizarCu(actualizado!.cu ?? null),
            carrera: asignacionesCarrera[0]?.carrera ?? actualizado!.carrera ?? null,
            cus: asignacionesCarrera.map((a) => a.cu),
            carreras: asignacionesCarrera.map((a) => a.carrera),
            asignacionesCarrera,
            carnetRetenido: actualizado!.carnetRetenido,
            carnetRetenidoOverride: actualizado!.carnetRetenidoOverride ?? null,
            fechaNacimiento: actualizado!.fechaNacimiento
                ? (actualizado!.fechaNacimiento instanceof Date
                    ? actualizado!.fechaNacimiento.toISOString().slice(0, 10)
                    : String(actualizado!.fechaNacimiento))
                : '',
            estadoAprobacion: actualizado!.estadoAprobacion,
        };
    }

    async editarCarnetRetenido(
        id: number,
        datos: Partial<{
            carnetRetenido: boolean;
            carnetRetenidoOverride: boolean | null;
        }>,
    ): Promise<EstudianteEntidad> {
        const estudiante = await this.repositorioEstudiante.findOne({
            where: { id },
            relations: ['carreraRef', 'cus', 'cus.carreras'],
        });
        if (!estudiante) {
            throw new NotFoundException('Estudiante no encontrado.');
        }

        if (datos.carnetRetenidoOverride !== undefined) {
            estudiante.carnetRetenidoOverride = datos.carnetRetenidoOverride;
            if (typeof datos.carnetRetenidoOverride === 'boolean') {
                estudiante.carnetRetenido = datos.carnetRetenidoOverride;
            }
        } else if (datos.carnetRetenido !== undefined) {
            estudiante.carnetRetenidoOverride = datos.carnetRetenido;
            estudiante.carnetRetenido = datos.carnetRetenido;
        }

        const guardado = await this.repositorioEstudiante.save(estudiante);

        if (guardado.carnetRetenidoOverride === null) {
            await this.prestamoUtilServicio.sincronizarCarnetRetenidoEstudiante(guardado.id);
            return (await this.repositorioEstudiante.findOne({
                where: { id },
                relations: ['carreraRef', 'cus', 'cus.carreras'],
            }))!;
        }

        return guardado;
    }

    async eliminarEstudiante(id: number): Promise<void> {
        const estudiante = await this.repositorioEstudiante.findOne({ where: { id } });
        if (!estudiante) {
            throw new NotFoundException('Estudiante no encontrado.');
        }
        await this.repositorioEstudiante.softRemove(estudiante);
    }

    async aprobarEstudiante(id: number, usuarioActual: { id: number; rol: string }): Promise<void> {
        const estudiante = await this.repositorioEstudiante.findOne({
            where: { id },
            relations: ['usuario', 'carreraRef', 'cus', 'cus.carreras'],
        });
        if (!estudiante) throw new NotFoundException('Estudiante no encontrado.');
        if (estudiante.estadoAprobacion !== 'pendiente') {
            throw new BadRequestException('El estudiante no tiene una solicitud pendiente.');
        }

        if (usuarioActual.rol === 'encargado_inventario') {
            const encargado = await this.repositorioEstudiante.manager.getRepository(EncargadoInventarioEntidad).findOne({
                where: { usuario: { id: usuarioActual.id } },
                relations: ['inventario'],
            });
            if (!encargado || !encargado.inventario) {
                throw new ForbiddenException('No tienes un inventario asignado.');
            }
            const inventarioId = encargado.inventario.id;

            const carreraIds = [
                estudiante.carreraRef?.id,
                ...(estudiante.cus ?? []).flatMap(cu => (cu.carreras ?? []).map(c => c.id))
            ].filter((id): id is number => typeof id === 'number');

            if (carreraIds.length === 0) {
                throw new ForbiddenException('El estudiante no tiene carreras asignadas.');
            }

            const carrerasConInventario = await this.repositorioCarrera.createQueryBuilder('carrera')
                .leftJoinAndSelect('carrera.inventarios', 'inventario')
                .where('carrera.id IN (:...carreraIds)', { carreraIds })
                .getMany();

            const tieneInventarioAsignado = carrerasConInventario.some(c => 
                c.inventarios?.some(i => i.id === inventarioId)
            );

            if (!tieneInventarioAsignado) {
                throw new ForbiddenException('No tienes permisos para aprobar a este estudiante.');
            }
        }

        estudiante.estadoAprobacion = 'aprobado';
        await this.repositorioEstudiante.save(estudiante);

        if (estudiante.usuario) {
            estudiante.usuario.estado = true;
            await this.repositorioEstudiante.manager.save(estudiante.usuario);
        }
    }

    async rechazarEstudiante(id: number, usuarioActual: { id: number; rol: string }): Promise<void> {
        const estudiante = await this.repositorioEstudiante.findOne({
            where: { id },
            relations: ['usuario', 'carreraRef', 'cus', 'cus.carreras'],
        });
        if (!estudiante) throw new NotFoundException('Estudiante no encontrado.');
        if (estudiante.estadoAprobacion !== 'pendiente') {
            throw new BadRequestException('El estudiante no tiene una solicitud pendiente.');
        }

        if (usuarioActual.rol === 'encargado_inventario') {
            const encargado = await this.repositorioEstudiante.manager.getRepository(EncargadoInventarioEntidad).findOne({
                where: { usuario: { id: usuarioActual.id } },
                relations: ['inventario'],
            });
            if (!encargado || !encargado.inventario) {
                throw new ForbiddenException('No tienes un inventario asignado.');
            }
            const inventarioId = encargado.inventario.id;

            const carreraIds = [
                estudiante.carreraRef?.id,
                ...(estudiante.cus ?? []).flatMap(cu => (cu.carreras ?? []).map(c => c.id))
            ].filter((id): id is number => typeof id === 'number');

            if (carreraIds.length === 0) {
                throw new ForbiddenException('El estudiante no tiene carreras asignadas.');
            }

            const carrerasConInventario = await this.repositorioCarrera.createQueryBuilder('carrera')
                .leftJoinAndSelect('carrera.inventarios', 'inventario')
                .where('carrera.id IN (:...carreraIds)', { carreraIds })
                .getMany();

            const tieneInventarioAsignado = carrerasConInventario.some(c => 
                c.inventarios?.some(i => i.id === inventarioId)
            );

            if (!tieneInventarioAsignado) {
                throw new ForbiddenException('No tienes permisos para rechazar a este estudiante.');
            }
        }

        estudiante.estadoAprobacion = 'rechazado';
        await this.repositorioEstudiante.save(estudiante);

        if (estudiante.usuario) {
            estudiante.usuario.estado = false;
            await this.repositorioEstudiante.manager.save(estudiante.usuario);
        }
    }
}

