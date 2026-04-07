import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Usuario } from '@/modulos/usuario/entidades/usuario.entidad';

@Entity('configuracion_ia')
export class ConfiguracionIAEntidad {
  @PrimaryGeneratedColumn()
  id!: number;

  @OneToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario!: Usuario;

  @Column({ type: 'text', nullable: true })
  geminiApiUrl!: string | null;

  @Column({ type: 'text', nullable: true })
  geminiApiKey!: string | null;
}
