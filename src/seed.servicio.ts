import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivoFijo } from './modulos/activo/entidades/activo-fijo.entidad';
import { ItemActivoFijo } from './modulos/activo/entidades/item-activo-fijo.entidad';
import { ContenedorMaterial } from './modulos/material/entidades/contenedor_material.entidad';
import { MaterialFungible } from './modulos/material/entidades/material_fungible.entidad';
import { LoteMaterial } from './modulos/material/entidades/lote_material.entidad';
import { MovimientoMaterial } from './modulos/material/entidades/movimiento_material.entidad';
import { EstudianteEntidad } from './modulos/prestamo/entidades/estudiante.entidad';
import { DocenteEntidad } from './modulos/prestamo/entidades/docente.entidad';
import { PrestamoEntidad } from './modulos/prestamo/entidades/prestamo.entidad';
import { SEED_ACTIVOS_FIJOS } from './seed/seed-activos-fijos';

@Injectable()
export class SeedServicio {
    private readonly logger = new Logger(SeedServicio.name);

    private normalizarNombreActivo(nombreBase: string) {
        const limpio = String(nombreBase ?? '').trim().replace(/\s+/g, ' ');
        const MAX = 100;
        if (limpio.length <= MAX) {
            return { nombre: limpio, descripcion: null as string | null };
        }

        // Para no violar `varchar(100)`, recortamos y guardamos el texto completo en `descripcion`.
        const target = MAX - 1; // reserva para elipsis
        const slice = limpio.slice(0, target);
        const lastPunct = Math.max(slice.lastIndexOf('.'), slice.lastIndexOf(';'), slice.lastIndexOf(','));
        const lastSpace = slice.lastIndexOf(' ');
        let cut = Math.max(lastPunct, lastSpace);
        if (cut < 30) cut = target; // evita nombres absurdamente cortos

        const nombre = `${slice.slice(0, cut).trimEnd()}…`;
        return { nombre, descripcion: limpio };
    }

    constructor(
        @InjectRepository(ActivoFijo)
        private readonly activosRepo: Repository<ActivoFijo>,
        @InjectRepository(ItemActivoFijo)
        private readonly itemsRepo: Repository<ItemActivoFijo>,
        @InjectRepository(ContenedorMaterial)
        private readonly contenedoresRepo: Repository<ContenedorMaterial>,
        @InjectRepository(MaterialFungible)
        private readonly materialesRepo: Repository<MaterialFungible>,
        @InjectRepository(LoteMaterial)
        private readonly lotesRepo: Repository<LoteMaterial>,
        @InjectRepository(MovimientoMaterial)
        private readonly movimientosMaterialRepo: Repository<MovimientoMaterial>,
        @InjectRepository(EstudianteEntidad)
        private readonly estudiantesRepo: Repository<EstudianteEntidad>,
        @InjectRepository(DocenteEntidad)
        private readonly docentesRepo: Repository<DocenteEntidad>,
        @InjectRepository(PrestamoEntidad)
        private readonly prestamosRepo: Repository<PrestamoEntidad>,
    ) { }

    async seedActivosFijos() {
        const seedForceRefresh = (process.env.SEED_FORCE_REFRESH ?? '').toLowerCase() === 'true';

        // Marcador simple de idempotencia: si ya existe al menos 1 item con alguno
        // de los códigos del seeder, no re-insertamos a menos que se fuerce.
        const primerCodigo = SEED_ACTIVOS_FIJOS.find((g) => g.items.length)?.items?.[0]?.codigoInventario ?? null;
        if (primerCodigo && !seedForceRefresh) {
            const existente = await this.itemsRepo.findOne({
                where: { codigo_inventario: primerCodigo },
                withDeleted: true,
            });
            if (existente) {
                this.logger.log('Seed de activos fijos omitido: datos ya existen. (Usa SEED_FORCE_REFRESH=true para forzar)');
                return;
            }
        }

        this.logger.log(`Aplicando seed de activos fijos: ${SEED_ACTIVOS_FIJOS.length} grupos...`);

        for (const grupo of SEED_ACTIVOS_FIJOS) {
            const normalizado = this.normalizarNombreActivo(grupo.nombreBase);

            // 1) Preferir encontrar el ActivoFijo vía un item existente del grupo (evita duplicados
            // cuando la base ya tenía datos pero con nombre distinto/recortado).
            const itemReferencia =
                grupo.items.find((i) => i.codigoInventario) ??
                grupo.items.find((i) => i.codigoSistema) ??
                grupo.items.find((i) => i.codigoUnico) ??
                null;
            let activo: ActivoFijo | null = null;

            if (itemReferencia) {
                const existente = itemReferencia.codigoInventario
                    ? await this.itemsRepo.findOne({ where: { codigo_inventario: itemReferencia.codigoInventario }, withDeleted: true, relations: ['activo'] })
                    : itemReferencia.codigoSistema
                        ? await this.itemsRepo.findOne({ where: { codigo_sistema: itemReferencia.codigoSistema }, withDeleted: true, relations: ['activo'] })
                        : itemReferencia.codigoUnico
                            ? await this.itemsRepo.findOne({ where: { codigo_unico: itemReferencia.codigoUnico }, withDeleted: true, relations: ['activo'] })
                            : null;
                activo = (existente?.activo as ActivoFijo) ?? null;
            }

            // 2) Fallback por (nombre,categoria) ya normalizado.
            if (!activo) {
                activo = await this.activosRepo.findOne({
                    where: { nombre: normalizado.nombre, categoria: grupo.categoria },
                    withDeleted: true,
                });
            }

            if (!activo) {
                activo = this.activosRepo.create({
                    nombre: normalizado.nombre,
                    categoria: grupo.categoria,
                    descripcion: normalizado.descripcion ?? undefined,
                });
                activo = await this.activosRepo.save(activo);
            } else {
                // Mantiene el activo actualizado si cambiaron campos del seeder.
                Object.assign(activo, {
                    nombre: normalizado.nombre,
                    categoria: grupo.categoria,
                    descripcion: normalizado.descripcion ?? activo.descripcion ?? undefined,
                });
                activo = await this.activosRepo.save(activo);
            }

            for (const itemSeed of grupo.items) {
                // Importante: evitar búsquedas OR con campos ambiguos (ej. `codigoUnico` repetido).
                // Priorizamos claves fuertes para que el seed sea determinístico y no provoque colisiones
                // en uniques (ej. `codigo_inventario`).
                let item: ItemActivoFijo | null = null;
                if (itemSeed.codigoInventario) {
                    item = await this.itemsRepo.findOne({
                        where: { codigo_inventario: itemSeed.codigoInventario },
                        withDeleted: true,
                        relations: ['activo'],
                    });
                } else if (itemSeed.codigoSistema) {
                    item = await this.itemsRepo.findOne({
                        where: { codigo_sistema: itemSeed.codigoSistema },
                        withDeleted: true,
                        relations: ['activo'],
                    });
                } else if (itemSeed.codigoUnico) {
                    item = await this.itemsRepo.findOne({
                        where: { codigo_unico: itemSeed.codigoUnico },
                        withDeleted: true,
                        relations: ['activo'],
                    });
                }

                if (!item) {
                    item = this.itemsRepo.create({
                        activo,
                        codigo_inventario: itemSeed.codigoInventario,
                        codigo_unico: itemSeed.codigoUnico,
                        codigo_sistema: itemSeed.codigoSistema,
                        descripcion: itemSeed.descripcion,
                        ue: grupo.ue,
                        estado_fisico: itemSeed.estadoFisico,
                        estado: 'disponible',
                        precio: 0,
                    });
                } else {
                    Object.assign(item, {
                        activo,
                        codigo_inventario: itemSeed.codigoInventario,
                        codigo_unico: itemSeed.codigoUnico,
                        codigo_sistema: itemSeed.codigoSistema,
                        descripcion: itemSeed.descripcion,
                        ue: grupo.ue,
                        estado_fisico: itemSeed.estadoFisico,
                        deleted_at: null,
                    });
                }

                await this.itemsRepo.save(item);
            }
        }

        this.logger.log('Seed de activos fijos aplicado.');
    }

    async seedDemo() {
        const seedForceRefresh = (process.env.SEED_FORCE_REFRESH ?? '').toLowerCase() === 'true';
        const seedExistente = await this.prestamosRepo
            .createQueryBuilder('p')
            .where("p.observaciones LIKE :marca", { marca: '[EJEMPLO SGI]%' })
            .andWhere('p.deleted_at IS NULL')
            .getOne();
        if (seedExistente && !seedForceRefresh) {
            this.logger.log('Seed demo omitido: datos ya existen.');
            return;
        }

        let activo = await this.activosRepo.findOne({ where: { nombre: 'Taladro de prueba' } });
        if (!activo) {
            activo = this.activosRepo.create({ nombre: 'Taladro de prueba' });
            await this.activosRepo.save(activo);
        }

        const ensureItem = async (
            codigoInventario: string,
            fechaEntrega: string,
            fechaRetiro: string | null,
            estado: string,
            observaciones: string,
            precio: number,
        ) => {
            const item = await this.itemsRepo.findOne({ where: { codigo_inventario: codigoInventario } });
            if (item) {
                Object.assign(item, {
                    codigo_inventario: codigoInventario,
                    fecha_entrega: fechaEntrega as unknown as Date,
                    fecha_retiro: (fechaRetiro as unknown as Date) ?? undefined,
                    estado,
                    observaciones,
                    precio,
                    activo,
                });
                return this.itemsRepo.save(item);
            }
            return this.itemsRepo.save(this.itemsRepo.create({
                activo,
                codigo_inventario: codigoInventario,
                fecha_entrega: fechaEntrega as unknown as Date,
                fecha_retiro: (fechaRetiro as unknown as Date) ?? undefined,
                estado,
                observaciones,
                precio,
            }));
        };

        await ensureItem('ACT-TEST-001', '2026-03-01', null, 'buen_estado', 'Item de prueba', 1200);
        await ensureItem('ACT-TEST-002', '2026-02-15', '2026-03-09', 'regular', 'Item retirado para mantenimiento', 980);

        let contenedor = await this.contenedoresRepo.findOne({ where: { nombre: 'Contenedor prueba', ubicacion: 'Laboratorio' } });
        if (!contenedor) {
            contenedor = this.contenedoresRepo.create({ nombre: 'Contenedor prueba', ubicacion: 'Laboratorio' });
            await this.contenedoresRepo.save(contenedor);
        }

        let material = await this.materialesRepo.findOne({ where: { nombre: 'Cable de prueba' }, relations: ['contenedor'] });
        if (!material) {
            material = this.materialesRepo.create({
                contenedor,
                nombre: 'Cable de prueba',
                categoria: 'Material eléctrico',
                descripcion: 'Caja/material de prueba',
                unidad: 'metros',
                stockMinimo: 5,
            });
            await this.materialesRepo.save(material);
        }

        const ensureLote = async (
            lote: string,
            fechaEntrega: string,
            fechaRetiro: string | null,
            cantidadDisponible: number,
            fechaCaducidad: string | null,
            precio: number,
        ) => {
            const loteDb = await this.lotesRepo.findOne({ where: { lote, material: { id: material!.id } }, relations: ['material'] });
            if (loteDb) {
                Object.assign(loteDb, { material, lote, fechaEntrega, fechaRetiro, cantidadDisponible, fechaCaducidad, precio });
                return this.lotesRepo.save(loteDb);
            }
            return this.lotesRepo.save(this.lotesRepo.create({
                material,
                lote,
                fechaEntrega,
                fechaRetiro: fechaRetiro ?? undefined,
                cantidadDisponible,
                fechaCaducidad: fechaCaducidad ?? undefined,
                precio,
            }));
        };

        await ensureLote('LOTE-TEST-001', '2026-03-02', null, 25, null, 3.5);
        await ensureLote('LOTE-TEST-002', '2026-01-20', '2026-03-06', 8, '2027-01-30', 3.8);

        const lotesMaterial = await this.lotesRepo.find({ where: { material: { id: material.id } }, relations: ['material'] });
        for (const lote of lotesMaterial) {
            const existeEntrada = await this.movimientosMaterialRepo.findOne({ where: { lote: { id: lote.id }, tipo: 'entrada' as any } });
            if (!existeEntrada) {
                await this.movimientosMaterialRepo.save(this.movimientosMaterialRepo.create({
                    lote,
                    tipo: 'entrada',
                    cantidad: lote.cantidadDisponible,
                    motivo: 'Inventario inicial',
                    referencia: `SEED-${lote.lote}`,
                }));
            }
        }

        const ensureEstudiante = async (
            carnet: string,
            nombre: string,
            apellido: string,
            carrera: string,
            semestre: number,
        ) => {
            const existente = await this.estudiantesRepo.findOne({ where: { carnet } });
            if (existente) {
                Object.assign(existente, { nombre, apellido, carrera, semestre });
                return this.estudiantesRepo.save(existente);
            }
            return this.estudiantesRepo.save(this.estudiantesRepo.create({
                carnet,
                nombre,
                apellido,
                carrera,
                semestre,
            }));
        };

        const ensureDocente = async (
            codigo: string,
            nombre: string,
            apellido: string,
            materia: string,
            carnet: string,
        ) => {
            const existente = await this.docentesRepo.findOne({ where: { codigo } });
            if (existente) {
                Object.assign(existente, { nombre, apellido, materia, carnet });
                return this.docentesRepo.save(existente);
            }
            return this.docentesRepo.save(this.docentesRepo.create({
                codigo,
                nombre,
                apellido,
                materia,
                carnet,
            }));
        };

        const est1 = await ensureEstudiante('2021-15430', 'Carlos Eduardo', 'Mamani Quispe', 'Ing. Electronica', 6);
        const est2 = await ensureEstudiante('2022-08712', 'Lucia Fernanda', 'Torrez Mamani', 'Ing. Industrial', 4);
        await ensureEstudiante('2020-33891', 'Rodrigo Andres', 'Vasquez Chavez', 'Ing. Mecanica', 8);

        const doc1 = await ensureDocente('DOC-001', 'Alan', 'Brito', 'SIS245', '1234567');
        const doc2 = await ensureDocente('DOC-002', 'Maria', 'Lopez', 'SIS104', '7654321');
        const doc3 = await ensureDocente('DOC-003', 'Armando', 'Casas', 'SIS101', '3456789');

        const itemA = await this.itemsRepo.findOne({ where: { codigo_inventario: 'ACT-TEST-001' } });
        const itemB = await this.itemsRepo.findOne({ where: { codigo_inventario: 'ACT-TEST-002' } });

        const ensurePrestamo = async (
            carnetEstudiante: string,
            codigoDocente: string,
            itemActivo: ItemActivoFijo | null,
            fechaPrestamo: string,
            fechaDevolucion: string | null,
            estado: string,
            observaciones: string,
        ) => {
            if (!itemActivo) return;
            const codigoHerramienta = String(itemActivo.id);

            const prestamo = await this.prestamosRepo.findOne({
                where: {
                    codigoHerramienta,
                    fechaPrestamo: fechaPrestamo as unknown as Date,
                    estudiante: { carnet: carnetEstudiante },
                },
                relations: ['estudiante', 'docente'],
            });

            const estudiante = await this.estudiantesRepo.findOne({ where: { carnet: carnetEstudiante } });
            const docente = await this.docentesRepo.findOne({ where: { codigo: codigoDocente } });
            if (!estudiante || !docente) return;

            if (prestamo) {
                Object.assign(prestamo, {
                    estudiante,
                    docente,
                    itemActivo,
                    codigoHerramienta,
                    fechaPrestamo: fechaPrestamo as unknown as Date,
                    fechaDevolucion: (fechaDevolucion as unknown as Date) ?? null,
                    estado,
                    observaciones,
                });
                return this.prestamosRepo.save(prestamo);
            }

            return this.prestamosRepo.save(this.prestamosRepo.create({
                estudiante,
                docente,
                itemActivo,
                codigoHerramienta,
                fechaPrestamo: fechaPrestamo as unknown as Date,
                fechaDevolucion: (fechaDevolucion as unknown as Date) ?? null,
                estado,
                observaciones,
            }));
        };

        await ensurePrestamo(est1.carnet, doc1.codigo, itemA ?? null, '2026-03-10T08:00:00', '2026-03-20T18:00:00', 'activo', '[EJEMPLO SGI] Prestamo activo de laboratorio');
        await ensurePrestamo(est2.carnet, doc3.codigo, itemB ?? null, '2026-02-25T09:30:00', '2026-03-01T09:30:00', 'vencido', '[EJEMPLO SGI] Prestamo vencido para seguimiento');
        await ensurePrestamo(est2.carnet, doc2.codigo, itemA ?? null, '2026-02-10T10:00:00', '2026-02-12T10:00:00', 'devuelto', '[EJEMPLO SGI] Prestamo historico devuelto');

        this.logger.log('Seed demo aplicado (activos/materiales/prestamos)');
    }
}
