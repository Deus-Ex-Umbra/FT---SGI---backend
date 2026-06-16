import { IsBoolean } from 'class-validator';

export class ActualizarConfiguracionRegistroDocenteDto {
  @IsBoolean()
  habilitado!: boolean;
}
