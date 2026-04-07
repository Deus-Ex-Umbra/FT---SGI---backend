import { Module } from '@nestjs/common';
import { ConfiguracionModulo } from '@/modulos/configuracion/configuracion.modulo';
import { GeminiServicio } from './gemini.servicio';

@Module({
  imports: [ConfiguracionModulo],
  providers: [GeminiServicio],
  exports: [GeminiServicio],
})
export class GeminiModulo {}
