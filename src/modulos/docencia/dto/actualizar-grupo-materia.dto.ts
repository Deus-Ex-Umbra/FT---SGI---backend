import { IsOptional, IsString, IsDateString, IsInt, IsBoolean } from 'class-validator';

export class ActualizarGrupoMateriaDto {
  @IsInt()
  @IsOptional()
  materiaId?: number;

  @IsString()
  @IsOptional()
  sigla?: string;

  @IsString()
  @IsOptional()
  nombre?: string;

  @IsString()
  @IsOptional()
  descripcion?: string;


  @IsDateString()
  @IsOptional()
  fechaInicioInscripcion?: string;

  @IsDateString()
  @IsOptional()
  fechaFinInscripcion?: string;

  @IsString()
  @IsOptional()
  codigoInscripcion?: string;


  @IsOptional()
  grupo?: string | number;

  @IsInt()
  @IsOptional()
  maxEstudiantesGrupo?: number;

  @IsString()
  @IsOptional()
  nombreGrupo?: string | null;

  @IsBoolean()
  @IsOptional()
  activo?: boolean;

  @IsBoolean()
  @IsOptional()
  permitirInscripcion?: boolean;
}
