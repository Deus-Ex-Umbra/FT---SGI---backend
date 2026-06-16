import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('configuracion_registro_docente')
export class ConfiguracionRegistroDocenteEntidad {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'registro_docente_habilitado', type: 'boolean', default: true })
  registroDocenteHabilitado!: boolean;
}
