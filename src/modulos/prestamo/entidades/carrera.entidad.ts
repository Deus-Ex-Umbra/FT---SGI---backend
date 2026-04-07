import { Entity, PrimaryGeneratedColumn, Column, DeleteDateColumn, OneToMany } from 'typeorm';
import { EstudianteEntidad } from './estudiante.entidad';

@Entity('carreras')
export class CarreraEntidad {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 120, unique: true })
  nombre!: string;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date | null;

  @OneToMany(() => EstudianteEntidad, (estudiante: EstudianteEntidad) => estudiante.carreraRef)
  estudiantes!: EstudianteEntidad[];
}
