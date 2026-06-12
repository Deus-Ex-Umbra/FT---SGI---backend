import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('configuracion_registro_estudiante')
export class ConfiguracionRegistroEstudianteEntidad {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'registro_estudiante_habilitado', type: 'boolean', default: true })
  registroEstudianteHabilitado!: boolean;
}
