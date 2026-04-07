import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ActivoServicio } from './activo.servicio';

@Controller('activos')
export class ActivoControlador {
    constructor(private readonly servicio: ActivoServicio) { }

    @Get('fijos')
    obtenerFijos() {
        return this.servicio.obtenerTodosFijos();
    }

    @Post('fijos')
    crearActivoFijo(
        @Body() body: { nombre: string; idContenedor?: number; categoria?: string; descripcion?: string },
    ) {
        return this.servicio.crearActivoFijo(body);
    }

    @Put('fijos/:id')
    editarActivoFijo(
        @Param('id') id: string,
        @Body() body: Partial<{ nombre: string; categoria: string; descripcion: string }>,
    ) {
        return this.servicio.editarActivoFijo(Number(id), body);
    }

    @Delete('fijos/:id')
    eliminarActivoFijo(@Param('id') id: string) {
        return this.servicio.eliminarActivoFijo(Number(id));
    }

    @Get('contenedores')
    obtenerContenedores() {
        return this.servicio.obtenerContenedores();
    }

    @Post('contenedores')
    crearContenedor(@Body() body: { nombre: string; ubicacion: string }) {
        return this.servicio.crearContenedor(body);
    }

    @Put('contenedores/:id')
    editarContenedor(
        @Param('id') id: string,
        @Body() body: Partial<{ nombre: string; ubicacion: string }>,
    ) {
        return this.servicio.editarContenedor(Number(id), body);
    }

    @Post('items')
    crearItem(@Body() body: {
        idActivo: string | number;
        codigoInventario?: string;
        codigoUnico?: string;
        codigoSistema?: string;
        ubicacion?: string;
        ue?: string;
        descripcion?: string;
        fechaEntrega?: string | null;
        fechaRetiro?: string | null;
        estado?: string;
        estadoFisico?: string;
        observaciones?: string;
        precio?: number;
    }) {
        return this.servicio.crearItemActivo(body);
    }

    @Put('items/:id')
    editarItem(
        @Param('id') id: string,
        @Body() body: Partial<{
            codigoInventario: string;
            codigoUnico: string;
            codigoSistema: string;
            fechaEntrega: string | null;
            fechaRetiro: string | null;
            estado: string;
            estadoFisico: string;
            ubicacion: string;
            ue: string;
            descripcion: string;
            observaciones: string;
            precio: number;
            justificacion: string;
        }>,
    ) {
        return this.servicio.editarItemActivo(id, body);
    }

    @Delete('items/:id')
    eliminarItem(@Param('id') id: string) {
        return this.servicio.eliminarItemActivo(id);
    }

    @Get('items/:id/transiciones-permitidas')
    obtenerTransiciones(@Param('id') id: string) {
        return this.servicio.obtenerTransicionesPermitidas(id);
    }
}
