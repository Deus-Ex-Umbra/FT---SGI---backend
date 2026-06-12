import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, IsArray } from 'class-validator';

export class CrearDocenteDto {
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio' })
  correo!: string;

  @IsString()
  @IsNotEmpty({ message: 'El CI es obligatorio' })
  ci!: string;

  @IsString()
  @IsOptional()
  codigo?: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  nombre!: string;

  @IsString()
  @IsNotEmpty({ message: 'El apellido es obligatorio' })
  apellido!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha de nacimiento debe tener formato YYYY-MM-DD' })
  @IsOptional()
  fechaNacimiento?: string;

  @IsString()
  @IsOptional()
  contrasena?: string;

  @IsArray({ message: 'Las carreras deben ser un arreglo de números' })
  @IsOptional()
  carrerasIds?: number[];
}
