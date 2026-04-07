import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToMany, DeleteDateColumn } from 'typeorm';
import { ContenedorMaterial } from './contenedor_material.entidad';
import { LoteMaterial } from './lote_material.entidad';

@Entity('materiales_fungibles')
export class MaterialFungible {
    @PrimaryGeneratedColumn()
    id!: number;

    // Legacy: antes el material vivía dentro de un contenedor. Ahora el contenedor se asocia a cada instancia.
    @ManyToOne(() => ContenedorMaterial, contenedor => contenedor.materiales, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'id_contenedor' })
    contenedor?: ContenedorMaterial | null;

    @Column({ length: 100 })
    nombre!: string;

    @Column({ length: 50 })
    categoria!: string;

    @Column({ type: 'text', nullable: true })
    descripcion?: string;

    @Column({ length: 20 })
    unidad!: string;

    @Column({ name: 'stock_minimo_habilitado', type: 'boolean', default: false })
    stockMinimoHabilitado!: boolean;

    @Column({ name: 'stock_minimo', type: 'int', default: 0 })
    stockMinimo!: number;

    @Column({ name: 'tipo_identificacion', type: 'varchar', length: 12, default: 'lote' })
    tipoIdentificacion!: 'lote' | 'serie' | 'simple';

    @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
    createdAt!: Date;

    @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp', nullable: true })
    deletedAt?: Date | null;

    @OneToMany(() => LoteMaterial, (lote: LoteMaterial) => lote.material)
    lotes!: LoteMaterial[];
}
