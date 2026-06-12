import { CanActivate, ExecutionContext, Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DocenteEntidad } from '@/modulos/docente/entidades/docente.entidad';
import { EstudianteEntidad } from '@/modulos/estudiante/entidades/estudiante.entidad';

@Injectable()
export class PertenenciaInventarioGuardia implements CanActivate {
  constructor(private readonly dataSource: DataSource) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const usuario = req.user;
    const params = req.params ?? {};
    const body = req.body ?? {};
    const query = req.query ?? {};

    if (!usuario) {
      return false;
    }

    if (usuario.rol === 'administrador') {
      return true;
    }

    if (usuario.rol !== 'encargado_inventario') {
      if ((usuario.rol === 'docente' || usuario.rol === 'estudiante') && req.method === 'GET') {
      } else {
        throw new ForbiddenException('No tienes permisos para gestionar recursos de inventario.');
      }
    }

    const metodo = req.method;
    const path = req.route?.path ?? req.path ?? '';

    if (usuario.rol === 'encargado_inventario' && metodo !== 'GET') {
      if (path.includes('fijos') && !usuario.puedeEditarFijos) {
        throw new ForbiddenException('No tienes permisos para editar activos fijos.');
      }
      if (path.includes('materiales') && !usuario.puedeEditarFungibles) {
        throw new ForbiddenException('No tienes permisos para editar materiales fungibles.');
      }
    }

    const idInventarioUsuario = usuario.id_inventario;
    if (usuario.rol === 'encargado_inventario' && !idInventarioUsuario) {
      throw new ForbiddenException('No tienes ningún inventario asignado.');
    }

    const idInventarioReq = params.idInventario || body.idInventario || query.idInventario ||
                           params.id_inventario || body.id_inventario || query.id_inventario;

    if (idInventarioReq) {
      if (usuario.rol === 'encargado_inventario') {
        if (Number(idInventarioReq) !== Number(idInventarioUsuario)) {
          throw new ForbiddenException('No tienes permisos sobre el inventario solicitado.');
        }
      } else if (usuario.rol === 'docente' || usuario.rol === 'estudiante') {
        const permitidos = await this.obtenerInventariosPermitidos(usuario);
        if (!permitidos.includes(Number(idInventarioReq))) {
          throw new ForbiddenException('No tienes acceso al inventario solicitado.');
        }
      }
      return true;
    }

    const idRecurso = params.id;
    if (idRecurso) {
      let entityClass = '';

      if (path.includes('fijos')) {
        entityClass = 'ActivoFijo';
      } else if (path.includes('contenedores')) {
        entityClass = 'ContenedorActivo';
      } else if (path.includes('items')) {
        entityClass = 'ItemActivoFijo';
      } else if (path.includes('lotes')) {
        entityClass = 'LoteMaterial';
      }

      if (entityClass) {
        const repo = this.dataSource.getRepository(entityClass);
        const recurso = await repo.findOne({
          where: { id: idRecurso } as any,
          relations: ['inventario', 'activo', 'activo.inventario'],
        });

        if (!recurso) {
          throw new BadRequestException('El recurso solicitado no existe.');
        }

        const idInventarioRecurso = recurso.inventario?.id || recurso.activo?.inventario?.id;
        if (idInventarioRecurso) {
          if (usuario.rol === 'encargado_inventario') {
            if (Number(idInventarioRecurso) !== Number(idInventarioUsuario)) {
              throw new ForbiddenException('El recurso solicitado pertenece a otro inventario.');
            }
          } else if (usuario.rol === 'docente' || usuario.rol === 'estudiante') {
            const permitidos = await this.obtenerInventariosPermitidos(usuario);
            if (!permitidos.includes(Number(idInventarioRecurso))) {
              throw new ForbiddenException('No tienes acceso al inventario del recurso solicitado.');
            }
          }
        }
      }
    }

    return true;
  }

  private async obtenerInventariosPermitidos(usuario: any): Promise<number[]> {
    const ids: number[] = [];
    if (usuario.rol === 'docente') {
      const docente = await this.dataSource.getRepository(DocenteEntidad).findOne({
        where: { usuario: { id: usuario.id } },
        relations: ['carreras', 'carreras.inventarios'],
      });
      if (docente?.carreras) {
        for (const carrera of docente.carreras) {
          if (carrera.inventarios) {
            for (const inv of carrera.inventarios) {
              if (inv.id && !ids.includes(inv.id)) {
                ids.push(inv.id);
              }
            }
          }
        }
      }
    } else if (usuario.rol === 'estudiante') {
      const estudiante = await this.dataSource.getRepository(EstudianteEntidad).findOne({
        where: { usuario: { id: usuario.id } },
        relations: ['cus', 'cus.carreras', 'cus.carreras.inventarios', 'carreraRef', 'carreraRef.inventarios'],
      });
      if (estudiante) {
        if (estudiante.carreraRef?.inventarios) {
          for (const inv of estudiante.carreraRef.inventarios) {
            if (inv.id && !ids.includes(inv.id)) {
              ids.push(inv.id);
            }
          }
        }
        if (estudiante.asignacionesCarrera) {
          for (const asignacion of estudiante.asignacionesCarrera) {
            if (asignacion.carrera?.inventarios) {
              for (const inv of asignacion.carrera.inventarios) {
                if (inv.id && !ids.includes(inv.id)) {
                  ids.push(inv.id);
                }
              }
            }
          }
        }
      }
    }
    return ids;
  }
}
