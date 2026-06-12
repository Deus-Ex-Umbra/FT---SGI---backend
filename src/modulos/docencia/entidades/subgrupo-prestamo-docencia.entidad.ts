import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { GrupoMateriaDocenteEntidad } from './grupo-materia-docente.entidad';

@Entity('docencia_subgrupos_prestamo')
export class SubgrupoPrestamoDocenciaEntidad {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => GrupoMateriaDocenteEntidad, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'grupo_materia_id' })
  grupoMateria!: GrupoMateriaDocenteEntidad;

  @Column({ name: 'codigo', type: 'varchar', length: 30 })
  codigo!: string;

  @Column({ name: 'nombre', type: 'varchar', length: 140, nullable: true })
  nombre?: string | null;

  @Column({ name: 'descripcion', type: 'text', nullable: true })
  descripcion?: string | null;

  @Column({ name: 'estudiante_ids', type: 'jsonb', nullable: true })
  estudianteIds?: number[] | null;

  @Column({ name: 'responsable_estudiante_id', type: 'int', nullable: true })
  responsableEstudianteId?: number | null;

  @Column({ name: 'habilitado', type: 'boolean', default: true })
  habilitado!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;
}
