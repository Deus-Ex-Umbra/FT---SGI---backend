import { IsNotEmpty, IsString, IsOptional, IsBoolean } from 'class-validator';
import { PartialType } from '@nestjs/swagger';

export class CrearInventarioDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre del inventario es obligatorio' })
  nombre!: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsBoolean()
  @IsOptional()
  puedeEditarFijos?: boolean;

  @IsBoolean()
  @IsOptional()
  puedeEditarFungibles?: boolean;
}

export class EditarInventarioDto extends PartialType(CrearInventarioDto) {}
