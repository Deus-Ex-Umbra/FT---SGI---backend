import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, DeleteDateColumn } from 'typeorm';
import { ActivoFijo } from './activo_fijo.entidad';

@Entity('items_activos')
export class ItemActivo {
    @PrimaryGeneratedColumn()
    id!: number;

    @ManyToOne(() => ActivoFijo, activo => activo.items, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'id_activo' })
    activo!: ActivoFijo;

    @Column({ name: 'codigo_inventario', length: 50, unique: true })
    codigoInventario!: string;

    @Column({ name: 'fecha_entrega', type: 'date', nullable: true })
    fechaEntrega?: Date;

    @Column({ name: 'fecha_retiro', type: 'date', nullable: true })
    fechaRetiro?: Date;

    @Column({ length: 30, default: 'buen_estado' })
    estado!: string; // 'buen_estado', 'regular', 'en_mantenimiento', 'en_prestamo', 'revision', 'dado_de_baja', 'danado'

    @Column({ type: 'text', nullable: true })
    observaciones?: string;

    @Column({ type: 'numeric', precision: 10, scale: 2, default: 0.00 })
    precio!: number;

    @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
    createdAt!: Date;

    @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp', nullable: true })
    deletedAt?: Date | null;
}
