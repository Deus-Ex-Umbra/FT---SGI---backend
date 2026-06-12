import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { BaseCrudController } from '@/modulos/administrador/base-crud.controlador';
import { JwtAutenticacionGuardia } from '@/modulos/autenticacion/guardias/jwt-autenticacion.guardia';
import { RolesGuardia } from '@/modulos/autenticacion/guardias/roles.guardia';
import { Roles } from '@/modulos/autenticacion/guardias/roles.decorador';
import { InventarioServicio } from './inventario.servicio';
import { CrearInventarioDto, EditarInventarioDto } from './dto/inventario.dto';

@Controller('inventarios')
export class InventarioControlador extends BaseCrudController<any, CrearInventarioDto, EditarInventarioDto>(['administrador']) {
    constructor(private readonly inventarioServicio: InventarioServicio) {
        super({
            findAll: () => this.inventarioServicio.listarInventarios(),
            create: (dto) => this.inventarioServicio.crearInventario(dto),
            update: (id, dto) => this.inventarioServicio.editarInventario(id, dto),
            delete: (id) => this.inventarioServicio.eliminarInventario(id),
        });
    }

    @Get('mis-inventarios')
    @UseGuards(JwtAutenticacionGuardia, RolesGuardia)
    @Roles('administrador', 'encargado_inventario', 'docente', 'estudiante')
    async obtenerMisInventarios(@Request() req: any) {
        return this.inventarioServicio.obtenerInventariosAutorizados(req.user);
    }
}
