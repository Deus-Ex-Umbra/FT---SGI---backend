import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, DeleteDateColumn, ManyToMany } from 'typeorm';
import { ActivoFijo } from '@/modulos/activo/entidades/activo-fijo.entidad';
import { ActivoFungible } from '@/modulos/activo/entidades/activo-fungible.entidad';
import { ContenedorActivo } from '@/modulos/contenedor/entidades/contenedor-activo.entidad';
import { EncargadoInventarioEntidad } from '@/modulos/encargado-inventario/entidades/encargado-inventario.entidad';
import { CarreraEntidad } from '@/modulos/prestamo/entidades/carrera.entidad';

@Entity('inventarios')
export class InventarioEntidad {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'varchar', length: 120 })
    nombre!: string;

    @Column({ type: 'text', nullable: true })
    descripcion?: string | null;

    @Column({ name: 'puede_editar_activos_fijos', type: 'boolean', nullable: true, default: null })
    puedeEditarFijos?: boolean | null;

    @Column({ name: 'puede_editar_materiales_fungibles', type: 'boolean', nullable: true, default: null })
    puedeEditarFungibles?: boolean | null;

    @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
    created_at!: Date;

    @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp', nullable: true })
    deleted_at?: Date | null;

    @OneToMany(() => EncargadoInventarioEntidad, (encargado: EncargadoInventarioEntidad) => encargado.inventario)
    encargados!: EncargadoInventarioEntidad[];

    @OneToMany(() => ContenedorActivo, (contenedor: ContenedorActivo) => contenedor.inventario)
    contenedores!: ContenedorActivo[];

    @OneToMany(() => ActivoFijo, (activo: ActivoFijo) => activo.inventario)
    activosFijos!: ActivoFijo[];

    @OneToMany(() => ActivoFungible, (activo: ActivoFungible) => activo.inventario)
    activosFungibles!: ActivoFungible[];

    @ManyToMany(() => CarreraEntidad, (carrera) => carrera.inventarios)
    carreras!: CarreraEntidad[];
}
