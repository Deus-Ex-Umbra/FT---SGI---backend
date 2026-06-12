import { IsNotEmpty, IsOptional, IsString, IsArray, IsInt, IsDateString } from 'class-validator';

export class CrearGrupoMateriaDto {
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


  @IsNotEmpty({ message: 'El grupo es obligatorio' })
  grupo!: string | number;

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  estudianteIds?: number[];

  @IsInt()
  @IsOptional()
  maxEstudiantesGrupo?: number;

  @IsString()
  @IsOptional()
  nombreGrupo?: string | null;
}
