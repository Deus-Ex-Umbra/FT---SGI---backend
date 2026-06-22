import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';
import * as bcrypt from 'bcrypt';

import { ActivoFijo } from './modulos/activo/entidades/activo-fijo.entidad';
import { ItemActivoFijo } from './modulos/activo/entidades/item-activo-fijo.entidad';
import { EstudianteEntidad } from '@/modulos/estudiante/entidades/estudiante.entidad';
import { DocenteEntidad } from '@/modulos/docente/entidades/docente.entidad';
import { Usuario } from './modulos/usuario/entidades/usuario.entidad';
import { InventarioEntidad } from './modulos/inventario/entidades/inventario.entidad';
import { CarreraEntidad } from './modulos/prestamo/entidades/carrera.entidad';
import { MateriaEntidad } from './modulos/prestamo/entidades/materia.entidad';
import { ActivoFungible, TipoCantidadFungible, TipoIdentificacionFungible } from './modulos/activo/entidades/activo-fungible.entidad';
import { ItemActivoFungible } from './modulos/activo/entidades/item-activo-fungible.entidad';
import { CuEntidad } from '@/modulos/estudiante/entidades/cu.entidad';
import { ContenedorActivo } from '@/modulos/contenedor/entidades/contenedor-activo.entidad';
import { EncargadoInventarioEntidad } from './modulos/encargado-inventario/entidades/encargado-inventario.entidad';
import { GrupoMateriaDocenteEntidad } from './modulos/docencia/entidades/grupo-materia-docente.entidad';

@Injectable()
export class SeedActivosServicio {
    private readonly logger = new Logger(SeedActivosServicio.name);

    constructor(
        @InjectRepository(ActivoFijo)
        public readonly activosRepo: Repository<ActivoFijo>,
        @InjectRepository(ItemActivoFijo)
        public readonly itemsRepo: Repository<ItemActivoFijo>,
        @InjectRepository(EstudianteEntidad)
        public readonly estudiantesRepo: Repository<EstudianteEntidad>,
        @InjectRepository(Usuario)
        public readonly usuariosRepo: Repository<Usuario>,
        @InjectRepository(DocenteEntidad)
        public readonly docentesRepo: Repository<DocenteEntidad>,
        @InjectRepository(InventarioEntidad)
        public readonly inventariosRepo: Repository<InventarioEntidad>,
        @InjectRepository(CarreraEntidad)
        public readonly carrerasRepo: Repository<CarreraEntidad>,
        @InjectRepository(MateriaEntidad)
        public readonly materiasRepo: Repository<MateriaEntidad>,
        @InjectRepository(ActivoFungible)
        public readonly activosFungiblesRepo: Repository<ActivoFungible>,
        @InjectRepository(ItemActivoFungible)
        public readonly itemsFungiblesRepo: Repository<ItemActivoFungible>,
        @InjectRepository(CuEntidad)
        public readonly cuRepo: Repository<CuEntidad>,
        @InjectRepository(ContenedorActivo)
        public readonly contenedoresRepo: Repository<ContenedorActivo>,
        @InjectRepository(EncargadoInventarioEntidad)
        public readonly encargadosRepo: Repository<EncargadoInventarioEntidad>,
        @InjectRepository(GrupoMateriaDocenteEntidad)
        public readonly gruposRepo: Repository<GrupoMateriaDocenteEntidad>,
    ) {}

    private normalizarNombreActivo(nombreBase: string) {
        const limpio = String(nombreBase ?? '').trim().replace(/\s+/g, ' ');
        const MAX = 100;
        if (limpio.length <= MAX) {
            return { nombre: limpio, descripcion: null as string | null };
        }
        const target = MAX - 1;
        const slice = limpio.slice(0, target);
        const lastPunct = Math.max(slice.lastIndexOf('.'), slice.lastIndexOf(';'), slice.lastIndexOf(','));
        const lastSpace = slice.lastIndexOf(' ');
        let cut = Math.max(lastPunct, lastSpace);
        if (cut < 30) cut = target;
        const nombre = `${slice.slice(0, cut).trimEnd()}…`;
        return { nombre, descripcion: limpio };
    }

    private clasificarContenedor(nombre: string, descripcion: string, carpeta: string): string {
        const n = String(nombre).toLowerCase();
        const d = String(descripcion).toLowerCase();

        if (carpeta === 'gabinete-topografico') {
            if (n.includes('dron') || d.includes('dron') || n.includes('drone') || d.includes('drone')) {
                return 'Drones';
            }
            if (
                n.includes('gnss') || d.includes('gnss') ||
                n.includes('receptor') || d.includes('receptor') ||
                n.includes('trimble') || d.includes('trimble') ||
                n.includes('ntrip') || d.includes('ntrip') ||
                n.includes('satlab') || d.includes('satlab')
            ) {
                return 'GNSS';
            }
            if (
                n.includes('gps') || d.includes('gps') ||
                n.includes('gns') || d.includes('gns') ||
                n.includes('magellan') || d.includes('magellan') ||
                n.includes('garmin') || d.includes('garmin')
            ) {
                return 'GPS';
            }
            if (
                n.includes('estacion total') || d.includes('estacion total') ||
                n.includes('estación total') || d.includes('estación total') ||
                n.includes('teodolito') || d.includes('teodolito') ||
                n.includes('taquimetro') || d.includes('taquimetro') ||
                n.includes('taquímetro') || d.includes('taquímetro') ||
                n.includes('leica') || d.includes('leica') ||
                n.includes('geomax') || d.includes('geomax')
            ) {
                return 'Estaciones Totales';
            }
            if (n.includes('nivel') || d.includes('nivel')) {
                return 'Niveles';
            }
            if (
                n.includes('brujula') || d.includes('brujula') ||
                n.includes('brújula') || d.includes('brújula')
            ) {
                return 'Brújulas';
            }
            if (
                n.includes('eclimetro') || d.includes('eclimetro') ||
                n.includes('eclímetro') || d.includes('eclímetro') ||
                n.includes('abney') || d.includes('abney') ||
                n.includes('clinometer') || d.includes('clinometer')
            ) {
                return 'Eclímetros';
            }
            if (n.includes('estereoscopio') || d.includes('estereoscopio')) {
                return 'Estereoscopios';
            }
            if (
                n.includes('altimetro') || d.includes('altimetro') ||
                n.includes('altímetro') || d.includes('altímetro') ||
                n.includes('konus') || d.includes('konus')
            ) {
                return 'Altímetros';
            }
            if (
                n.includes('scaner') || d.includes('scaner') ||
                n.includes('scanner') || d.includes('scanner') ||
                n.includes('genius') || d.includes('genius')
            ) {
                return 'Escáner';
            }
            if (n.includes('mira') || d.includes('mira')) {
                return 'Miras';
            }
            if (n.includes('tripode') || d.includes('trípode')) {
                return 'Trípodes';
            }
            if (n.includes('prisma') || d.includes('prisma')) {
                return 'Prismas';
            }
            if (
                n.includes('jalon') || d.includes('jalón') ||
                n.includes('baston') || d.includes('bastón')
            ) {
                return 'Jalones';
            }
            if (n.includes('distanciometro') || d.includes('distanciómetro')) {
                return 'Distanciómetros';
            }
            if (
                n.includes('computadora') || d.includes('computadora') ||
                n.includes('portatil') || d.includes('portatil') ||
                n.includes('portátil') || d.includes('portátil') ||
                n.includes('tablet') || d.includes('tablet') ||
                n.includes('ipad') || d.includes('ipad') ||
                n.includes('apple') || d.includes('apple') ||
                n.includes('ploter') || d.includes('ploter') ||
                n.includes('designjet') || d.includes('designjet') ||
                n.includes('monitor') || d.includes('monitor') ||
                n.includes('cpu') || d.includes('cpu') ||
                n.includes('impresora') || d.includes('impresora') ||
                n.includes('epson') || d.includes('epson') ||
                n.includes('estabilizador') || d.includes('estabilizador') ||
                n.includes('bosch') || d.includes('bosch')
            ) {
                return 'Equipos de Computación';
            }
            return 'Otros';
        } else {
            if (
                n.includes('taladro') || d.includes('taladro') ||
                n.includes('amoladora') || d.includes('amoladora') ||
                n.includes('amolador') || d.includes('amolador') ||
                n.includes('esmeril') || d.includes('esmeril') ||
                n.includes('soldar') || d.includes('soldar') ||
                n.includes('soldadora') || d.includes('soldadora') ||
                n.includes('compresor') || d.includes('compresor') ||
                n.includes('aeg') || d.includes('aeg') ||
                n.includes('dewalt') || d.includes('dewalt')
            ) {
                return 'Herramientas Eléctricas';
            }
            if (
                n.includes('scaner') || d.includes('scaner') ||
                n.includes('scanner') || d.includes('scanner') ||
                n.includes('autel') || d.includes('autel') ||
                n.includes('ultrasonido') || d.includes('ultrasonido') ||
                n.includes('mastercant') || d.includes('mastercant') ||
                n.includes('lampara') || d.includes('lampara') ||
                n.includes('lámpara') || d.includes('lámpara') ||
                n.includes('snap-on') || d.includes('snap-on') ||
                n.includes('blue point') || d.includes('blue point') ||
                n.includes('multimetro') || d.includes('multimetro') ||
                n.includes('multímetro') || d.includes('multímetro') ||
                n.includes('osciloscopio') || d.includes('osciloscopio') ||
                n.includes('calibrador') || d.includes('calibrador') ||
                n.includes('micrometro') || d.includes('micrometro') ||
                n.includes('micrómetro') || d.includes('micrómetro')
            ) {
                return 'Equipos de Diagnóstico y Medición';
            }
            if (
                n.includes('oxiacetileno') || d.includes('oxiacetileno') ||
                n.includes('victor') || d.includes('victor') ||
                n.includes('gata') || d.includes('gata') ||
                n.includes('truper') || d.includes('truper') ||
                n.includes('garrafa') || d.includes('garrafa') ||
                n.includes('glp') || d.includes('glp') ||
                n.includes('prensa') || d.includes('prensa') ||
                n.includes('pluma') || d.includes('pluma') ||
                n.includes('tecle') || d.includes('tecle') ||
                n.includes('cilindro') || d.includes('cilindro')
            ) {
                return 'Equipos Pesados y Gas';
            }
            if (
                n.includes('mascara') || d.includes('mascara') ||
                n.includes('máscara') || d.includes('máscara') ||
                n.includes('artoch') || d.includes('artoch') ||
                n.includes('lente') || d.includes('lente') ||
                n.includes('guante') || d.includes('guante') ||
                n.includes('casco') || d.includes('casco') ||
                n.includes('extintor') || d.includes('extintor')
            ) {
                return 'Equipos de Seguridad';
            }
            if (
                n.includes('computadora') || d.includes('computadora') ||
                n.includes('portatil') || d.includes('portatil') ||
                n.includes('portátil') || d.includes('portátil') ||
                n.includes('monitor') || d.includes('monitor') ||
                n.includes('cpu') || d.includes('cpu') ||
                n.includes('impresora') || d.includes('impresora') ||
                n.includes('teclado') || d.includes('teclado') ||
                n.includes('mouse') || d.includes('mouse') ||
                n.includes('lg') || d.includes('lg') ||
                n.includes('delux') || d.includes('delux')
            ) {
                return 'Equipos de Computación';
            }
            return 'Otros';
        }
    }

    private cargarJson<T>(subPath: string): T {
        const baseDir = __dirname;
        const fullPath = path.join(baseDir, 'seed', subPath);
        if (!fs.existsSync(fullPath)) {
            throw new Error(`No se encontró el archivo de seed: ${fullPath}`);
        }
        const raw = fs.readFileSync(fullPath, 'utf8');
        return JSON.parse(raw) as T;
    }

    private normalizarCodigoUnico(valor: unknown): string | null {
        if (!valor) return null;
        const v = String(valor).trim().replace(/\s+/g, ' ');
        if (!v) return null;
        const canon = v.toLowerCase();
        if (
            canon === 'no especificado' ||
            canon === 'no especificada' ||
            canon === 's/n' ||
            canon === 'sn' ||
            canon === 'n/a' ||
            canon === 'na'
        ) {
            return null;
        }
        return v;
    }

    private extraerCodigoSistema(desc: string): string | null {
        if (!desc) return null;
        const regex = /\b([0-9]{3,4}[a-zA-Z]?\s*-\s*[0-9a-zA-Z]{3,4}\s*-\s*[0-9a-zA-Z]{2,4}\s*-\s*[0-9a-zA-Z]{4}\s*-\s*[0-9a-zA-Z]{3,4})\b/i;
        const match = regex.exec(desc);
        if (match) {
            return match[1].trim().replace(/\s+/g, ' ');
        }
        return null;
    }

    private normalizarEstadoFisico(estado: string | undefined, desc: string): 'bueno' | 'regular' | 'malo' {
        const estLimpio = String(estado ?? '').toLowerCase().trim();
        if (estLimpio.includes('malo')) return 'malo';
        if (estLimpio.includes('regular')) return 'regular';
        if (estLimpio.includes('bueno')) return 'bueno';

        const m = /estado\s*:\s*([a-záéíóúñ]+)/i.exec(desc);
        if (!m) return 'bueno';
        const raw = m[1].toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
        if (raw.includes('malo')) return 'malo';
        if (raw.includes('regular')) return 'regular';
        return 'bueno';
    }

    private extraerUe(desc: string, defaultUe: string): string {
        const m = /u\.?\s*e\.?\s*:\s*([a-z0-9_-]{2,20})/i.exec(desc);
        if (!m) return defaultUe || 'POL';
        return String(m[1]).trim().toUpperCase();
    }

    async seedActivosFijos() {
        this.logger.log('Iniciando carga de seeders estructurados...');
        const seenSistemas = new Set<string>();

        this.logger.log('Seeding Carreras...');
        const carrerasData = this.cargarJson<Array<{ nombre: string; prefijoCu: string }>>('carreras/carreras.json');
        
        const existingCarreras = await this.carrerasRepo.find();
        const existingCarrerasMap = new Map<string, CarreraEntidad>(existingCarreras.map(c => [c.nombre, c]));
        const carrerasMap = new Map<string, CarreraEntidad>();
        const carrerasToSave: CarreraEntidad[] = [];

        for (const c of carrerasData) {
            let carrera = existingCarrerasMap.get(c.nombre);
            if (!carrera) {
                carrera = this.carrerasRepo.create({ nombre: c.nombre, prefijoCu: c.prefijoCu });
                carrerasToSave.push(carrera);
            } else if (carrera.prefijoCu !== c.prefijoCu) {
                carrera.prefijoCu = c.prefijoCu;
                carrerasToSave.push(carrera);
            }
            carrerasMap.set(c.nombre, carrera);
        }
        if (carrerasToSave.length > 0) {
            const savedCarreras = await this.carrerasRepo.save(carrerasToSave, { chunk: 100 });
            for (const sc of savedCarreras) {
                carrerasMap.set(sc.nombre, sc);
            }
        }

        this.logger.log('Seeding Materias...');
        const materiasData = this.cargarJson<Array<{ codigo: string; nombre: string; descripcion: string; carrerasNames: string[] }>>('materias/materias.json');
        
        const existingMaterias = await this.materiasRepo.find();
        const existingMateriasMap = new Map<string, MateriaEntidad>(existingMaterias.map(m => [m.codigo, m]));
        const materiasMap = new Map<string, MateriaEntidad>();
        const materiasToSave: MateriaEntidad[] = [];

        for (const m of materiasData) {
            const carrerasHabilitadasIds = m.carrerasNames
                .map((name) => carrerasMap.get(name)?.id)
                .filter(Boolean)
                .map((id) => String(id));

            let materia = existingMateriasMap.get(m.codigo);
            if (!materia) {
                materia = this.materiasRepo.create({
                    codigo: m.codigo,
                    nombre: m.nombre,
                    descripcion: m.descripcion,
                    carrerasHabilitadasIds,
                });
                materiasToSave.push(materia);
            } else {
                let changed = false;
                if (materia.nombre !== m.nombre) { changed = true; materia.nombre = m.nombre; }
                if (materia.descripcion !== m.descripcion) { changed = true; materia.descripcion = m.descripcion; }
                if (JSON.stringify(materia.carrerasHabilitadasIds) !== JSON.stringify(carrerasHabilitadasIds)) {
                    changed = true;
                    materia.carrerasHabilitadasIds = carrerasHabilitadasIds;
                }
                if (changed) {
                    materiasToSave.push(materia);
                }
            }
            materiasMap.set(m.codigo, materia);
        }
        if (materiasToSave.length > 0) {
            const savedMaterias = await this.materiasRepo.save(materiasToSave, { chunk: 100 });
            for (const sm of savedMaterias) {
                materiasMap.set(sm.codigo, sm);
            }
        }

        this.logger.log('Seeding Docentes...');
        const docentesData = this.cargarJson<Array<{ codigo: string; carnet: string; nombre: string; apellido: string; materia: string; materiasCodigos: string[]; correo: string }>>('docentes/docentes.json');
        
        const existingDocentes = await this.docentesRepo.find({ relations: ['usuario', 'carreras'] });
        const existingDocentesMap = new Map<string, DocenteEntidad>(existingDocentes.filter(d => d.codigo).map(d => [d.codigo!, d]));
        
        const existingUsuarios = await this.usuariosRepo.find();
        const existingUsuariosMap = new Map<string, Usuario>(existingUsuarios.filter(u => u.correo).map(u => [u.correo!.toLowerCase(), u]));

        const docentesToSave: DocenteEntidad[] = [];
        const usuariosDocentesToSave: Usuario[] = [];

        const contrasenaDocenteHash = await bcrypt.hash('docente123', 10);

        const nuevosUsuariosDocentes: Usuario[] = [];
        for (const d of docentesData) {
            const emailClean = d.correo.trim().toLowerCase();
            let usuario = existingUsuariosMap.get(emailClean);
            if (!usuario) {
                usuario = this.usuariosRepo.create({
                    correo: emailClean,
                    contrasena: contrasenaDocenteHash,
                    rol: 'docente',
                });
                nuevosUsuariosDocentes.push(usuario);
            }
        }
        if (nuevosUsuariosDocentes.length > 0) {
            const savedUsers = await this.usuariosRepo.save(nuevosUsuariosDocentes, { chunk: 100 });
            for (const su of savedUsers) {
                existingUsuariosMap.set(su.correo!.toLowerCase(), su);
            }
        }

        for (const d of docentesData) {
            let docente = existingDocentesMap.get(d.codigo);
            const nombreCompleto = `${d.nombre} ${d.apellido}`.trim();
            const emailClean = d.correo.trim().toLowerCase();

            const materiasCodigos = d.materiasCodigos || [];
            const carrerasIdsSet = new Set<string>();
            for (const cod of materiasCodigos) {
                const matEnt = materiasMap.get(cod);
                if (matEnt?.carrerasHabilitadasIds) {
                    for (const cid of matEnt.carrerasHabilitadasIds) {
                        carrerasIdsSet.add(cid);
                    }
                }
            }

            const carrerasDocente: CarreraEntidad[] = [];
            for (const cid of carrerasIdsSet) {
                const idNum = Number(cid);
                const carrera = Array.from(carrerasMap.values()).find((c) => c.id === idNum);
                if (carrera) {
                    carrerasDocente.push(carrera);
                }
            }

            if (!docente) {
                const usuario = existingUsuariosMap.get(emailClean)!;
                docente = this.docentesRepo.create({
                    usuario,
                    codigo: d.codigo,
                    nombre: nombreCompleto,
                    apellido: d.apellido,
                    materia: d.materia,
                    materiasAsignadas: d.materiasCodigos,
                    ci: d.carnet,
                    carreras: carrerasDocente,
                });
                docentesToSave.push(docente);
            } else {
                let changedDocente = false;
                if (docente.nombre !== nombreCompleto) { changedDocente = true; docente.nombre = nombreCompleto; }
                if (docente.apellido !== d.apellido) { changedDocente = true; docente.apellido = d.apellido; }
                if (docente.materia !== d.materia) { changedDocente = true; docente.materia = d.materia; }
                if (JSON.stringify(docente.materiasAsignadas) !== JSON.stringify(d.materiasCodigos)) {
                    changedDocente = true;
                    docente.materiasAsignadas = d.materiasCodigos;
                }
                if (docente.ci !== d.carnet) { changedDocente = true; docente.ci = d.carnet; }
                
                const existingCarrerasIds = (docente.carreras ?? []).map(c => c.id).sort();
                const newCarrerasIds = carrerasDocente.map(c => c.id).sort();
                if (JSON.stringify(existingCarrerasIds) !== JSON.stringify(newCarrerasIds)) {
                    changedDocente = true;
                    docente.carreras = carrerasDocente;
                }

                if (docente.usuario) {
                    if (docente.usuario.correo !== emailClean) {
                        docente.usuario.correo = emailClean;
                        usuariosDocentesToSave.push(docente.usuario);
                    }
                }
                if (changedDocente) {
                    docentesToSave.push(docente);
                }
            }
        }

        if (usuariosDocentesToSave.length > 0) {
            await this.usuariosRepo.save(usuariosDocentesToSave, { chunk: 100 });
        }
        if (docentesToSave.length > 0) {
            await this.docentesRepo.save(docentesToSave, { chunk: 100 });
        }

        this.logger.log('Seeding Estudiantes...');
        let estudiantesData = this.cargarJson<Array<{ carnet: string; cu: string; nombre: string; apellido: string; carrera: string; semestre: number; correo?: string }>>('estudiantes/estudiantes.json');
        try {
            const pathFalsos = path.join(__dirname, 'seed', 'estudiantes/estudiantes_falsos.json');
            if (fs.existsSync(pathFalsos)) {
                const estudiantesFalsos = this.cargarJson<Array<{ carnet: string; cu: string; nombre: string; apellido: string; carrera: string; semestre: number; correo?: string }>>('estudiantes/estudiantes_falsos.json');
                estudiantesData = estudiantesData.concat(estudiantesFalsos);
                this.logger.log(`Se cargaron ${estudiantesFalsos.length} estudiantes falsos adicionales.`);
            }
        } catch (err: any) {
            this.logger.warn(`No se pudo cargar estudiantes_falsos.json: ${String(err.message || err)}`);
        }
        
        const existingEstudiantes = await this.estudiantesRepo.find({ relations: ['usuario', 'carreraRef'] });
        const existingEstudiantesMap = new Map<string, EstudianteEntidad>(existingEstudiantes.map(e => [e.carnet, e]));
        
        const existingCus = await this.cuRepo.find({ relations: ['estudiante', 'carreras'] });
        const existingCusMap = new Map<string, CuEntidad>(existingCus.map(cu => [cu.codigo, cu]));

        const estudiantesToSave: EstudianteEntidad[] = [];
        const usuariosEstToSave: Usuario[] = [];
        const cusToSave: CuEntidad[] = [];

        const contrasenaEstudianteHash = await bcrypt.hash('estudiante123', 10);

        const nuevosUsuariosEstudiantes: Usuario[] = [];
        for (const e of estudiantesData) {
            const emailClean = e.correo ? e.correo.trim().toLowerCase() : `estudiante-${e.carnet}@sgi.usfx`;
            let usuario = existingUsuariosMap.get(emailClean);
            if (!usuario) {
                usuario = this.usuariosRepo.create({
                    correo: emailClean,
                    contrasena: contrasenaEstudianteHash,
                    rol: 'estudiante',
                });
                nuevosUsuariosEstudiantes.push(usuario);
            }
        }
        if (nuevosUsuariosEstudiantes.length > 0) {
            const savedUsers = await this.usuariosRepo.save(nuevosUsuariosEstudiantes, { chunk: 100 });
            for (const su of savedUsers) {
                existingUsuariosMap.set(su.correo!.toLowerCase(), su);
            }
        }

        const nuevosEstudiantes: EstudianteEntidad[] = [];
        for (const e of estudiantesData) {
            let estudiante = existingEstudiantesMap.get(e.carnet);
            const carreraRef = carrerasMap.get(e.carrera) ?? null;
            const emailClean = e.correo ? e.correo.trim().toLowerCase() : `estudiante-${e.carnet}@sgi.usfx`;

            if (!estudiante) {
                const usuario = existingUsuariosMap.get(emailClean)!;
                estudiante = this.estudiantesRepo.create({
                    usuario,
                    carnet: e.carnet,
                    cu: e.cu,
                    nombre: e.nombre,
                    apellido: e.apellido,
                    carrera: e.carrera,
                    carreraRef,
                });
                nuevosEstudiantes.push(estudiante);
            } else {
                let changedEst = false;
                if (estudiante.cu !== e.cu) { changedEst = true; estudiante.cu = e.cu; }
                if (estudiante.nombre !== e.nombre) { changedEst = true; estudiante.nombre = e.nombre; }
                if (estudiante.apellido !== e.apellido) { changedEst = true; estudiante.apellido = e.apellido; }
                if (estudiante.carrera !== e.carrera) { changedEst = true; estudiante.carrera = e.carrera; }
                if (estudiante.carreraRef?.id !== carreraRef?.id) { changedEst = true; estudiante.carreraRef = carreraRef; }

                if (estudiante.usuario) {
                    if (estudiante.usuario.correo !== emailClean) {
                        estudiante.usuario.correo = emailClean;
                        usuariosEstToSave.push(estudiante.usuario);
                    }
                }
                if (changedEst) {
                    estudiantesToSave.push(estudiante);
                }
            }
        }

        if (nuevosEstudiantes.length > 0) {
            const savedNewEst = await this.estudiantesRepo.save(nuevosEstudiantes, { chunk: 100 });
            for (const se of savedNewEst) {
                existingEstudiantesMap.set(se.carnet, se);
            }
        }
        if (usuariosEstToSave.length > 0) {
            await this.usuariosRepo.save(usuariosEstToSave, { chunk: 100 });
        }
        if (estudiantesToSave.length > 0) {
            await this.estudiantesRepo.save(estudiantesToSave, { chunk: 100 });
        }

        for (const e of estudiantesData) {
            const estudiante = existingEstudiantesMap.get(e.carnet)!;
            const carreraRef = carrerasMap.get(e.carrera) ?? null;
            if (carreraRef) {
                let cu = existingCusMap.get(e.cu);
                if (!cu) {
                    cu = this.cuRepo.create({
                        codigo: e.cu,
                        estudiante,
                        carreras: [carreraRef],
                    });
                    cusToSave.push(cu);
                }
            }
        }
        if (cusToSave.length > 0) {
            await this.cuRepo.save(cusToSave, { chunk: 100 });
        }

        this.logger.log('Cargando datos.json para enriquecimiento del Gabinete Topográfico...');
        const datosJson = this.cargarJson<Array<{
            'Código de Inventario'?: string;
            'Código Único/Código de Serie'?: string;
            'Nombre del Activo'?: string;
            'Descripción del Activo'?: string;
        }>>('datos.json');

        const datosMap = new Map<string, typeof datosJson[number]>();
        for (const row of datosJson) {
            const ci = String(row['Código de Inventario'] ?? '').trim();
            if (ci) {
                datosMap.set(ci, row);
            }
        }

        const inventariosCarpetas = ['gabinete-topografico', 'bodega-mecanicas'];
        const existingItemsGlobal = await this.itemsRepo.find({ relations: ['activo'] });
        const existingItemsGlobalMap = new Map<string, ItemActivoFijo>(
            existingItemsGlobal.filter(item => item.codigo_inventario).map(item => [item.codigo_inventario!, item])
        );
        const existingItemsBySistema = new Map<string, ItemActivoFijo>(
            existingItemsGlobal.filter(item => item.codigo_sistema).map(item => [item.codigo_sistema!.toLowerCase(), item])
        );

        for (const carpeta of inventariosCarpetas) {
            this.logger.log(`Procesando inventario: ${carpeta}...`);
            const invConfig = this.cargarJson<{ nombre: string; descripcion: string; puedeEditarFijos: boolean; puedeEditarFungibles: boolean }>(`inventarios/${carpeta}/inventario.json`);

            let inventario = await this.inventariosRepo.findOne({ where: { nombre: invConfig.nombre } });
            if (!inventario) {
                inventario = this.inventariosRepo.create({
                    nombre: invConfig.nombre,
                    descripcion: invConfig.descripcion,
                    puedeEditarFijos: invConfig.puedeEditarFijos,
                    puedeEditarFungibles: invConfig.puedeEditarFungibles,
                });
                inventario = await this.inventariosRepo.save(inventario);
            } else {
                inventario.descripcion = invConfig.descripcion;
                inventario.puedeEditarFijos = invConfig.puedeEditarFijos;
                inventario.puedeEditarFungibles = invConfig.puedeEditarFungibles;
                inventario = await this.inventariosRepo.save(inventario);
            }

            const activosFijosData = this.cargarJson<{ titulo: string; activos: Array<{ codigo_inventario: string; codigo_unico?: string | null; descripcion: string; estado: string; ue: string; observacion?: string }> }>(`inventarios/${carpeta}/activos-fijos.json`);
            this.logger.log(`Cargando ${activosFijosData.activos.length} activos fijos para ${invConfig.nombre}...`);

            const contenedoresDef = this.cargarJson<Array<{ nombre: string; ubicacion: string }>>(`inventarios/${carpeta}/contenedores.json`);

            const contenedoresMap = new Map<string, ContenedorActivo>();
            const contenedoresToSave: ContenedorActivo[] = [];
            for (const cDef of contenedoresDef) {
                let cont = await this.contenedoresRepo.findOne({
                    where: { nombre: cDef.nombre, inventario: { id: inventario.id } },
                });
                if (!cont) {
                    cont = this.contenedoresRepo.create({
                        nombre: cDef.nombre,
                        ubicacion: cDef.ubicacion,
                        inventario,
                    });
                    contenedoresToSave.push(cont);
                } else if (cont.ubicacion !== cDef.ubicacion) {
                    cont.ubicacion = cDef.ubicacion;
                    contenedoresToSave.push(cont);
                }
                contenedoresMap.set(cDef.nombre, cont);
            }
            if (contenedoresToSave.length > 0) {
                const savedCont = await this.contenedoresRepo.save(contenedoresToSave, { chunk: 100 });
                for (const sc of savedCont) {
                    contenedoresMap.set(sc.nombre, sc);
                }
            }

            const existingActivos = await this.activosRepo.find({
                where: { inventario: { id: inventario.id } },
                relations: ['inventario', 'contenedor'],
            });
            const existingActivosMap = new Map<string, ActivoFijo>(existingActivos.map(a => [a.nombre, a]));

            const activosToSave: ActivoFijo[] = [];
            const nuevosActivos: ActivoFijo[] = [];

            for (const itemSeed of activosFijosData.activos) {
                const ciClean = String(itemSeed.codigo_inventario ?? '').trim();
                const rowEnriquecido = datosMap.get(ciClean);
                const nombreBaseRaw = rowEnriquecido?.['Nombre del Activo'] ?? itemSeed.descripcion;
                const normalizado = this.normalizarNombreActivo(nombreBaseRaw);
                const rawDesc = rowEnriquecido?.['Descripción del Activo'] ?? itemSeed.descripcion;

                const nombreContenedor = this.clasificarContenedor(normalizado.nombre, rawDesc, carpeta);
                const contenedorAsignado = contenedoresMap.get(nombreContenedor) ?? null;

                let activo = existingActivosMap.get(normalizado.nombre);

                if (!activo) {
                    activo = this.activosRepo.create({
                        nombre: normalizado.nombre,
                        categoria: 'General',
                        descripcion: normalizado.descripcion ?? undefined,
                        inventario,
                    });
                    nuevosActivos.push(activo);
                    existingActivosMap.set(normalizado.nombre, activo);
                } else {
                    let changedActivo = false;
                    if (activo.descripcion !== (normalizado.descripcion ?? undefined)) {
                        activo.descripcion = normalizado.descripcion ?? undefined;
                        changedActivo = true;
                    }
                    if (changedActivo) {
                        activosToSave.push(activo);
                    }
                }
            }

            if (nuevosActivos.length > 0) {
                const savedNewActivos = await this.activosRepo.save(nuevosActivos, { chunk: 100 });
                for (const sa of savedNewActivos) {
                    existingActivosMap.set(sa.nombre, sa);
                }
            }
            if (activosToSave.length > 0) {
                await this.activosRepo.save(activosToSave, { chunk: 100 });
            }

            const itemsToSave: ItemActivoFijo[] = [];

            for (const itemSeed of activosFijosData.activos) {
                const ciClean = String(itemSeed.codigo_inventario ?? '').trim();
                const rowEnriquecido = datosMap.get(ciClean);
                const nombreBaseRaw = rowEnriquecido?.['Nombre del Activo'] ?? itemSeed.descripcion;
                const normalizado = this.normalizarNombreActivo(nombreBaseRaw);
                const rawDesc = rowEnriquecido?.['Descripción del Activo'] ?? itemSeed.descripcion;

                const nombreContenedor = this.clasificarContenedor(normalizado.nombre, rawDesc, carpeta);
                const contenedorAsignado = contenedoresMap.get(nombreContenedor) ?? null;

                const activo = existingActivosMap.get(normalizado.nombre)!;

                const codigoInventario = ciClean;
                const codigoUnico = itemSeed.codigo_unico || this.normalizarCodigoUnico(rowEnriquecido?.['Código Único/Código de Serie']);
                
                let codigoSistema = this.extraerCodigoSistema(rawDesc);
                if (codigoSistema) {
                    if (seenSistemas.has(codigoSistema.toLowerCase())) {
                        codigoSistema = null;
                    } else {
                        const duplicadoDb = existingItemsBySistema.get(codigoSistema.toLowerCase());
                        if (duplicadoDb && duplicadoDb.codigo_inventario !== codigoInventario) {
                            codigoSistema = null;
                        } else {
                            seenSistemas.add(codigoSistema.toLowerCase());
                        }
                    }
                }

                const estadoFisico = this.normalizarEstadoFisico(itemSeed.estado, rawDesc);
                const ue = this.extraerUe(rawDesc, itemSeed.ue);

                let item = existingItemsGlobalMap.get(codigoInventario);

                if (!item) {
                    item = this.itemsRepo.create({
                        activo,
                        codigo_inventario: codigoInventario,
                        codigo_unico: codigoUnico,
                        codigo_sistema: codigoSistema,
                        descripcion: rawDesc,
                        ue,
                        estado_fisico: estadoFisico,
                        estado: 'disponible',
                        precio: 0,
                        contenedor: contenedorAsignado,
                    });
                    itemsToSave.push(item);
                } else {
                    let changedItem = false;
                    if (item.activo?.id !== activo.id) { item.activo = activo; changedItem = true; }
                    if (item.codigo_unico !== (codigoUnico ?? item.codigo_unico)) { item.codigo_unico = codigoUnico ?? item.codigo_unico; changedItem = true; }
                    if (item.codigo_sistema !== (codigoSistema ?? item.codigo_sistema)) { item.codigo_sistema = codigoSistema ?? item.codigo_sistema; changedItem = true; }
                    if (item.descripcion !== rawDesc) { item.descripcion = rawDesc; changedItem = true; }
                    if (item.ue !== ue) { item.ue = ue; changedItem = true; }
                    if (item.estado_fisico !== estadoFisico) { item.estado_fisico = estadoFisico; changedItem = true; }
                    if (item.contenedor?.id !== contenedorAsignado?.id) { item.contenedor = contenedorAsignado; changedItem = true; }
                    if (item.deleted_at !== null) { item.deleted_at = null; changedItem = true; }

                    if (changedItem) {
                        itemsToSave.push(item);
                    }
                }
            }

            if (itemsToSave.length > 0) {
                await this.itemsRepo.save(itemsToSave, { chunk: 100 });
            }
            const activosFungiblesData = this.cargarJson<Array<{
                nombre: string;
                categoria: string;
                unidad_medida: string;
                tipo_cantidad: string;
                tipo_identificacion: string;
                tiene_vencimiento: boolean;
                contenedor?: string;
                items: Array<{ lote?: string; serie?: string; cantidad: number; precio: number }>;
            }>>(`inventarios/${carpeta}/activos-fungibles.json`);

            this.logger.log(`Cargando ${activosFungiblesData.length} activos fungibles para ${invConfig.nombre}...`);

            const existingFungibles = await this.activosFungiblesRepo.find({
                where: { inventario: { id: inventario.id } },
                relations: ['contenedor'],
            });
            const existingFungiblesMap = new Map<string, ActivoFungible>(existingFungibles.map(f => [f.nombre, f]));

            const fungiblesToSave: ActivoFungible[] = [];
            const nuevosFungibles: ActivoFungible[] = [];

            for (const fungibleSeed of activosFungiblesData) {
                let fungible = existingFungiblesMap.get(fungibleSeed.nombre);
                const nombreContenedor = fungibleSeed.contenedor;
                const contenedorAsignado = nombreContenedor ? (contenedoresMap.get(nombreContenedor) ?? null) : null;

                if (!fungible) {
                    fungible = this.activosFungiblesRepo.create({
                        nombre: fungibleSeed.nombre,
                        categoria: fungibleSeed.categoria,
                        unidad_medida: fungibleSeed.unidad_medida,
                        tipo_cantidad: fungibleSeed.tipo_cantidad as TipoCantidadFungible,
                        tipo_identificacion: fungibleSeed.tipo_identificacion as TipoIdentificacionFungible,
                        tiene_vencimiento: fungibleSeed.tiene_vencimiento,
                        inventario,
                        contenedor: contenedorAsignado,
                    });
                    nuevosFungibles.push(fungible);
                    existingFungiblesMap.set(fungibleSeed.nombre, fungible);
                } else {
                    let changedFungible = false;
                    if (fungible.contenedor?.id !== contenedorAsignado?.id) {
                        fungible.contenedor = contenedorAsignado;
                        changedFungible = true;
                    }
                    if (changedFungible) {
                        fungiblesToSave.push(fungible);
                    }
                }
            }

            if (nuevosFungibles.length > 0) {
                const savedNewFung = await this.activosFungiblesRepo.save(nuevosFungibles, { chunk: 100 });
                for (const sf of savedNewFung) {
                    existingFungiblesMap.set(sf.nombre, sf);
                }
            }
            if (fungiblesToSave.length > 0) {
                await this.activosFungiblesRepo.save(fungiblesToSave, { chunk: 100 });
            }

            const existingItemsFungibles = await this.itemsFungiblesRepo.find({ relations: ['activo', 'contenedor'] });
            const existingItemsFungiblesMap = new Map<string, ItemActivoFungible>(
                existingItemsFungibles.map(item => [`${item.activo.id}_${item.lote ?? ''}_${item.serie ?? ''}`, item])
            );

            const itemsFungiblesToSave: ItemActivoFungible[] = [];

            for (const fungibleSeed of activosFungiblesData) {
                const fungible = existingFungiblesMap.get(fungibleSeed.nombre)!;
                const nombreContenedor = fungibleSeed.contenedor;
                const contenedorAsignado = nombreContenedor ? (contenedoresMap.get(nombreContenedor) ?? null) : null;

                for (const itemSeed of fungibleSeed.items) {
                    const key = `${fungible.id}_${itemSeed.lote ?? ''}_${itemSeed.serie ?? ''}`;
                    let itemF = existingItemsFungiblesMap.get(key);

                    if (!itemF) {
                        itemF = this.itemsFungiblesRepo.create({
                            activo: fungible,
                            lote: itemSeed.lote,
                            serie: itemSeed.serie,
                            cantidad: itemSeed.cantidad,
                            precio: itemSeed.precio,
                            estado: 'disponible',
                            contenedor: contenedorAsignado,
                        });
                        itemsFungiblesToSave.push(itemF);
                    } else {
                        let changedItemF = false;
                        if (itemF.cantidad !== itemSeed.cantidad) { itemF.cantidad = itemSeed.cantidad; changedItemF = true; }
                        if (itemF.precio !== itemSeed.precio) { itemF.precio = itemSeed.precio; changedItemF = true; }
                        if (itemF.contenedor?.id !== contenedorAsignado?.id) { itemF.contenedor = contenedorAsignado; changedItemF = true; }
                        if (changedItemF) {
                            itemsFungiblesToSave.push(itemF);
                        }
                    }
                }
            }

            if (itemsFungiblesToSave.length > 0) {
                await this.itemsFungiblesRepo.save(itemsFungiblesToSave, { chunk: 100 });
            }
        }

        this.logger.log('Seeding Encargados de Inventario...');
        const encargadosData = this.cargarJson<Array<{
            nombre: string;
            apellido: string;
            correo: string;
            inventarioNombre: string | null;
            puedeEditarFijos: boolean;
            puedeEditarFungibles: boolean;
        }>>('encargados/encargados.json');

        const existingEncargados = await this.encargadosRepo.find({ relations: ['usuario', 'inventario'] });
        const existingEncargadosMap = new Map<string, EncargadoInventarioEntidad>(
            existingEncargados.filter(e => e.usuario && e.usuario.correo).map(e => [e.usuario!.correo!.toLowerCase(), e])
        );

        const existingInventarios = await this.inventariosRepo.find();
        const existingInventariosMap = new Map<string, InventarioEntidad>(existingInventarios.map(i => [i.nombre, i]));

        const encargadosToSave: EncargadoInventarioEntidad[] = [];
        const contrasenaEncargadoHash = await bcrypt.hash('encargado123', 10);

        const nuevosUsuariosEncargados: Usuario[] = [];
        for (const enc of encargadosData) {
            const correoClean = enc.correo.trim().toLowerCase();
            let usuario = existingUsuariosMap.get(correoClean);
            if (!usuario) {
                usuario = this.usuariosRepo.create({
                    correo: correoClean,
                    contrasena: contrasenaEncargadoHash,
                    rol: 'encargado_inventario',
                    estado: true
                });
                nuevosUsuariosEncargados.push(usuario);
            } else if (usuario.rol !== 'encargado_inventario') {
                usuario.rol = 'encargado_inventario';
                usuariosDocentesToSave.push(usuario);
            }
        }
        if (nuevosUsuariosEncargados.length > 0) {
            const savedNewUsers = await this.usuariosRepo.save(nuevosUsuariosEncargados, { chunk: 100 });
            for (const su of savedNewUsers) {
                existingUsuariosMap.set(su.correo!.toLowerCase(), su);
            }
        }

        for (const enc of encargadosData) {
            const correoClean = enc.correo.trim().toLowerCase();
            let encargado = existingEncargadosMap.get(correoClean);
            
            const inventarioAsignado = enc.inventarioNombre ? (existingInventariosMap.get(enc.inventarioNombre) ?? null) : null;

            if (!encargado) {
                const usuario = existingUsuariosMap.get(correoClean)!;
                encargado = this.encargadosRepo.create({
                    usuario,
                    nombre: enc.nombre,
                    apellido: enc.apellido,
                    inventario: inventarioAsignado,
                    puedeEditarFijos: enc.puedeEditarFijos,
                    puedeEditarFungibles: enc.puedeEditarFungibles,
                });
                encargadosToSave.push(encargado);
            } else {
                let changedEnc = false;
                if (encargado.nombre !== enc.nombre) { encargado.nombre = enc.nombre; changedEnc = true; }
                if (encargado.apellido !== enc.apellido) { encargado.apellido = enc.apellido; changedEnc = true; }
                if (encargado.inventario?.id !== inventarioAsignado?.id) { encargado.inventario = inventarioAsignado; changedEnc = true; }
                if (encargado.puedeEditarFijos !== enc.puedeEditarFijos) { encargado.puedeEditarFijos = enc.puedeEditarFijos; changedEnc = true; }
                if (encargado.puedeEditarFungibles !== enc.puedeEditarFungibles) { encargado.puedeEditarFungibles = enc.puedeEditarFungibles; changedEnc = true; }

                if (changedEnc) {
                    encargadosToSave.push(encargado);
                }
            }
        }

        if (encargadosToSave.length > 0) {
            await this.encargadosRepo.save(encargadosToSave, { chunk: 100 });
        }

        this.logger.log('Asociando Carreras con Inventarios...');
        const carrerasToUpdate: CarreraEntidad[] = [];
        for (const [carreraNombre, carreraEnt] of carrerasMap.entries()) {
            const inventariosAsociados: InventarioEntidad[] = [];
            for (const carpeta of inventariosCarpetas) {
                try {
                    const invConfig = this.cargarJson<{ nombre: string; carreras?: string[] }>(`inventarios/${carpeta}/inventario.json`);
                    if (invConfig.carreras?.includes(carreraNombre)) {
                        const invEnt = existingInventariosMap.get(invConfig.nombre);
                        if (invEnt) {
                            inventariosAsociados.push(invEnt);
                        }
                    }
                } catch (err) {
                    this.logger.warn(`Error al asociar carreras: ${String(err)}`);
                }
            }
            carreraEnt.inventarios = inventariosAsociados;
            carrerasToUpdate.push(carreraEnt);
        }
        if (carrerasToUpdate.length > 0) {
            await this.carrerasRepo.save(carrerasToUpdate, { chunk: 100 });
        }

        this.logger.log('Seeding Grupos de Materias...');
        try {
            const gruposData = this.cargarJson<Array<{
                docenteCorreo: string;
                materiaCodigo: string;
                grupo: string;
                codigoInscripcion: string;
                estudiantesCarnets: string[];
            }>>('grupos/grupos.json');

            const existingGrupos = await this.gruposRepo.find({ relations: ['docenteUsuario'] });
            const existingGruposMap = new Map<string, GrupoMateriaDocenteEntidad>(
                existingGrupos.map(g => [`${g.docenteUsuario?.id}_${g.codigoMateria}_${g.grupo}`, g])
            );

            const gruposToSave: GrupoMateriaDocenteEntidad[] = [];

            for (const g of gruposData) {
                const docenteUser = existingUsuariosMap.get(g.docenteCorreo.trim().toLowerCase());
                if (!docenteUser) {
                    this.logger.warn(`No se encontró el usuario docente con correo: ${g.docenteCorreo}`);
                    continue;
                }

                const materiaEnt = materiasMap.get(g.materiaCodigo);
                if (!materiaEnt) {
                    this.logger.warn(`No se encontró la materia con código: ${g.materiaCodigo}`);
                    continue;
                }

                const estudianteIds: number[] = [];
                const carrerasPorEstudiante: Record<number, string[]> = {};

                for (const carnet of g.estudiantesCarnets) {
                    const est = existingEstudiantesMap.get(carnet);
                    if (est) {
                        estudianteIds.push(est.id);
                        carrerasPorEstudiante[est.id] = est.carrera ? [est.carrera] : [];
                    } else {
                        this.logger.warn(`Estudiante con carnet ${carnet} no encontrado para asociar al grupo.`);
                    }
                }

                const key = `${docenteUser.id}_${g.materiaCodigo}_${g.grupo}`;
                let grupoEnt = existingGruposMap.get(key);

                if (!grupoEnt) {
                    grupoEnt = this.gruposRepo.create({
                        docenteUsuario: docenteUser,
                        materia: g.materiaCodigo,
                        materiaId: materiaEnt.id,
                        codigoMateria: g.materiaCodigo,
                        sigla: g.materiaCodigo,
                        nombreMateria: materiaEnt.nombre,
                        nombre: materiaEnt.nombre,
                        descripcion: materiaEnt.descripcion,
                        codigoInscripcion: g.codigoInscripcion,
                        fechaInicioInscripcion: new Date(),
                        fechaFinInscripcion: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
                        duracionMateriaSemanas: 16,
                        nombreGrupo: g.grupo,
                        grupo: g.grupo,
                        estadoAprobacion: 'aprobado',
                        activo: true,
                        permitirInscripcion: true,
                        solicitadoAt: new Date(),
                        aprobadoAt: new Date(),
                        maxEstudiantesGrupo: 30,
                        estudianteIds,
                        carrerasPorEstudiante,
                    });
                    gruposToSave.push(grupoEnt);
                } else {
                    let changedGrupo = false;
                    if (grupoEnt.materiaId !== materiaEnt.id) { grupoEnt.materiaId = materiaEnt.id; changedGrupo = true; }
                    if (grupoEnt.nombreMateria !== materiaEnt.nombre) { grupoEnt.nombreMateria = materiaEnt.nombre; changedGrupo = true; }
                    if (grupoEnt.nombre !== materiaEnt.nombre) { grupoEnt.nombre = materiaEnt.nombre; changedGrupo = true; }
                    if (grupoEnt.descripcion !== materiaEnt.descripcion) { grupoEnt.descripcion = materiaEnt.descripcion; changedGrupo = true; }
                    if (grupoEnt.codigoInscripcion !== g.codigoInscripcion) { grupoEnt.codigoInscripcion = g.codigoInscripcion; changedGrupo = true; }
                    if (JSON.stringify(grupoEnt.estudianteIds) !== JSON.stringify(estudianteIds)) { grupoEnt.estudianteIds = estudianteIds; changedGrupo = true; }
                    if (JSON.stringify(grupoEnt.carrerasPorEstudiante) !== JSON.stringify(carrerasPorEstudiante)) { grupoEnt.carrerasPorEstudiante = carrerasPorEstudiante; changedGrupo = true; }

                    if (changedGrupo) {
                        gruposToSave.push(grupoEnt);
                    }
                }
            }

            if (gruposToSave.length > 0) {
                await this.gruposRepo.save(gruposToSave, { chunk: 100 });
            }
        } catch (err) {
            this.logger.error(`Error al sembrar grupos de materias: ${String(err)}`);
        }

        this.logger.log('Seeders estructurados aplicados correctamente.');
    }
}
