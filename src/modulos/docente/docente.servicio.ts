import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocenteEntidad } from './entidades/docente.entidad';
import { UsuarioServicio } from '@/modulos/usuario/usuario.servicio';
import { CrearDocenteDto } from './dto/crear-docente.dto';

export interface DocentePublico {
    id: number;
    rol: 'docente';
    correo: string;
    ci: string;
    codigo: string;
    nombre: string;
    apellido: string;
    materiasAsignadas: string[];
    fechaNacimiento: string;
    carrerasIds?: number[];
}

@Injectable()
export class DocenteServicio {
    constructor(
        @InjectRepository(DocenteEntidad)
        private readonly repositorioDocente: Repository<DocenteEntidad>,
        private readonly usuarioServicio: UsuarioServicio,
    ) { }

    async listarDocentes(): Promise<DocentePublico[]> {
        const docentes = await this.repositorioDocente.find({
            where: { usuario: { rol: 'docente' } },
            relations: ['usuario', 'carreras'],
            order: { id: 'ASC' },
        });

        return docentes
            .filter((d) => d.usuario && d.ci && d.nombre && d.apellido)
            .map((d) => ({
                id: d.usuario!.id,
                rol: 'docente' as const,
                correo: d.usuario!.correo ?? '',
                ci: d.ci ?? '',
                codigo: d.codigo ?? '',
                nombre: d.nombre ?? '',
                apellido: d.apellido ?? '',
                materiasAsignadas: Array.isArray(d.materiasAsignadas)
                    ? d.materiasAsignadas.map((c) => String(c).trim().toUpperCase()).filter(Boolean)
                    : [],
                fechaNacimiento: d.fechaNacimiento ?? '',
                carrerasIds: (d.carreras ?? []).map((c) => c.id),
            }));
    }

    async crearDocente(dto: CrearDocenteDto): Promise<DocentePublico> {
        const correo = String(dto.correo ?? '').trim().toLowerCase();
        const ci = String(dto.ci ?? '').trim();
        const nombre = String(dto.nombre ?? '').trim();
        const apellido = String(dto.apellido ?? '').trim();
        const codigoRaw = String(dto.codigo ?? '').trim();
        const codigo = codigoRaw ? codigoRaw.toUpperCase() : null;
        const fechaNacimientoRaw = String(dto.fechaNacimiento ?? '').trim();
        const fechaNacimiento = fechaNacimientoRaw ? fechaNacimientoRaw : null;
        const { contrasena } = dto;

        if (!correo) throw new BadRequestException('El correo electrónico es obligatorio.');
        if (!ci) throw new BadRequestException('El CI del docente es obligatorio.');
        if (!nombre) throw new BadRequestException('El nombre del docente es obligatorio.');
        if (!apellido) throw new BadRequestException('El apellido del docente es obligatorio.');
        if (fechaNacimiento && !/^\d{4}-\d{2}-\d{2}$/.test(fechaNacimiento)) {
            throw new BadRequestException('La fecha de nacimiento debe tener formato YYYY-MM-DD.');
        }

        const existeCi = await this.repositorioDocente.findOne({ where: { ci } });
        if (existeCi) throw new ConflictException('Ya existe un docente con ese CI.');

        const existeCorreo = await this.usuarioServicio.buscarPorCorreo(correo);
        if (existeCorreo) throw new ConflictException('Ya existe un usuario con ese correo electrónico.');

        if (codigo) {
            const existeCodigo = await this.repositorioDocente.findOne({ where: { codigo } });
            if (existeCodigo) throw new ConflictException('Ya existe un docente con ese código.');
        }

        const usuario = await this.usuarioServicio.crearUsuarioBase({
            correo,
            contrasena: contrasena || this.usuarioServicio.construirContrasenaTemporalConFecha('docente', fechaNacimiento),
            rol: 'docente',
        });

        const docente = await this.repositorioDocente.save({
            usuario,
            ci,
            codigo,
            nombre,
            apellido,
            materiasAsignadas: [],
            fechaNacimiento,
            carreras: dto.carrerasIds ? dto.carrerasIds.map(id => ({ id } as any)) : [],
        });

        return {
            id: usuario.id,
            rol: 'docente',
            correo,
            ci,
            codigo: codigo ?? '',
            nombre,
            apellido,
            materiasAsignadas: [],
            fechaNacimiento: fechaNacimiento ?? '',
            carrerasIds: dto.carrerasIds ?? [],
        };
    }

    async buscarPorIdUsuario(usuarioId: number): Promise<DocenteEntidad> {
        const docente = await this.repositorioDocente.findOne({
            where: { usuario: { id: usuarioId } },
            relations: ['usuario'],
        });
        if (!docente) throw new NotFoundException('No se encontró el perfil de docente.');
        return docente;
    }

    async editarDocente(usuarioId: number, datos: Partial<{
        correo: string;
        ci: string;
        codigo: string;
        nombre: string;
        apellido: string;
        fechaNacimiento: string;
        carrerasIds: number[];
    }>): Promise<DocentePublico> {
        const docente = await this.repositorioDocente.findOne({
            where: { usuario: { id: usuarioId } },
            relations: ['usuario', 'carreras'],
        });
        if (!docente || !docente.usuario) throw new NotFoundException('No se encontró el docente.');

        if (datos.correo !== undefined) {
            const correo = String(datos.correo ?? '').trim().toLowerCase();
            if (!correo) throw new BadRequestException('El correo electrónico es obligatorio.');
            const existeOtro = await this.usuarioServicio.buscarPorCorreo(correo);
            if (existeOtro && existeOtro.id !== docente.usuario.id) {
                throw new ConflictException('Ya existe un usuario con ese correo electrónico.');
            }
            await this.usuarioServicio.actualizarCorreo(docente.usuario.id, correo);
            docente.usuario.correo = correo;
        }

        if (datos.ci !== undefined) {
            const ci = String(datos.ci ?? '').trim();
            if (!ci) throw new BadRequestException('El CI del docente es obligatorio.');
            const existeCi = await this.repositorioDocente.findOne({ where: { ci } });
            if (existeCi && existeCi.id !== docente.id) throw new ConflictException('Ya existe un docente con ese CI.');
            docente.ci = ci;
        }
        if (datos.codigo !== undefined) {
            const codigoRaw = String(datos.codigo ?? '').trim();
            const codigo = codigoRaw ? codigoRaw.toUpperCase() : null;
            if (codigo) {
                const existeCodigo = await this.repositorioDocente.findOne({ where: { codigo } });
                if (existeCodigo && existeCodigo.id !== docente.id) throw new ConflictException('Ya existe un docente con ese código.');
            }
            docente.codigo = codigo;
        }
        if (datos.nombre !== undefined) {
            const nombre = String(datos.nombre ?? '').trim();
            if (!nombre) throw new BadRequestException('El nombre del docente es obligatorio.');
            docente.nombre = nombre;
        }
        if (datos.apellido !== undefined) {
            const apellido = String(datos.apellido ?? '').trim();
            if (!apellido) throw new BadRequestException('El apellido del docente es obligatorio.');
            docente.apellido = apellido;
        }
        if (datos.fechaNacimiento !== undefined) {
            const fechaNacimientoRaw = String(datos.fechaNacimiento ?? '').trim();
            const fechaNacimiento = fechaNacimientoRaw ? fechaNacimientoRaw : null;
            if (fechaNacimiento && !/^\d{4}-\d{2}-\d{2}$/.test(fechaNacimiento)) {
                throw new BadRequestException('La fecha de nacimiento debe tener formato YYYY-MM-DD.');
            }
            docente.fechaNacimiento = fechaNacimiento;
        }

        if (datos.carrerasIds !== undefined) {
            docente.carreras = datos.carrerasIds.map(id => ({ id } as any));
        }

        const guardado = await this.repositorioDocente.save(docente);

        return {
            id: docente.usuario.id,
            rol: 'docente',
            correo: docente.usuario.correo ?? '',
            ci: guardado.ci ?? '',
            codigo: guardado.codigo ?? '',
            nombre: guardado.nombre ?? '',
            apellido: guardado.apellido ?? '',
            materiasAsignadas: Array.isArray(guardado.materiasAsignadas) ? guardado.materiasAsignadas : [],
            fechaNacimiento: guardado.fechaNacimiento ?? '',
            carrerasIds: (guardado.carreras ?? []).map(c => c.id),
        };
    }

    async eliminarDocente(usuarioId: number): Promise<void> {
        const docente = await this.repositorioDocente.findOne({
            where: { usuario: { id: usuarioId } },
            relations: ['usuario'],
        });
        if (!docente) throw new NotFoundException('No se encontró el docente.');
        await this.repositorioDocente.remove(docente);
    }
}
