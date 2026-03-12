import { Entity, PrimaryGeneratedColumn, Column, OneToMany, Index, DeleteDateColumn } from 'typeorm';
import { PrestamoEntidad } from './prestamo.entidad';

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

  @Column({ type: 'int' })
  semestre!: number;

  @Column({ name: 'carnet_retenido', type: 'boolean', default: false })
  carnetRetenido!: boolean;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date | null;

  @OneToMany(() => PrestamoEntidad, (prestamo: PrestamoEntidad) => prestamo.estudiante)
  prestamos!: PrestamoEntidad[];
}
