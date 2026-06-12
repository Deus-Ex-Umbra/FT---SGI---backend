import { Injectable, BadRequestException } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ConfiguracionServicio } from '@/modulos/configuracion/configuracion.servicio';

@Injectable()
export class GeminiServicio {
  constructor(private readonly configuracion: ConfiguracionServicio) {}

  async generarTexto(usuarioId: number, prompt: string): Promise<string> {
    const cfg = await this.configuracion.obtenerIA(usuarioId);
    const apiKey = cfg.geminiApiKey;
    if (!apiKey) {
      throw new BadRequestException('No hay clave de API Gemini configurada.');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return text?.trim() || '';
  }
}
