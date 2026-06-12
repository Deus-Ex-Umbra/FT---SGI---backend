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

    async validate(carga: { 
        sub: number; 
        correo: string; 
        rol: string; 
        id_inventario?: number | null; 
        puedeEditarFijos?: boolean; 
        puedeEditarFungibles?: boolean;
    }) {
        return {
            id: carga.sub,
            correo: carga.correo,
            rol: carga.rol,
            id_inventario: carga.id_inventario ?? null,
            puedeEditarFijos: carga.puedeEditarFijos ?? false,
            puedeEditarFungibles: carga.puedeEditarFungibles ?? false,
        };
    }
}
