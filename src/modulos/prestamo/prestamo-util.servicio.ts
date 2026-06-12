import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHmac } from 'crypto';
import { PrestamoEntidad } from './entidades/prestamo.entidad';
import { HistorialPrestamoEntidad } from './entidades/historial-prestamo.entidad';
import { EncargadoInventarioEntidad } from '@/modulos/encargado-inventario/entidades/encargado-inventario.entidad';
import { EstudianteEntidad } from '@/modulos/estudiante/entidades/estudiante.entidad';
import { DocenteEntidad } from '@/modulos/docente/entidades/docente.entidad';
import { CanastaEstudianteEntidad } from './entidades/canasta_estudiante.entidad';
import { ItemActivoFijo } from '@/modulos/activo/entidades/item-activo-fijo.entidad';
import { ItemActivoFungible } from '@/modulos/activo/entidades/item-activo-fungible.entidad';
import { normalizarEstadoItem } from '@/modulos/activo/dominio/reglas-estado-item';
import { Usuario } from '@/modulos/usuario/entidades/usuario.entidad';

@Injectable()
export class PrestamoUtilServicio {
  constructor(
    @InjectRepository(PrestamoEntidad)
    public readonly prestamosRepo: Repository<PrestamoEntidad>,
    @InjectRepository(HistorialPrestamoEntidad)
    public readonly historialRepo: Repository<HistorialPrestamoEntidad>,
    @InjectRepository(EncargadoInventarioEntidad)
    public readonly encargadosRepo: Repository<EncargadoInventarioEntidad>,
    @InjectRepository(EstudianteEntidad)
    public readonly estudiantesRepo: Repository<EstudianteEntidad>,
    @InjectRepository(DocenteEntidad)
    public readonly docentesRepo: Repository<DocenteEntidad>,
    @InjectRepository(CanastaEstudianteEntidad)
    public readonly canastaEstudiantesRepo: Repository<CanastaEstudianteEntidad>,
    @InjectRepository(ItemActivoFijo)
    public readonly itemsActivosRepo: Repository<ItemActivoFijo>,
    @InjectRepository(ItemActivoFungible)
    public readonly itemsFungiblesRepo: Repository<ItemActivoFungible>,
  ) {}

  public async obtenerInfoUsuarioParaHistorial(usuario: any) {
    if (!usuario) {
      return {
        id: 0,
        nombre: 'Sistema',
        correo: 'sistema@sgi.local',
        rol: 'sistema',
      };
    }

    let nombre = 'Administrador';
    if (usuario.rol === 'encargado_inventario') {
      const encargado = await this.encargadosRepo.findOne({
        where: { usuario: { id: usuario.id } },
      });
      if (encargado) {
        nombre = `${encargado.nombre ?? ''} ${encargado.apellido ?? ''}`.trim() || 'Encargado';
      } else {
        nombre = 'Encargado';
      }
    } else if (usuario.rol === 'docente') {
      const docente = await this.docentesRepo.findOne({
        where: [{ id: usuario.id }, { usuario: { id: usuario.id } }],
      });
      if (docente) {
        nombre = `${docente.nombre ?? ''} ${docente.apellido ?? ''}`.trim() || 'Docente';
      } else {
        nombre = 'Docente';
      }
    } else if (usuario.rol === 'estudiante') {
      const estudiante = await this.estudiantesRepo.findOne({
        where: [{ id: usuario.id }, { usuario: { id: usuario.id } }],
      });
      if (estudiante) {
        nombre = `${estudiante.nombre ?? ''} ${estudiante.apellido ?? ''}`.trim() || 'Estudiante';
      } else {
        nombre = 'Estudiante';
      }
    }

    return {
      id: usuario.id,
      nombre,
      correo: usuario.correo ?? '',
      rol: usuario.rol,
    };
  }

  public async registrarCambioHistorial(
    prestamo: PrestamoEntidad,
    accion: string,
    estado: string,
    observaciones: string,
    ejecutor: any,
    detallesCambios?: { antes?: Record<string, any>; despues?: Record<string, any> } | null,
  ) {
    const usuarioInfo = await this.obtenerInfoUsuarioParaHistorial(ejecutor);

    const log = this.historialRepo.create({
      prestamo,
      usuario: ejecutor ? { id: ejecutor.id } as any : null,
      nombreUsuario: usuarioInfo.nombre,
      rolUsuario: usuarioInfo.rol,
      correoUsuario: usuarioInfo.correo,
      estado,
      accion,
      observaciones,
      detalles: detallesCambios ?? null,
    });

    await this.historialRepo.save(log);
  }

  public normalizarCodigo(valor: string): string {
    return valor.trim();
  }

  public generarCodigoPrestamo(
    fecha: Date,
    carnetEstudiante: string,
    ref: string,
  ): string {
    const secreto = process.env.JWT_SECRETO ?? 'secreto_prestamos_siyp';
    const input = `${fecha.getTime()}:${carnetEstudiante}:${ref}`;
    const hash = createHmac('sha256', secreto)
      .update(input)
      .digest('hex');
    
    const subHash = hash.substring(0, 12);
    const num = parseInt(subHash, 16);
    let cod = num.toString(36).toUpperCase().padStart(8, '0');
    cod = cod.substring(cod.length - 8);
    
    return `${cod.substring(0, 4)}-${cod.substring(4, 8)}`;
  }

  public normalizarCodigoMateriaCatalogo(valor: string): string {
    return String(valor ?? '').trim().toUpperCase().replace(/\s+/g, '');
  }

  public obtenerNombreCompletoDocente(docente: DocenteEntidad | Usuario | null | undefined): string {
    const nombre = String((docente as any)?.nombre ?? '').trim();
    const apellido = String((docente as any)?.apellido ?? '').trim();
    const completo = `${nombre} ${apellido}`.trim();
    if (completo) return completo;
    return String((docente as any)?.correo ?? '').trim();
  }

  public dividirNombreDocente(nombreCompleto: string): { nombre: string; apellido: string } {
    const limpio = String(nombreCompleto ?? '').trim().replace(/\s+/g, ' ');
    if (!limpio) return { nombre: '', apellido: '' };
    const partes = limpio.split(' ');
    if (partes.length === 1) return { nombre: partes[0], apellido: '' };
    const nombre = partes.shift() ?? '';
    return { nombre, apellido: partes.join(' ') };
  }

  public async obtenerDocenteUsuarioPorId(idDocente: number): Promise<Usuario> {
    const docente = await this.docentesRepo.findOne({
      where: [{ id: idDocente }, { usuario: { id: idDocente } }],
      relations: ['usuario'],
    });
    if (!docente || !docente.usuario)
      throw new NotFoundException('Perfil de docente o usuario no encontrado.');
    return docente.usuario;
  }

  public async obtenerItemActivo(idHerramienta: string): Promise<ItemActivoFijo> {
    const limpio = String(idHerramienta ?? '').trim();
    if (!limpio) {
      throw new BadRequestException('El identificador del item de activo no es válido.');
    }
    const item = await this.itemsActivosRepo.findOne({ where: { id: limpio }, relations: ['activo', 'activo.inventario'] });
    if (!item) throw new NotFoundException('Item de activo no encontrado.');
    return item;
  }

  public async validarDisponibilidadItem(idHerramienta: string, excluirPrestamoId?: number, itemActivo?: ItemActivoFijo) {
    const item = itemActivo ?? (await this.obtenerItemActivo(idHerramienta));
    const estadoItem = normalizarEstadoItem(item.estado);
    if (estadoItem !== 'disponible') {
      throw new BadRequestException(`El item no está disponible para préstamo (estado actual: ${estadoItem}).`);
    }

    const qb = this.prestamosRepo
      .createQueryBuilder('p')
      .where('p.codigo_herramienta = :idHerramienta', { idHerramienta })
      .andWhere('p.estado NOT IN (:...estadosCerrados)', { estadosCerrados: ['devuelto', 'devuelto_fuera_de_fecha_limite', 'rechazado'] })
      .andWhere('p.deleted_at IS NULL');

    if (typeof excluirPrestamoId === 'number') {
      qb.andWhere('p.id <> :excluirPrestamoId', { excluirPrestamoId });
    }

    const enUso = await qb.getCount();
    if (enUso > 0) {
      throw new BadRequestException('El item seleccionado ya tiene un préstamo activo y no puede volver a prestarse hasta su devolución.');
    }
  }

  public async marcarItemEnPrestamo(item: ItemActivoFijo) {
    const actual = normalizarEstadoItem(item.estado);
    if (actual === 'disponible') {
      item.estado = 'en_prestamo';
      await this.itemsActivosRepo.save(item);
    }
  }

  public async marcarItemDisponibleAlDevolver(item: ItemActivoFijo) {
    const actual = normalizarEstadoItem(item.estado);
    if (actual === 'en_prestamo') {
      item.estado = 'disponible';
      await this.itemsActivosRepo.save(item);
    }
  }

  public estadoCalculado(estadoActual: string, fechaDevolucion: Date | null | undefined): string {
    if (['devuelto', 'devuelto_fuera_de_fecha_limite', 'solicitado', 'aceptado', 'rechazado'].includes(estadoActual)) {
      return estadoActual;
    }
    if (['despachado', 'vencido', 'activo', 'pendiente'].includes(estadoActual)) {
      if (!fechaDevolucion) return 'despachado';
      return new Date(fechaDevolucion).getTime() < Date.now() ? 'vencido' : 'despachado';
    }
    return estadoActual;
  }

  public estadoDevolucionFinal(fechaLimite: Date | null | undefined): 'devuelto' | 'devuelto_fuera_de_fecha_limite' {
    if (!fechaLimite) return 'devuelto';
    return Date.now() > new Date(fechaLimite).getTime()
      ? 'devuelto_fuera_de_fecha_limite'
      : 'devuelto';
  }

  public async sincronizarCarnetRetenidoEstudiante(idEstudiante: number) {
    const estudiante = await this.estudiantesRepo.findOne({ where: { id: idEstudiante } });
    if (!estudiante) return;
    if (typeof estudiante.carnetRetenidoOverride === 'boolean') {
      if (estudiante.carnetRetenido !== estudiante.carnetRetenidoOverride) {
        estudiante.carnetRetenido = estudiante.carnetRetenidoOverride;
        await this.estudiantesRepo.save(estudiante);
      }
      return;
    }

    const activos = await this.prestamosRepo
      .createQueryBuilder('p')
      .where('p.id_estudiante = :idEstudiante', { idEstudiante })
      .andWhere('p.estado IN (:...estados)', { estados: ['despachado', 'vencido'] })
      .andWhere('p.carnet_retenido = true')
      .andWhere('p.deleted_at IS NULL')
      .getCount();

    const activosCanasta = await this.canastaEstudiantesRepo
      .createQueryBuilder('ce')
      .innerJoin(PrestamoEntidad, 'p', 'p.grupo_canasta = ce.grupoCanasta AND p.estado IN (:...estados) AND p.deleted_at IS NULL', {
        estados: ['despachado', 'vencido'],
      })
      .where('ce.id_estudiante = :idEstudiante', { idEstudiante })
      .andWhere('ce.carnet_retenido = true')
      .getCount();

    const nuevoValor = activos > 0 || activosCanasta > 0;
    if (nuevoValor === estudiante.carnetRetenido) return;
    estudiante.carnetRetenido = nuevoValor;
    await this.estudiantesRepo.save(estudiante);
  }

  public async sincronizarCarnetsRetenidosEnLote() {
    const estadosActivos = ['despachado', 'vencido'];

    await this.estudiantesRepo
      .createQueryBuilder()
      .update(EstudianteEntidad)
      .set({ carnetRetenido: true })
      .where('carnet_retenido = false')
      .andWhere('carnet_retenido_override IS NULL')
      .andWhere(
        `id IN (
          SELECT DISTINCT p.id_estudiante
          FROM prestamos p
          WHERE p.estado IN (:...estadosActivos)
            AND p.carnet_retenido = true
            AND p.deleted_at IS NULL
          UNION
          SELECT DISTINCT ce.id_estudiante
          FROM canasta_estudiantes ce
          INNER JOIN prestamos p ON p.grupo_canasta = ce.grupo_canasta
          WHERE p.estado IN (:...estadosActivos)
            AND ce.carnet_retenido = true
            AND p.deleted_at IS NULL
        )`,
        { estadosActivos },
      )
      .execute();

    await this.estudiantesRepo
      .createQueryBuilder()
      .update(EstudianteEntidad)
      .set({ carnetRetenido: false })
      .where('carnet_retenido = true')
      .andWhere('carnet_retenido_override IS NULL')
      .andWhere(
        `id NOT IN (
          SELECT DISTINCT p.id_estudiante
          FROM prestamos p
          WHERE p.estado IN (:...estadosActivos)
            AND p.carnet_retenido = true
            AND p.deleted_at IS NULL
          UNION
          SELECT DISTINCT ce.id_estudiante
          FROM canasta_estudiantes ce
          INNER JOIN prestamos p ON p.grupo_canasta = ce.grupo_canasta
          WHERE p.estado IN (:...estadosActivos)
            AND ce.carnet_retenido = true
            AND p.deleted_at IS NULL
        )`,
        { estadosActivos },
      )
      .execute();
  }

  public async marcarVencidosEnLote() {
    await this.prestamosRepo
       .createQueryBuilder()
       .update(PrestamoEntidad)
       .set({ estado: 'vencido' })
       .where('estado IN (:...estados)', { estados: ['despachado', 'activo', 'pendiente'] })
       .andWhere('deleted_at IS NULL')
       .andWhere('fecha_devolucion IS NOT NULL')
       .andWhere('fecha_devolucion < NOW()')
       .execute();
  }
}
