import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivoFijo } from './modulos/activo/entidades/activo-fijo.entidad';
import { ItemActivoFijo } from './modulos/activo/entidades/item-activo-fijo.entidad';
import { EstudianteEntidad } from '@/modulos/estudiante/entidades/estudiante.entidad';
import { DocenteEntidad } from '@/modulos/docente/entidades/docente.entidad';
import { PrestamoEntidad } from './modulos/prestamo/entidades/prestamo.entidad';
import { SeedActivosServicio } from './seed-activos.servicio';

@Injectable()
export class SeedServicio {
    private readonly logger = new Logger(SeedServicio.name);

    constructor(
        private readonly seedActivosServicio: SeedActivosServicio,
        @InjectRepository(ActivoFijo)
        private readonly activosRepo: Repository<ActivoFijo>,
        @InjectRepository(ItemActivoFijo)
        private readonly itemsRepo: Repository<ItemActivoFijo>,
        @InjectRepository(EstudianteEntidad)
        private readonly estudiantesRepo: Repository<EstudianteEntidad>,
        @InjectRepository(DocenteEntidad)
        private readonly docentesRepo: Repository<DocenteEntidad>,
        @InjectRepository(PrestamoEntidad)
        private readonly prestamosRepo: Repository<PrestamoEntidad>,
    ) {}

    async seedActivosFijos() {
        return this.seedActivosServicio.seedActivosFijos();
    }

    async seedDemo() {
        await this.seedActivosFijos();

        this.logger.log('Aplicando datos adicionales de demo (préstamos históricos)...');

        let activo = await this.activosRepo.findOne({ where: { nombre: 'Taladro de prueba' } });
        if (!activo) {
            activo = this.activosRepo.create({ nombre: 'Taladro de prueba', categoria: 'Herramientas' });
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

        this.logger.log('Seed de demo completado.');
    }
}
