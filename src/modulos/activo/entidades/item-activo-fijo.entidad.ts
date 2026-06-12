import { randomUUID } from 'crypto';
import { BeforeInsert, Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { ActivoFijo } from './activo-fijo.entidad';

@Entity('items_activos')
export class ItemActivoFijo {
    @PrimaryColumn('uuid')
    id!: string;

    @ManyToOne(() => ActivoFijo, activo => activo.items, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'id_activo' })
    activo!: ActivoFijo;

    @Column({ name: 'codigo_inventario', type: 'varchar', length: 50, unique: true, nullable: true })
    codigo_inventario!: string | null;

    @Column({ name: 'codigo_unico', type: 'varchar', length: 120, unique: true, nullable: true })
    codigo_unico!: string | null;

    @Column({ name: 'codigo_sistema', type: 'varchar', length: 36, unique: true, nullable: true })
    codigo_sistema!: string | null;

    @Column({ length: 150, nullable: true })
    ubicacion?: string;

    @Column({ length: 20, nullable: true })
    ue?: string;

    @Column({ type: 'text', nullable: true })
    descripcion?: string;

    @Column({ name: 'fecha_entrega', type: 'date', nullable: true })
    fecha_entrega?: Date;

    @Column({ name: 'fecha_retiro', type: 'timestamp', nullable: true })
    fecha_retiro?: Date;

    @Column({ length: 30, default: 'disponible' })
    estado!: string; 
    
    @Column({ name: 'estado_fisico', length: 15, default: 'bueno' })
    estado_fisico!: string;

    @Column({ type: 'text', nullable: true })
    observaciones?: string;

    @Column({ type: 'numeric', precision: 10, scale: 2, default: 0.00 })
    precio!: number;

    @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
    created_at!: Date;

    @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp', nullable: true })
    deleted_at?: Date | null;

    @BeforeInsert()
    private beforeInsert() {
        if (!this.id) this.id = randomUUID();
    }
}
