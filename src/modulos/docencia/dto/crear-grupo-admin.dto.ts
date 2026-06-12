import { IsInt, IsNotEmpty } from 'class-validator';
import { CrearGrupoMateriaDto } from './crear-grupo-materia.dto';

export class CrearGrupoAdminDto extends CrearGrupoMateriaDto {
  @IsInt({ message: 'El ID del docente es obligatorio y debe ser un número entero' })
  @IsNotEmpty({ message: 'El ID del docente es obligatorio' })
  docenteUsuarioId!: number;
}
