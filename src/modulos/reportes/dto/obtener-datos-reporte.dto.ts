import { IsArray, IsDateString, IsOptional } from 'class-validator';

export class ObtenerDatosReporteDto {
  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @IsOptional()
  @IsArray()
  areas?: string[];
}
