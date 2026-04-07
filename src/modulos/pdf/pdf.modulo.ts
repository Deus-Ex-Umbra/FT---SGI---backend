import { Module } from '@nestjs/common';
import { PdfServicio } from './pdf.servicio';

@Module({
  providers: [PdfServicio],
  exports: [PdfServicio],
})
export class PdfModulo {}
