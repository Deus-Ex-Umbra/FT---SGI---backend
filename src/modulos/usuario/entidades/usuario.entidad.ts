import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

export const ROLES_USUARIO = ['administrador', 'encargado_inventario'] as const;
export type RolUsuario = (typeof ROLES_USUARIO)[number];

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  nombre_usuario!: string;

  @Column()
  contrasena!: string;

  @Column({ type: 'enum', enum: ROLES_USUARIO, default: 'administrador' })
  rol!: RolUsuario;
}
