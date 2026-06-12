import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Usuario } from '@/modulos/usuario/entidades/usuario.entidad';

export const TIPOS_ENLACE_FIRMADO = ['registro_estudiante', 'inscripcion_materia'] as const;
export type TipoEnlaceFirmado = (typeof TIPOS_ENLACE_FIRMADO)[number];

export const PERMISOS_ENLACE_FIRMADO = ['registro_estudiante_publico', 'inscripcion_materia_docente'] as const;
export type PermisoEnlaceFirmado = (typeof PERMISOS_ENLACE_FIRMADO)[number];

@Entity('enlaces_firmados')
export class EnlaceFirmadoEntidad {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: TIPOS_ENLACE_FIRMADO })
  tipo!: TipoEnlaceFirmado;

  @Column({ type: 'enum', enum: PERMISOS_ENLACE_FIRMADO })
  permiso!: PermisoEnlaceFirmado;

  @Column({ name: 'recurso_id', type: 'varchar', length: 120, nullable: true })
  recursoId?: string | null;

  @Column({ type: 'varchar', length: 120 })
  nonce!: string;

  @Column({ name: 'expira_en', type: 'timestamp' })
  expiraEn!: Date;

  @Column({ type: 'boolean', default: true })
  habilitado!: boolean;

  @Column({ name: 'usos_count', type: 'int', default: 0 })
  usosCount!: number;

  @Column({ name: 'ultimo_uso_at', type: 'timestamp', nullable: true })
  ultimoUsoAt?: Date | null;

  @ManyToOne(() => Usuario, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'creado_por_usuario_id' })
  creadoPorUsuario?: Usuario | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;
}
