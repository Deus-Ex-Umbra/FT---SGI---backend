import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario } from '@/modulos/usuario/entidades/usuario.entidad';
import { EnlaceFirmadoServicio } from '@/modulos/enlace-firmado/enlace-firmado.servicio';
import { ConfiguracionIAEntidad } from './entidades/configuracion-ia.entidad';
import { ActualizarConfiguracionIADto } from './dto/actualizar-configuracion-ia.dto';
import { ConfiguracionRegistroEstudianteEntidad } from './entidades/configuracion-registro-estudiante.entidad';
import { ConfiguracionRegistroDocenteEntidad } from './entidades/configuracion-registro-docente.entidad';

@Injectable()
export class ConfiguracionServicio {
  constructor(
    @InjectRepository(ConfiguracionIAEntidad)
    private readonly repoIA: Repository<ConfiguracionIAEntidad>,
    @InjectRepository(Usuario)
    private readonly repoUsuario: Repository<Usuario>,
    @InjectRepository(ConfiguracionRegistroEstudianteEntidad)
    private readonly repoRegistroEstudiante: Repository<ConfiguracionRegistroEstudianteEntidad>,
    @InjectRepository(ConfiguracionRegistroDocenteEntidad)
    private readonly repoRegistroDocente: Repository<ConfiguracionRegistroDocenteEntidad>,
    private readonly enlaceFirmadoServicio: EnlaceFirmadoServicio,
  ) {}

  private async obtenerRegistroEstudianteEntidad(): Promise<ConfiguracionRegistroEstudianteEntidad> {
    const existente = await this.repoRegistroEstudiante.findOne({ where: { id: 1 } });
    if (existente) return existente;

    const nueva = this.repoRegistroEstudiante.create({
      id: 1,
      registroEstudianteHabilitado: true,
    });
    return await this.repoRegistroEstudiante.save(nueva);
  }

  private async obtenerRegistroDocenteEntidad(): Promise<ConfiguracionRegistroDocenteEntidad> {
    const existente = await this.repoRegistroDocente.findOne({ where: { id: 1 } });
    if (existente) return existente;

    const nueva = this.repoRegistroDocente.create({
      id: 1,
      registroDocenteHabilitado: true,
    });
    return await this.repoRegistroDocente.save(nueva);
  }

  async obtenerIA(usuarioId: number): Promise<ConfiguracionIAEntidad> {
    const existente = await this.repoIA.findOne({
      where: { usuario: { id: usuarioId } },
      relations: ['usuario'],
    });
    if (existente) return existente;

    const usuario = await this.repoUsuario.findOne({ where: { id: usuarioId } });
    const nuevo = this.repoIA.create({
      usuario: usuario!,
      geminiApiKey: null,
      geminiApiUrl: null,
    });
    return await this.repoIA.save(nuevo);
  }

  async actualizarIA(usuarioId: number, dto: ActualizarConfiguracionIADto) {
    const cfg = await this.obtenerIA(usuarioId);
    if (dto.geminiApiUrl !== undefined) cfg.geminiApiUrl = dto.geminiApiUrl?.trim() || null;
    if (dto.geminiApiKey !== undefined) cfg.geminiApiKey = dto.geminiApiKey?.trim() || null;
    await this.repoIA.save(cfg);
    return { geminiApiUrl: cfg.geminiApiUrl, geminiApiKeyConfigurada: Boolean(cfg.geminiApiKey) };
  }

  async obtenerRegistroEstudiante() {
    const cfg = await this.obtenerRegistroEstudianteEntidad();
    return { habilitado: cfg.registroEstudianteHabilitado };
  }

  async actualizarRegistroEstudiante(habilitado: boolean) {
    const cfg = await this.obtenerRegistroEstudianteEntidad();

    const habilitadoNormalizado = Boolean(habilitado);
    const huboCambio = cfg.registroEstudianteHabilitado !== habilitadoNormalizado;
    cfg.registroEstudianteHabilitado = habilitadoNormalizado;
    await this.repoRegistroEstudiante.save(cfg);

    if (huboCambio) {
      await this.enlaceFirmadoServicio.deshabilitarInvitacionRegistro();
    }

    return { habilitado: cfg.registroEstudianteHabilitado };
  }

  async obtenerRegistroDocente() {
    const cfg = await this.obtenerRegistroDocenteEntidad();
    return { habilitado: cfg.registroDocenteHabilitado };
  }

  async actualizarRegistroDocente(habilitado: boolean) {
    const cfg = await this.obtenerRegistroDocenteEntidad();

    const habilitadoNormalizado = Boolean(habilitado);
    const huboCambio = cfg.registroDocenteHabilitado !== habilitadoNormalizado;
    cfg.registroDocenteHabilitado = habilitadoNormalizado;
    await this.repoRegistroDocente.save(cfg);

    if (huboCambio) {
      await this.enlaceFirmadoServicio.deshabilitarInvitacionRegistroDocente();
    }

    return { habilitado: cfg.registroDocenteHabilitado };
  }
}
