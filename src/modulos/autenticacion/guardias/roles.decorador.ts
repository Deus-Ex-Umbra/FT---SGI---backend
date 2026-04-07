import { SetMetadata } from '@nestjs/common';
import { RolUsuario } from '@/modulos/usuario/entidades/usuario.entidad';

export const CLAVE_ROLES = 'roles';
export const Roles = (...roles: RolUsuario[]) => SetMetadata(CLAVE_ROLES, roles);
