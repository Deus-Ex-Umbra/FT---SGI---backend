import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets, IsNull } from 'typeorm';
import { PrestamoEntidad } from './entidades/prestamo.entidad';
import { CanastaPrestamoItemEntidad } from './entidades/canasta-prestamo-item.entidad';
import { EstudianteEntidad } from '@/modulos/estudiante/entidades/estudiante.entidad';
import { PrestamoUtilServicio } from './prestamo-util.servicio';
import { ContenedorActivo } from '@/modulos/contenedor/entidades/contenedor-activo.entidad';
import { ActivoFungible } from '@/modulos/activo/entidades/activo-fungible.entidad';

@Injectable()
export class PrestamoCanastaServicio {
  constructor(
    private readonly util: PrestamoUtilServicio,
    @InjectRepository(CanastaPrestamoItemEntidad)
    private readonly canastaItemsRepo: Repository<CanastaPrestamoItemEntidad>,
    @InjectRepository(ContenedorActivo)
    private readonly contenedoresRepo: Repository<ContenedorActivo>,
  ) {}

  private async resolverEstudiantesPorCarnets(carnetsEntrada: string[]): Promise<EstudianteEntidad[]> {
    const carnets = Array.from(new Set((carnetsEntrada ?? []).map((c) => c?.trim()).filter(Boolean)));
    if (carnets.length === 0) {
      throw new BadRequestException('Debes seleccionar al menos un estudiante.');
    }
    const estudiantes = await this.util.estudiantesRepo.find({
      where: carnets.map((carnet) => ({ carnet })),
      relations: ['carreraRef', 'cus', 'cus.carreras'],
    });
    if (estudiantes.length !== carnets.length) {
      const encontrados = new Set(estudiantes.map((e) => e.carnet));
      const faltantes = carnets.filter((c) => !encontrados.has(c));
      throw new NotFoundException(`Estudiante no encontrado: ${faltantes.join(', ')}`);
    }
    return carnets.map((c) => estudiantes.find((e) => e.carnet === c)!);
  }

  private async obtenerEstudiantesCanasta(grupoCanasta: string): Promise<EstudianteEntidad[]> {
    if (!grupoCanasta?.trim()) return [];
    const participantes = await this.util.canastaEstudiantesRepo.find({
      where: { grupoCanasta: grupoCanasta.trim() },
      relations: ['estudiante', 'estudiante.carreraRef', 'estudiante.cus', 'estudiante.cus.carreras'],
      order: { id: 'ASC' },
    });
    return participantes.map((p) => p.estudiante).filter(Boolean);
  }

  private async obtenerEstudiantesPorCanastas(gruposCanasta: string[]): Promise<Map<string, EstudianteEntidad[]>> {
    const mapa = new Map<string, EstudianteEntidad[]>();
    const grupos = Array.from(new Set((gruposCanasta ?? []).map((g) => g?.trim()).filter(Boolean)));
    if (grupos.length === 0) return mapa;
    const participantes = await this.util.canastaEstudiantesRepo.find({
      where: grupos.map((grupoCanasta) => ({ grupoCanasta })),
      relations: ['estudiante', 'estudiante.carreraRef', 'estudiante.cus', 'estudiante.cus.carreras'],
      order: { id: 'ASC' },
    });
    for (const p of participantes) {
      const lista = mapa.get(p.grupoCanasta) ?? [];
      lista.push(p.estudiante);
      mapa.set(p.grupoCanasta, lista);
    }
    return mapa;
  }

  private async reemplazarEstudiantesCanasta(
    grupoCanasta: string,
    estudiantes: EstudianteEntidad[],
    defaultCarnetRetenido = false,
    carnetsRetenidosInput?: string[],
  ): Promise<void> {
    const existentes = await this.util.canastaEstudiantesRepo.find({
      where: { grupoCanasta },
      relations: ['estudiante'],
    });
    const mapaExistentes = new Map(existentes.map((e) => [e.estudiante.id, e.carnetRetenido]));
    await this.util.canastaEstudiantesRepo.delete({ grupoCanasta });
    if (estudiantes.length === 0) return;
    await this.util.canastaEstudiantesRepo.save(
      estudiantes.map((e) => {
        let retenido = false;
        if (Array.isArray(carnetsRetenidosInput)) {
          retenido = carnetsRetenidosInput.includes(e.carnet);
        } else {
          retenido = mapaExistentes.has(e.id) ? mapaExistentes.get(e.id)! : defaultCarnetRetenido;
        }
        return this.util.canastaEstudiantesRepo.create({ grupoCanasta, estudiante: e, carnetRetenido: retenido });
      }),
    );
  }

  private async obtenerDetallesItemsCanasta(grupoCanasta: string): Promise<CanastaPrestamoItemEntidad[]> {
    if (!grupoCanasta?.trim()) return [];
    return this.canastaItemsRepo.find({
      where: { grupoCanasta: grupoCanasta.trim() },
      relations: ['itemActivo', 'itemActivo.activo', 'contenedor'],
      order: { id: 'ASC' },
    });
  }

  private async obtenerDetallesItemsPorCanastas(gruposCanasta: string[]): Promise<Map<string, CanastaPrestamoItemEntidad[]>> {
    const mapa = new Map<string, CanastaPrestamoItemEntidad[]>();
    const grupos = Array.from(new Set((gruposCanasta ?? []).map((g) => g?.trim()).filter(Boolean)));
    if (grupos.length === 0) return mapa;
    const detalles = await this.canastaItemsRepo.find({
      where: grupos.map((grupoCanasta) => ({ grupoCanasta })),
      relations: ['itemActivo', 'itemActivo.activo', 'contenedor'],
      order: { id: 'ASC' },
    });
    for (const d of detalles) {
      const lista = mapa.get(d.grupoCanasta) ?? [];
      lista.push(d);
      mapa.set(d.grupoCanasta, lista);
    }
    return mapa;
  }

  private construirDetallesCanastaFallback(prestamos: PrestamoEntidad[]): CanastaPrestamoItemEntidad[] {
    const vistos = new Set<string>();
    const detalles: CanastaPrestamoItemEntidad[] = [];
    for (const p of prestamos) {
      if (p.itemActivo) {
        const idH = String(p.itemActivo.id).trim();
        if (vistos.has(`item-${idH}`)) continue;
        vistos.add(`item-${idH}`);
        detalles.push(this.canastaItemsRepo.create({
          grupoCanasta: p.grupoCanasta ?? `IND-${p.id}`,
          itemActivo: p.itemActivo,
          registrado: p.estado === 'despachado' || p.estado === 'activo' || p.estado === 'devuelto' || p.estado === 'devuelto_fuera_de_fecha_limite',
        }));
      } else if (p.contenedor) {
        detalles.push(this.canastaItemsRepo.create({
          grupoCanasta: p.grupoCanasta ?? `IND-${p.id}`,
          itemActivo: null,
          contenedor: p.contenedor,
          registrado: p.estado === 'despachado' || p.estado === 'activo' || p.estado === 'devuelto' || p.estado === 'devuelto_fuera_de_fecha_limite',
        }));
      }
    }
    return detalles;
  }

  private async asegurarDetallesCanastaRegistrados(grupoCanasta: string, prestamos: PrestamoEntidad[]): Promise<CanastaPrestamoItemEntidad[]> {
    const existentes = await this.obtenerDetallesItemsCanasta(grupoCanasta);
    if (existentes.length > 0) return existentes;
    const seed = this.construirDetallesCanastaFallback(prestamos);
    if (seed.length > 0) {
      await this.canastaItemsRepo.save(seed);
    }
    return this.obtenerDetallesItemsCanasta(grupoCanasta);
  }

  public async resolverPrestamosPorCanastaId(canastaId: string): Promise<PrestamoEntidad[]> {
    if (!canastaId?.trim()) throw new BadRequestException('Identificador de canasta no válido.');
    const limpio = canastaId.trim();
    if (limpio.startsWith('IND-')) {
      const id = Number(limpio.replace('IND-', ''));
      if (!Number.isInteger(id) || id <= 0) throw new BadRequestException('Identificador de canasta individual no válido.');
      const unico = await this.util.prestamosRepo.findOne({
        where: { id },
        relations: ['estudiante', 'estudiante.carreraRef', 'estudiante.cus', 'estudiante.cus.carreras', 'docente', 'itemActivo', 'itemActivo.activo', 'contenedor'],
      });
      if (!unico || unico.deletedAt) throw new NotFoundException('Canasta no encontrada.');
      return [unico];
    }
    let items = await this.util.prestamosRepo.find({
      where: { grupoCanasta: limpio },
      relations: ['estudiante', 'estudiante.carreraRef', 'estudiante.cus', 'estudiante.cus.carreras', 'docente', 'itemActivo', 'itemActivo.activo', 'contenedor'],
      order: { id: 'ASC' },
    });
    if (items.length === 0) {
      items = await this.util.prestamosRepo.find({
        where: { codigo: limpio },
        relations: ['estudiante', 'estudiante.carreraRef', 'estudiante.cus', 'estudiante.cus.carreras', 'docente', 'itemActivo', 'itemActivo.activo', 'contenedor'],
        order: { id: 'ASC' },
      });
    }
    const vigentes = items.filter((p) => !p.deletedAt);
    if (vigentes.length === 0) throw new NotFoundException('Canasta no encontrada.');
    return vigentes;
  }

  private normalizarItemsCanastaEntrada(
    itemsEntrada?: Array<{ idItem?: string; idHerramienta?: string; registrado?: boolean; marcado?: boolean }>,
  ): Array<{ idHerramienta: string; registrado: boolean }> {
    if (!Array.isArray(itemsEntrada)) return [];
    const items = new Map<string, { idHerramienta: string; registrado: boolean }>();
    for (const item of itemsEntrada) {
      const idHerramienta = String(item?.idItem ?? item?.idHerramienta ?? '').trim();
      if (!idHerramienta) continue;
      const previo = items.get(idHerramienta);
      const registrado = typeof item?.registrado === 'boolean'
        ? item.registrado
        : typeof item?.marcado === 'boolean'
          ? item.marcado
          : previo?.registrado ?? true;
      items.set(idHerramienta, { idHerramienta, registrado });
    }
    return Array.from(items.values());
  }

  public mapCanastaDto(
    prestamos: PrestamoEntidad[],
    consumibles: any[] = [],
    estudiantesCanasta: EstudianteEntidad[] = [],
    detallesCanasta: CanastaPrestamoItemEntidad[] = [],
  ) {
    const primero = prestamos[0];
    const idCanasta = primero.grupoCanasta ?? `IND-${primero.id}`;
    const estudiantes = estudiantesCanasta.length > 0 ? estudiantesCanasta : (primero.estudiante ? [primero.estudiante] : []);
    const estados = prestamos.map((p) => p.estado);
    const estadoCanasta = estados.includes('vencido')
      ? 'vencido'
      : (estados.includes('despachado') || estados.includes('activo') || estados.includes('pendiente'))
        ? 'despachado'
        : estados.includes('aceptado')
          ? 'aceptado'
          : estados.includes('solicitado')
            ? 'solicitado'
            : estados.includes('rechazado')
              ? 'rechazado'
              : estados.includes('devuelto_fuera_de_fecha_limite')
                ? 'devuelto_fuera_de_fecha_limite'
                : 'devuelto';

    const detalles = detallesCanasta.length > 0 ? detallesCanasta : this.construirDetallesCanastaFallback(prestamos);
    const prestamosAsignados = new Set<number>();
    const cosas = detalles.map((d) => {
      if (!d.itemActivo && d.contenedor) {
        const pr = prestamos.find((p) => p.codigoHerramienta === null && p.contenedor?.id === d.contenedor?.id && !prestamosAsignados.has(p.id));
        if (pr) {
          prestamosAsignados.add(pr.id);
        }
        return {
          idPrestamo: pr?.id ?? null,
          idHerramienta: null,
          codigoInventario: null,
          idContenedor: d.contenedor.id,
          nombreContenedor: d.contenedor.nombre,
          nombre: `${d.contenedor.nombre} (Solicitado)`,
          registrado: d.registrado === true,
        };
      }
      const idH = String(d.itemActivo?.id ?? '').trim();
      const pr = prestamos.find((p) => p.codigoHerramienta === idH && !prestamosAsignados.has(p.id));
      if (pr) {
        prestamosAsignados.add(pr.id);
      }
      return {
        idPrestamo: pr?.id ?? null,
        idHerramienta: idH || (pr?.codigoHerramienta ?? ''),
        codigoInventario: (d.itemActivo as any)?.codigo_inventario ?? (pr?.itemActivo as any)?.codigo_inventario ?? pr?.codigoHerramienta ?? idH,
        nombre: d.itemActivo?.activo?.nombre ?? pr?.itemActivo?.activo?.nombre ?? 'Activo',
        registrado: d.registrado !== false,
      };
    });

    const consumiblesCanasta = consumibles && consumibles.length > 0
      ? consumibles
      : (prestamos.find((p) => Array.isArray(p.consumibles) && p.consumibles.length > 0)?.consumibles ?? []);

    const consumiblesMapeados = consumiblesCanasta.map((con: any) => ({
      idLote: con.idLote,
      idActivoFungible: con.idActivoFungible ?? null,
      idContenedor: con.idContenedor ?? null,
      lote: con.lote,
      material: con.material,
      cantidadSolicitada: con.cantidadSolicitada ?? con.cantidad ?? 0,
      cantidadDespachada: con.cantidadDespachada ?? con.cantidad ?? 0,
      cantidadDevuelta: con.cantidadDevuelta,
      motivo: con.motivo,
      estadoDevuelto: con.estadoDevuelto,
      fecha: con.fecha,
    }));

    return {
      id: idCanasta,
      grupoCanasta: primero.grupoCanasta ?? null,
      codigo: primero.codigo ?? null,
      idsPrestamo: prestamos.map((p) => p.id),
      carnetEstudiante: estudiantes[0]?.carnet ?? primero.estudiante?.carnet ?? '',
      carnetsEstudiantes: estudiantes.map((e) => e.carnet),
      estudiantes: estudiantes.map((e) => {
        const asignaciones = (e.asignacionesCarrera ?? [])
          .filter((a) => a?.carrera && a.cu)
          .map((a) => ({
            carreraId: a.carrera?.id ?? null,
            carrera: a.carrera?.nombre ?? '',
            cu: String(a.cu).trim().toUpperCase(),
            prefijoCu: a.carrera?.prefijoCu ?? null,
          }));
        
        const asignacionesFinal = asignaciones.length > 0 ? asignaciones : [{
          carreraId: e.carreraRef?.id ?? null,
          carrera: e.carrera ?? '',
          cu: String(e.cu ?? '').trim().toUpperCase(),
          prefijoCu: e.carreraRef?.prefijoCu ?? null,
        }];

        return {
          id: e.id,
          carnet: e.carnet,
          nombre: e.nombre,
          apellido: e.apellido,
          carrera: asignacionesFinal[0]?.carrera ?? null,
          cu: asignacionesFinal[0]?.cu ?? null,
          asignacionesCarrera: asignacionesFinal,
          carnetRetenido: e.carnetRetenido,
        };
      }),
      idDocente: primero.docente?.id,
      docente: this.util.obtenerNombreCompletoDocente(primero.docente),
      fechaPrestamo: primero.fechaPrestamo,
      fechaDevolucion: primero.fechaDevolucion,
      estado: estadoCanasta,
      observaciones: primero.observaciones ?? '',
      cosas,
      consumibles: consumiblesMapeados,
      totalActivos: cosas.filter((c) => c.registrado).length,
      totalConsumibles: consumiblesMapeados.reduce((acc: number, c: any) => acc + (c.cantidadDespachada ?? c.cantidadSolicitada ?? 0), 0),
      totalCosas: cosas.length + consumiblesMapeados.reduce((acc: number, c: any) => acc + (c.cantidadDespachada ?? c.cantidadSolicitada ?? 0), 0),
    };
  }

  async obtenerCanastasPrestamo(ejecutor?: any) {
    await this.util.marcarVencidosEnLote();
    await this.util.sincronizarCarnetsRetenidosEnLote();

    const queryBuilder = this.util.prestamosRepo.createQueryBuilder('p')
      .leftJoinAndSelect('p.estudiante', 'estudiante')
      .leftJoinAndSelect('estudiante.usuario', 'estudianteUsuario')
      .leftJoinAndSelect('estudiante.carreraRef', 'carreraRef')
      .leftJoinAndSelect('estudiante.cus', 'cus')
      .leftJoinAndSelect('cus.carreras', 'carrera')
      .leftJoinAndSelect('p.docente', 'docente')
      .leftJoinAndSelect('p.itemActivo', 'itemActivo')
      .leftJoinAndSelect('itemActivo.activo', 'activo')
      .leftJoinAndSelect('activo.inventario', 'inventario')
      .leftJoinAndSelect('p.contenedor', 'contenedor')
      .orderBy('p.fecha_prestamo', 'DESC')
      .addOrderBy('p.id', 'DESC');

    if (ejecutor) {
      if (ejecutor.rol === 'docente') {
        queryBuilder.andWhere('docente.id = :ejecutorId', { ejecutorId: ejecutor.id });
      } else if (ejecutor.rol === 'estudiante') {
        const estudiante = await this.util.estudiantesRepo.findOne({ where: { usuario: { id: ejecutor.id } } });
        if (estudiante) {
          const participaciones = await this.util.canastaEstudiantesRepo.find({ where: { estudiante: { id: estudiante.id } } });
          const gruposCanasta = Array.from(new Set(participaciones.map(p => p.grupoCanasta).filter(Boolean)));
          if (gruposCanasta.length > 0) {
            queryBuilder.andWhere('(p.id_estudiante = :estudianteId OR p.grupo_canasta IN (:...gruposCanasta))', {
              estudianteId: estudiante.id,
              gruposCanasta,
            });
          } else {
            queryBuilder.andWhere('p.id_estudiante = :estudianteId', { estudianteId: estudiante.id });
          }
        } else {
          queryBuilder.andWhere('p.id = -1');
        }
      } else if (ejecutor.rol === 'encargado_inventario') {
        const encargado = await this.util.encargadosRepo.findOne({
          where: { usuario: { id: ejecutor.id } },
          relations: ['inventario'],
        });
        if (encargado?.inventario) {
          const idInventario = encargado.inventario.id;
          const fungiblesInventario = await this.util.itemsFungiblesRepo.find({
            where: { activo: { inventario: { id: idInventario } } },
            relations: ['activo', 'activo.inventario'],
            select: { id: true },
          });
          const idsFungibles = fungiblesInventario.map(f => f.id);
          const prestamosCoincidentes = await this.util.prestamosRepo.createQueryBuilder('p')
            .leftJoin('p.itemActivo', 'itemActivo')
            .leftJoin('itemActivo.activo', 'activo')
            .leftJoin('activo.inventario', 'inventario')
            .leftJoin('p.inventario', 'inventarioPrestamo')
            .select(['p.id', 'p.grupoCanasta'])
            .where(new Brackets(qb => {
              qb.where('inventarioPrestamo.id = :idInventario', { idInventario })
                .orWhere('inventario.id = :idInventario', { idInventario });
              if (idsFungibles.length > 0) {
                qb.orWhere(`EXISTS (
                  SELECT 1 
                  FROM jsonb_to_recordset(COALESCE(p.consumibles, '[]'::jsonb)) as x("idLote" text) 
                  WHERE x."idLote" IN (:...idsFungibles)
                )`, { idsFungibles });
              }
            }))
            .getMany();

          const gruposCoincidentes = Array.from(new Set(prestamosCoincidentes.map(p => p.grupoCanasta).filter(Boolean)));
          const idsIndividualesCoincidentes = prestamosCoincidentes.filter(p => !p.grupoCanasta).map(p => p.id);

          if (gruposCoincidentes.length > 0 || idsIndividualesCoincidentes.length > 0) {
            queryBuilder.andWhere(new Brackets(qb => {
              if (gruposCoincidentes.length > 0) {
                qb.where('p.grupo_canasta IN (:...gruposCoincidentes)', { gruposCoincidentes });
              }
              if (idsIndividualesCoincidentes.length > 0) {
                if (gruposCoincidentes.length > 0) {
                  qb.orWhere('p.id IN (:...idsIndividualesCoincidentes)', { idsIndividualesCoincidentes });
                } else {
                  qb.where('p.id IN (:...idsIndividualesCoincidentes)', { idsIndividualesCoincidentes });
                }
              }
            }));
          } else {
            queryBuilder.andWhere('p.id = -1');
          }
        } else {
          queryBuilder.andWhere('p.id = -1');
        }
      }
    }

    const prestamos = await queryBuilder.getMany();
    const vigentes = prestamos.filter((p) => !p.deletedAt);
    const grupos = new Map<string, PrestamoEntidad[]>();
    for (const p of vigentes) {
      const clave = p.grupoCanasta ?? `IND-${p.id}`;
      const lista = grupos.get(clave) ?? [];
      lista.push(p);
      grupos.set(clave, lista);
    }

    const referencias = Array.from(grupos.keys()).filter((k) => !k.startsWith('IND-'));
    const estudiantesPorCanasta = await this.obtenerEstudiantesPorCanastas(referencias);
    const detallesPorCanasta = await this.obtenerDetallesItemsPorCanastas(referencias);

    return Array.from(grupos.entries()).map(([clave, lista]) =>
      this.mapCanastaDto(
        lista,
        [],
        clave.startsWith('IND-') ? [lista[0].estudiante] : (estudiantesPorCanasta.get(clave) ?? [lista[0].estudiante]),
        clave.startsWith('IND-') ? [] : (detallesPorCanasta.get(clave) ?? []),
      ),
    );
  }

  async crearCanastaPrestamo(datos: any, ejecutor?: any) {
    const estudiantes = await this.resolverEstudiantesPorCarnets(datos.carnetsEstudiantes?.length ? datos.carnetsEstudiantes : [datos.carnetEstudiante ?? '']);
    const estudiante = estudiantes[0];

    for (const est of estudiantes) {
      if (est.carnetRetenido) {
        throw new BadRequestException(`El estudiante ${est.nombre} ${est.apellido} (${est.carnet}) tiene su carnet retenido.`);
      }
    }

    const inventarioSolicitadoId = datos.idInventario ? Number(datos.idInventario) : null;

    const docente = await this.util.obtenerDocenteUsuarioPorId(Number(datos.idDocente));
    const fechaPrestamo = new Date(datos.fechaPrestamo);
    const fechaDevolucion = new Date(datos.fechaDevolucion);
    if (Number.isNaN(fechaPrestamo.getTime()) || Number.isNaN(fechaDevolucion.getTime())) throw new BadRequestException('Fechas inválidas.');
    if (fechaDevolucion.getTime() <= fechaPrestamo.getTime()) throw new BadRequestException('Fecha de devolución debe ser posterior.');

    const itemsCanasta = this.normalizarItemsCanastaEntrada(
      Array.isArray(datos.items) && datos.items.length > 0
        ? datos.items
        : (datos.equipos ?? []).map((idHerramienta: string) => ({ idHerramienta, registrado: true })),
    );
    const contenedoresInput = datos.contenedores ?? [];
    const consumibles = datos.consumibles ?? datos.materiales ?? [];
    if (itemsCanasta.length === 0 && contenedoresInput.length === 0 && consumibles.length === 0) throw new BadRequestException('Canasta vacía.');

    const idsContenedores = contenedoresInput.map((c: any) => Number(c.idContenedor)).filter(Boolean);
    const contenedoresDb = idsContenedores.length > 0
      ? await this.contenedoresRepo.find({ where: idsContenedores.map((id: number) => ({ id })), relations: ['inventario'] })
      : [];
    const contenedoresMap = new Map(contenedoresDb.map(c => [c.id, c]));

    const estadoInicial = ejecutor?.rol === 'docente' ? 'solicitado' : 'despachado';
    const itemsRegistrados = itemsCanasta.filter((item) => item.registrado);

    const timestamp = Date.now();
    const grupoCanasta = `CANASTA-${estudiante.carnet}-${timestamp}`;
    const codigoCanasta = this.util.generarCodigoPrestamo(fechaPrestamo, estudiante.carnet, grupoCanasta);

    await this.reemplazarEstudiantesCanasta(grupoCanasta, estudiantes, estadoInicial === 'despachado', datos.carnetsRetenidos);

    const detallesCanasta: CanastaPrestamoItemEntidad[] = [];
    for (const itemCanasta of itemsCanasta) {
      const itemActivo = await this.util.obtenerItemActivo(itemCanasta.idHerramienta);
      detallesCanasta.push(this.canastaItemsRepo.create({ grupoCanasta, itemActivo, registrado: itemCanasta.registrado }));
    }
    for (const cont of contenedoresInput) {
      const contenedor = contenedoresMap.get(Number(cont.idContenedor));
      if (!contenedor) throw new NotFoundException(`Contenedor ${cont.idContenedor} no encontrado.`);
      for (let i = 0; i < Number(cont.cantidad); i++) {
        detallesCanasta.push(this.canastaItemsRepo.create({
          grupoCanasta,
          itemActivo: null,
          contenedor,
          registrado: false,
        }));
      }
    }
    if (detallesCanasta.length > 0) {
      await this.canastaItemsRepo.save(detallesCanasta);
    }

    const salidasConsumibles: any[] = [];
    for (const salida of consumibles) {
      const idLote = salida.idLote ? String(salida.idLote).trim() : null;
      const idActivoFungible = salida.idActivoFungible ? Number(salida.idActivoFungible) : null;
      const idContenedor = salida.idContenedor ? Number(salida.idContenedor) : null;
      const cantidad = Number(salida.cantidad ?? 0);
      if (!Number.isFinite(cantidad) || cantidad <= 0) throw new BadRequestException('Cantidad de consumible inválida.');

      if (idLote) {
        const itemFungible = await this.util.itemsFungiblesRepo.findOne({ where: { id: idLote }, relations: ['activo', 'contenedor'] });
        if (!itemFungible) throw new NotFoundException(`Fungible no encontrado: ${idLote}`);

        if (estadoInicial === 'despachado') {
          if (itemFungible.cantidad < cantidad) throw new BadRequestException(`Stock insuficiente para ${itemFungible.activo?.nombre || itemFungible.id}.`);
          itemFungible.cantidad -= cantidad;
          await this.util.itemsFungiblesRepo.save(itemFungible);
        }

        salidasConsumibles.push({
          idLote: itemFungible.id,
          idActivoFungible: itemFungible.activo.id,
          idContenedor: itemFungible.contenedor?.id ?? null,
          lote: itemFungible.lote ?? itemFungible.serie ?? 'Sistema',
          material: itemFungible.activo?.nombre ?? 'Material',
          cantidadSolicitada: cantidad,
          cantidadDespachada: estadoInicial === 'despachado' ? cantidad : 0,
          cantidadDevuelta: 0,
          motivo: salida.motivo?.trim() || (estadoInicial === 'despachado' ? 'Salida por canasta' : 'Solicitud'),
        });
      } else {
        if (!idActivoFungible) {
          throw new BadRequestException('Para solicitudes genéricas de fungibles se requiere idActivoFungible.');
        }
        const activoFungible = await this.util.itemsFungiblesRepo.manager.getRepository(ActivoFungible).findOne({
          where: { id: idActivoFungible },
          relations: ['contenedor']
        });
        if (!activoFungible) throw new NotFoundException(`Activo fungible no encontrado.`);

        if (estadoInicial === 'despachado') {
          throw new BadRequestException('No se puede despachar directamente una solicitud genérica de consumibles. Debe seleccionar un lote físico.');
        }

        salidasConsumibles.push({
          idLote: null,
          idActivoFungible: activoFungible.id,
          idContenedor: idContenedor ?? activoFungible.contenedor?.id ?? null,
          lote: null,
          material: activoFungible.nombre,
          cantidadSolicitada: cantidad,
          cantidadDespachada: 0,
          cantidadDevuelta: 0,
          motivo: salida.motivo?.trim() || 'Solicitud genérica',
        });
      }
    }

    const prestamosCreados: any[] = [];
    const carnetLiderRetenido = Array.isArray(datos.carnetsRetenidos)
      ? datos.carnetsRetenidos.includes(estudiante.carnet)
      : estadoInicial === 'despachado';

    // 1. Create loans for specific items
    if (itemsRegistrados.length > 0) {
      for (const itemCanasta of itemsRegistrados) {
        const itemActivo = await this.util.obtenerItemActivo(itemCanasta.idHerramienta);
        await this.util.validarDisponibilidadItem(itemCanasta.idHerramienta, undefined, itemActivo);

        const prestamo = this.util.prestamosRepo.create({
          estudiante,
          docente,
          codigoHerramienta: itemCanasta.idHerramienta,
          grupoCanasta,
          fechaPrestamo,
          fechaDevolucion,
          estado: estadoInicial,
          observaciones: datos.observaciones?.trim() || 'Canasta de prestamo',
          itemActivo,
          codigo: codigoCanasta,
          consumibles: salidasConsumibles.length > 0 ? salidasConsumibles : null,
          carnetRetenido: carnetLiderRetenido,
          inventario: inventarioSolicitadoId ? { id: inventarioSolicitadoId } : (itemActivo?.activo?.inventario ?? { id: 1 } as any),
        });

        let guardado;
        try {
          guardado = await this.util.prestamosRepo.save(prestamo);
        } catch (err: any) {
          if (err.code === '23505' || err.message?.includes('uq_prestamos_item_no_devuelto')) {
            throw new BadRequestException(`El equipo "${itemActivo?.activo?.nombre || itemCanasta.idHerramienta}" ya ha sido solicitado o está en préstamo por otro docente.`);
          }
          throw err;
        }

        if (estadoInicial === 'despachado') {
          await this.util.marcarItemEnPrestamo(itemActivo);
        }

        const completo = await this.util.prestamosRepo.findOne({ where: { id: guardado.id }, relations: ['estudiante', 'docente', 'itemActivo'] });
        if (completo) {
          prestamosCreados.push({ id: completo.id, carnetEstudiante: completo.estudiante?.carnet, idHerramienta: completo.codigoHerramienta, fechaPrestamo: completo.fechaPrestamo, fechaDevolucion: completo.fechaDevolucion, estado: completo.estado, observaciones: completo.observaciones });
          await this.util.registrarCambioHistorial(completo, 'creacion_solicitud', completo.estado, estadoInicial === 'solicitado' ? 'Canasta solicitada.' : 'Préstamo creado como parte de canasta.', ejecutor);
        }
      }
    }

    // 2. Create loans for generic containers
    for (const cont of contenedoresInput) {
      const contenedor = contenedoresMap.get(Number(cont.idContenedor));
      if (!contenedor) continue;
      for (let i = 0; i < Number(cont.cantidad); i++) {
        const prestamo = this.util.prestamosRepo.create({
          estudiante,
          docente,
          codigoHerramienta: null,
          grupoCanasta,
          fechaPrestamo,
          fechaDevolucion,
          estado: estadoInicial,
          observaciones: datos.observaciones?.trim() || 'Canasta de prestamo (Contenedor)',
          itemActivo: null,
          contenedor,
          codigo: codigoCanasta,
          consumibles: salidasConsumibles.length > 0 ? salidasConsumibles : null,
          carnetRetenido: carnetLiderRetenido,
          inventario: inventarioSolicitadoId ? { id: inventarioSolicitadoId } : (contenedor?.inventario ?? { id: 1 } as any),
        });

        const guardado = await this.util.prestamosRepo.save(prestamo);
        const completo = await this.util.prestamosRepo.findOne({ where: { id: guardado.id }, relations: ['estudiante', 'docente', 'contenedor'] });
        if (completo) {
          prestamosCreados.push({
            id: completo.id,
            carnetEstudiante: completo.estudiante?.carnet,
            idHerramienta: null,
            idContenedor: completo.contenedor?.id,
            nombreContenedor: completo.contenedor?.nombre,
            fechaPrestamo: completo.fechaPrestamo,
            fechaDevolucion: completo.fechaDevolucion,
            estado: completo.estado,
            observaciones: completo.observaciones,
          });
          await this.util.registrarCambioHistorial(completo, 'creacion_solicitud', completo.estado, 'Canasta solicitada (contenedor).', ejecutor);
        }
      }
    }

    // 3. Fallback for only consumibles
    if (itemsRegistrados.length === 0 && contenedoresInput.length === 0) {
      const prestamo = this.util.prestamosRepo.create({
        estudiante,
        docente,
        codigoHerramienta: null,
        grupoCanasta,
        fechaPrestamo,
        fechaDevolucion,
        estado: estadoInicial,
        observaciones: datos.observaciones?.trim() || 'Canasta (Solo consumibles)',
        itemActivo: null,
        codigo: codigoCanasta,
        consumibles: salidasConsumibles,
        carnetRetenido: carnetLiderRetenido,
        inventario: inventarioSolicitadoId ? { id: inventarioSolicitadoId } : { id: 1 } as any,
      });
      const guardado = await this.util.prestamosRepo.save(prestamo);
      const completo = await this.util.prestamosRepo.findOne({ where: { id: guardado.id }, relations: ['estudiante', 'docente', 'itemActivo'] });
      if (completo) {
        prestamosCreados.push({ id: completo.id, carnetEstudiante: completo.estudiante?.carnet, idHerramienta: null, fechaPrestamo: completo.fechaPrestamo, fechaDevolucion: completo.fechaDevolucion, estado: completo.estado, observaciones: completo.observaciones });
        await this.util.registrarCambioHistorial(completo, 'creacion_solicitud', completo.estado, estadoInicial === 'solicitado' ? 'Canasta solicitada (consumibles).' : 'Préstamo de consumibles creado.', ejecutor);
      }
    }

    for (const est of estudiantes) {
      await this.util.sincronizarCarnetRetenidoEstudiante(est.id);
    }
    await this.util.sincronizarCarnetsRetenidosEnLote();

    return { ok: true, prestamos: prestamosCreados, consumibles: salidasConsumibles };
  }

  async editarCanastaPrestamo(canastaId: string, datos: any, ejecutor?: any) {
    const prestamos = await this.resolverPrestamosPorCanastaId(canastaId);
    const grupoCanasta = prestamos[0].grupoCanasta ?? null;
    const estudiantesPrevios = grupoCanasta ? await this.obtenerEstudiantesCanasta(grupoCanasta) : [prestamos[0].estudiante];
    const idsPrevios = estudiantesPrevios.map((e) => e.id);
    const inventarioSolicitadoId = datos.idInventario ? Number(datos.idInventario) : (prestamos[0].inventario?.id ?? null);

    let estudiantesDestino = estudiantesPrevios;
    if (Array.isArray(datos.carnetsEstudiantes) && datos.carnetsEstudiantes.length > 0) {
      estudiantesDestino = await this.resolverEstudiantesPorCarnets(datos.carnetsEstudiantes);
    } else if (typeof datos.carnetEstudiante === 'string' && datos.carnetEstudiante.trim()) {
      estudiantesDestino = await this.resolverEstudiantesPorCarnets([datos.carnetEstudiante]);
    }
    const estudianteDestino = estudiantesDestino[0];

    let docenteDestino = prestamos[0].docente;
    if (typeof datos.idDocente === 'number') {
      docenteDestino = await this.util.obtenerDocenteUsuarioPorId(Number(datos.idDocente));
    }

    const fechaPrestamoDestino = datos.fechaPrestamo ? new Date(datos.fechaPrestamo) : prestamos[0].fechaPrestamo;
    const fechaDevolucionDestino = datos.fechaDevolucion !== undefined
      ? (datos.fechaDevolucion ? new Date(datos.fechaDevolucion) : null)
      : prestamos[0].fechaDevolucion;

    if (Number.isNaN(fechaPrestamoDestino.getTime())) throw new BadRequestException('Fecha de préstamo inválida.');
    if (fechaDevolucionDestino && Number.isNaN(fechaDevolucionDestino.getTime())) throw new BadRequestException('Fecha de devolución inválida.');
    if (fechaDevolucionDestino && fechaDevolucionDestino.getTime() <= fechaPrestamoDestino.getTime()) {
      throw new BadRequestException('Fecha de devolución debe ser posterior.');
    }

    const observacionesDestino = typeof datos.observaciones === 'string' ? datos.observaciones.trim() : (prestamos[0].observaciones ?? '');

    let salidasConsumibles: any[] | null = null;
    if (Array.isArray(datos.materiales)) {
      salidasConsumibles = [];
      const isDespachado = prestamos.some(p => p.estado === 'despachado' || p.estado === 'activo');
      
      for (const salida of datos.materiales) {
        const idLote = salida.idLote ? String(salida.idLote).trim() : null;
        const idActivoFungible = salida.idActivoFungible ? Number(salida.idActivoFungible) : null;
        const idContenedor = salida.idContenedor ? Number(salida.idContenedor) : null;
        const cantidad = Number(salida.cantidad ?? 0);
        if (!Number.isFinite(cantidad) || cantidad <= 0) throw new BadRequestException(`Cantidad inválida.`);

        if (idLote) {
          const itemFungible = await this.util.itemsFungiblesRepo.findOne({ where: { id: idLote }, relations: ['activo', 'contenedor'] });
          if (!itemFungible) throw new NotFoundException(`Fungible no encontrado: ${idLote}`);

          if (isDespachado) {
            const pConLote = prestamos.find(p => p.consumibles)?.consumibles?.find((pc: any) => pc.idLote === idLote);
            const prevCantDespachada = pConLote?.cantidadDespachada ?? 0;
            const diff = cantidad - prevCantDespachada;
            if (diff > 0) {
              if (itemFungible.cantidad < diff) throw new BadRequestException(`Stock insuficiente para ${itemFungible.activo?.nombre || itemFungible.id}.`);
              itemFungible.cantidad -= diff;
              await this.util.itemsFungiblesRepo.save(itemFungible);
            } else if (diff < 0) {
              itemFungible.cantidad += Math.abs(diff);
              await this.util.itemsFungiblesRepo.save(itemFungible);
            }
          }

          salidasConsumibles.push({
            idLote: itemFungible.id,
            idActivoFungible: itemFungible.activo.id,
            idContenedor: itemFungible.contenedor?.id ?? null,
            lote: itemFungible.lote ?? itemFungible.serie ?? 'Sistema',
            material: itemFungible.activo?.nombre ?? 'Material',
            cantidadSolicitada: cantidad,
            cantidadDespachada: isDespachado ? cantidad : 0,
            cantidadDevuelta: 0,
            motivo: salida.motivo?.trim() || (isDespachado ? 'Salida por canasta' : 'Solicitud'),
          });
        } else {
          if (!idActivoFungible) throw new BadRequestException('Para solicitudes genéricas de fungibles se requiere idActivoFungible.');
          const activoFungible = await this.util.itemsFungiblesRepo.manager.getRepository(ActivoFungible).findOne({
            where: { id: idActivoFungible },
            relations: ['contenedor']
          });
          if (!activoFungible) throw new NotFoundException(`Activo fungible no encontrado.`);

          salidasConsumibles.push({
            idLote: null,
            idActivoFungible: activoFungible.id,
            idContenedor: idContenedor ?? activoFungible.contenedor?.id ?? null,
            lote: null,
            material: activoFungible.nombre,
            cantidadSolicitada: cantidad,
            cantidadDespachada: 0,
            cantidadDevuelta: 0,
            motivo: salida.motivo?.trim() || 'Solicitud genérica',
          });
        }
      }

      if (isDespachado) {
        const prevConsumibles = prestamos.find(p => p.consumibles)?.consumibles ?? [];
        for (const prev of prevConsumibles) {
          if (!datos.materiales.some((m: any) => m.idLote === prev.idLote)) {
            const itemFungible = await this.util.itemsFungiblesRepo.findOne({ where: { id: prev.idLote } });
            if (itemFungible) {
              itemFungible.cantidad += (prev.cantidadDespachada ?? 0);
              await this.util.itemsFungiblesRepo.save(itemFungible);
            }
          }
        }
      }
    }

    for (const p of prestamos) {
      const antes = {
        carnetEstudiante: p.estudiante?.carnet,
        idDocente: p.docente?.id,
        fechaPrestamo: p.fechaPrestamo.toISOString(),
        fechaDevolucion: p.fechaDevolucion ? p.fechaDevolucion.toISOString() : null,
        observaciones: p.observaciones ?? '',
        estado: p.estado,
      };

      p.estudiante = estudianteDestino;
      p.docente = docenteDestino;
      p.fechaPrestamo = fechaPrestamoDestino;
      p.fechaDevolucion = fechaDevolucionDestino;
      p.observaciones = observacionesDestino;

      p.estado = this.util.estadoCalculado(datos.estado ?? p.estado, p.fechaDevolucion);
      if (datos.estado === 'devuelto') {
        p.estado = this.util.estadoDevolucionFinal(p.fechaDevolucion);
      }

      if (datos.carnetsRetenidos !== undefined && Array.isArray(datos.carnetsRetenidos)) {
        p.carnetRetenido = datos.carnetsRetenidos.includes(p.estudiante.carnet);
      }

      if (salidasConsumibles !== null) {
        p.consumibles = salidasConsumibles.length > 0 ? salidasConsumibles : null;
      }

      let guardado;
      try {
        guardado = await this.util.prestamosRepo.save(p);
      } catch (err: any) {
        if (err.code === '23505' || err.message?.includes('uq_prestamos_item_no_devuelto')) {
          throw new BadRequestException(`El equipo ya ha sido solicitado o está en préstamo por otro docente.`);
        }
        throw err;
      }
      const despues = {
        carnetEstudiante: guardado.estudiante?.carnet,
        idDocente: guardado.docente?.id,
        fechaPrestamo: guardado.fechaPrestamo.toISOString(),
        fechaDevolucion: guardado.fechaDevolucion ? guardado.fechaDevolucion.toISOString() : null,
        observaciones: guardado.observaciones ?? '',
        estado: guardado.estado,
      };

      const cambios: { antes: Record<string, any>; despues: Record<string, any> } = { antes: {}, despues: {} };
      for (const key of Object.keys(despues)) {
        if ((despues as any)[key] !== (antes as any)[key]) {
          cambios.antes[key] = (antes as any)[key];
          cambios.despues[key] = (despues as any)[key];
        }
      }

      if (Object.keys(cambios.despues).length > 0) {
        const accion = cambios.antes.estado !== cambios.despues.estado && (cambios.despues.estado === 'devuelto' || cambios.despues.estado === 'devuelto_fuera_de_fecha_limite')
          ? 'devolucion'
          : (cambios.antes.estado !== cambios.despues.estado ? 'modificacion_estado' : 'modificacion_detalles');
        await this.util.registrarCambioHistorial(guardado, accion, guardado.estado, 'Canasta editada.', ejecutor, cambios);
      }
    }

    if (grupoCanasta) {
      if (Array.isArray(datos.items)) {
        const entradasItems = this.normalizarItemsCanastaEntrada(datos.items);
        const detallesActuales = await this.asegurarDetallesCanastaRegistrados(grupoCanasta, prestamos);
        const detallesPorItem = new Map(detallesActuales.map((d) => [String(d.itemActivo?.id ?? '').trim(), d]));
        const entradasPorItem = new Map(entradasItems.map((e) => [e.idHerramienta, e]));

        for (const d of detallesActuales) {
          const idH = String(d.itemActivo?.id ?? '').trim();
          if (!idH) continue;
          const entrada = entradasPorItem.get(idH);
          if (!entrada) {
            if (d.registrado) throw new BadRequestException('No puedes quitar un item ya registrado.');
            await this.canastaItemsRepo.delete({ id: d.id });
            continue;
          }
          if (d.registrado && !entrada.registrado) throw new BadRequestException('No puedes desmarcar un item ya registrado.');
        }

        const detallesGuardar: CanastaPrestamoItemEntidad[] = [];
        for (const entrada of entradasItems) {
          let d = detallesPorItem.get(entrada.idHerramienta);
          const itemActivo = d?.itemActivo ?? await this.util.obtenerItemActivo(entrada.idHerramienta);
          if (!d) {
            d = this.canastaItemsRepo.create({ grupoCanasta, itemActivo, registrado: false });
          }

          if (!d.registrado && entrada.registrado) {
            await this.util.validarDisponibilidadItem(entrada.idHerramienta, undefined, itemActivo);

            const nuevoPrestamo = this.util.prestamosRepo.create({
              estudiante: estudianteDestino,
              docente: docenteDestino,
              codigoHerramienta: entrada.idHerramienta,
              grupoCanasta,
              fechaPrestamo: fechaPrestamoDestino,
              fechaDevolucion: fechaDevolucionDestino,
              estado: this.util.estadoCalculado('activo', fechaDevolucionDestino),
              observaciones: observacionesDestino,
              itemActivo,
              inventario: itemActivo?.activo?.inventario ?? { id: 1 } as any,
              consumibles: salidasConsumibles !== null ? (salidasConsumibles.length > 0 ? salidasConsumibles : null) : (prestamos.find(p => p.consumibles)?.consumibles ?? null),
            });

            let guardado;
            try {
              guardado = await this.util.prestamosRepo.save(nuevoPrestamo);
            } catch (err: any) {
              if (err.code === '23505' || err.message?.includes('uq_prestamos_item_no_devuelto')) {
                throw new BadRequestException(`El equipo "${itemActivo?.activo?.nombre || entrada.idHerramienta}" ya ha sido solicitado o está en préstamo por otro docente.`);
              }
              throw err;
            }
            await this.util.marcarItemEnPrestamo(itemActivo);
            d.registrado = true;

            const completoNuevo = await this.util.prestamosRepo.findOne({ where: { id: guardado.id }, relations: ['estudiante', 'docente', 'itemActivo'] });
            if (completoNuevo) {
              await this.util.registrarCambioHistorial(completoNuevo, 'creacion_solicitud', completoNuevo.estado, 'Item agregado a canasta.', ejecutor, {
                antes: {},
                despues: { id: completoNuevo.id, carnetEstudiante: completoNuevo.estudiante?.carnet, idHerramienta: completoNuevo.codigoHerramienta, fechaPrestamo: completoNuevo.fechaPrestamo.toISOString(), fechaDevolucion: completoNuevo.fechaDevolucion?.toISOString() ?? null, estado: completoNuevo.estado, observaciones: completoNuevo.observaciones }
              });
            }
          }
          detallesGuardar.push(d);
        }

        if (detallesGuardar.length > 0) {
          await this.canastaItemsRepo.save(detallesGuardar);
        }

        const tieneEquiposRegistrados = entradasItems.some(e => e.registrado);
        const pNulo = prestamos.find(p => p.codigoHerramienta === null);
        if (tieneEquiposRegistrados && pNulo) {
          await this.util.prestamosRepo.softRemove(pNulo);
        }

        const finalConsumibles = salidasConsumibles !== null ? salidasConsumibles : (prestamos.find(p => p.consumibles)?.consumibles ?? []);
        if (!tieneEquiposRegistrados && finalConsumibles.length > 0 && !pNulo) {
          const nuevoPrestamoNulo = this.util.prestamosRepo.create({
            estudiante: estudianteDestino,
            docente: docenteDestino,
            codigoHerramienta: null,
            grupoCanasta,
            fechaPrestamo: fechaPrestamoDestino,
            fechaDevolucion: fechaDevolucionDestino,
            estado: this.util.estadoCalculado('activo', fechaDevolucionDestino),
            observaciones: observacionesDestino,
            itemActivo: null,
            codigo: prestamos[0].codigo,
            consumibles: finalConsumibles,
            inventario: prestamos[0].inventario ?? { id: 1 } as any,
          });
          await this.util.prestamosRepo.save(nuevoPrestamoNulo);
        }
      }

      if (Array.isArray(datos.contenedores)) {
        const contenedoresInput = datos.contenedores;
        const idsContenedores = contenedoresInput.map((c: any) => Number(c.idContenedor)).filter(Boolean);
        const contenedoresDb = idsContenedores.length > 0
          ? await this.contenedoresRepo.find({ where: idsContenedores.map((id: number) => ({ id })), relations: ['inventario'] })
          : [];
        const contenedoresMap = new Map(contenedoresDb.map(c => [c.id, c]));

        const detallesCanastaActuales = await this.canastaItemsRepo.find({
          where: { grupoCanasta },
          relations: ['contenedor', 'itemActivo'],
        });
        const containerItemsActuales = detallesCanastaActuales.filter(d => d.itemActivo === null && d.contenedor !== null);

        const prestamosActuales = await this.util.prestamosRepo.find({
          where: { grupoCanasta },
          relations: ['contenedor', 'itemActivo', 'estudiante', 'docente'],
        });
        const prestamosContenedorActuales = prestamosActuales.filter(p => p.codigoHerramienta === null && p.contenedor !== null);

        const itemsPorContenedor = new Map<number, CanastaPrestamoItemEntidad[]>();
        for (const d of containerItemsActuales) {
          const cid = d.contenedor!.id;
          const list = itemsPorContenedor.get(cid) ?? [];
          list.push(d);
          itemsPorContenedor.set(cid, list);
        }

        const prestamosPorContenedor = new Map<number, PrestamoEntidad[]>();
        for (const p of prestamosContenedorActuales) {
          const cid = p.contenedor!.id;
          const list = prestamosPorContenedor.get(cid) ?? [];
          list.push(p);
          prestamosPorContenedor.set(cid, list);
        }

        const processedContIds = new Set<number>();
        for (const cont of contenedoresInput) {
          const cid = Number(cont.idContenedor);
          if (!cid) continue;
          processedContIds.add(cid);

          const targetQty = Number(cont.cantidad) || 0;
          const currentItems = itemsPorContenedor.get(cid) ?? [];
          const currentPrestamos = prestamosPorContenedor.get(cid) ?? [];

          const currentQty = currentItems.length;

          if (targetQty > currentQty) {
            const diff = targetQty - currentQty;
            const contenedor = contenedoresMap.get(cid);
            if (!contenedor) throw new NotFoundException(`Contenedor ${cid} no encontrado.`);

            for (let i = 0; i < diff; i++) {
              const nuevoItem = this.canastaItemsRepo.create({
                grupoCanasta,
                itemActivo: null,
                contenedor,
                registrado: false,
              });
              await this.canastaItemsRepo.save(nuevoItem);

              const nuevoPrestamo = this.util.prestamosRepo.create({
                estudiante: estudianteDestino,
                docente: docenteDestino,
                codigoHerramienta: null,
                grupoCanasta,
                fechaPrestamo: fechaPrestamoDestino,
                fechaDevolucion: fechaDevolucionDestino,
                estado: this.util.estadoCalculado(datos.estado ?? 'solicitado', fechaDevolucionDestino),
                observaciones: observacionesDestino,
                itemActivo: null,
                contenedor,
                codigo: prestamos[0].codigo,
                consumibles: salidasConsumibles !== null ? (salidasConsumibles.length > 0 ? salidasConsumibles : null) : (prestamos.find(p => p.consumibles)?.consumibles ?? null),
                inventario: inventarioSolicitadoId ? { id: inventarioSolicitadoId } : (contenedor?.inventario ?? { id: 1 } as any),
              });
              await this.util.prestamosRepo.save(nuevoPrestamo);
            }
          } else if (targetQty < currentQty) {
            const diff = currentQty - targetQty;
            for (let i = 0; i < diff; i++) {
              const itemToRemove = currentItems[i];
              if (itemToRemove) {
                await this.canastaItemsRepo.delete({ id: itemToRemove.id });
              }
              const prestamoToRemove = currentPrestamos[i];
              if (prestamoToRemove) {
                await this.util.prestamosRepo.delete({ id: prestamoToRemove.id });
              }
            }
          }
        }

        for (const cid of itemsPorContenedor.keys()) {
          if (!processedContIds.has(cid)) {
            const currentItems = itemsPorContenedor.get(cid) ?? [];
            const currentPrestamos = prestamosPorContenedor.get(cid) ?? [];
            for (const item of currentItems) {
              await this.canastaItemsRepo.delete({ id: item.id });
            }
            for (const prestamo of currentPrestamos) {
              await this.util.prestamosRepo.delete({ id: prestamo.id });
            }
          }
        }
      }

      await this.reemplazarEstudiantesCanasta(grupoCanasta, estudiantesDestino, false, datos.carnetsRetenidos);
    }

    const idsRecalcular = Array.from(new Set([...idsPrevios, ...estudiantesDestino.map((e) => e.id)]));
    for (const idEstudiante of idsRecalcular) {
      await this.util.sincronizarCarnetRetenidoEstudiante(idEstudiante);
    }
    await this.util.sincronizarCarnetsRetenidosEnLote();

    const recargados = await this.resolverPrestamosPorCanastaId(canastaId);
    const estudiantesCanasta = grupoCanasta ? await this.obtenerEstudiantesCanasta(grupoCanasta) : [recargados[0].estudiante];
    const detallesCanasta = grupoCanasta ? await this.obtenerDetallesItemsCanasta(grupoCanasta) : [];
    return this.mapCanastaDto(recargados, [], estudiantesCanasta, detallesCanasta);
  }

  async extenderCanastaPrestamo(canastaId: string, fechaDevolucion: string, ejecutor?: any) {
    const prestamos = await this.resolverPrestamosPorCanastaId(canastaId);
    const grupoCanasta = prestamos[0].grupoCanasta ?? null;
    const nuevaFecha = new Date(fechaDevolucion);
    if (Number.isNaN(nuevaFecha.getTime())) throw new BadRequestException('Nueva fecha inválida.');

    for (const p of prestamos) {
      if (nuevaFecha.getTime() <= p.fechaPrestamo.getTime()) throw new BadRequestException('Nueva fecha debe ser posterior.');
      const estadoAnterior = p.estado;
      const fechaAnterior = p.fechaDevolucion;
      p.fechaDevolucion = nuevaFecha;
      p.estado = this.util.estadoCalculado('activo', nuevaFecha);
      const guardado = await this.util.prestamosRepo.save(p);

      await this.util.registrarCambioHistorial(guardado, 'extension', guardado.estado, `Fecha extendida a ${nuevaFecha.toISOString().slice(0, 10)}.`, ejecutor, {
        antes: { fechaDevolucion: fechaAnterior ? fechaAnterior.toISOString() : null, estado: estadoAnterior },
        despues: { fechaDevolucion: guardado.fechaDevolucion ? guardado.fechaDevolucion.toISOString() : null, estado: guardado.estado }
      });
    }

    const estudiantesCanasta = grupoCanasta ? await this.obtenerEstudiantesCanasta(grupoCanasta) : [prestamos[0].estudiante];
    for (const e of estudiantesCanasta) {
      await this.util.sincronizarCarnetRetenidoEstudiante(e.id);
    }
    await this.util.sincronizarCarnetsRetenidosEnLote();

    const recargados = await this.resolverPrestamosPorCanastaId(canastaId);
    return this.mapCanastaDto(recargados, [], estudiantesCanasta);
  }

  async aceptarCanastaPrestamo(canastaId: string, ejecutor?: any) {
    const prestamos = await this.resolverPrestamosPorCanastaId(canastaId);
    const grupoCanasta = prestamos[0].grupoCanasta ?? null;

    for (const p of prestamos) {
      if (p.estado === 'aceptado') continue;
      if (p.estado !== 'solicitado') throw new BadRequestException('El préstamo no está solicitado.');
      const estadoAnterior = p.estado;
      p.estado = 'aceptado';
      const guardado = await this.util.prestamosRepo.save(p);
      await this.util.registrarCambioHistorial(guardado, 'aceptacion', guardado.estado, 'Solicitud aceptada.', ejecutor, {
        antes: { estado: estadoAnterior },
        despues: { estado: guardado.estado }
      });
    }

    const estudiantesCanasta = grupoCanasta ? await this.obtenerEstudiantesCanasta(grupoCanasta) : [prestamos[0].estudiante];
    const recargados = await this.resolverPrestamosPorCanastaId(canastaId);
    const detallesCanasta = grupoCanasta ? await this.obtenerDetallesItemsCanasta(grupoCanasta) : [];
    return this.mapCanastaDto(recargados, [], estudiantesCanasta, detallesCanasta);
  }

  async rechazarCanastaPrestamo(canastaId: string, motivo: string, ejecutor?: any) {
    const limpioMotivo = String(motivo ?? '').trim();
    if (!limpioMotivo) throw new BadRequestException('Debes proporcionar un motivo.');

    const prestamos = await this.resolverPrestamosPorCanastaId(canastaId);
    const grupoCanasta = prestamos[0].grupoCanasta ?? null;

    for (const p of prestamos) {
      if (p.estado !== 'solicitado') throw new BadRequestException('El préstamo no está solicitado.');
      const estadoAnterior = p.estado;
      p.estado = 'rechazado';
      p.motivoRechazo = limpioMotivo;
      const guardado = await this.util.prestamosRepo.save(p);
      await this.util.registrarCambioHistorial(guardado, 'rechazo', guardado.estado, `Solicitud rechazada. Motivo: ${limpioMotivo}`, ejecutor, {
        antes: { estado: estadoAnterior, motivoRechazo: null },
        despues: { estado: guardado.estado, motivoRechazo: limpioMotivo }
      });
    }

    const estudiantesCanasta = grupoCanasta ? await this.obtenerEstudiantesCanasta(grupoCanasta) : [prestamos[0].estudiante];
    const recargados = await this.resolverPrestamosPorCanastaId(canastaId);
    const detallesCanasta = grupoCanasta ? await this.obtenerDetallesItemsCanasta(grupoCanasta) : [];
    return this.mapCanastaDto(recargados, [], estudiantesCanasta, detallesCanasta);
  }

  async despacharCanastaPrestamo(canastaId: string, datos: any, ejecutor?: any) {
    const prestamos = await this.resolverPrestamosPorCanastaId(canastaId);
    const grupoCanasta = prestamos[0].grupoCanasta ?? null;
    const estudiantesCanasta = grupoCanasta ? await this.obtenerEstudiantesCanasta(grupoCanasta) : [prestamos[0].estudiante];

    const checkEstados = ['despachado', 'vencido'];
    for (const est of estudiantesCanasta) {
      const activosCount = await this.util.prestamosRepo
        .createQueryBuilder('p')
        .where('p.id_estudiante = :idEstudiante', { idEstudiante: est.id })
        .andWhere('p.estado IN (:...estados)', { estados: checkEstados })
        .andWhere('p.carnet_retenido = true')
        .andWhere('p.deleted_at IS NULL')
        .andWhere(grupoCanasta ? 'p.grupo_canasta <> :grupoCanasta' : 'p.id <> :prestamoId', { grupoCanasta, prestamoId: prestamos[0].id })
        .getCount();

      const activosCanastaCount = await this.util.canastaEstudiantesRepo
        .createQueryBuilder('ce')
        .innerJoin(PrestamoEntidad, 'p', 'p.grupo_canasta = ce.grupoCanasta AND p.estado IN (:...estados) AND p.deleted_at IS NULL', { estados: checkEstados })
        .where('ce.id_estudiante = :idEstudiante', { idEstudiante: est.id })
        .andWhere('ce.carnet_retenido = true')
        .andWhere('ce.grupo_canasta <> :grupoCanasta', { grupoCanasta: grupoCanasta ?? '' })
        .getCount();

      if (activosCount > 0 || activosCanastaCount > 0 || est.carnetRetenidoOverride === true) {
        throw new BadRequestException(`El estudiante ${est.nombre} (${est.carnet}) ya tiene su carnet retenido.`);
      }
    }

    if (Array.isArray(datos.equipos)) {
      const mapeoEntradaPorId = new Map<number, any>();
      const mapeoEntradaPorHerramienta = new Map<string, any>();
      for (const eq of datos.equipos) {
        if (eq.idPrestamo) {
          mapeoEntradaPorId.set(Number(eq.idPrestamo), eq);
        } else if (eq.idHerramienta) {
          mapeoEntradaPorHerramienta.set(eq.idHerramienta, eq);
        }
      }

      for (const p of prestamos) {
        const entrada = mapeoEntradaPorId.get(p.id) || (p.codigoHerramienta ? mapeoEntradaPorHerramienta.get(p.codigoHerramienta) : null);

        if (!entrada || !entrada.registrado) {
          if (p.itemActivo) {
            await this.util.marcarItemDisponibleAlDevolver(p.itemActivo);
          }
          await this.util.registrarCambioHistorial(p, 'no_despachado', 'no_despachado', 'No despachado (desmarcado por el encargado).', ejecutor);
          if (grupoCanasta) {
            if (p.itemActivo) {
              const existeCanastaItem = await this.canastaItemsRepo.findOne({
                where: { grupoCanasta, itemActivo: { id: p.itemActivo.id } }
              });
              if (existeCanastaItem) {
                await this.canastaItemsRepo.remove(existeCanastaItem);
              }
            } else if (p.contenedor) {
              const existeCanastaItem = await this.canastaItemsRepo.findOne({
                where: { grupoCanasta, itemActivo: IsNull(), contenedor: { id: p.contenedor.id } }
              });
              if (existeCanastaItem) {
                await this.canastaItemsRepo.remove(existeCanastaItem);
              }
            }
          }
          await this.util.prestamosRepo.softRemove(p);
        } else {
          if (!p.codigoHerramienta && entrada.idHerramienta) {
            const itemActivo = await this.util.obtenerItemActivo(entrada.idHerramienta);
            await this.util.validarDisponibilidadItem(entrada.idHerramienta, undefined, itemActivo);
            p.itemActivo = itemActivo;
            p.codigoHerramienta = entrada.idHerramienta;
            p.inventario = itemActivo?.activo?.inventario ?? p.inventario;
          }

          p.estadoFisicoEntrega = entrada.estadoFisicoEntrega || 'bueno';
          p.estado = 'despachado';
          if (p.itemActivo) await this.util.marcarItemEnPrestamo(p.itemActivo);
          await this.util.prestamosRepo.save(p);

          if (grupoCanasta && p.itemActivo) {
            let existeCanastaItem = await this.canastaItemsRepo.findOne({
              where: { grupoCanasta, itemActivo: { id: p.itemActivo.id } }
            });
            if (!existeCanastaItem) {
              existeCanastaItem = await this.canastaItemsRepo.findOne({
                where: { grupoCanasta, itemActivo: IsNull(), contenedor: { id: p.contenedor?.id } }
              });
              if (existeCanastaItem) {
                existeCanastaItem.itemActivo = p.itemActivo;
                existeCanastaItem.registrado = true;
                await this.canastaItemsRepo.save(existeCanastaItem);
              } else {
                await this.canastaItemsRepo.save(this.canastaItemsRepo.create({
                  grupoCanasta,
                  itemActivo: p.itemActivo,
                  contenedor: p.contenedor,
                  registrado: true,
                }));
              }
            } else {
              existeCanastaItem.registrado = true;
              await this.canastaItemsRepo.save(existeCanastaItem);
            }
          }
        }
      }

      for (const eq of datos.equipos) {
        if (!eq.registrado || eq.idPrestamo) continue;
        const yaExiste = prestamos.some((p) => p.codigoHerramienta === eq.idHerramienta);
        if (!yaExiste) {
          const itemActivo = await this.util.obtenerItemActivo(eq.idHerramienta);
          await this.util.validarDisponibilidadItem(eq.idHerramienta, undefined, itemActivo);

          const nuevoPrestamo = this.util.prestamosRepo.create({
            estudiante: prestamos[0].estudiante,
            docente: prestamos[0].docente,
            codigoHerramienta: eq.idHerramienta,
            grupoCanasta,
            fechaPrestamo: prestamos[0].fechaPrestamo,
            fechaDevolucion: prestamos[0].fechaDevolucion,
            estado: 'despachado',
            estadoFisicoEntrega: eq.estadoFisicoEntrega || 'bueno',
            itemActivo,
            codigo: prestamos[0].codigo,
            inventario: itemActivo?.activo?.inventario ?? { id: 1 } as any,
          });
          await this.util.prestamosRepo.save(nuevoPrestamo);
          await this.util.marcarItemEnPrestamo(itemActivo);

          if (grupoCanasta) {
            const existeCanastaItem = await this.canastaItemsRepo.findOne({ where: { grupoCanasta, itemActivo: { id: itemActivo.id } } });
            if (!existeCanastaItem) {
              await this.canastaItemsRepo.save(this.canastaItemsRepo.create({ grupoCanasta, itemActivo, registrado: true }));
            } else if (!existeCanastaItem.registrado) {
              existeCanastaItem.registrado = true;
              await this.canastaItemsRepo.save(existeCanastaItem);
            }
          }
        }
      }
    } else {
      for (const p of prestamos) {
        p.estado = 'despachado';
        if (p.itemActivo) await this.util.marcarItemEnPrestamo(p.itemActivo);
        await this.util.prestamosRepo.save(p);
      }
    }

    const consumiblesDespachados: any[] = [];
    if (Array.isArray(datos.consumibles)) {
      for (const c of datos.consumibles) {
        if (!c.idLote) {
          throw new BadRequestException('Se debe especificar un lote físico real (idLote) para todos los consumibles a despachar.');
        }
        const itemFungible = await this.util.itemsFungiblesRepo.findOne({ where: { id: c.idLote }, relations: ['activo', 'contenedor'] });
        if (!itemFungible) throw new NotFoundException(`Lote fungible ${c.idLote} no encontrado.`);

        const cantADespachar = Number(c.cantidad ?? c.cantidadDespachada ?? 0);
        if (!Number.isFinite(cantADespachar) || cantADespachar <= 0) {
          throw new BadRequestException(`Cantidad inválida para despachar el material ${itemFungible.activo?.nombre}.`);
        }

        if (itemFungible.cantidad < cantADespachar) {
          throw new BadRequestException(`Stock insuficiente para el lote del material ${itemFungible.activo?.nombre}.`);
        }

        itemFungible.cantidad -= cantADespachar;
        await this.util.itemsFungiblesRepo.save(itemFungible);

        // Find original request in prestamos to match cantidadSolicitada and motivo
        let cantidadSolicitada = cantADespachar;
        let motivo = 'Despachado por canasta';
        let idActivoFungible = itemFungible.activo.id;
        let idContenedor = itemFungible.contenedor?.id ?? null;

        for (const p of prestamos) {
          if (p.consumibles) {
            const orig = p.consumibles.find((x: any) =>
              (x.idLote === c.idLote) ||
              (x.idLote === null && Number(x.idActivoFungible) === Number(itemFungible.activo.id))
            ) as any;
            if (orig) {
              cantidadSolicitada = orig.cantidadSolicitada ?? orig.cantidad ?? cantADespachar;
              motivo = orig.motivo ?? motivo;
              idContenedor = orig.idContenedor ?? idContenedor;
              break;
            }
          }
        }

        consumiblesDespachados.push({
          idLote: c.idLote,
          idActivoFungible,
          idContenedor,
          lote: itemFungible.lote || itemFungible.serie || 'Lote',
          material: itemFungible.activo?.nombre || 'Material',
          cantidadSolicitada,
          cantidadDespachada: cantADespachar,
          cantidadDevuelta: 0,
          motivo,
        });
      }
    }

    const prestamosActualizados = await this.resolverPrestamosPorCanastaId(canastaId);
    const ahora = new Date();
    for (const p of prestamosActualizados) {
      p.estado = 'despachado';

      if (p.fechaDevolucion && p.fechaDevolucion.getTime() <= ahora.getTime()) {
        const difOriginal = p.fechaDevolucion.getTime() - p.fechaPrestamo.getTime();
        const duracion = difOriginal > 0 ? difOriginal : 24 * 60 * 60 * 1000;
        p.fechaDevolucion = new Date(ahora.getTime() + duracion);
      }

      p.fechaPrestamo = ahora; // Update start date/time
      if (consumiblesDespachados.length > 0) p.consumibles = consumiblesDespachados;
      await this.util.prestamosRepo.save(p);
      await this.util.registrarCambioHistorial(p, 'despacho', p.estado, 'Préstamo despachado.', ejecutor);
    }

    const carnetsSet = new Set(datos.carnetsRetenidos ?? []);
    if (carnetsSet.size === 0) {
      throw new BadRequestException('Debes retener al menos un CU/carnet para despachar el préstamo.');
    }
    if (grupoCanasta) {
      const canastaEstudiantes = await this.util.canastaEstudiantesRepo.find({ where: { grupoCanasta }, relations: ['estudiante'] });
      for (const ce of canastaEstudiantes) {
        const retenido = carnetsSet.has(ce.estudiante.carnet);
        ce.carnetRetenido = retenido;
        await this.util.canastaEstudiantesRepo.save(ce);
        ce.estudiante.carnetRetenido = retenido;
        await this.util.estudiantesRepo.save(ce.estudiante);
      }
    } else {
      const pUnico = prestamosActualizados[0];
      const retenido = carnetsSet.has(pUnico.estudiante.carnet);
      pUnico.carnetRetenido = retenido;
      await this.util.prestamosRepo.save(pUnico);
      pUnico.estudiante.carnetRetenido = retenido;
      await this.util.estudiantesRepo.save(pUnico.estudiante);
    }

    await this.util.sincronizarCarnetsRetenidosEnLote();

    const recargados = await this.resolverPrestamosPorCanastaId(canastaId);
    const estudiantesFinal = grupoCanasta ? await this.obtenerEstudiantesCanasta(grupoCanasta) : [recargados[0].estudiante];
    const detallesFinal = grupoCanasta ? await this.obtenerDetallesItemsCanasta(grupoCanasta) : [];
    return this.mapCanastaDto(recargados, [], estudiantesFinal, detallesFinal);
  }

  async devolverCanastaPrestamo(canastaId: string, ejecutor?: any) {
    const prestamos = await this.resolverPrestamosPorCanastaId(canastaId);
    const grupoCanasta = prestamos[0].grupoCanasta ?? null;

    for (const p of prestamos) {
      const estadoAnterior = p.estado;
      p.estado = this.util.estadoDevolucionFinal(p.fechaDevolucion);
      p.fechaDevolucion = new Date(); // Update return date to actual return time!
      const guardado = await this.util.prestamosRepo.save(p);

      await this.util.registrarCambioHistorial(guardado, 'devolucion', guardado.estado, 'Canasta devuelta.', ejecutor, {
        antes: { estado: estadoAnterior },
        despues: { estado: guardado.estado }
      });

      if (guardado.itemActivo) {
        await this.util.marcarItemDisponibleAlDevolver(guardado.itemActivo);
      } else if (guardado.codigoHerramienta) {
        try {
          const item = await this.util.obtenerItemActivo(guardado.codigoHerramienta);
          await this.util.marcarItemDisponibleAlDevolver(item);
        } catch {}
      }
    }

    const estudiantesCanasta = grupoCanasta ? await this.obtenerEstudiantesCanasta(grupoCanasta) : [prestamos[0].estudiante];
    for (const e of estudiantesCanasta) {
      await this.util.sincronizarCarnetRetenidoEstudiante(e.id);
    }
    await this.util.sincronizarCarnetsRetenidosEnLote();

    const recargados = await this.resolverPrestamosPorCanastaId(canastaId);
    return this.mapCanastaDto(recargados, [], estudiantesCanasta);
  }

  async devolverCanastaPrestamoCompleto(canastaId: string, datos: any, ejecutor?: any) {
    const prestamos = await this.resolverPrestamosPorCanastaId(canastaId);
    const grupoCanasta = prestamos[0].grupoCanasta ?? null;
    const observacionesDevolucion = datos.observaciones?.trim() || '';

    if (Array.isArray(datos.equipos)) {
      const mapeoEntrada = new Map<string, any>(datos.equipos.map((eq: any) => [eq.idHerramienta, eq]));
      for (const p of prestamos) {
        if (!p.codigoHerramienta) continue;
        const entrada = mapeoEntrada.get(p.codigoHerramienta);
        if (entrada && entrada.devuelto) {
          const estadoAnterior = p.estado;
          p.estado = this.util.estadoDevolucionFinal(p.fechaDevolucion);
          p.estadoFisicoDevolucion = entrada.estadoFisicoDevolucion || 'bueno';
          p.fechaDevolucion = new Date(); // Update return date to actual return time!
          if (observacionesDevolucion) p.observaciones = `${p.observaciones || ''}\nDevolución: ${observacionesDevolucion}`.trim();
          await this.util.prestamosRepo.save(p);

          if (p.itemActivo) {
            await this.util.marcarItemDisponibleAlDevolver(p.itemActivo);
            p.itemActivo.estado_fisico = entrada.estadoFisicoDevolucion || 'bueno';
            await this.util.itemsActivosRepo.save(p.itemActivo);
          }

          await this.util.registrarCambioHistorial(p, 'devolucion', p.estado, 'Item devuelto.', ejecutor, {
            antes: { estado: estadoAnterior },
            despues: { estado: p.estado, estadoFisicoDevolucion: p.estadoFisicoDevolucion }
          });
        }
      }
    } else {
      for (const p of prestamos) {
        const estadoAnterior = p.estado;
        p.estado = this.util.estadoDevolucionFinal(p.fechaDevolucion);
        p.fechaDevolucion = new Date(); // Update return date to actual return time!
        if (observacionesDevolucion) p.observaciones = `${p.observaciones || ''}\nDevolución: ${observacionesDevolucion}`.trim();
        await this.util.prestamosRepo.save(p);

        if (p.itemActivo) await this.util.marcarItemDisponibleAlDevolver(p.itemActivo);
        await this.util.registrarCambioHistorial(p, 'devolucion', p.estado, 'Item devuelto (Completo).', ejecutor, {
          antes: { estado: estadoAnterior },
          despues: { estado: p.estado }
        });
      }
    }

    if (Array.isArray(datos.consumibles)) {
      for (const c of datos.consumibles) {
        let found = false;
        let cantidadDespachada = 0;
        let prevDevuelta = 0;

        for (const p of prestamos) {
          if (p.consumibles) {
            const pc = p.consumibles.find((x: any) => x.idLote === c.idLote);
            if (pc) {
              cantidadDespachada = pc.cantidadDespachada ?? pc.cantidadSolicitada ?? 0;
              prevDevuelta = pc.cantidadDevuelta ?? 0;
              found = true;
              break;
            }
          }
        }

        if (!found) {
          throw new BadRequestException(`El lote fungible ${c.idLote} no pertenece a este préstamo/canasta.`);
        }

        const cantDev = Number(c.cantidadDevuelta ?? 0);
        if (Number.isNaN(cantDev) || cantDev < 0) {
          throw new BadRequestException(`Cantidad devuelta inválida para el lote ${c.idLote}.`);
        }
        if (cantDev > cantidadDespachada) {
          throw new BadRequestException(`La cantidad devuelta (${cantDev}) no puede ser mayor que la cantidad despachada (${cantidadDespachada}) para el lote ${c.idLote}.`);
        }

        const diff = cantDev - prevDevuelta;
        if (diff !== 0) {
          const itemFungible = await this.util.itemsFungiblesRepo.findOne({ where: { id: c.idLote } });
          if (itemFungible) {
            itemFungible.cantidad += diff;
            await this.util.itemsFungiblesRepo.save(itemFungible);
          }
        }
      }

      for (const p of prestamos) {
        if (p.consumibles) {
          p.consumibles = p.consumibles.map((pc) => {
            const dev = datos.consumibles?.find((c: any) => c.idLote === pc.idLote);
            return dev ? { ...pc, cantidadDevuelta: Number(dev.cantidadDevuelta ?? 0), estadoDevuelto: dev.estadoDevuelto || 'bueno' } : pc;
          });
          await this.util.prestamosRepo.save(p);
        }
      }
    }

    const carnetsDevueltosSet = new Set(datos.carnetsDevueltos ?? []);
    if (grupoCanasta) {
      const canastaEstudiantes = await this.util.canastaEstudiantesRepo.find({ where: { grupoCanasta }, relations: ['estudiante'] });
      for (const ce of canastaEstudiantes) {
        if (carnetsDevueltosSet.has(ce.estudiante.carnet)) {
          ce.carnetRetenido = false;
          await this.util.canastaEstudiantesRepo.save(ce);
          ce.estudiante.carnetRetenido = false;
          await this.util.estudiantesRepo.save(ce.estudiante);
        }
      }
    } else {
      const pUnico = prestamos[0];
      if (carnetsDevueltosSet.has(pUnico.estudiante.carnet)) {
        pUnico.carnetRetenido = false;
        await this.util.prestamosRepo.save(pUnico);
        pUnico.estudiante.carnetRetenido = false;
        await this.util.estudiantesRepo.save(pUnico.estudiante);
      }
    }

    await this.util.sincronizarCarnetsRetenidosEnLote();

    const recargados = await this.resolverPrestamosPorCanastaId(canastaId);
    const estudiantesFinal = grupoCanasta ? await this.obtenerEstudiantesCanasta(grupoCanasta) : [recargados[0].estudiante];
    const detallesFinal = grupoCanasta ? await this.obtenerDetallesItemsCanasta(grupoCanasta) : [];
    return this.mapCanastaDto(recargados, [], estudiantesFinal, detallesFinal);
  }

  async eliminarCanastaPrestamo(canastaId: string, ejecutor?: any): Promise<void> {
    const prestamos = await this.resolverPrestamosPorCanastaId(canastaId);
    const grupoCanasta = prestamos[0].grupoCanasta ?? null;
    const estudiantesCanasta = grupoCanasta ? await this.obtenerEstudiantesCanasta(grupoCanasta) : [prestamos[0].estudiante];

    for (const p of prestamos) {
      await this.util.registrarCambioHistorial(p, 'eliminacion', p.estado, 'Canasta eliminada (soft delete).', ejecutor, {
        antes: { deletedAt: null },
        despues: { deletedAt: new Date().toISOString() }
      });
    }

    await this.util.prestamosRepo.softRemove(prestamos);
    if (grupoCanasta) {
      await this.util.canastaEstudiantesRepo.delete({ grupoCanasta });
      await this.canastaItemsRepo.delete({ grupoCanasta });
    }
    for (const e of estudiantesCanasta) {
      await this.util.sincronizarCarnetRetenidoEstudiante(e.id);
    }
    await this.util.sincronizarCarnetsRetenidosEnLote();
  }
}
