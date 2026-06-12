import { Injectable } from '@nestjs/common';
import { EstudianteConsultaServicio, EstudiantePublico } from './estudiante-consulta.servicio';
import { EstudianteMutacionServicio } from './estudiante-mutacion.servicio';
import { CrearEstudianteDto } from './dto/crear-estudiante.dto';
import { EstudianteEntidad } from './entidades/estudiante.entidad';

@Injectable()
export class EstudianteServicio {
    constructor(
        private readonly consultaServicio: EstudianteConsultaServicio,
        private readonly mutacionServicio: EstudianteMutacionServicio,
    ) {}

    async listarEstudiantes(usuarioActual?: { id: number; rol: string }): Promise<EstudiantePublico[]> {
        return this.consultaServicio.listarEstudiantes(usuarioActual);
    }

    async crearEstudiante(dto: CrearEstudianteDto, aprobadoPorDefecto: boolean = true): Promise<EstudiantePublico> {
        return this.mutacionServicio.crearEstudiante(dto, aprobadoPorDefecto);
    }

    async buscarPorIdUsuario(usuarioId: number): Promise<EstudianteEntidad> {
        return this.consultaServicio.buscarPorIdUsuario(usuarioId);
    }

    async buscarPorIdentificador(identificador: string): Promise<EstudianteEntidad | null> {
        return this.consultaServicio.buscarPorIdentificador(identificador);
    }

    async editarEstudiante(
        id: number,
        dto: Partial<{
            correo: string;
            ci: string;
            nombre: string;
            apellido: string;
            fechaNacimiento: string | null;
            asignacionesCarrera: Array<{ carreraId: number | string; cu: string }>;
            carnetRetenido?: boolean;
            carnetRetenidoOverride?: boolean | null;
        }>,
    ): Promise<EstudiantePublico> {
        return this.mutacionServicio.editarEstudiante(id, dto);
    }

    async editarCarnetRetenido(
        id: number,
        datos: Partial<{
            carnetRetenido: boolean;
            carnetRetenidoOverride: boolean | null;
        }>,
    ): Promise<EstudianteEntidad> {
        return this.mutacionServicio.editarCarnetRetenido(id, datos);
    }

    async eliminarEstudiante(id: number): Promise<void> {
        return this.mutacionServicio.eliminarEstudiante(id);
    }

    async listarSolicitudesPendientes(usuarioActual: { id: number; rol: string }): Promise<EstudiantePublico[]> {
        return this.consultaServicio.listarSolicitudesPendientes(usuarioActual);
    }

    async aprobarEstudiante(id: number, usuarioActual: { id: number; rol: string }): Promise<void> {
        return this.mutacionServicio.aprobarEstudiante(id, usuarioActual);
    }

    async rechazarEstudiante(id: number, usuarioActual: { id: number; rol: string }): Promise<void> {
        return this.mutacionServicio.rechazarEstudiante(id, usuarioActual);
    }
}
