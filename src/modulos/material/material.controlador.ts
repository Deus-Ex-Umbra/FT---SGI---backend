import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { MaterialServicio } from './material.servicio';

@Controller('materiales')
export class MaterialControlador {
    constructor(private readonly materialServicio: MaterialServicio) { }

    @Get('contenedores')
    async obtenerContenedores() {
        return await this.materialServicio.obtenerContenedores();
    }

    @Get('cajas')
    async obtenerCajas() {
        // Materiales fungibles son referidos como "cajas" por reglas de negocio
        return await this.materialServicio.obtenerCajas();
    }

    @Get('lotes')
    async obtenerLotes() {
        return await this.materialServicio.obtenerLotes();
    }

    @Post('contenedores')
    async crearContenedor(
        @Body() body: { nombre: string; ubicacion: string },
    ) {
        return this.materialServicio.crearContenedor(body);
    }

    @Post('cajas')
    async crearCaja(
        @Body()
        body: {
            idContenedor: number;
            nombre: string;
            categoria?: string;
            descripcion?: string;
            unidad?: string;
            stockMinimo?: number;
        },
    ) {
        return this.materialServicio.crearCaja(body);
    }

    @Post('lotes')
    async crearLote(
        @Body()
        body: {
            idMaterial: number;
            lote: string;
            fechaEntrega?: string | null;
            fechaRetiro?: string | null;
            cantidadDisponible?: number;
            fechaCaducidad?: string | null;
            precio?: number;
        },
    ) {
        return this.materialServicio.crearLote(body);
    }

    @Put('contenedores/:id')
    async editarContenedor(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: Partial<{ nombre: string; ubicacion: string }>,
    ) {
        return this.materialServicio.editarContenedor(id, body);
    }

    @Delete('contenedores/:id')
    async eliminarContenedor(
        @Param('id', ParseIntPipe) id: number,
    ) {
        await this.materialServicio.eliminarContenedor(id);
        return { ok: true };
    }

    @Put('cajas/:id')
    async editarCaja(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: Partial<{ nombre: string; categoria: string; descripcion: string; unidad: string; stockMinimo: number }>,
    ) {
        return this.materialServicio.editarCaja(id, body);
    }

    @Delete('cajas/:id')
    async eliminarCaja(
        @Param('id', ParseIntPipe) id: number,
    ) {
        await this.materialServicio.eliminarCaja(id);
        return { ok: true };
    }

    @Put('lotes/:id')
    async editarLote(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: Partial<{ lote: string; fechaEntrega: string | null; fechaRetiro: string | null; cantidadDisponible: number; fechaCaducidad: string | null; precio: number }>,
    ) {
        return this.materialServicio.editarLote(id, body);
    }

    @Delete('lotes/:id')
    async eliminarLote(
        @Param('id', ParseIntPipe) id: number,
    ) {
        await this.materialServicio.eliminarLote(id);
        return { ok: true };
    }

    @Get(':id/kardex')
    async obtenerKardexMaterial(
        @Param('id', ParseIntPipe) id: number,
    ) {
        return this.materialServicio.obtenerKardexMaterial(id);
    }
}
