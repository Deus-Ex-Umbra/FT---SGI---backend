import { Type } from 'class-transformer';
import { IsArray, IsEmail, IsNotEmpty, IsOptional, IsString, Matches, IsNumber, ValidateNested } from 'class-validator';
import { AsignacionCarreraEstudianteDto } from './asignacion-carrera-estudiante.dto';

export class CrearEstudianteDto {
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @IsOptional()
  correo?: string;

  @IsString()
  @IsNotEmpty({ message: 'El CI es obligatorio' })
  ci!: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  nombre!: string;

  @IsString()
  @IsNotEmpty({ message: 'El apellido es obligatorio' })
  apellido!: string;

  @IsString()
  @IsOptional()
  cu?: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'El ID de la carrera debe ser un número' })
  @IsOptional()
  carreraId?: number;

  @IsString()
  @IsOptional()
  carrera?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AsignacionCarreraEstudianteDto)
  @IsOptional()
  asignacionesCarrera?: AsignacionCarreraEstudianteDto[];

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha de nacimiento debe tener formato YYYY-MM-DD' })
  @IsNotEmpty({ message: 'La fecha de nacimiento es obligatoria' })
  fechaNacimiento!: string;

  @IsString()
  @IsOptional()
  contrasena?: string;
}
