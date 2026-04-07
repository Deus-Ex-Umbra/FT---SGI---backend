import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany, DeleteDateColumn } from 'typeorm';
import { ActivoFijo } from '@/modulos/activo/entidades/activo-fijo.entidad';

@Entity('contenedores_activos')
export class ContenedorActivo {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ length: 100 })
    nombre!: string;

    @Column({ length: 150 })
    ubicacion!: string;

    @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
    created_at!: Date;

    @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp', nullable: true })
    deleted_at?: Date | null;

    @OneToMany(() => ActivoFijo, (activo: ActivoFijo) => activo.contenedor)
    activos!: ActivoFijo[];
}
