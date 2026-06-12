import { IsBoolean } from 'class-validator';

export class ActualizarConfiguracionRegistroEstudianteDto {
  @IsBoolean()
  habilitado!: boolean;
}
