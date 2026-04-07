import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtEstrategia extends PassportStrategy(Strategy) {
    constructor(configuracion: ConfigService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configuracion.get<string>('JWT_SECRETO') ?? 'secreto_sgi_default',
        });
    }

    async validate(carga: { sub: number; nombre_usuario: string; rol: string }) {
        return { id: carga.sub, nombre_usuario: carga.nombre_usuario, rol: carga.rol };
    }
}
