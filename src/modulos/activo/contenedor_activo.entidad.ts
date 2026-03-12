import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany, DeleteDateColumn } from 'typeorm';
import { ActivoFijo } from './activo_fijo.entidad';

@Entity('contenedores_activos')
export class ContenedorActivo {
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

    @OneToMany(() => ActivoFijo, (activo: ActivoFijo) => activo.contenedor)
    activos!: ActivoFijo[];
}
