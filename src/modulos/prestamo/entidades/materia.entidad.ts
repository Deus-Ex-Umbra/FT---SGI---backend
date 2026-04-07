import { Entity, PrimaryGeneratedColumn, Column, DeleteDateColumn, ManyToMany } from 'typeorm';
import { DocenteEntidad } from './docente.entidad';

@Entity('materias')
export class MateriaEntidad {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 30, unique: true })
  codigo!: string;

  // Importante: con `string | null`, TypeScript emite `design:type = Object`.
  // TypeORM no soporta inferir "Object" en Postgres, así que fijamos el tipo.
  @Column({ type: 'varchar', length: 120, nullable: true })
  nombre!: string | null;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date | null;

  @ManyToMany(() => DocenteEntidad, (docente: DocenteEntidad) => docente.materias)
  docentes!: DocenteEntidad[];
}
