import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export const ROLES_USUARIO = ['administrador', 'encargado_inventario', 'docente', 'estudiante'] as const;
export type RolUsuario = (typeof ROLES_USUARIO)[number];

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', unique: true, nullable: true })
  correo!: string | null;

  @Column()
  contrasena!: string;

  @Column({ type: 'enum', enum: ROLES_USUARIO, default: 'administrador' })
  rol!: RolUsuario;

  @Column({ name: 'estado', type: 'boolean', default: true })
  estado!: boolean;
}
