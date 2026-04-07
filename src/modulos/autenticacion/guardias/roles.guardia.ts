import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CLAVE_ROLES } from './roles.decorador';
import { RolUsuario } from '@/modulos/usuario/entidades/usuario.entidad';

@Injectable()
export class RolesGuardia implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(contexto: ExecutionContext): boolean {
        const rolesRequeridos = this.reflector.getAllAndOverride<RolUsuario[]>(CLAVE_ROLES, [
            contexto.getHandler(),
            contexto.getClass(),
        ]);

        if (!rolesRequeridos || rolesRequeridos.length === 0) {
            return true;
        }

        const solicitud = contexto.switchToHttp().getRequest();
        const usuario = solicitud.user as { rol?: RolUsuario } | undefined;
        return !!usuario?.rol && rolesRequeridos.includes(usuario.rol);
    }
}
