import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany, DeleteDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ItemActivo } from './item_activo.entidad';
import { ContenedorActivo } from './contenedor_activo.entidad';

@Entity('activos_fijos')
export class ActivoFijo {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ length: 100 })
    nombre!: string;

    @CreateDateColumn({ type: 'timestamp' })
    created_at!: Date;

    @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp', nullable: true })
    deletedAt?: Date | null;

    @ManyToOne(() => ContenedorActivo, (contenedor: ContenedorActivo) => contenedor.activos, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'id_contenedor' })
    contenedor?: ContenedorActivo | null;

    @OneToMany(() => ItemActivo, (item: ItemActivo) => item.activo)
    items!: ItemActivo[];
}
