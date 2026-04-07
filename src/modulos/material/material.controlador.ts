import { Body, Controller, Delete, Get, Param, ParseIntPipe, ParseUUIDPipe, Post, Put } from '@nestjs/common';
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
            idContenedor?: number;
            nombre: string;
            categoria?: string;
            descripcion?: string;
            unidad?: string;
            stockMinimoHabilitado?: boolean;
            stockMinimo?: number;
            tipoIdentificacion?: 'lote' | 'serie' | 'simple';
        },
    ) {
        return this.materialServicio.crearCaja(body);
    }

    @Post('lotes')
    async crearLote(
        @Body()
        body: {
            idMaterial: number;
            idContenedor: number;
            tipo: 'lote' | 'serie' | 'simple';
            lote?: string | null;
            serie?: string | null;
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
        @Body() body: Partial<{ nombre: string; categoria: string; descripcion: string; unidad: string; stockMinimoHabilitado: boolean; stockMinimo: number; tipoIdentificacion: 'lote' | 'serie' | 'simple' }>,
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
        @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
        @Body() body: Partial<{ tipo: 'lote' | 'serie' | 'simple'; lote: string | null; serie: string | null; fechaEntrega: string | null; fechaRetiro: string | null; cantidadDisponible: number; fechaCaducidad: string | null; precio: number }>,
    ) {
        return this.materialServicio.editarLote(id, body);
    }

    @Delete('lotes/:id')
    async eliminarLote(
        @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
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
