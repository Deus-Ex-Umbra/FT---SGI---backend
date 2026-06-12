import { Entity, PrimaryGeneratedColumn, Column, OneToMany, Index, DeleteDateColumn, ManyToOne, JoinColumn, OneToOne } from 'typeorm';
import { PrestamoEntidad } from '@/modulos/prestamo/entidades/prestamo.entidad';
import { CarreraEntidad } from '@/modulos/prestamo/entidades/carrera.entidad';
import { Usuario } from '@/modulos/usuario/entidades/usuario.entidad';
import { CuEntidad } from './cu.entidad';

@Entity('estudiantes')
@Index('idx_estudiantes_carnet_retenido', ['carnetRetenido'])
export class EstudianteEntidad {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 30, unique: true })
  carnet!: string;

  @Column({ name: 'cu', type: 'varchar', length: 30, unique: true, nullable: true })
  cu?: string | null;

  @Column({ name: 'fecha_nacimiento', type: 'date', nullable: true })
  fechaNacimiento?: Date;

  @Column({ length: 80 })
  nombre!: string;

  @Column({ length: 80 })
  apellido!: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  carrera?: string | null;

  @ManyToOne(() => CarreraEntidad, (carrera: CarreraEntidad) => carrera.estudiantes, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_carrera' })
  carreraRef?: CarreraEntidad | null;

  @Column({ name: 'carnet_retenido', type: 'boolean', default: false })
  carnetRetenido!: boolean;
  
  @Column({ name: 'carnet_retenido_override', type: 'boolean', nullable: true, default: null })
  carnetRetenidoOverride?: boolean | null;

  @Column({ name: 'estado_aprobacion', type: 'varchar', length: 20, default: 'aprobado' })
  estadoAprobacion!: 'pendiente' | 'aprobado' | 'rechazado';

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date | null;

  @OneToOne(() => Usuario, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_usuario' })
  usuario?: Usuario | null;

  @OneToMany(() => CuEntidad, (cu: CuEntidad) => cu.estudiante, { cascade: true })
  cus!: CuEntidad[];

  get asignacionesCarrera(): { id: number; cu: string; estudiante: EstudianteEntidad; carrera: CarreraEntidad }[] {
    const asignaciones: { id: number; cu: string; estudiante: EstudianteEntidad; carrera: CarreraEntidad }[] = [];
    if (this.cus) {
      for (const cu of this.cus) {
        if (cu.carreras) {
          for (const carrera of cu.carreras) {
            asignaciones.push({
              id: cu.id,
              cu: cu.codigo,
              estudiante: this,
              carrera: carrera,
            });
          }
        }
      }
    }
    return asignaciones;
  }

  @OneToMany(() => PrestamoEntidad, (prestamo: PrestamoEntidad) => prestamo.estudiante)
  prestamos!: PrestamoEntidad[];
}

