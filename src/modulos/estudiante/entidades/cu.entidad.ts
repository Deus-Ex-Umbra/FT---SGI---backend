import { Column, Entity, JoinColumn, JoinTable, ManyToMany, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { CarreraEntidad } from '@/modulos/prestamo/entidades/carrera.entidad';
import { EstudianteEntidad } from './estudiante.entidad';

@Entity('cus')
export class CuEntidad {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 30, unique: true })
  codigo!: string;

  @ManyToOne(() => EstudianteEntidad, (estudiante) => estudiante.cus, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'id_estudiante' })
  estudiante!: EstudianteEntidad;

  @ManyToMany(() => CarreraEntidad, (carrera) => carrera.cus)
  @JoinTable({
    name: 'cus_carreras',
    joinColumn: { name: 'id_cu', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'id_carrera', referencedColumnName: 'id' },
  })
  carreras!: CarreraEntidad[];


}
