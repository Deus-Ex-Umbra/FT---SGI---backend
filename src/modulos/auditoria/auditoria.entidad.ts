import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('auditoria_eventos')
@Index('idx_auditoria_entidad_entidad_id', ['entidad', 'entidadId'])
@Index('idx_auditoria_fecha', ['fecha'])
export class AuditoriaEventoEntidad {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 80 })
  entidad!: string;

  @Column({ name: 'entidad_id', length: 80 })
  entidadId!: string;

  @Column({ length: 20 })
  accion!: 'crear' | 'actualizar' | 'eliminar';

  @Column({ type: 'jsonb' })
  detalle!: Record<string, unknown>;

  @Column({ name: 'hash_previo', type: 'varchar', length: 64, nullable: true })
  hashPrevio?: string | null;

  @Column({ name: 'hash_actual', type: 'varchar', length: 64 })
  hashActual!: string;

  @CreateDateColumn({ type: 'timestamp', name: 'fecha' })
  fecha!: Date;
}
