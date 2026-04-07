import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { ContenedorActivo } from './entidades/contenedor-activo.entidad';
import { ContenedorMaterial } from '@/modulos/material/entidades/contenedor_material.entidad';

export interface ContenedorCompartido {
    id: string;
    nombre: string;
    descripcion: string;
    idActivo?: number;
    idMaterial?: number;
}

@Injectable()
export class ContenedorCompartidoServicio {
    constructor(
        @InjectDataSource()
        private readonly dataSource: DataSource,
        @InjectRepository(ContenedorActivo)
        private readonly contenedorActivoRepositorio: Repository<ContenedorActivo>,
        @InjectRepository(ContenedorMaterial)
        private readonly contenedorMaterialRepositorio: Repository<ContenedorMaterial>,
    ) {}

    async obtenerTodos(): Promise<ContenedorCompartido[]> {
        const [contenedoresActivos, contenedoresMateriales] = await Promise.all([
            this.contenedorActivoRepositorio.find({ where: { deleted_at: IsNull() }, order: { id: 'ASC' } }),
            this.contenedorMaterialRepositorio.find({ where: { deletedAt: IsNull() }, order: { id: 'ASC' } }),
        ]);

        const agrupados = new Map<string, ContenedorCompartido>();

        const agregar = (payload: { id: number; nombre: string; ubicacion: string; tipo: 'activo' | 'material' }) => {
            const nombre = payload.nombre.trim();
            const descripcion = payload.ubicacion.trim();
            const clave = `${nombre.toLowerCase()}::${descripcion.toLowerCase()}`;
            const actual = agrupados.get(clave) ?? {
                id: `CA0-CM0-${clave}`,
                nombre,
                descripcion,
            };

            if (payload.tipo === 'activo') {
                actual.idActivo = payload.id;
            } else {
                actual.idMaterial = payload.id;
            }

            actual.id = `CA${actual.idActivo ?? 0}-CM${actual.idMaterial ?? 0}-${clave}`;

            agrupados.set(clave, actual);
        };

        contenedoresActivos.forEach((contenedor) => {
            agregar({ id: contenedor.id, nombre: contenedor.nombre, ubicacion: contenedor.ubicacion, tipo: 'activo' });
        });
        contenedoresMateriales.forEach((contenedor) => {
            agregar({ id: contenedor.id, nombre: contenedor.nombre, ubicacion: contenedor.ubicacion, tipo: 'material' });
        });

        return Array.from(agrupados.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    }

    async crear(datos: { nombre: string; descripcion: string }): Promise<ContenedorCompartido> {
        const nombre = datos.nombre?.trim();
        const descripcion = datos.descripcion?.trim();

        if (!nombre || !descripcion) {
            throw new BadRequestException('Nombre y descripción son obligatorios para crear un contenedor.');
        }

        return this.dataSource.transaction(async (manager) => {
            const activoRepositorio = manager.getRepository(ContenedorActivo);
            const materialRepositorio = manager.getRepository(ContenedorMaterial);

            const [existenteActivo, existenteMaterial] = await Promise.all([
                activoRepositorio.findOne({ where: { nombre, ubicacion: descripcion, deleted_at: IsNull() } }),
                materialRepositorio.findOne({ where: { nombre, ubicacion: descripcion, deletedAt: IsNull() } }),
            ]);

            if (existenteActivo && existenteMaterial) {
                throw new BadRequestException('Ya existe un contenedor con ese nombre y descripción.');
            }

            const contenedorActivo = existenteActivo ?? await activoRepositorio.save(
                activoRepositorio.create({ nombre, ubicacion: descripcion }),
            );
            const contenedorMaterial = existenteMaterial ?? await materialRepositorio.save(
                materialRepositorio.create({ nombre, ubicacion: descripcion }),
            );

            return {
                id: `CA${contenedorActivo.id}-CM${contenedorMaterial.id}-${nombre.toLowerCase()}::${descripcion.toLowerCase()}`,
                nombre,
                descripcion,
                idActivo: contenedorActivo.id,
                idMaterial: contenedorMaterial.id,
            };
        });
    }

    async editar(datos: { idActivo?: number; idMaterial?: number; nombre: string; descripcion: string }): Promise<ContenedorCompartido> {
        const nombre = datos.nombre?.trim();
        const descripcion = datos.descripcion?.trim();

        if (!nombre || !descripcion) {
            throw new BadRequestException('Nombre y descripción son obligatorios para editar un contenedor.');
        }

        return this.dataSource.transaction(async (manager) => {
            const activoRepositorio = manager.getRepository(ContenedorActivo);
            const materialRepositorio = manager.getRepository(ContenedorMaterial);

            const [contenedorActivo, contenedorMaterial] = await Promise.all([
                datos.idActivo ? activoRepositorio.findOne({ where: { id: Number(datos.idActivo), deleted_at: IsNull() } }) : Promise.resolve(null),
                datos.idMaterial ? materialRepositorio.findOne({ where: { id: Number(datos.idMaterial), deletedAt: IsNull() } }) : Promise.resolve(null),
            ]);

            if (!contenedorActivo && !contenedorMaterial) {
                throw new NotFoundException('Contenedor no encontrado para editar.');
            }

            if (contenedorActivo) {
                contenedorActivo.nombre = nombre;
                contenedorActivo.ubicacion = descripcion;
                await activoRepositorio.save(contenedorActivo);
            }

            if (contenedorMaterial) {
                contenedorMaterial.nombre = nombre;
                contenedorMaterial.ubicacion = descripcion;
                await materialRepositorio.save(contenedorMaterial);
            }

            return {
                id: `CA${contenedorActivo?.id ?? 0}-CM${contenedorMaterial?.id ?? 0}-${nombre.toLowerCase()}::${descripcion.toLowerCase()}`,
                nombre,
                descripcion,
                idActivo: contenedorActivo?.id,
                idMaterial: contenedorMaterial?.id,
            };
        });
    }

    async eliminar(datos: { idActivo?: number; idMaterial?: number }): Promise<void> {
        await this.dataSource.transaction(async (manager) => {
            const activoRepositorio = manager.getRepository(ContenedorActivo);
            const materialRepositorio = manager.getRepository(ContenedorMaterial);

            const [contenedorActivo, contenedorMaterial] = await Promise.all([
                datos.idActivo ? activoRepositorio.findOne({ where: { id: Number(datos.idActivo), deleted_at: IsNull() } }) : Promise.resolve(null),
                datos.idMaterial ? materialRepositorio.findOne({ where: { id: Number(datos.idMaterial), deletedAt: IsNull() } }) : Promise.resolve(null),
            ]);

            if (!contenedorActivo && !contenedorMaterial) {
                throw new NotFoundException('Contenedor no encontrado para eliminar.');
            }

            if (contenedorActivo) {
                await activoRepositorio.softRemove(contenedorActivo);
            }

            if (contenedorMaterial) {
                await materialRepositorio.softRemove(contenedorMaterial);
            }
        });
    }
}