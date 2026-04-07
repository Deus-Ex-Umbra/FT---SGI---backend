import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ContenedorCompartidoServicio } from './contenedor.servicio';

@Controller('contenedores')
export class ContenedorCompartidoControlador {
    constructor(private readonly contenedorCompartidoServicio: ContenedorCompartidoServicio) {}

    @Get()
    async obtenerTodos() {
        return this.contenedorCompartidoServicio.obtenerTodos();
    }

    @Post()
    async crear(@Body() body: { nombre: string; descripcion: string }) {
        return this.contenedorCompartidoServicio.crear(body);
    }

    @Put(':id')
    async editar(
        @Param('id') _id: string,
        @Body() body: { idActivo?: number; idMaterial?: number; nombre: string; descripcion: string },
    ) {
        return this.contenedorCompartidoServicio.editar(body);
    }

    @Delete(':id')
    async eliminar(
        @Param('id') _id: string,
        @Body() body: { idActivo?: number; idMaterial?: number },
    ) {
        await this.contenedorCompartidoServicio.eliminar(body);
        return { ok: true };
    }
}