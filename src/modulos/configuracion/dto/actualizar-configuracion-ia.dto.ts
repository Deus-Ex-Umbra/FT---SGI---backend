import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class ActualizarConfiguracionIADto {
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @IsUrl({ require_tld: false })
  geminiApiUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  geminiApiKey?: string;
}
