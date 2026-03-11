import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { MaterialFungible } from './material_fungible.entidad';

@Entity('lotes_materiales')
export class LoteMaterial {
    @PrimaryGeneratedColumn()
    id!: number;

    @ManyToOne(() => MaterialFungible, material => material.lotes, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'id_material' })
    material!: MaterialFungible;

    @Column({ length: 50 })
    lote!: string;

    @Column({ name: 'fecha_entrega', type: 'date', nullable: true })
    fechaEntrega?: Date;

    @Column({ name: 'fecha_retiro', type: 'date', nullable: true })
    fechaRetiro?: Date;

    @Column({ name: 'cantidad_disponible', type: 'int', default: 0 })
    cantidadDisponible!: number;

    @Column({ name: 'fecha_caducidad', type: 'date', nullable: true })
    fechaCaducidad?: Date;

    @Column({ type: 'numeric', precision: 10, scale: 2, default: 0.00 })
    precio!: number;

    @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
    createdAt!: Date;
}
