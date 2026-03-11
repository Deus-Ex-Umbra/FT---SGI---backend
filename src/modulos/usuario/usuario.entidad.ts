import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  nombre_usuario!: string;

  @Column()
  contrasena!: string;

  @Column({ default: 'director' })
  rol!: string;
}
