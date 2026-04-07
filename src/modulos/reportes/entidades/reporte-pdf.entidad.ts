import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Usuario } from '@/modulos/usuario/entidades/usuario.entidad';
import { ReporteEntidad } from './reporte.entidad';

@Entity('reporte_pdf')
export class ReportePdfEntidad {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  @Index()
  usuario!: Usuario;

  @ManyToOne(() => ReporteEntidad, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reporte_id' })
  @Index()
  reporte!: ReporteEntidad;

  @Column({ type: 'varchar', length: 200 })
  filename!: string;

  @Column({ type: 'varchar', length: 100, default: 'application/pdf' })
  mime!: string;

  @Column({ type: 'int' })
  sizeBytes!: number;

  @Column({ type: 'varchar', length: 64 })
  sha256!: string;

  @Column({ type: 'bytea' })
  contenido!: Buffer;

  @CreateDateColumn()
  creadoEn!: Date;
}
