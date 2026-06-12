import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Usuario } from '@/modulos/usuario/entidades/usuario.entidad';
import { GrupoMateriaDocenteEntidad } from './grupo-materia-docente.entidad';

export const ESTADOS_SOLICITUD_DOCENTE = [
  'vacio',
  'en_revision',
  'aprobado_docente',
  'rechazado_docente',
  'aprobado_almacen',
  'rechazado_almacen',
] as const;

export type EstadoSolicitudDocente = (typeof ESTADOS_SOLICITUD_DOCENTE)[number];

@Entity('docencia_solicitudes_material')
export class SolicitudMaterialDocenteEntidad {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Usuario, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'docente_usuario_id' })
  docenteUsuario!: Usuario;

  @ManyToOne(() => GrupoMateriaDocenteEntidad, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'grupo_id' })
  grupo?: GrupoMateriaDocenteEntidad | null;

  @Column({ name: 'responsable_estudiante_id', type: 'int', nullable: true })
  responsableEstudianteId?: number | null;

  @Column({ name: 'detalle', type: 'text', nullable: true })
  detalle?: string | null;

  @Column({ type: 'enum', enum: ESTADOS_SOLICITUD_DOCENTE, default: 'vacio' })
  estado!: EstadoSolicitudDocente;

  @Column({ name: 'aprobado_docente_at', type: 'timestamp', nullable: true })
  aprobadoDocenteAt?: Date | null;

  @Column({ name: 'aprobado_almacen_at', type: 'timestamp', nullable: true })
  aprobadoAlmacenAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;
}
