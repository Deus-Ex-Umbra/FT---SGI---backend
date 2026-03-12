import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Index, DeleteDateColumn } from 'typeorm';
import { EstudianteEntidad } from './estudiante.entidad';
import { DocenteEntidad } from './docente.entidad';
import { ItemActivo } from '../activo/item_activo.entidad';

@Entity('prestamos')
@Index('idx_prestamos_estado_fecha_devolucion', ['estado', 'fechaDevolucion'])
@Index('idx_prestamos_codigo_herramienta', ['codigoHerramienta'])
@Index('uq_prestamos_item_no_devuelto', ['codigoHerramienta'], { unique: true, where: `"estado" NOT IN ('devuelto', 'devuelto_fuera_de_fecha_limite') AND "deleted_at" IS NULL` })
export class PrestamoEntidad {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => EstudianteEntidad, (estudiante: EstudianteEntidad) => estudiante.prestamos, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_estudiante' })
  estudiante!: EstudianteEntidad;

  @ManyToOne(() => DocenteEntidad, (docente: DocenteEntidad) => docente.prestamos, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_docente' })
  docente!: DocenteEntidad;

  @ManyToOne(() => ItemActivo, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_item_activo' })
  itemActivo?: ItemActivo | null;

  @Column({ name: 'codigo_herramienta', length: 50 })
  codigoHerramienta!: string;

  @Column({ name: 'grupo_canasta', type: 'varchar', length: 80, nullable: true })
  grupoCanasta?: string | null;

  @Column({ name: 'fecha_prestamo', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fechaPrestamo!: Date;

  @Column({ name: 'fecha_devolucion', type: 'timestamp', nullable: true })
  fechaDevolucion?: Date | null;

  @Column({ length: 20, default: 'pendiente' })
  estado!: string;

  @Column({ type: 'text', nullable: true })
  observaciones?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date | null;
}
