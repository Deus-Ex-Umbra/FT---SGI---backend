import { Column, CreateDateColumn, DeleteDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { ItemActivoFungible } from './item-activo-fungible.entidad';

export enum TipoCantidadFungible {
    Entero = 'entero',
    Decimal = 'decimal',
}

export enum TipoIdentificacionFungible {
    Lote = 'lote',
    Serie = 'serie',
    SoloSistema = 'solo_sistema',
}

@Entity('activos_fungibles')
export class ActivoFungible {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ length: 100 })
    nombre!: string;

    @Column({ length: 80, default: 'General' })
    categoria!: string;

    @Column({ type: 'text', nullable: true })
    descripcion?: string;

    // Define cómo se mide el activo fungible (g, kg, L, ml, unidades, etc.)
    @Column({ name: 'unidad_medida', type: 'varchar', length: 30, default: 'unidades' })
    unidad_medida!: string;

    @Column({ name: 'tipo_cantidad', type: 'enum', enum: TipoCantidadFungible, default: TipoCantidadFungible.Entero })
    tipo_cantidad!: TipoCantidadFungible;

    @Column({ name: 'tipo_identificacion', type: 'enum', enum: TipoIdentificacionFungible, default: TipoIdentificacionFungible.SoloSistema })
    tipo_identificacion!: TipoIdentificacionFungible;

    @Column({ name: 'tiene_vencimiento', type: 'boolean', default: false })
    tiene_vencimiento!: boolean;

    @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
    created_at!: Date;

    @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp', nullable: true })
    deleted_at?: Date | null;

    @OneToMany(() => ItemActivoFungible, (item) => item.activo)
    items!: ItemActivoFungible[];
}
