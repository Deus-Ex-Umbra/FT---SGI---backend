import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ItemActivoFijo } from '@/modulos/activo/entidades/item-activo-fijo.entidad';
import { ContenedorActivo } from '@/modulos/contenedor/entidades/contenedor-activo.entidad';

@Entity('canasta_prestamo_items')
@Index('idx_canasta_prestamo_items_grupo', ['grupoCanasta'])
@Index('uq_canasta_prestamo_items_grupo_item', ['grupoCanasta', 'itemActivo'], { unique: true })
export class CanastaPrestamoItemEntidad {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'grupo_canasta', type: 'varchar', length: 80 })
  grupoCanasta!: string;

  @ManyToOne(() => ItemActivoFijo, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_item_activo' })
  itemActivo?: ItemActivoFijo | null;

  @ManyToOne(() => ContenedorActivo, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_contenedor' })
  contenedor?: ContenedorActivo | null;

  @Column({ name: 'registrado', type: 'boolean', default: true })
  registrado!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;
}