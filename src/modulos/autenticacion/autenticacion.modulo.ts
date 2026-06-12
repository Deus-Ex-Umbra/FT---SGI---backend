import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';
import { UsuarioModulo } from '@/modulos/usuario/usuario.modulo';
import { ConfiguracionModulo } from '@/modulos/configuracion/configuracion.modulo';
import { EnlaceFirmadoModulo } from '@/modulos/enlace-firmado/enlace-firmado.modulo';
import { AutenticacionServicio } from './autenticacion.servicio';
import { AutenticacionControlador } from './autenticacion.controlador';
import { JwtEstrategia } from './estrategias/jwt.estrategia';
import { RolesGuardia } from './guardias/roles.guardia';

import { DocenteModulo } from '@/modulos/docente/docente.modulo';
import { EstudianteModulo } from '@/modulos/estudiante/estudiante.modulo';
import { EncargadoInventarioModulo } from '@/modulos/encargado-inventario/encargado-inventario.modulo';

const JWT_EXPIRACION_DEFECTO: StringValue = '30d';

const resolverExpiracionJwt = (valor: string | undefined): StringValue => {
    const normalizado = (valor ?? '').trim().toLowerCase().replace(/\s+/g, '');
    if (!normalizado) return JWT_EXPIRACION_DEFECTO;
    if (!/^\d+(h|d)$/i.test(normalizado)) {
        return JWT_EXPIRACION_DEFECTO;
    }

    return normalizado as StringValue;
};

@Module({
    imports: [
        UsuarioModulo,
        DocenteModulo,
        EstudianteModulo,
        EncargadoInventarioModulo,
        ConfiguracionModulo,
        EnlaceFirmadoModulo,
        PassportModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configuracion: ConfigService) => ({
                secret: configuracion.get<string>('JWT_SECRETO'),
                signOptions: {
                    expiresIn: resolverExpiracionJwt(configuracion.get<string>('JWT_EXPIRACION')),
                },
            }),
        }),
    ],
    providers: [AutenticacionServicio, JwtEstrategia, RolesGuardia],
    controllers: [AutenticacionControlador],
})
export class AutenticacionModulo { }
