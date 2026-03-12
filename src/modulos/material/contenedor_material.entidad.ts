import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany, DeleteDateColumn } from 'typeorm';
import { MaterialFungible } from './material_fungible.entidad';

@Entity('contenedores_materiales')
export class ContenedorMaterial {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ length: 100 })
    nombre!: string;

    @Column({ length: 150 })
    ubicacion!: string;

    @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
    createdAt!: Date;

    @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp', nullable: true })
    deletedAt?: Date | null;

    @OneToMany(() => MaterialFungible, (material: MaterialFungible) => material.contenedor)
    materiales!: MaterialFungible[];
}
