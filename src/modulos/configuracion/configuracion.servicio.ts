import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario } from '@/modulos/usuario/entidades/usuario.entidad';
import { ConfiguracionIAEntidad } from './entidades/configuracion-ia.entidad';
import { ActualizarConfiguracionIADto } from './dto/actualizar-configuracion-ia.dto';

@Injectable()
export class ConfiguracionServicio {
  constructor(
    @InjectRepository(ConfiguracionIAEntidad)
    private readonly repoIA: Repository<ConfiguracionIAEntidad>,
    @InjectRepository(Usuario)
    private readonly repoUsuario: Repository<Usuario>,
  ) {}

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
}
