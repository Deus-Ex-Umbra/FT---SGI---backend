import { IsNotEmpty, IsOptional, IsString, IsNumber, IsInt } from 'class-validator';

export class CrearActivoFijoDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre del activo es obligatorio' })
  nombre!: string;

  @IsInt({ message: 'El ID del contenedor debe ser un número entero' })
  @IsOptional()
  idContenedor?: number;

  @IsInt({ message: 'El ID del inventario debe ser un número entero' })
  @IsOptional()
  idInventario?: number;

  @IsString()
  @IsOptional()
  categoria?: string;

  @IsString()
  @IsOptional()
  descripcion?: string;
}
