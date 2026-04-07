import { IsArray, IsBoolean, IsDateString, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CrearReporteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  tituloBase!: string;

  @IsIn(['blanco', 'precreado'])
  tipo!: 'blanco' | 'precreado';

  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @IsOptional()
  @IsArray()
  areas?: string[];

  @IsOptional()
  @IsBoolean()
  usarIA?: boolean;
}
