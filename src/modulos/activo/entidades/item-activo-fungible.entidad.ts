import { randomUUID } from 'crypto';
import { BeforeInsert, Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { ActivoFungible } from './activo-fungible.entidad';

@Entity('items_activos_fungibles')
export class ItemActivoFungible {
    @PrimaryColumn('uuid')
    id!: string;

    @ManyToOne(() => ActivoFungible, (activo) => activo.items, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'id_activo' })
    activo!: ActivoFungible;

    @Column({ name: 'codigo_sistema', type: 'varchar', length: 36, unique: true, nullable: true })
    codigo_sistema!: string | null;

    @Column({ name: 'codigo_inventario', type: 'varchar', length: 50, unique: true, nullable: true })
    codigo_inventario!: string | null;

    @Column({ name: 'codigo_unico', type: 'varchar', length: 120, unique: true, nullable: true })
    codigo_unico!: string | null;

    @Column({ name: 'lote', type: 'varchar', length: 80, nullable: true })
    lote?: string | null;

    @Column({ name: 'serie', type: 'varchar', length: 80, nullable: true })
    serie?: string | null;

    @Column({ name: 'fecha_vencimiento', type: 'date', nullable: true })
    fecha_vencimiento?: Date | null;

    @Column({ name: 'cantidad', type: 'numeric', precision: 14, scale: 4, default: 0 })
    cantidad!: number;

    @Column({ length: 30, default: 'disponible' })
    estado!: string;

    @Column({ type: 'text', nullable: true })
    observaciones?: string;

    @Column({ type: 'numeric', precision: 10, scale: 2, default: 0.0 })
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
