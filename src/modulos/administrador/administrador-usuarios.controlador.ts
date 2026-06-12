import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, UseGuards, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { JwtAutenticacionGuardia } from '@/modulos/autenticacion/guardias/jwt-autenticacion.guardia';
import { Roles } from '@/modulos/autenticacion/guardias/roles.decorador';
import { RolesGuardia } from '@/modulos/autenticacion/guardias/roles.guardia';
import { UsuarioServicio } from '@/modulos/usuario/usuario.servicio';
import { DocenteServicio } from '@/modulos/docente/docente.servicio';
import { EstudianteServicio } from '@/modulos/estudiante/estudiante.servicio';
import { EncargadoInventarioServicio } from '@/modulos/encargado-inventario/encargado-inventario.servicio';
import { CrearDocenteDto } from '@/modulos/docente/dto/crear-docente.dto';
import { EditarDocenteDto } from '@/modulos/docente/dto/editar-docente.dto';
import { CrearEstudianteDto } from '@/modulos/estudiante/dto/crear-estudiante.dto';
import { EditarEstudianteDto } from '@/modulos/estudiante/dto/editar-estudiante.dto';
import { CrearEncargadoDto } from '@/modulos/encargado-inventario/dto/crear-encargado.dto';
import { PrestamoServicio } from '@/modulos/prestamo/prestamo.servicio';

@Controller('administrador/usuarios')
@UseGuards(JwtAutenticacionGuardia, RolesGuardia)
@Roles('administrador')
export class AdministradorUsuariosControlador {
    constructor(
        private readonly usuarioServicio: UsuarioServicio,
        private readonly docenteServicio: DocenteServicio,
        private readonly estudianteServicio: EstudianteServicio,
        private readonly encargadoServicio: EncargadoInventarioServicio,
        private readonly prestamoServicio: PrestamoServicio,
    ) {}

    @Get()
    async listarUsuarios() {
        const [usuarios, encargados, docentes, estudiantes] = await Promise.all([
            this.usuarioServicio.listarUsuarios(),
            this.encargadoServicio.listarEncargados(),
            this.docenteServicio.listarDocentes(),
            this.estudianteServicio.listarEstudiantes(),
        ]);

        const mapaEncargados = new Map(encargados.map(e => [e.id, e]));
        const mapaDocentes = new Map(docentes.map(d => [d.id, d]));
        const mapaEstudiantes = new Map(estudiantes.map(e => [e.correo.toLowerCase(), e]));

        return usuarios.map(usuario => {
            const correo = usuario.correo ?? '';
            const base = {
                id: usuario.id,
                correo: correo,
                rol: usuario.rol,
                estado: usuario.estado,
            };

            if (usuario.rol === 'encargado_inventario') {
                const perfil = mapaEncargados.get(usuario.id);
                return {
                    ...base,
                    nombre: perfil?.nombre ?? null,
                    apellido: perfil?.apellido ?? null,
                    id_inventario: perfil?.id_inventario ?? null,
                    puedeEditarFijos: perfil?.puedeEditarFijos ?? false,
                    puedeEditarFungibles: perfil?.puedeEditarFungibles ?? false,
                    inventario: perfil?.inventario ?? null,
                };
            }

            if (usuario.rol === 'docente') {
                const perfil = mapaDocentes.get(usuario.id);
                return {
                    ...base,
                    ...(perfil || {}),
                    id: usuario.id,
                };
            }

            if (usuario.rol === 'estudiante') {
                const perfil = mapaEstudiantes.get(correo.toLowerCase());
                return {
                    ...base,
                    ...(perfil || {}),
                    id: usuario.id,
                };
            }

            return base;
        });
    }



    @Post('encargados')
    async crearEncargado(@Body() dto: CrearEncargadoDto) {
        return this.encargadoServicio.crearEncargado(dto);
    }

    @Put(':id/inventario')
    async asignarInventario(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { idInventario?: number | null },
    ) {
        return this.encargadoServicio.asignarInventario(id, body.idInventario ?? null);
    }

    @Post(':id/restablecer-contrasena')
    async restablecerContrasena(@Param('id', ParseIntPipe) id: number) {
        return this.usuarioServicio.restablecerContrasenaUsuario(id);
    }

    @Put(':id/estado')
    async cambiarEstado(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { estado: boolean },
    ) {
        return this.usuarioServicio.cambiarEstadoUsuario(id, body.estado);
    }

    @Put(':id')
    async editarUsuario(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: any,
    ) {
        const usuario = await this.usuarioServicio.buscarPorId(id);
        if (!usuario) {
            throw new NotFoundException('Usuario no encontrado.');
        }

        if (usuario.rol === 'administrador') {
            const correo = String(body.correo ?? '').trim().toLowerCase();
            if (!correo) {
                throw new BadRequestException('El correo electrónico es obligatorio.');
            }
            const existe = await this.usuarioServicio.buscarPorCorreo(correo);
            if (existe && existe.id !== id) {
                throw new ConflictException('Ya existe un usuario con ese correo electrónico.');
            }
            await this.usuarioServicio.actualizarCorreo(id, correo);
            return {
                id,
                correo,
                rol: usuario.rol,
                estado: usuario.estado,
            };
        }

        if (usuario.rol === 'encargado_inventario') {
            return this.encargadoServicio.editarEncargado(id, body);
        }

        if (usuario.rol === 'docente') {
            return this.docenteServicio.editarDocente(id, body);
        }

        if (usuario.rol === 'estudiante') {
            const estudiante = await this.estudianteServicio.buscarPorIdUsuario(id);
            return this.estudianteServicio.editarEstudiante(estudiante.id, body);
        }

        throw new BadRequestException('Rol no soportado.');
    }
}
