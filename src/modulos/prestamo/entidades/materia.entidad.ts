import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';


@Entity('materias')
export class MateriaEntidad {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 30, unique: true })
  codigo!: string;

  @Column({ type: 'varchar', length: 160, nullable: true })
  nombre?: string | null;

  @Column({ type: 'text', nullable: true })
  descripcion?: string | null;

  @Column({ name: 'carreras_habilitadas_ids', type: 'simple-array', nullable: true })
  carrerasHabilitadasIds?: string[] | null;

}
