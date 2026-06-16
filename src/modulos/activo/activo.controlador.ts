import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Request, UseGuards } from '@nestjs/common';
import { JwtAutenticacionGuardia } from '@/modulos/autenticacion/guardias/jwt-autenticacion.guardia';
import { Roles } from '@/modulos/autenticacion/guardias/roles.decorador';
import { RolesGuardia } from '@/modulos/autenticacion/guardias/roles.guardia';
import { PertenenciaInventarioGuardia } from '@/modulos/autenticacion/guardias/pertenencia-inventario.guardia';
import { ActivoServicio } from './activo.servicio';

import { CrearActivoFijoDto } from './dto/crear-activo-fijo.dto';
import { EditarActivoFijoDto } from './dto/editar-activo-fijo.dto';
import { CrearItemActivoDto } from './dto/crear-item.dto';

export interface UsuarioConPermisos {
    id: number;
    rol: string;
    id_inventario?: number | null;
    puedeEditarFijos?: boolean;
}

@Controller('activos')
@UseGuards(JwtAutenticacionGuardia, RolesGuardia, PertenenciaInventarioGuardia)
@Roles('administrador', 'encargado_inventario', 'docente', 'estudiante')
export class ActivoControlador {
    constructor(private readonly servicio: ActivoServicio) { }

    @Get('fijos')
    obtenerFijos(@Request() req: { user: UsuarioConPermisos }) {
        return this.servicio.obtenerTodosFijos(req.user);
    }

    @Get('fijos/inventario/:id')
    obtenerFijosPorInventario(
        @Request() req: { user: UsuarioConPermisos },
        @Param('id', ParseIntPipe) id: number,
    ) {
        return this.servicio.obtenerFijosPorInventario(id, req.user);
    }

    @Post('fijos')
    crearActivoFijo(
        @Request() req: { user: UsuarioConPermisos },
        @Body() dto: CrearActivoFijoDto,
    ) {
        return this.servicio.crearActivoFijo(dto, req.user);
    }

    @Put('fijos/:id')
    editarActivoFijo(
        @Request() req: { user: UsuarioConPermisos },
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: EditarActivoFijoDto,
    ) {
        return this.servicio.editarActivoFijo(id, dto, req.user);
    }

    @Delete('fijos/:id')
    eliminarActivoFijo(
        @Request() req: { user: UsuarioConPermisos },
        @Param('id', ParseIntPipe) id: number,
    ) {
        return this.servicio.eliminarActivoFijo(id, req.user);
    }

    @Get('contenedores')
    obtenerContenedores(@Request() req: { user: UsuarioConPermisos }) {
        return this.servicio.obtenerContenedores(req.user);
    }

    @Get('contenedores/inventario/:id')
    obtenerContenedoresPorInventario(
        @Param('id', ParseIntPipe) id: number,
    ) {
        return this.servicio.obtenerContenedoresPorInventario(id);
    }

    @Post('contenedores')
    crearContenedor(
        @Request() req: { user: UsuarioConPermisos },
        @Body() body: { nombre: string; ubicacion: string; idInventario?: number },
    ) {
        return this.servicio.crearContenedor(body, req.user);
    }

    @Put('contenedores/:id')
    editarContenedor(
        @Request() req: { user: UsuarioConPermisos },
        @Param('id', ParseIntPipe) id: number,
        @Body() body: Partial<{ nombre: string; ubicacion: string; idInventario: number }>,
    ) {
        return this.servicio.editarContenedor(id, body, req.user);
    }

    @Get('items')
    obtenerItems(@Request() req: { user: UsuarioConPermisos }) {
        return this.servicio.obtenerItems(req.user);
    }

    @Post('items')
    crearItem(
        @Request() req: { user: UsuarioConPermisos },
        @Body() dto: CrearItemActivoDto,
    ) {
        return this.servicio.crearItemActivo(dto, req.user);
    }

    @Put('items/:id')
    editarItem(
        @Request() req: { user: UsuarioConPermisos },
        @Param('id') id: string,
        @Body() body: any,
    ) {
        return this.servicio.editarItemActivo(id, body, req.user);
    }

    @Delete('items/:id')
    eliminarItem(
        @Request() req: { user: UsuarioConPermisos },
        @Param('id') id: string,
    ) {
        return this.servicio.eliminarItemActivo(id, req.user);
    }

    @Get('items/:id/transiciones-permitidas')
    obtenerTransiciones(
        @Request() req: { user: UsuarioConPermisos },
        @Param('id') id: string,
    ) {
        return this.servicio.obtenerTransicionesPermitidas(id, req.user);
    }

    @Get('fungibles')
    obtenerFungibles(@Request() req: { user: UsuarioConPermisos }) {
        return this.servicio.obtenerFungibles(req.user);
    }

    @Post('fungibles')
    crearActivoFungible(
        @Request() req: { user: UsuarioConPermisos },
        @Body() body: any,
    ) {
        return this.servicio.crearActivoFungible(body, req.user);
    }

    @Put('fungibles/:id')
    editarActivoFungible(
        @Request() req: { user: UsuarioConPermisos },
        @Param('id', ParseIntPipe) id: number,
        @Body() body: any,
    ) {
        return this.servicio.editarActivoFungible(id, body, req.user);
    }

    @Delete('fungibles/:id')
    eliminarActivoFungible(
        @Request() req: { user: UsuarioConPermisos },
        @Param('id', ParseIntPipe) id: number,
    ) {
        return this.servicio.eliminarActivoFungible(id, req.user);
    }

    @Post('fungibles/items')
    crearItemFungible(
        @Request() req: { user: UsuarioConPermisos },
        @Body() body: any,
    ) {
        return this.servicio.crearItemFungible(body, req.user);
    }

    @Put('fungibles/items/:id')
    editarItemFungible(
        @Request() req: { user: UsuarioConPermisos },
        @Param('id') id: string,
        @Body() body: any,
    ) {
        return this.servicio.editarItemFungible(id, body, req.user);
    }

    @Delete('fungibles/items/:id')
    eliminarItemFungible(
        @Request() req: { user: UsuarioConPermisos },
        @Param('id') id: string,
    ) {
        return this.servicio.eliminarItemFungible(id, req.user);
    }

    @Get('fungibles/:id/kardex')
    obtenerKardexFungible(
        @Param('id') id: string,
    ) {
        return {
            materialId: id,
            materialNombre: 'Fungible',
            movimientos: [],
        };
    }
}
