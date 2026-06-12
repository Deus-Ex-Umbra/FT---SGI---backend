import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { CarreraEntidad } from './entidades/carrera.entidad';

@Injectable()
export class CarreraServicio {
  constructor(
    @InjectRepository(CarreraEntidad)
    private readonly carrerasRepo: Repository<CarreraEntidad>,
  ) {}

  public normalizarPrefijoCu(prefijoCu: string): string {
    const limpio = String(prefijoCu ?? '').trim().toUpperCase();
    if (!limpio) {
      throw new BadRequestException('El prefijo de CU es obligatorio.');
    }
    if (limpio.length > 20) {
      throw new BadRequestException('El prefijo de CU es demasiado largo.');
    }
    if (/\s/.test(limpio)) {
      throw new BadRequestException('El prefijo de CU no puede contener espacios.');
    }
    if (!/^[A-Z0-9-]+$/.test(limpio)) {
      throw new BadRequestException('El prefijo de CU solo puede contener letras, números y guiones.');
    }
    return limpio;
  }

  async obtenerCarreras(): Promise<CarreraEntidad[]> {
    return this.carrerasRepo.find({
      where: { deletedAt: IsNull() },
      relations: ['inventarios'],
      order: { nombre: 'ASC', id: 'ASC' },
    });
  }

  async crearCarrera(datos: { nombre: string; prefijoCu: string; inventariosIds?: number[] }): Promise<CarreraEntidad> {
    const nombre = datos.nombre.trim();
    const prefijoCu = this.normalizarPrefijoCu(datos.prefijoCu);
    if (!nombre) throw new BadRequestException('El nombre de la carrera es obligatorio.');
    const existente = await this.carrerasRepo.findOne({ where: { nombre } });
    if (existente) throw new BadRequestException('La carrera ya está registrada.');
    const existentePrefijo = await this.carrerasRepo.findOne({ where: { prefijoCu } });
    if (existentePrefijo) throw new BadRequestException('El prefijo de CU ya está registrado para otra carrera.');
    const carrera = this.carrerasRepo.create({
      nombre,
      prefijoCu,
      inventarios: datos.inventariosIds ? datos.inventariosIds.map(id => ({ id } as any)) : [],
    });
    return this.carrerasRepo.save(carrera);
  }

  async editarCarrera(id: number, datos: Partial<{ nombre: string; prefijoCu: string; inventariosIds: number[] }>): Promise<CarreraEntidad> {
    const carrera = await this.carrerasRepo.findOne({ where: { id }, relations: ['inventarios'] });
    if (!carrera) throw new NotFoundException('Carrera no encontrada.');
    if (typeof datos.nombre === 'string' && datos.nombre.trim() && datos.nombre.trim() !== carrera.nombre) {
      const nuevoNombre = datos.nombre.trim();
      const existente = await this.carrerasRepo.findOne({ where: { nombre: nuevoNombre } });
      if (existente) throw new BadRequestException('La carrera ya está registrada.');
      carrera.nombre = nuevoNombre;
    }

    if (typeof datos.prefijoCu === 'string') {
      const prefijoCu = this.normalizarPrefijoCu(datos.prefijoCu);
      if (prefijoCu !== carrera.prefijoCu) {
        const existentePrefijo = await this.carrerasRepo.findOne({ where: { prefijoCu } });
        if (existentePrefijo && existentePrefijo.id !== carrera.id) {
          throw new BadRequestException('El prefijo de CU ya está registrado para otra carrera.');
        }
        carrera.prefijoCu = prefijoCu;
      }
    }

    if (datos.inventariosIds !== undefined) {
      carrera.inventarios = datos.inventariosIds.map(id => ({ id } as any));
    }

    return this.carrerasRepo.save(carrera);
  }

  async eliminarCarrera(id: number): Promise<void> {
    const carrera = await this.carrerasRepo.findOne({ where: { id }, relations: ['estudiantes'] });
    if (!carrera) throw new NotFoundException('Carrera no encontrada.');
    if ((carrera.estudiantes ?? []).length > 0) {
      throw new BadRequestException('La carrera está asignada a estudiantes. Primero actualiza esos estudiantes a otra carrera.');
    }
    await this.carrerasRepo.softRemove(carrera);
  }
}
