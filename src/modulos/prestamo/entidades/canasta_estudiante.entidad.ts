import { CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Column } from 'typeorm';
import { EstudianteEntidad } from '@/modulos/estudiante/entidades/estudiante.entidad';

@Entity('canasta_estudiantes')
@Index('idx_canasta_estudiantes_grupo', ['grupoCanasta'])
@Index('uq_canasta_estudiantes_grupo_estudiante', ['grupoCanasta', 'estudiante'], { unique: true })
export class CanastaEstudianteEntidad {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'grupo_canasta', type: 'varchar', length: 80 })
  grupoCanasta!: string;

  @ManyToOne(() => EstudianteEntidad, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_estudiante' })
  estudiante!: EstudianteEntidad;

  @Column({ name: 'carnet_retenido', type: 'boolean', default: false })
  carnetRetenido!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;
}