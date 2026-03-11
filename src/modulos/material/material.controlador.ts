import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
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

    @Get(':id/kardex')
    async obtenerKardexMaterial(
        @Param('id', ParseIntPipe) id: number,
    ) {
        return this.materialServicio.obtenerKardexMaterial(id);
    }
}
