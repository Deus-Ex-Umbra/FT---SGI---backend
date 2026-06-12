import { PartialType } from '@nestjs/swagger';
import { CrearEstudianteDto } from './crear-estudiante.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class EditarEstudianteDto extends PartialType(CrearEstudianteDto) {
  @IsBoolean({ message: 'El carnet retenido debe ser un valor booleano' })
  @IsOptional()
  carnetRetenido?: boolean;

  @IsBoolean({ message: 'El carnet retenido override debe ser un valor booleano o nulo' })
  @IsOptional()
  carnetRetenidoOverride?: boolean | null;
}
