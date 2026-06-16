import { Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { ActivoFijo } from '@/modulos/activo/entidades/activo-fijo.entidad';
import { InventarioEntidad } from '@/modulos/inventario/entidades/inventario.entidad';

@Entity('contenedores_activos')
export class ContenedorActivo {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ length: 100 })
    nombre!: string;

    @Column({ length: 150 })
    ubicacion!: string;

    @Column({ type: 'boolean', default: true })
    visible!: boolean;


    @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
    created_at!: Date;

    @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp', nullable: true })
    deleted_at?: Date | null;

    @ManyToOne(() => InventarioEntidad, (inventario: InventarioEntidad) => inventario.contenedores, {
        nullable: true,
        onDelete: 'SET NULL',
    })
    @JoinColumn({ name: 'id_inventario' })
    inventario?: InventarioEntidad | null;

    @OneToMany(() => ActivoFijo, (activo: ActivoFijo) => activo.contenedor)
    activos!: ActivoFijo[];
}
