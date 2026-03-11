import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsuarioModulo } from '../usuario/usuario.modulo';
import { AutenticacionServicio } from './autenticacion.servicio';
import { AutenticacionControlador } from './autenticacion.controlador';
import { JwtEstrategia } from './jwt.estrategia';

@Module({
    imports: [
        UsuarioModulo,
        PassportModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configuracion: ConfigService) => ({
                secret: configuracion.get<string>('JWT_SECRETO'),
                signOptions: { expiresIn: '8h' },
            }),
        }),
    ],
    providers: [AutenticacionServicio, JwtEstrategia],
    controllers: [AutenticacionControlador],
})
export class AutenticacionModulo { }
