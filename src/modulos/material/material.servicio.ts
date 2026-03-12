import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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

    async crearContenedor(datos: { nombre: string; ubicacion: string }): Promise<ContenedorMaterial> {
        const nombre = datos.nombre?.trim();
        const ubicacion = datos.ubicacion?.trim();
        if (!nombre || !ubicacion) {
            throw new BadRequestException('Nombre y ubicación del contenedor son obligatorios.');
        }

        const contenedor = this.contenedorRepositorio.create({ nombre, ubicacion });
        return this.contenedorRepositorio.save(contenedor);
    }

    async editarContenedor(
        id: number,
        datos: Partial<{ nombre: string; ubicacion: string }>,
    ): Promise<ContenedorMaterial> {
        const contenedor = await this.contenedorRepositorio.findOne({ where: { id } });
        if (!contenedor) throw new NotFoundException('Contenedor de material no encontrado.');

        if (typeof datos.nombre === 'string' && datos.nombre.trim()) {
            contenedor.nombre = datos.nombre.trim();
        }
        if (typeof datos.ubicacion === 'string' && datos.ubicacion.trim()) {
            contenedor.ubicacion = datos.ubicacion.trim();
        }

        return this.contenedorRepositorio.save(contenedor);
    }

    async eliminarContenedor(id: number): Promise<void> {
        const contenedor = await this.contenedorRepositorio.findOne({ where: { id }, relations: ['materiales', 'materiales.lotes'] });
        if (!contenedor) throw new NotFoundException('Contenedor de material no encontrado.');

        const materiales = contenedor.materiales ?? [];
        const lotes = materiales.flatMap((material) => material.lotes ?? []);

        if (lotes.length > 0) {
            await this.loteRepositorio.softRemove(lotes);
        }
        if (materiales.length > 0) {
            await this.materialRepositorio.softRemove(materiales);
        }
        await this.contenedorRepositorio.softRemove(contenedor);
    }

    async crearCaja(datos: {
        idContenedor: number;
        nombre: string;
        categoria?: string;
        descripcion?: string;
        unidad?: string;
        stockMinimo?: number;
    }): Promise<MaterialFungible> {
        const contenedor = await this.contenedorRepositorio.findOne({ where: { id: Number(datos.idContenedor) } });
        if (!contenedor) {
            throw new NotFoundException('Contenedor de material no encontrado.');
        }

        const nombre = datos.nombre?.trim();
        if (!nombre) {
            throw new BadRequestException('El nombre de la caja es obligatorio.');
        }

        const caja = this.materialRepositorio.create({
            contenedor,
            nombre,
            categoria: datos.categoria?.trim() || 'Fungible',
            descripcion: datos.descripcion?.trim() || '',
            unidad: datos.unidad?.trim() || 'Unidades',
            stockMinimo: Number(datos.stockMinimo ?? 0),
        });

        return this.materialRepositorio.save(caja);
    }

    async editarCaja(
        id: number,
        datos: Partial<{ nombre: string; categoria: string; descripcion: string; unidad: string; stockMinimo: number }>,
    ): Promise<MaterialFungible> {
        const caja = await this.materialRepositorio.findOne({ where: { id }, relations: ['contenedor'] });
        if (!caja) throw new NotFoundException('Caja/material no encontrado.');

        if (typeof datos.nombre === 'string' && datos.nombre.trim()) caja.nombre = datos.nombre.trim();
        if (typeof datos.categoria === 'string' && datos.categoria.trim()) caja.categoria = datos.categoria.trim();
        if (typeof datos.descripcion === 'string') caja.descripcion = datos.descripcion.trim();
        if (typeof datos.unidad === 'string' && datos.unidad.trim()) caja.unidad = datos.unidad.trim();
        if (typeof datos.stockMinimo === 'number' && Number.isFinite(datos.stockMinimo)) {
            caja.stockMinimo = Number(datos.stockMinimo);
        }

        return this.materialRepositorio.save(caja);
    }

    async eliminarCaja(id: number): Promise<void> {
        const caja = await this.materialRepositorio.findOne({ where: { id }, relations: ['lotes'] });
        if (!caja) throw new NotFoundException('Caja/material no encontrado.');

        const lotes = caja.lotes ?? [];
        if (lotes.length > 0) {
            await this.loteRepositorio.softRemove(lotes);
        }
        await this.materialRepositorio.softRemove(caja);
    }

    async crearLote(datos: {
        idMaterial: number;
        lote: string;
        fechaEntrega?: string | null;
        fechaRetiro?: string | null;
        cantidadDisponible?: number;
        fechaCaducidad?: string | null;
        precio?: number;
    }): Promise<LoteMaterial> {
        const material = await this.materialRepositorio.findOne({ where: { id: Number(datos.idMaterial) } });
        if (!material) {
            throw new NotFoundException('Caja/material no encontrado.');
        }

        const loteCodigo = datos.lote?.trim();
        if (!loteCodigo) {
            throw new BadRequestException('El código de lote es obligatorio.');
        }

        const lote = this.loteRepositorio.create({
            material,
            lote: loteCodigo,
            fechaEntrega: datos.fechaEntrega ? new Date(datos.fechaEntrega) : undefined,
            fechaRetiro: datos.fechaRetiro ? new Date(datos.fechaRetiro) : undefined,
            cantidadDisponible: Number(datos.cantidadDisponible ?? 0),
            fechaCaducidad: datos.fechaCaducidad ? new Date(datos.fechaCaducidad) : undefined,
            precio: Number(datos.precio ?? 0),
        });

        return this.loteRepositorio.save(lote);
    }

    async editarLote(
        id: number,
        datos: Partial<{ lote: string; fechaEntrega: string | null; fechaRetiro: string | null; cantidadDisponible: number; fechaCaducidad: string | null; precio: number }>,
    ): Promise<LoteMaterial> {
        const lote = await this.loteRepositorio.findOne({ where: { id }, relations: ['material'] });
        if (!lote) throw new NotFoundException('Lote no encontrado.');

        if (typeof datos.lote === 'string' && datos.lote.trim()) lote.lote = datos.lote.trim();
        if (datos.fechaEntrega !== undefined) lote.fechaEntrega = datos.fechaEntrega ? new Date(datos.fechaEntrega) : undefined;
        if (datos.fechaRetiro !== undefined) lote.fechaRetiro = datos.fechaRetiro ? new Date(datos.fechaRetiro) : undefined;
        if (typeof datos.cantidadDisponible === 'number' && Number.isFinite(datos.cantidadDisponible)) {
            lote.cantidadDisponible = Number(datos.cantidadDisponible);
        }
        if (datos.fechaCaducidad !== undefined) lote.fechaCaducidad = datos.fechaCaducidad ? new Date(datos.fechaCaducidad) : undefined;
        if (typeof datos.precio === 'number' && Number.isFinite(datos.precio)) lote.precio = Number(datos.precio);

        return this.loteRepositorio.save(lote);
    }

    async eliminarLote(id: number): Promise<void> {
        const lote = await this.loteRepositorio.findOne({ where: { id } });
        if (!lote) throw new NotFoundException('Lote no encontrado.');
        await this.loteRepositorio.remove(lote);
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
