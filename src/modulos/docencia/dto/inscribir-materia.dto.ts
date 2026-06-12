import { IsOptional, IsInt, IsString } from 'class-validator';

export class InscribirMateriaDto {
  @IsInt()
  @IsOptional()
  estudianteId?: number | null;

  @IsString()
  @IsOptional()
  carnet?: string | null;
}
