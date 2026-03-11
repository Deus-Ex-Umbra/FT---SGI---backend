import { Body, Controller, Get, Param, ParseIntPipe, Put } from '@nestjs/common';
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
}
