import { Entity, PrimaryGeneratedColumn, Column, JoinColumn, OneToOne, ManyToOne } from 'typeorm';
import { Usuario } from '@/modulos/usuario/entidades/usuario.entidad';
import { InventarioEntidad } from '@/modulos/inventario/entidades/inventario.entidad';

@Entity('encargados_inventario')
export class EncargadoInventarioEntidad {
  @PrimaryGeneratedColumn()
  id!: number;

  @OneToOne(() => Usuario, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_usuario' })
  usuario?: Usuario | null;

  @ManyToOne(() => InventarioEntidad, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_inventario' })
  inventario?: InventarioEntidad | null;

  @Column({ name: 'nombre', type: 'varchar', length: 150, nullable: true })
  nombre?: string | null;

  @Column({ name: 'apellido', type: 'varchar', length: 150, nullable: true })
  apellido?: string | null;

  @Column({ name: 'puede_editar_activos_fijos', type: 'boolean', default: false, nullable: true })
  puedeEditarFijos?: boolean;

  @Column({ name: 'puede_editar_materiales_fungibles', type: 'boolean', default: false, nullable: true })
  puedeEditarFungibles?: boolean;
}
