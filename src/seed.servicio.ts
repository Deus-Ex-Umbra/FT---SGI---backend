import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivoFijo } from './modulos/activo/activo_fijo.entidad';
import { ItemActivo } from './modulos/activo/item_activo.entidad';
import { ContenedorMaterial } from './modulos/material/contenedor_material.entidad';
import { MaterialFungible } from './modulos/material/material_fungible.entidad';
import { LoteMaterial } from './modulos/material/lote_material.entidad';
import { MovimientoMaterial } from './modulos/material/movimiento_material.entidad';
import { EstudianteEntidad } from './modulos/prestamo/estudiante.entidad';
import { DocenteEntidad } from './modulos/prestamo/docente.entidad';
import { PrestamoEntidad } from './modulos/prestamo/prestamo.entidad';

@Injectable()
export class SeedServicio {
    private readonly logger = new Logger(SeedServicio.name);

    constructor(
        @InjectRepository(ActivoFijo)
        private readonly activosRepo: Repository<ActivoFijo>,
        @InjectRepository(ItemActivo)
        private readonly itemsRepo: Repository<ItemActivo>,
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

    async seedDemo() {
        const seedForceRefresh = (process.env.SEED_FORCE_REFRESH ?? '').toLowerCase() === 'true';
        const seedExistente = await this.prestamosRepo.findOne({ where: { codigoHerramienta: 'S01' } });
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
            const item = await this.itemsRepo.findOne({ where: { codigoInventario } });
            if (item) {
                Object.assign(item, { codigoInventario, fechaEntrega, fechaRetiro, estado, observaciones, precio, activo });
                return this.itemsRepo.save(item);
            }
            return this.itemsRepo.save(this.itemsRepo.create({
                activo,
                codigoInventario,
                fechaEntrega,
                fechaRetiro: fechaRetiro ?? undefined,
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

        const itemA = await this.itemsRepo.findOne({ where: { codigoInventario: 'ACT-TEST-001' } });
        const itemB = await this.itemsRepo.findOne({ where: { codigoInventario: 'ACT-TEST-002' } });

        const ensurePrestamo = async (
            carnetEstudiante: string,
            codigoDocente: string,
            codigoHerramienta: string,
            fechaPrestamo: string,
            fechaDevolucion: string | null,
            estado: string,
            observaciones: string,
            itemActivo: ItemActivo | null,
        ) => {
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

        await ensurePrestamo(est1.carnet, doc1.codigo, 'S01', '2026-03-01T08:00:00', null, 'pendiente', 'Para practica de automatizacion', itemA ?? null);
        await ensurePrestamo(est2.carnet, doc3.codigo, 'S03', '2026-02-25T09:30:00', null, 'vencido', 'No devolvio en fecha acordada', itemB ?? null);
        await ensurePrestamo(est1.carnet, doc2.codigo, 'S05', '2026-02-28T10:00:00', '2026-03-02T10:00:00', 'devuelto', '', itemB ?? null);

        this.logger.log('Seed demo aplicado (activos/materiales/prestamos)');
    }
}
