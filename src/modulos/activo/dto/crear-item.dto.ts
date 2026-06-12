import { IsNotEmpty, IsOptional, IsString, IsNumber, IsDateString } from 'class-validator';

export class CrearItemActivoDto {
  @IsNotEmpty({ message: 'El ID del activo es obligatorio' })
  idActivo!: string | number;

  @IsString()
  @IsOptional()
  codigoInventario?: string;

  @IsString()
  @IsOptional()
  codigoUnico?: string;

  @IsString()
  @IsOptional()
  codigoSistema?: string;

  @IsString()
  @IsOptional()
  ubicacion?: string;

  @IsString()
  @IsOptional()
  ue?: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsDateString({}, { message: 'Fecha de entrega inválida' })
  @IsOptional()
  fechaEntrega?: string | null;

  @IsDateString({}, { message: 'Fecha de retiro inválida' })
  @IsOptional()
  fechaRetiro?: string | null;

  @IsString()
  @IsOptional()
  estado?: string;

  @IsString()
  @IsOptional()
  estadoFisico?: string;

  @IsString()
  @IsOptional()
  observaciones?: string;

  @IsNumber({}, { message: 'El precio debe ser un número' })
  @IsOptional()
  precio?: number;
}
