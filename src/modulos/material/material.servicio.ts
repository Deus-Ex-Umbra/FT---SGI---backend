import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContenedorMaterial } from './contenedor_material.entidad';
import { MaterialFungible } from './material_fungible.entidad';
import { LoteMaterial } from './lote_material.entidad';
import { MovimientoMaterial } from './movimiento_material.entidad';

@Injectable()
export class MaterialServicio {
    constructor(
        @InjectRepository(ContenedorMaterial)
        private readonly contenedorRepositorio: Repository<ContenedorMaterial>,
        @InjectRepository(MaterialFungible)
        private readonly materialRepositorio: Repository<MaterialFungible>,
        @InjectRepository(LoteMaterial)
        private readonly loteRepositorio: Repository<LoteMaterial>,
        @InjectRepository(MovimientoMaterial)
        private readonly movimientoRepositorio: Repository<MovimientoMaterial>,
    ) { }

    async obtenerContenedores(): Promise<ContenedorMaterial[]> {
        return await this.contenedorRepositorio.find({ relations: ['materiales'] });
    }

    // "Caja" en el contexto de la aplicación, guardado como MaterialFungible
    async obtenerCajas(): Promise<MaterialFungible[]> {
        return await this.materialRepositorio.find({ relations: ['contenedor', 'lotes'] });
    }

    async obtenerLotes(): Promise<LoteMaterial[]> {
        return await this.loteRepositorio.find({ relations: ['material'] });
    }

    async obtenerKardexMaterial(idMaterial: number) {
        const lotes = await this.loteRepositorio.find({
            where: { material: { id: idMaterial } },
            relations: ['material'],
            order: { id: 'ASC' },
        });

        if (lotes.length === 0) {
            return {
                materialId: idMaterial,
                materialNombre: null,
                movimientos: [],
            };
        }

        const idsLotes = lotes.map((l) => l.id);
        const movimientos = await this.movimientoRepositorio.find({
            where: idsLotes.map((id) => ({ lote: { id } })),
            relations: ['lote', 'lote.material'],
            order: { fecha: 'ASC', id: 'ASC' },
        });

        return {
            materialId: idMaterial,
            materialNombre: lotes[0].material.nombre,
            movimientos: movimientos.map((m) => ({
                id: m.id,
                fecha: m.fecha,
                tipo: m.tipo,
                cantidad: m.cantidad,
                motivo: m.motivo,
                referencia: m.referencia ?? '',
                lote: m.lote?.lote ?? '',
            })),
        };
    }
}
