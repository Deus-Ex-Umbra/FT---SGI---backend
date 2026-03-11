import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { LoteMaterial } from './lote_material.entidad';

@Entity('movimientos_materiales')
export class MovimientoMaterial {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => LoteMaterial, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_lote' })
  lote!: LoteMaterial;

  @Column({ length: 20 })
  tipo!: 'entrada' | 'salida';

  @Column({ type: 'int' })
  cantidad!: number;

  @Column({ type: 'text' })
  motivo!: string;

  @Column({ name: 'referencia', type: 'varchar', length: 120, nullable: true })
  referencia?: string | null;

  @CreateDateColumn({ type: 'timestamp', name: 'fecha' })
  fecha!: Date;
}
