import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { ItemActivo } from './item_activo.entidad';

@Entity('activos_fijos')
export class ActivoFijo {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ length: 100 })
    nombre!: string;

    @CreateDateColumn({ type: 'timestamp' })
    created_at!: Date;

    @OneToMany(() => ItemActivo, (item: ItemActivo) => item.activo)
    items!: ItemActivo[];
}
