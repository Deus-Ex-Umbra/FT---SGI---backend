import { Entity, PrimaryGeneratedColumn, Column, DeleteDateColumn, OneToMany, ManyToMany, JoinTable } from 'typeorm';
import { EstudianteEntidad } from '@/modulos/estudiante/entidades/estudiante.entidad';
import { CuEntidad } from '@/modulos/estudiante/entidades/cu.entidad';
import { DocenteEntidad } from '@/modulos/docente/entidades/docente.entidad';
import { InventarioEntidad } from '@/modulos/inventario/entidades/inventario.entidad';

@Entity('carreras')
export class CarreraEntidad {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 120, unique: true })
  nombre!: string;

  @Column({ name: 'prefijo_cu', type: 'varchar', length: 20, unique: true, nullable: true })
  prefijoCu?: string | null;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date | null;

  @OneToMany(() => EstudianteEntidad, (estudiante: EstudianteEntidad) => estudiante.carreraRef)
  estudiantes!: EstudianteEntidad[];

  @ManyToMany(() => CuEntidad, (cu) => cu.carreras)
  cus?: CuEntidad[];

  @ManyToMany(() => DocenteEntidad, (docente) => docente.carreras)
  docentes!: DocenteEntidad[];

  @ManyToMany(() => InventarioEntidad, (inventario) => inventario.carreras, { cascade: true })
  @JoinTable({
    name: 'carreras_inventarios',
    joinColumn: { name: 'id_carrera', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'id_inventario', referencedColumnName: 'id' },
  })
  inventarios?: InventarioEntidad[];
}

