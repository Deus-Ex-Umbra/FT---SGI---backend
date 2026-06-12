import { IsEmail, IsNotEmpty, IsOptional, IsString, IsNumber, MaxLength } from 'class-validator';

export class CrearEncargadoDto {
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio' })
  correo!: string;

  @IsString()
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  contrasena!: string;

  @IsString()
  @MaxLength(150)
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  nombre!: string;

  @IsString()
  @MaxLength(150)
  @IsOptional()
  apellido?: string;

  @IsNumber({}, { message: 'El ID del inventario debe ser un número' })
  @IsOptional()
  idInventario?: number;

  @IsString()
  @IsOptional()
  fechaNacimiento?: string;
}
