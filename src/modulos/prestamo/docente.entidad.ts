import { Entity, PrimaryGeneratedColumn, Column, OneToMany, DeleteDateColumn } from 'typeorm';
import { PrestamoEntidad } from './prestamo.entidad';

@Entity('docentes')
export class DocenteEntidad {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 30, unique: true })
  codigo!: string;

  @Column({ length: 80 })
  nombre!: string;

  @Column({ length: 80 })
  apellido!: string;

  @Column({ length: 80 })
  materia!: string;

  @Column({ length: 30, unique: true })
  carnet!: string;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date | null;

  @OneToMany(() => PrestamoEntidad, (prestamo: PrestamoEntidad) => prestamo.docente)
  prestamos!: PrestamoEntidad[];
}
