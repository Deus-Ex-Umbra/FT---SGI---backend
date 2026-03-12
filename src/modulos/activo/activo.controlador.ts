import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { ActivoServicio } from './activo.servicio';

@Controller('activos')
// @UseGuards(JwtAutenticacionGuardia) // Descomentar para asegurar
export class ActivoControlador {
    constructor(private readonly activoServicio: ActivoServicio) { }

    @Get('fijos')
    async obtenerTodosFijos() {
        return await this.activoServicio.obtenerTodosFijos();
    }

    @Get('items')
    async obtenerItems() {
        return await this.activoServicio.obtenerItems();
    }

    @Get('contenedores')
    async obtenerContenedores() {
        return this.activoServicio.obtenerContenedores();
    }

    @Post('contenedores')
    async crearContenedor(
        @Body() body: { nombre: string; ubicacion: string },
    ) {
        return this.activoServicio.crearContenedor(body);
    }

    @Post('fijos')
    async crearActivoFijo(
        @Body() body: { nombre: string; idContenedor?: number },
    ) {
        return this.activoServicio.crearActivoFijo(body);
    }

    @Put('contenedores/:id')
    async editarContenedor(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: Partial<{ nombre: string; ubicacion: string }>,
    ) {
        return this.activoServicio.editarContenedor(id, body);
    }

    @Post('items')
    async crearItemActivo(
        @Body()
        body: {
            idActivo: number;
            codigoInventario: string;
            fechaEntrega?: string | null;
            fechaRetiro?: string | null;
            estado?: string;
            observaciones?: string;
            precio?: number;
        },
    ) {
        return this.activoServicio.crearItemActivo(body);
    }

    @Get('items/:id/transiciones-permitidas')
    async obtenerTransicionesPermitidas(
        @Param('id', ParseIntPipe) id: number,
    ) {
        return this.activoServicio.obtenerTransicionesPermitidas(id);
    }

    @Put('fijos/:id')
    async editarActivoFijo(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: Partial<{ nombre: string }>,
    ) {
        return this.activoServicio.editarActivoFijo(id, body);
    }

    @Put('items/:id')
    async editarItemActivo(
        @Param('id', ParseIntPipe) id: number,
        @Body()
        body: Partial<{
            codigoInventario: string;
            fechaEntrega: string | null;
            fechaRetiro: string | null;
            estado: string;
            observaciones: string;
            precio: number;
            justificacion: string;
        }>,
    ) {
        return this.activoServicio.editarItemActivo(id, body);
    }

    @Delete('fijos/:id')
    async eliminarActivoFijo(@Param('id', ParseIntPipe) id: number) {
        await this.activoServicio.eliminarActivoFijo(id);
        return { ok: true };
    }
}
