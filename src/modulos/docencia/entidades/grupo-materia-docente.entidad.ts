import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Usuario } from '@/modulos/usuario/entidades/usuario.entidad';

export const ESTADOS_APROBACION_GRUPO_DOCENCIA = ['pendiente', 'aprobado', 'rechazado'] as const;
export type EstadoAprobacionGrupoDocencia = (typeof ESTADOS_APROBACION_GRUPO_DOCENCIA)[number];

@Entity('docencia_grupos_materia')
export class GrupoMateriaDocenteEntidad {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Usuario, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'docente_usuario_id' })
  docenteUsuario!: Usuario;

  @Column({ name: 'materia_id', type: 'int', nullable: true })
  materiaId?: number | null;

  @Column({ name: 'codigo_materia', type: 'varchar', length: 40, nullable: true })
  codigoMateria?: string | null;

  @Column({ name: 'sigla', type: 'varchar', length: 40, nullable: true })
  sigla?: string | null;

  @Column({ name: 'nombre_materia', type: 'varchar', length: 200, nullable: true })
  nombreMateria?: string | null;

  @Column({ name: 'nombre', type: 'varchar', length: 200, nullable: true })
  nombre?: string | null;

  @Column({ name: 'descripcion', type: 'text', nullable: true })
  descripcion?: string | null;

  @Column({ name: 'materia', type: 'varchar', length: 200 })
  materia!: string;

  @Column({ name: 'codigo_inscripcion', type: 'varchar', length: 50, nullable: true })
  codigoInscripcion?: string | null;

  @Column({ name: 'fecha_inicio_inscripcion', type: 'timestamp', nullable: true })

  fechaInicioInscripcion?: Date | null;

  @Column({ name: 'fecha_fin_inscripcion', type: 'timestamp', nullable: true })
  fechaFinInscripcion?: Date | null;

  @Column({ name: 'duracion_materia_semanas', type: 'int' })
  duracionMateriaSemanas!: number;

  @Column({ name: 'nombre_grupo', type: 'varchar', length: 200, nullable: true })
  nombreGrupo?: string | null;

  @Column({ name: 'grupo', type: 'varchar', length: 60, nullable: true })
  grupo?: string | null;

  @Column({
    name: 'estado_aprobacion',
    type: 'enum',
    enum: ESTADOS_APROBACION_GRUPO_DOCENCIA,
    default: 'aprobado',
  })
  estadoAprobacion!: EstadoAprobacionGrupoDocencia;

  @Column({ name: 'solicitado_at', type: 'timestamp', nullable: true })
  solicitadoAt?: Date | null;

  @ManyToOne(() => Usuario, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'aprobado_por_usuario_id' })
  aprobadoPorUsuario?: Usuario | null;

  @Column({ name: 'aprobado_at', type: 'timestamp', nullable: true })
  aprobadoAt?: Date | null;

  @Column({ name: 'motivo_rechazo', type: 'text', nullable: true })
  motivoRechazo?: string | null;

  @Column({ name: 'rechazos', type: 'int', default: 0 })
  rechazos!: number;

  @Column({ name: 'max_estudiantes_grupo', type: 'int', default: 3 })
  maxEstudiantesGrupo!: number;

  @Column({ name: 'estudiante_ids', type: 'jsonb' })
  estudianteIds!: number[];

  @Column({ name: 'carreras_por_estudiante', type: 'jsonb', nullable: true })
  carrerasPorEstudiante?: Record<number, string[]> | null;

  @Column({ name: 'activo', type: 'boolean', default: true })
  activo!: boolean;

  @Column({ name: 'permitir_inscripcion', type: 'boolean', default: true })
  permitirInscripcion!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;
}
