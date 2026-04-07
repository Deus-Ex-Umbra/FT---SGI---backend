import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class GenerarPreReporteDto {
  @IsDateString()
  fechaInicio!: string;

  @IsDateString()
  fechaFin!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  instrucciones?: string;
}
