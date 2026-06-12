import { Body, Controller, Delete, Get, Param, Post, Put, Request, UseGuards } from '@nestjs/common';
import { JwtAutenticacionGuardia } from '@/modulos/autenticacion/guardias/jwt-autenticacion.guardia';
import { Roles } from '@/modulos/autenticacion/guardias/roles.decorador';
import { RolesGuardia } from '@/modulos/autenticacion/guardias/roles.guardia';
import { ContenedorCompartidoServicio } from './contenedor.servicio';

@Controller('contenedores')
@UseGuards(JwtAutenticacionGuardia, RolesGuardia)
@Roles('administrador', 'encargado_inventario')
export class ContenedorCompartidoControlador {
    constructor(private readonly contenedorCompartidoServicio: ContenedorCompartidoServicio) {}

    @Get()
    async obtenerTodos(@Request() req: { user: { id: number; rol: string; id_inventario?: number | null } }) {
        return this.contenedorCompartidoServicio.obtenerTodos(req.user);
    }

    @Post()
    async crear(
        @Request() req: { user: { id: number; rol: string; id_inventario?: number | null } },
        @Body() body: { nombre: string; descripcion: string; idInventario?: number },
    ) {
        return this.contenedorCompartidoServicio.crear(body, req.user);
    }

    @Put(':id')
    async editar(
        @Request() req: { user: { id: number; rol: string; id_inventario?: number | null } },
        @Param('id') _id: string,
        @Body() body: { idActivo?: number; idMaterial?: number; nombre: string; descripcion: string; idInventario?: number },
    ) {
        return this.contenedorCompartidoServicio.editar(body, req.user);
    }

    @Delete(':id')
    async eliminar(
        @Request() req: { user: { id: number; rol: string; id_inventario?: number | null } },
        @Param('id') _id: string,
        @Body() body: { idActivo?: number; idMaterial?: number },
    ) {
        await this.contenedorCompartidoServicio.eliminar(body, req.user);
        return { ok: true };
    }
}