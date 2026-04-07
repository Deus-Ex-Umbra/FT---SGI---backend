import { IsNumber, IsObject, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class MargenesDto {
  @IsNumber() top!: number;
  @IsNumber() right!: number;
  @IsNumber() bottom!: number;
  @IsNumber() left!: number;
}

class ConfigDocumentoDto {
  @IsNumber() widthMm!: number;
  @IsNumber() heightMm!: number;

  @IsObject()
  @ValidateNested()
  @Type(() => MargenesDto)
  margenes!: MargenesDto;
}

export class GenerarPdfDto {
  @IsString()
  contenido_html!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => ConfigDocumentoDto)
  config!: ConfigDocumentoDto;
}
