import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Usuario } from '@/modulos/usuario/entidades/usuario.entidad';

@Entity('reporte')
export class ReporteEntidad {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  @Index()
  usuario!: Usuario;

  @Column({ type: 'text' })
  titulo!: string;

  @Column({ type: 'text' })
  html!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    tipo?: 'blanco' | 'precreado' | string;
    areas?: string[];
    usarIA?: boolean;
  } | null;

  @Column({ type: 'date' })
  fechaInicio!: string;

  @Column({ type: 'date' })
  fechaFin!: string;

  @CreateDateColumn()
  creadoEn!: Date;
}
