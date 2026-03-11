import { Body, Controller, Post } from '@nestjs/common';
import { AutenticacionServicio } from './autenticacion.servicio';
import { InicioSesionDto } from './dto/inicio-sesion.dto';

@Controller('auth')
export class AutenticacionControlador {
    constructor(private readonly autenticacionServicio: AutenticacionServicio) { }

    @Post('iniciar-sesion')
    async iniciarSesion(@Body() dto: InicioSesionDto) {
        return this.autenticacionServicio.iniciarSesion(dto);
    }
}
