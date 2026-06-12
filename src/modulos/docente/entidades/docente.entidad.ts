import { Entity, PrimaryGeneratedColumn, Column, JoinColumn, OneToOne, ManyToMany, JoinTable } from 'typeorm';
import { Usuario } from '@/modulos/usuario/entidades/usuario.entidad';
import { CarreraEntidad } from '@/modulos/prestamo/entidades/carrera.entidad';

@Entity('docentes')
export class DocenteEntidad {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'ci', type: 'varchar', length: 30, unique: true, nullable: true })
  ci!: string | null;

  @Column({ name: 'codigo', type: 'varchar', length: 30, unique: true, nullable: true })
  codigo!: string | null;

  @Column({ name: 'nombre', type: 'varchar', length: 120, nullable: true })
  nombre!: string | null;

  @Column({ name: 'apellido', type: 'varchar', length: 120, nullable: true })
  apellido!: string | null;

  @Column({ name: 'materia', type: 'varchar', length: 80, nullable: true })
  materia?: string | null;

  @Column({ name: 'materias_asignadas', type: 'simple-array', nullable: true })
  materiasAsignadas?: string[] | null;

  @Column({ name: 'fecha_nacimiento', type: 'date', nullable: true })
  fechaNacimiento?: string | null;

  @OneToOne(() => Usuario, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_usuario' })
  usuario?: Usuario | null;

  @ManyToMany(() => CarreraEntidad, (carrera) => carrera.docentes)
  @JoinTable({
    name: 'docentes_carreras',
    joinColumn: { name: 'id_docente', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'id_carrera', referencedColumnName: 'id' },
  })
  carreras?: CarreraEntidad[];
}
