export class CrearUsuarioEstudianteDto {
  correo!: string;
  ci!: string;
  cu!: string;
  carreraId?: number;
  carrera?: string;
  fechaNacimiento!: string;
  contrasena?: string;
}
