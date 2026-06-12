import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { MoreThan, Repository } from 'typeorm';
import {
  EnlaceFirmadoEntidad,
  type PermisoEnlaceFirmado,
  type TipoEnlaceFirmado,
} from './entidades/enlace-firmado.entidad';

export interface EnlaceFirmadoRespuesta {
  eid: string;
  exp: number;
  nonce: string;
  sig: string;
}

interface CrearInvitacionEntrada {
  tipo: TipoEnlaceFirmado;
  permiso: PermisoEnlaceFirmado;
  creadoPorUsuarioId?: number;
  recursoId?: string | null;
  ttlMs: number;
}

interface ValidarInvitacionEntrada {
  eid: string;
  exp: string;
  nonce: string;
  sig: string;
  tipo: TipoEnlaceFirmado;
  permiso: PermisoEnlaceFirmado;
  recursoId?: string | null;
}

interface OpcionesValidacionInvitacion {
  registrarUso?: boolean;
}

interface ResultadoValidacionInvitacion {
  ok: boolean;
  message?: string;
  enlace?: EnlaceFirmadoEntidad;
}

@Injectable()
export class EnlaceFirmadoServicio {
  constructor(
    @InjectRepository(EnlaceFirmadoEntidad)
    private readonly repoEnlaces: Repository<EnlaceFirmadoEntidad>,
    private readonly config: ConfigService,
  ) {}

  private obtenerSecretoFirma() {
    return this.config.get<string>('ENLACES_FIRMADOS_SECRETO')
      ?? this.config.get<string>('REGISTRO_ESTUDIANTE_SECRETO')
      ?? this.config.get<string>('DOCENCIA_PDF_SECRETO')
      ?? 'enlaces_firmados_secreto_default';
  }

  private obtenerTtlMsRegistroEstudiante() {
    const horas = Number(this.config.get<string>('REGISTRO_ESTUDIANTE_TTL_HORAS') ?? 72);
    const horasValidas = Number.isFinite(horas) && horas > 0 ? horas : 72;
    return Math.round(horasValidas * 60 * 60 * 1000);
  }

  private obtenerTtlMsInscripcionMateria() {
    const dias = Number(this.config.get<string>('INSCRIPCION_MATERIA_TTL_DIAS') ?? 1);
    const diasValidos = Number.isFinite(dias) && dias > 0 ? dias : 1;
    return Math.round(diasValidos * 24 * 60 * 60 * 1000);
  }

  private firmar(payload: string) {
    return createHmac('sha256', this.obtenerSecretoFirma()).update(payload).digest('hex');
  }

  private verificarFirma(payload: string, firma: string) {
    const esperada = this.firmar(payload);
    const a = Buffer.from(esperada);
    const b = Buffer.from(String(firma ?? ''));
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  private construirPayload(args: {
    eid: string;
    tipo: TipoEnlaceFirmado;
    permiso: PermisoEnlaceFirmado;
    recursoId?: string | null;
    exp: number;
    nonce: string;
  }) {
    return [
      args.eid,
      args.tipo,
      args.permiso,
      String(args.recursoId ?? ''),
      String(args.exp),
      args.nonce,
    ].join('.');
  }

  private serializar(enlace: EnlaceFirmadoEntidad): EnlaceFirmadoRespuesta {
    const exp = new Date(enlace.expiraEn).getTime();
    const payload = this.construirPayload({
      eid: enlace.id,
      tipo: enlace.tipo,
      permiso: enlace.permiso,
      recursoId: enlace.recursoId,
      exp,
      nonce: enlace.nonce,
    });

    return {
      eid: enlace.id,
      exp,
      nonce: enlace.nonce,
      sig: this.firmar(payload),
    };
  }

  private async deshabilitarEnlacesActivos(filtro: {
    tipo: TipoEnlaceFirmado;
    permiso: PermisoEnlaceFirmado;
    recursoId?: string | null;
  }) {
    const query = this.repoEnlaces
      .createQueryBuilder()
      .update(EnlaceFirmadoEntidad)
      .set({ habilitado: false })
      .where('tipo = :tipo', { tipo: filtro.tipo })
      .andWhere('permiso = :permiso', { permiso: filtro.permiso })
      .andWhere('habilitado = :habilitado', { habilitado: true })
      .andWhere('expira_en > :ahora', { ahora: new Date() });

    if (filtro.recursoId == null) {
      query.andWhere('(recurso_id IS NULL OR recurso_id = \'\')');
    } else {
      query.andWhere('recurso_id = :recursoId', { recursoId: filtro.recursoId });
    }

    const resultado = await query.execute();
    return Number(resultado.affected ?? 0);
  }

  private async crearInvitacion(entrada: CrearInvitacionEntrada) {
    const recursoIdNormalizado = entrada.recursoId == null || String(entrada.recursoId).trim() === ''
      ? null
      : String(entrada.recursoId);
    const nonce = `${Date.now()}_${randomBytes(8).toString('hex')}`;
    const enlace = this.repoEnlaces.create({
      tipo: entrada.tipo,
      permiso: entrada.permiso,
      recursoId: recursoIdNormalizado,
      nonce,
      expiraEn: new Date(Date.now() + entrada.ttlMs),
      habilitado: true,
      creadoPorUsuario: entrada.creadoPorUsuarioId ? ({ id: entrada.creadoPorUsuarioId } as any) : null,
      usosCount: 0,
    });

    const guardado = await this.repoEnlaces.save(enlace);
    return this.serializar(guardado);
  }

  async obtenerInvitacionRegistroActiva() {
    const enlace = await this.repoEnlaces.findOne({
      where: {
        tipo: 'registro_estudiante',
        permiso: 'registro_estudiante_publico',
        habilitado: true,
        expiraEn: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });

    return enlace ? this.serializar(enlace) : null;
  }

  async habilitarInvitacionRegistro(creadoPorUsuarioId?: number) {
    await this.deshabilitarEnlacesActivos({
      tipo: 'registro_estudiante',
      permiso: 'registro_estudiante_publico',
      recursoId: null,
    });

    return await this.crearInvitacion({
      tipo: 'registro_estudiante',
      permiso: 'registro_estudiante_publico',
      creadoPorUsuarioId,
      ttlMs: this.obtenerTtlMsRegistroEstudiante(),
      recursoId: null,
    });
  }

  async deshabilitarInvitacionRegistro() {
    const afectados = await this.deshabilitarEnlacesActivos({
      tipo: 'registro_estudiante',
      permiso: 'registro_estudiante_publico',
      recursoId: null,
    });

    return { ok: true, deshabilitados: afectados };
  }

  async obtenerInvitacionInscripcionMateriaActiva(materiaId: string) {
    const enlace = await this.repoEnlaces.findOne({
      where: {
        tipo: 'inscripcion_materia',
        permiso: 'inscripcion_materia_docente',
        recursoId: materiaId,
        habilitado: true,
        expiraEn: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });

    return enlace ? this.serializar(enlace) : null;
  }

  async habilitarInvitacionInscripcionMateria(materiaId: string, creadoPorUsuarioId?: number) {
    await this.deshabilitarEnlacesActivos({
      tipo: 'inscripcion_materia',
      permiso: 'inscripcion_materia_docente',
      recursoId: materiaId,
    });

    return await this.crearInvitacion({
      tipo: 'inscripcion_materia',
      permiso: 'inscripcion_materia_docente',
      recursoId: materiaId,
      creadoPorUsuarioId,
      ttlMs: this.obtenerTtlMsInscripcionMateria(),
    });
  }

  async deshabilitarInvitacionInscripcionMateria(materiaId: string) {
    const afectados = await this.deshabilitarEnlacesActivos({
      tipo: 'inscripcion_materia',
      permiso: 'inscripcion_materia_docente',
      recursoId: materiaId,
    });

    return { ok: true, deshabilitados: afectados };
  }

  async validarInvitacionFirmada(
    entrada: ValidarInvitacionEntrada,
    opciones: OpcionesValidacionInvitacion = {},
  ): Promise<ResultadoValidacionInvitacion> {
    const registrarUso = opciones.registrarUso ?? true;
    const expNum = Number(entrada.exp);
    if (!expNum || !Number.isFinite(expNum)) {
      return { ok: false, message: 'El enlace tiene una expiración inválida.' };
    }

    const enlace = await this.repoEnlaces.findOne({
      where: {
        id: entrada.eid,
        tipo: entrada.tipo,
        permiso: entrada.permiso,
      },
    });

    if (!enlace) {
      return { ok: false, message: 'La invitación no existe.' };
    }

    if (!enlace.habilitado) {
      return { ok: false, message: 'La invitación está deshabilitada.' };
    }

    const recursoEnlace = String(enlace.recursoId ?? '').trim();
    const recursoEsperado = entrada.recursoId == null ? null : String(entrada.recursoId ?? '').trim();
    if (recursoEsperado == null) {
      if (recursoEnlace !== '') {
        return { ok: false, message: 'La invitación no pertenece al recurso solicitado.' };
      }
    } else if (recursoEnlace !== recursoEsperado) {
      return { ok: false, message: 'La invitación no pertenece al recurso solicitado.' };
    }

    const expGuardado = new Date(enlace.expiraEn).getTime();
    if (expGuardado !== expNum) {
      return { ok: false, message: 'La invitación no coincide con la expiración recibida.' };
    }

    if (String(enlace.nonce ?? '') !== String(entrada.nonce ?? '')) {
      return { ok: false, message: 'La invitación no coincide con el nonce recibido.' };
    }

    if (expNum < Date.now()) {
      await this.repoEnlaces.update({ id: enlace.id }, { habilitado: false });
      return { ok: false, message: 'La invitación expiró.' };
    }

    const payload = this.construirPayload({
      eid: enlace.id,
      tipo: enlace.tipo,
      permiso: enlace.permiso,
      recursoId: enlace.recursoId,
      exp: expNum,
      nonce: enlace.nonce,
    });

    if (!this.verificarFirma(payload, entrada.sig)) {
      return { ok: false, message: 'Firma inválida.' };
    }

    if (registrarUso) {
      await this.repoEnlaces.increment({ id: enlace.id }, 'usosCount', 1);
      await this.repoEnlaces.update({ id: enlace.id }, { ultimoUsoAt: new Date() });
    }

    return { ok: true, enlace };
  }
}
