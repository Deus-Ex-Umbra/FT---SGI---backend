import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToMany, DeleteDateColumn } from 'typeorm';
import { ContenedorMaterial } from './contenedor_material.entidad';
import { LoteMaterial } from './lote_material.entidad';

@Entity('materiales_fungibles')
export class MaterialFungible {
    @PrimaryGeneratedColumn()
    id!: number;

    @ManyToOne(() => ContenedorMaterial, contenedor => contenedor.materiales, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'id_contenedor' })
    contenedor!: ContenedorMaterial;

    @Column({ length: 100 })
    nombre!: string;

    @Column({ length: 50 })
    categoria!: string;

    @Column({ type: 'text', nullable: true })
    descripcion?: string;

    @Column({ length: 20 })
    unidad!: string; // Ej. Litros, Piezas, Cajas

    @Column({ name: 'stock_minimo', type: 'int', default: 0 })
    stockMinimo!: number;

    @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
    createdAt!: Date;

    @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp', nullable: true })
    deletedAt?: Date | null;

    @OneToMany(() => LoteMaterial, (lote: LoteMaterial) => lote.material)
    lotes!: LoteMaterial[];
}
