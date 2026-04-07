import { Entity, PrimaryGeneratedColumn, Column, OneToMany, DeleteDateColumn, ManyToMany, JoinTable } from 'typeorm';
import { PrestamoEntidad } from './prestamo.entidad';
import { MateriaEntidad } from './materia.entidad';

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

  @ManyToMany(() => MateriaEntidad, (materia: MateriaEntidad) => materia.docentes)
  @JoinTable({
    name: 'docentes_materias',
    joinColumn: { name: 'id_docente', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'id_materia', referencedColumnName: 'id' },
  })
  materias!: MateriaEntidad[];
}
