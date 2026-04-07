import { IsObject, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class MargenesDto {
  top!: number;
  right!: number;
  bottom!: number;
  left!: number;
}

class ConfigDocumentoDto {
  widthMm!: number;
  heightMm!: number;
  margenes!: MargenesDto;
}

export class ConvertirHtmlAPdfDto {
  @IsString()
  html!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => ConfigDocumentoDto)
  config!: ConfigDocumentoDto;
}
