import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class CambiarCorreoDto {
  @IsString()
  @IsNotEmpty({ message: 'La contraseña actual es obligatoria.' })
  contrasenaActual!: string;

  @IsEmail({}, { message: 'El formato del correo es inválido.' })
  @IsNotEmpty({ message: 'El nuevo correo es obligatorio.' })
  nuevoCorreo!: string;
}
