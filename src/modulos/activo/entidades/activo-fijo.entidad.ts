import { Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { ItemActivoFijo } from './item-activo-fijo.entidad';
import { ContenedorActivo } from '@/modulos/contenedor/entidades/contenedor-activo.entidad';
import { InventarioEntidad } from '@/modulos/inventario/entidades/inventario.entidad';

@Entity('activos_fijos')
export class ActivoFijo {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ length: 100 })
    nombre!: string;

    @Column({ length: 80, default: 'General' })
    categoria!: string;

    @Column({ type: 'text', nullable: true })
    descripcion?: string;

    @CreateDateColumn({ type: 'timestamp' })
    created_at!: Date;

    @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp', nullable: true })
    deleted_at?: Date | null;

    @ManyToOne(() => InventarioEntidad, (inventario: InventarioEntidad) => inventario.activosFijos, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'id_inventario' })
    inventario?: InventarioEntidad | null;

    @ManyToOne(() => ContenedorActivo, (contenedor: ContenedorActivo) => contenedor.activos, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'id_contenedor' })
    contenedor?: ContenedorActivo | null;

    @OneToMany(() => ItemActivoFijo, (item: ItemActivoFijo) => item.activo)
    items!: ItemActivoFijo[];
}
