import { Injectable } from '@nestjs/common';
import { ActivoContenedorServicio } from './activo-contenedor.servicio';
import { ActivoFungibleServicio } from './activo-fungible.servicio';
import { ActivoFijoServicio } from './activo-fijo.servicio';
import { ContenedorActivo } from '@/modulos/contenedor/entidades/contenedor-activo.entidad';
import { ActivoFijo } from './entidades/activo-fijo.entidad';
import { ItemActivoFijo } from './entidades/item-activo-fijo.entidad';

type UsuarioAutenticado = {
    id: number;
    rol: string;
    id_inventario?: number | null;
};

@Injectable()
export class ActivoServicio {
    constructor(
        private readonly contenedorServicio: ActivoContenedorServicio,
        private readonly fungibleServicio: ActivoFungibleServicio,
        private readonly fijoServicio: ActivoFijoServicio,
    ) {}

    async obtenerContenedores(usuario: UsuarioAutenticado): Promise<ContenedorActivo[]> {
        return this.contenedorServicio.obtenerContenedores(usuario);
    }

    async obtenerContenedoresPorInventario(idInventario: number): Promise<ContenedorActivo[]> {
        return this.contenedorServicio.obtenerContenedoresPorInventario(idInventario);
    }

    async crearContenedor(
        datos: { nombre: string; ubicacion: string; idInventario?: number; visible?: boolean },
        usuario: UsuarioAutenticado,
    ): Promise<ContenedorActivo> {
        return this.contenedorServicio.crearContenedor(datos, usuario);
    }

    async editarContenedor(
        id: number,
        datos: Partial<{ nombre: string; ubicacion: string; idInventario: number; visible: boolean }>,
        usuario: UsuarioAutenticado,
    ): Promise<ContenedorActivo> {
        return this.contenedorServicio.editarContenedor(id, datos, usuario);
    }

    async obtenerTodosFijos(usuario: UsuarioAutenticado) {
        return this.fijoServicio.obtenerTodosFijos(usuario);
    }

    async obtenerFijosPorInventario(idInventario: number, usuario: UsuarioAutenticado) {
        return this.fijoServicio.obtenerFijosPorInventario(idInventario, usuario);
    }

    async obtenerItems(usuario: UsuarioAutenticado): Promise<ItemActivoFijo[]> {
        return this.fijoServicio.obtenerItems(usuario);
    }

    async crearActivoFijo(
        datos: {
            nombre: string;
            idContenedor?: number;
            idInventario?: number;
            categoria?: string;
            descripcion?: string;
        },
        usuario: UsuarioAutenticado,
    ): Promise<ActivoFijo> {
        return this.fijoServicio.crearActivoFijo(datos, usuario);
    }

    async crearItemActivo(datos: any, usuario: UsuarioAutenticado): Promise<ItemActivoFijo> {
        return this.fijoServicio.crearItemActivo(datos, usuario);
    }

    async editarActivoFijo(id: number, datos: any, usuario: UsuarioAutenticado): Promise<ActivoFijo> {
        return this.fijoServicio.editarActivoFijo(id, datos, usuario);
    }

    async editarItemActivo(id: string, datos: any, usuario: UsuarioAutenticado): Promise<ItemActivoFijo> {
        return this.fijoServicio.editarItemActivo(id, datos, usuario);
    }

    async eliminarActivoFijo(id: number, usuario: UsuarioAutenticado): Promise<void> {
        return this.fijoServicio.eliminarActivoFijo(id, usuario);
    }

    async eliminarItemActivo(id: string, usuario: UsuarioAutenticado): Promise<void> {
        return this.fijoServicio.eliminarItemActivo(id, usuario);
    }

    async obtenerTransicionesPermitidas(id: string, usuario: UsuarioAutenticado) {
        return this.fijoServicio.obtenerTransicionesPermitidas(id, usuario);
    }

    async obtenerFungibles(usuario: UsuarioAutenticado) {
        return this.fungibleServicio.obtenerFungibles(usuario);
    }

    async crearActivoFungible(dto: any, usuario: UsuarioAutenticado) {
        return this.fungibleServicio.crearActivoFungible(dto, usuario);
    }

    async editarActivoFungible(id: number, dto: any, usuario: UsuarioAutenticado) {
        return this.fungibleServicio.editarActivoFungible(id, dto, usuario);
    }

    async eliminarActivoFungible(id: number, usuario: UsuarioAutenticado): Promise<void> {
        return this.fungibleServicio.eliminarActivoFungible(id, usuario);
    }

    async crearItemFungible(dto: any, usuario: UsuarioAutenticado) {
        return this.fungibleServicio.crearItemFungible(dto, usuario);
    }

    async editarItemFungible(id: string, dto: any, usuario: UsuarioAutenticado) {
        return this.fungibleServicio.editarItemFungible(id, dto, usuario);
    }

    async eliminarItemFungible(id: string, usuario: UsuarioAutenticado): Promise<void> {
        return this.fungibleServicio.eliminarItemFungible(id, usuario);
    }
}
