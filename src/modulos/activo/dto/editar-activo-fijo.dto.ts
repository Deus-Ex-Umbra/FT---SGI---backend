import { PartialType } from '@nestjs/swagger';
import { CrearActivoFijoDto } from './crear-activo-fijo.dto';

export class EditarActivoFijoDto extends PartialType(CrearActivoFijoDto) {}

