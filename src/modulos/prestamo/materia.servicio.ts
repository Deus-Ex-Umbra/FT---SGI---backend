import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { MateriaEntidad } from './entidades/materia.entidad';
import { CarreraEntidad } from './entidades/carrera.entidad';
import { DocenteEntidad } from '@/modulos/docente/entidades/docente.entidad';

@Injectable()
export class MateriaServicio {
  constructor(
    @InjectRepository(MateriaEntidad)
    private readonly materiasRepo: Repository<MateriaEntidad>,
    @InjectRepository(CarreraEntidad)
    private readonly carrerasRepo: Repository<CarreraEntidad>,
    @InjectRepository(DocenteEntidad)
    private readonly docentesRepo: Repository<DocenteEntidad>,
  ) {}

  public normalizarCodigoMateriaCatalogo(valor: string): string {
    return String(valor ?? '').trim().toUpperCase().replace(/\s+/g, '');
  }

  public validarCodigoMateriaCatalogo(codigo: string) {
    if (!codigo) {
      throw new BadRequestException('El código de materia es obligatorio.');
    }
    if (!/^[A-Z0-9][A-Z0-9-]{2,29}$/.test(codigo)) {
      throw new BadRequestException('Código de materia inválido. Usa formato tipo SIS245, MAT100, INF-101.');
    }
  }

  private parsearIdsPositivos(items: Array<string | number> | undefined | null): number[] {
    if (!Array.isArray(items)) return [];
    return Array.from(
      new Set(
        items
          .map((item) => Number(item))
          .filter((item) => Number.isInteger(item) && item > 0),
      ),
    );
  }

  private normalizarMateriasAsignadas(codigos: string[]): string[] {
    return Array.from(
      new Set(
        codigos
          .map((codigo) => this.normalizarCodigoMateriaCatalogo(codigo))
          .filter(Boolean),
      ),
    );
  }

  private mapearMateriaCatalogo(
    materia: MateriaEntidad,
    docentes: DocenteEntidad[],
    carrerasPorId: Map<number, CarreraEntidad>,
  ) {
    const codigo = this.normalizarCodigoMateriaCatalogo(materia.codigo);
    const carrerasIds = this.parsearIdsPositivos(
      (materia.carrerasHabilitadasIds ?? []).map((id) => String(id ?? '').trim()).filter(Boolean),
    );
    const carrerasHabilitadas = carrerasIds
      .map((id) => carrerasPorId.get(id))
      .filter((carrera): carrera is CarreraEntidad => !!carrera)
      .map((carrera) => ({
        id: carrera.id,
        nombre: carrera.nombre,
        prefijoCu: carrera.prefijoCu ?? null,
      }));

    const docentesAsignados = docentes
      .filter((docente) => {
        const materiasAsignadas = this.normalizarMateriasAsignadas(
          docente.materiasAsignadas ?? [],
        );
        return materiasAsignadas.includes(codigo);
      })
      .map((docente) => ({
        id: docente.usuario?.id ?? docente.id,
        codigo: String(docente.codigo ?? ''),
        nombre: String(docente.nombre ?? '').trim(),
        apellido: String(docente.apellido ?? '').trim(),
        correo: String(docente.usuario?.correo ?? '').trim(),
      }));

    return {
      id: String(materia.id),
      codigo,
      nombre: String(materia.nombre ?? '').trim() || null,
      descripcion: String(materia.descripcion ?? '').trim() || null,
      carrerasIds: carrerasHabilitadas.map((carrera) => carrera.id),
      carrerasHabilitadas,
      docentesIds: docentesAsignados.map((docente) => docente.id),
      docentesAsignados,
    };
  }

  async sincronizarAsignacionMateriaDocentes(
    codigoMateria: string,
    docentesIds: number[],
  ) {
    const codigo = this.normalizarCodigoMateriaCatalogo(codigoMateria);
    const idsAsignados = new Set(this.parsearIdsPositivos(docentesIds));

    const docentes = await this.docentesRepo.find({
      relations: ['usuario'],
      order: { id: 'ASC' },
    });
    const porActualizar: DocenteEntidad[] = [];

    for (const docente of docentes) {
      const materiasActuales = this.normalizarMateriasAsignadas(
        docente.materiasAsignadas ?? [],
      );
      const estabaAsignado = materiasActuales.includes(codigo);
      const idParaComparar = docente.usuario?.id ?? docente.id;
      const debeEstarAsignado = idsAsignados.has(idParaComparar);

      if (debeEstarAsignado && !estabaAsignado) {
        materiasActuales.push(codigo);
      }

      if (!debeEstarAsignado && estabaAsignado) {
        const indice = materiasActuales.indexOf(codigo);
        if (indice >= 0) materiasActuales.splice(indice, 1);
      }

      const normalizadas = this.normalizarMateriasAsignadas(materiasActuales);
      const cambioMaterias =
        normalizadas.join('|') !==
        this.normalizarMateriasAsignadas(docente.materiasAsignadas ?? []).join(
          '|',
        );

      if (!cambioMaterias) continue;

      docente.materiasAsignadas = normalizadas;
      docente.materia = normalizadas[0] ?? null;
      porActualizar.push(docente);
    }

    if (porActualizar.length > 0) {
      await this.docentesRepo.save(porActualizar);
    }
  }

  async obtenerMaterias(): Promise<Array<{
    id: string;
    codigo: string;
    nombre: string | null;
    descripcion: string | null;
    carrerasIds: number[];
    carrerasHabilitadas: Array<{ id: number; nombre: string; prefijoCu: string | null }>;
    docentesIds: number[];
    docentesAsignados: Array<{ id: number; codigo: string; nombre: string; apellido: string; correo: string }>;
  }>> {
    const [materias, carreras, docentes] = await Promise.all([
      this.materiasRepo.find({ order: { codigo: 'ASC', id: 'ASC' } }),
      this.carrerasRepo.find({
        where: { deletedAt: IsNull() },
        order: { nombre: 'ASC', id: 'ASC' },
      }),
      this.docentesRepo.find({
        relations: ['usuario'],
        order: { codigo: 'ASC', nombre: 'ASC', id: 'ASC' },
      }),
    ]);

    const carrerasPorId = new Map(carreras.map((carrera) => [carrera.id, carrera]));
    return materias.map((materia) => this.mapearMateriaCatalogo(materia, docentes, carrerasPorId));
  }

  async crearMateria(datos: {
    codigo: string;
    nombre?: string | null;
    descripcion?: string | null;
    carrerasIds?: Array<string | number>;
    docentesIds?: Array<string | number>;
  }) {
    const codigo = this.normalizarCodigoMateriaCatalogo(datos.codigo);
    this.validarCodigoMateriaCatalogo(codigo);

    const existente = await this.materiasRepo
      .createQueryBuilder('m')
      .where('UPPER(m.codigo) = :codigo', { codigo })
      .getOne();
    if (existente) {
      throw new BadRequestException('El código de materia ya está registrado.');
    }

    const carrerasIds = this.parsearIdsPositivos(datos.carrerasIds);
    if (carrerasIds.length === 0) {
      throw new BadRequestException('Debes seleccionar al menos una carrera habilitada.');
    }

    const carreras = await this.carrerasRepo.find({ where: carrerasIds.map((id) => ({ id, deletedAt: IsNull() })) });
    if (carreras.length !== carrerasIds.length) {
      throw new BadRequestException('Al menos una carrera habilitada no existe.');
    }

    const materia = this.materiasRepo.create({
      codigo,
      nombre: String(datos.nombre ?? '').trim() || null,
      descripcion: String(datos.descripcion ?? '').trim() || null,
      carrerasHabilitadasIds: carrerasIds.map((id) => String(id)),
    });

    const guardada = await this.materiasRepo.save(materia);
    await this.sincronizarAsignacionMateriaDocentes(codigo, this.parsearIdsPositivos(datos.docentesIds));

    const materias = await this.obtenerMaterias();
    const creada = materias.find((m) => m.id === String(guardada.id));
    if (!creada) {
      throw new NotFoundException('No se pudo recuperar la materia creada.');
    }
    return creada;
  }

  async editarMateria(
    id: number,
    datos: Partial<{
      codigo: string;
      nombre: string | null;
      descripcion: string | null;
      carrerasIds: Array<string | number>;
      docentesIds: Array<string | number>;
    }>,
  ) {
    const materia = await this.materiasRepo.findOne({ where: { id } });
    if (!materia) throw new NotFoundException('Materia no encontrada.');

    const codigoActual = this.normalizarCodigoMateriaCatalogo(materia.codigo);

    if (typeof datos.codigo === 'string') {
      const codigoNuevo = this.normalizarCodigoMateriaCatalogo(datos.codigo);
      this.validarCodigoMateriaCatalogo(codigoNuevo);
      if (codigoNuevo !== codigoActual) {
        throw new BadRequestException('El código de materia no puede modificarse una vez creado.');
      }
    }

    if (datos.nombre !== undefined) {
      materia.nombre = String(datos.nombre ?? '').trim() || null;
    }

    if (datos.descripcion !== undefined) {
      materia.descripcion = String(datos.descripcion ?? '').trim() || null;
    }

    if (Array.isArray(datos.carrerasIds)) {
      const carrerasIds = this.parsearIdsPositivos(datos.carrerasIds);
      if (carrerasIds.length === 0) {
        throw new BadRequestException('Debes seleccionar al menos una carrera habilitada.');
      }

      const carreras = await this.carrerasRepo.find({ where: carrerasIds.map((carreraId) => ({ id: carreraId, deletedAt: IsNull() })) });
      if (carreras.length !== carrerasIds.length) {
        throw new BadRequestException('Al menos una carrera habilitada no existe.');
      }

      materia.carrerasHabilitadasIds = carrerasIds.map((carreraId) => String(carreraId));
    }

    const guardada = await this.materiasRepo.save(materia);

    if (Array.isArray(datos.docentesIds)) {
      await this.sincronizarAsignacionMateriaDocentes(codigoActual, this.parsearIdsPositivos(datos.docentesIds));
    }

    const materias = await this.obtenerMaterias();
    const actualizada = materias.find((m) => m.id === String(guardada.id));
    if (!actualizada) {
      throw new NotFoundException('No se pudo recuperar la materia actualizada.');
    }
    return actualizada;
  }

  async eliminarMateria(id: number): Promise<void> {
    const materia = await this.materiasRepo.findOne({ where: { id } });
    if (!materia) throw new NotFoundException('Materia no encontrada.');

    const codigo = this.normalizarCodigoMateriaCatalogo(materia.codigo);

    const docentes = await this.docentesRepo.find();
    const docentesAsignados = docentes.filter((docente) =>
      this.normalizarMateriasAsignadas(docente.materiasAsignadas ?? []).includes(codigo),
    );
    if (docentesAsignados.length > 0) {
      throw new BadRequestException('No se puede eliminar la materia porque está asignada a docentes.');
    }

    await this.materiasRepo.delete({ id: materia.id });
  }
}
