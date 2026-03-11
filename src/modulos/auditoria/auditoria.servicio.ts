import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';
import { AuditoriaEventoEntidad } from './auditoria.entidad';

interface RegistrarEventoInput {
  entidad: string;
  entidadId: string | number;
  accion: 'crear' | 'actualizar' | 'eliminar';
  detalle: Record<string, unknown>;
}

@Injectable()
export class AuditoriaServicio implements OnModuleInit {
  private readonly logger = new Logger(AuditoriaServicio.name);

  constructor(
    @InjectRepository(AuditoriaEventoEntidad)
    private readonly auditoriaRepo: Repository<AuditoriaEventoEntidad>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.auditoriaRepo.query(`
      CREATE TABLE IF NOT EXISTS auditoria_eventos (
        id SERIAL PRIMARY KEY,
        entidad VARCHAR(80) NOT NULL,
        entidad_id VARCHAR(80) NOT NULL,
        accion VARCHAR(20) NOT NULL,
        detalle JSONB NOT NULL,
        hash_previo VARCHAR(64) NULL,
        hash_actual VARCHAR(64) NOT NULL,
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await this.auditoriaRepo.query(`
      CREATE INDEX IF NOT EXISTS idx_auditoria_entidad_entidad_id ON auditoria_eventos (entidad, entidad_id);
      CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria_eventos (fecha);
    `);

    await this.auditoriaRepo.query(`
      CREATE OR REPLACE FUNCTION bloquear_update_delete_auditoria_eventos()
      RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'La tabla auditoria_eventos es inmutable: solo se permiten inserts';
      END;
      $$ LANGUAGE plpgsql;
    `);

    await this.auditoriaRepo.query(`
      DROP TRIGGER IF EXISTS trg_bloquear_update_auditoria_eventos ON auditoria_eventos;
      CREATE TRIGGER trg_bloquear_update_auditoria_eventos
      BEFORE UPDATE ON auditoria_eventos
      FOR EACH ROW
      EXECUTE FUNCTION bloquear_update_delete_auditoria_eventos();
    `);

    await this.auditoriaRepo.query(`
      DROP TRIGGER IF EXISTS trg_bloquear_delete_auditoria_eventos ON auditoria_eventos;
      CREATE TRIGGER trg_bloquear_delete_auditoria_eventos
      BEFORE DELETE ON auditoria_eventos
      FOR EACH ROW
      EXECUTE FUNCTION bloquear_update_delete_auditoria_eventos();
    `);
  }

  private calcularHash(payload: string): string {
    return createHash('sha256').update(payload).digest('hex');
  }

  async registrarEvento(input: RegistrarEventoInput): Promise<void> {
    const ultimo = await this.auditoriaRepo
      .createQueryBuilder('a')
      .orderBy('a.id', 'DESC')
      .getOne();
    const hashPrevio = ultimo?.hashActual ?? null;

    const cuerpo = JSON.stringify({
      hashPrevio,
      entidad: input.entidad,
      entidadId: String(input.entidadId),
      accion: input.accion,
      detalle: input.detalle,
      fechaIso: new Date().toISOString(),
    });

    const hashActual = this.calcularHash(cuerpo);

    const evento = this.auditoriaRepo.create({
      entidad: input.entidad,
      entidadId: String(input.entidadId),
      accion: input.accion,
      detalle: input.detalle,
      hashPrevio,
      hashActual,
    });

    await this.auditoriaRepo.save(evento);
  }

  async registrarEventoSilencioso(input: RegistrarEventoInput): Promise<void> {
    try {
      await this.registrarEvento(input);
    } catch (error) {
      this.logger.warn(`No se pudo registrar auditoria para ${input.entidad}:${input.entidadId} -> ${(error as Error).message}`);
    }
  }
}
