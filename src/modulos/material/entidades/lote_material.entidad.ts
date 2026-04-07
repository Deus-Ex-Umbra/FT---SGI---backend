import { randomUUID } from 'crypto';
import { BeforeInsert, Entity, Column, CreateDateColumn, ManyToOne, JoinColumn, DeleteDateColumn, PrimaryColumn } from 'typeorm';
import { MaterialFungible } from './material_fungible.entidad';
import { ContenedorMaterial } from './contenedor_material.entidad';

@Entity('lotes_materiales')
export class LoteMaterial {
    // ID de sistema (UUIDv4) autogenerado.
    @PrimaryColumn('uuid')
    id!: string;

    @ManyToOne(() => MaterialFungible, material => material.lotes, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'id_material' })
    material!: MaterialFungible;

    @ManyToOne(() => ContenedorMaterial, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'id_contenedor' })
    contenedor!: ContenedorMaterial;

    // Cómo se identifica esta instancia.
    @Column({ type: 'varchar', length: 12, default: 'lote' })
    tipo!: 'lote' | 'serie' | 'simple';

    // Nota: con `string | null`, TypeScript emite `design:type = Object`.
    // TypeORM no puede inferir "Object" en Postgres, así que fijamos el tipo.
    @Column({ type: 'varchar', length: 50, nullable: true })
    lote!: string | null;

    @Column({ type: 'varchar', length: 80, nullable: true })
    serie!: string | null;

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

    @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp', nullable: true })
    deletedAt?: Date | null;

    @BeforeInsert()
    private beforeInsert() {
        if (!this.id) this.id = randomUUID();
    }
}
