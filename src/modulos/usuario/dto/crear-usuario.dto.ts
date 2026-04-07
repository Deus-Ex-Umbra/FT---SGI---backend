import { RolUsuario } from '@/modulos/usuario/entidades/usuario.entidad';

export class CrearUsuarioDto {
    nombre_usuario!: string;
    contrasena!: string;
    rol!: RolUsuario;
}
