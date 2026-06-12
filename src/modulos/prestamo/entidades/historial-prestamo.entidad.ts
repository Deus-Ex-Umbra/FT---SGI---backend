import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { PrestamoEntidad } from './prestamo.entidad';
import { Usuario } from '@/modulos/usuario/entidades/usuario.entidad';

@Entity('prestamos_historial')
export class HistorialPrestamoEntidad {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => PrestamoEntidad, (prestamo) => prestamo.historial, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_prestamo' })
  prestamo!: PrestamoEntidad;

  @ManyToOne(() => Usuario, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_usuario' })
  usuario?: Usuario | null;

  @Column({ name: 'nombre_usuario', type: 'varchar', length: 250, nullable: true })
  nombreUsuario?: string | null;

  @Column({ name: 'rol_usuario', type: 'varchar', length: 50, nullable: true })
  rolUsuario?: string | null;

  @Column({ name: 'correo_usuario', type: 'varchar', length: 150, nullable: true })
  correoUsuario?: string | null;

  @Column({ length: 40 })
  estado!: string;

  @Column({ length: 80 })
  accion!: string;

  @Column({ type: 'jsonb', nullable: true })
  detalles?: {
    antes?: Record<string, any>;
    despues?: Record<string, any>;
  } | null;

  @Column({ type: 'text', nullable: true })
  observaciones?: string | null;

  @CreateDateColumn({ name: 'fecha', type: 'timestamp' })
  fecha!: Date;
}
