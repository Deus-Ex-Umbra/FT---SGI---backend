import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class AsignacionCarreraEstudianteDto {
  @IsString()
  @IsNotEmpty({ message: 'El CU es obligatorio para cada carrera asignada' })
  cu!: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'El ID de la carrera debe ser un número' })
  @IsOptional()
  carreraId?: number;

  @IsString()
  @IsOptional()
  carrera?: string;
}