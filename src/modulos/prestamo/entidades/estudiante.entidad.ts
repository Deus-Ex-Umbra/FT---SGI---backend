import { Entity, PrimaryGeneratedColumn, Column, OneToMany, Index, DeleteDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { PrestamoEntidad } from './prestamo.entidad';
import { CarreraEntidad } from './carrera.entidad';

@Entity('estudiantes')
@Index('idx_estudiantes_carnet_retenido', ['carnetRetenido'])
export class EstudianteEntidad {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 30, unique: true })
  carnet!: string;

  @Column({ length: 80 })
  nombre!: string;

  @Column({ length: 80 })
  apellido!: string;

  @Column({ length: 120 })
  carrera!: string;

  @ManyToOne(() => CarreraEntidad, (carrera: CarreraEntidad) => carrera.estudiantes, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_carrera' })
  carreraRef?: CarreraEntidad | null;

  @Column({ type: 'int' })
  semestre!: number;

  @Column({ name: 'carnet_retenido', type: 'boolean', default: false })
  carnetRetenido!: boolean;

  // null => automático (según préstamos activos)
  // true/false => override manual persistente
  @Column({ name: 'carnet_retenido_override', type: 'boolean', nullable: true, default: null })
  carnetRetenidoOverride?: boolean | null;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date | null;

  @OneToMany(() => PrestamoEntidad, (prestamo: PrestamoEntidad) => prestamo.estudiante)
  prestamos!: PrestamoEntidad[];
}
