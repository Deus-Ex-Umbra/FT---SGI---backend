import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, CreateDateColumn, Index, DeleteDateColumn, BeforeInsert } from 'typeorm';
import { createHmac } from 'crypto';
import { EstudianteEntidad } from '@/modulos/estudiante/entidades/estudiante.entidad';
import { ItemActivoFijo } from '@/modulos/activo/entidades/item-activo-fijo.entidad';
import { ContenedorActivo } from '@/modulos/contenedor/entidades/contenedor-activo.entidad';
import { Usuario } from '@/modulos/usuario/entidades/usuario.entidad';
import { HistorialPrestamoEntidad } from './historial-prestamo.entidad';
import { InventarioEntidad } from '@/modulos/inventario/entidades/inventario.entidad';

@Entity('prestamos')
@Index('idx_prestamos_estado_fecha_devolucion', ['estado', 'fechaDevolucion'])
@Index('idx_prestamos_codigo_herramienta', ['codigoHerramienta'])
@Index('uq_prestamos_item_no_devuelto_v2', ['codigoHerramienta'], { unique: true, where: `"estado" IN ('solicitado', 'aceptado', 'despachado', 'vencido', 'activo', 'pendiente') AND "codigo_herramienta" IS NOT NULL AND "deleted_at" IS NULL` })
export class PrestamoEntidad {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => EstudianteEntidad, (estudiante: EstudianteEntidad) => estudiante.prestamos, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_estudiante' })
  estudiante!: EstudianteEntidad;

  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_docente' })
  docente!: Usuario;

  @ManyToOne(() => ItemActivoFijo, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_item_activo' })
  itemActivo?: ItemActivoFijo | null;

  @ManyToOne(() => ContenedorActivo, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_contenedor' })
  contenedor?: ContenedorActivo | null;

  @ManyToOne(() => InventarioEntidad, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_inventario' })
  inventario?: InventarioEntidad | null;

  @Column({ name: 'codigo_herramienta', type: 'varchar', length: 50, nullable: true })
  codigoHerramienta?: string | null;

  @Column({ name: 'grupo_canasta', type: 'varchar', length: 80, nullable: true })
  grupoCanasta?: string | null;

  @Column({ name: 'codigo', type: 'varchar', length: 20, nullable: true })
  codigo?: string | null;

  @Column({ name: 'fecha_prestamo', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fechaPrestamo!: Date;

  @Column({ name: 'fecha_devolucion', type: 'timestamp', nullable: true })
  fechaDevolucion?: Date | null;

  @Column({ length: 40, default: 'pendiente' })
  estado!: string;

  @Column({ name: 'motivo_rechazo', type: 'text', nullable: true })
  motivoRechazo?: string | null;

  @Column({ name: 'estado_fisico_entrega', type: 'varchar', length: 30, default: 'bueno' })
  estadoFisicoEntrega!: string;

  @Column({ name: 'estado_fisico_devolucion', type: 'varchar', length: 30, nullable: true })
  estadoFisicoDevolucion?: string | null;

  @Column({ name: 'consumibles', type: 'jsonb', nullable: true })
  consumibles?: Array<{ idLote: string; lote?: string; material?: string; cantidadSolicitada: number; cantidadDespachada?: number; cantidadDevuelta?: number; motivo: string; estadoDevuelto?: string }> | null;

  @Column({ name: 'carnet_retenido', type: 'boolean', default: false })
  carnetRetenido!: boolean;

  @Column({ type: 'text', nullable: true })
  observaciones?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date | null;

  @OneToMany(() => HistorialPrestamoEntidad, (historial) => historial.prestamo)
  historial?: HistorialPrestamoEntidad[];

  @BeforeInsert()
  generarCodigo() {
    if (!this.codigo) {
      const secreto = process.env.JWT_SECRETO ?? 'secreto_prestamos_siyp';
      const timestamp = this.fechaPrestamo ? new Date(this.fechaPrestamo).getTime() : Date.now();
      const carnet = this.estudiante?.carnet ?? 'SYS';
      const ref = this.grupoCanasta ?? this.codigoHerramienta ?? 'REF';
      
      const input = `${timestamp}:${carnet}:${ref}`;
      const hash = createHmac('sha256', secreto)
        .update(input)
        .digest('hex');
      
      const subHash = hash.substring(0, 12);
      const num = parseInt(subHash, 16);
      let cod = num.toString(36).toUpperCase().padStart(8, '0');
      cod = cod.substring(cod.length - 8);
      
      this.codigo = `${cod.substring(0, 4)}-${cod.substring(4, 8)}`;
    }
  }
}
