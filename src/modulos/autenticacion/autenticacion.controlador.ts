import { Body, Controller, Get, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAutenticacionGuardia } from './guardias/jwt-autenticacion.guardia';
import { Roles } from './guardias/roles.decorador';
import { RolesGuardia } from './guardias/roles.guardia';
import { AutenticacionServicio } from './autenticacion.servicio';
import { InicioSesionDto } from './dto/inicio-sesion.dto';
import { CambiarContrasenaDto } from './dto/cambiar-contrasena.dto';
import { CambiarCorreoDto } from './dto/cambiar-correo.dto';
import { CrearEstudianteDto } from '@/modulos/estudiante/dto/crear-estudiante.dto';

@Controller('auth')
export class AutenticacionControlador {
    constructor(private readonly autenticacionServicio: AutenticacionServicio) { }

    @Post('iniciar-sesion')
    async iniciarSesion(@Body() dto: InicioSesionDto) {
        return this.autenticacionServicio.iniciarSesion(dto);
    }

    @Get('perfil')
    @UseGuards(JwtAutenticacionGuardia)
    async obtenerPerfil(@Request() req: any) {
        return this.autenticacionServicio.obtenerPerfilUsuarioActual(req.user.id);
    }

    @Post('registro-estudiantes/url-firmada')
    @UseGuards(JwtAutenticacionGuardia, RolesGuardia)
    @Roles('administrador')
    async generarUrlFirmadaRegistroEstudiante(@Request() req: any) {
        return this.autenticacionServicio.generarUrlFirmadaRegistroEstudiante(req.user?.id);
    }

    @Get('registro-estudiantes/url-firmada')
    @UseGuards(JwtAutenticacionGuardia, RolesGuardia)
    @Roles('administrador')
    async obtenerUrlFirmadaRegistroEstudianteActiva() {
        return this.autenticacionServicio.obtenerUrlFirmadaRegistroEstudianteActiva();
    }

    @Post('registro-estudiantes/url-firmada/deshabilitar')
    @UseGuards(JwtAutenticacionGuardia, RolesGuardia)
    @Roles('administrador')
    async deshabilitarUrlFirmadaRegistroEstudiante() {
        return this.autenticacionServicio.deshabilitarUrlFirmadaRegistroEstudiante();
    }

    @Get('registro-estudiantes/verificar')
    async verificarRegistroEstudianteConEnlaceFirmado(
        @Query('eid') eid: string,
        @Query('exp') exp: string,
        @Query('nonce') nonce: string,
        @Query('sig') sig: string,
    ) {
        return this.autenticacionServicio.verificarRegistroEstudianteConEnlaceFirmado({ eid, exp, nonce, sig });
    }

    @Post('registro-estudiantes')
    async registrarEstudianteConEnlaceFirmado(
        @Query('eid') eid: string,
        @Query('exp') exp: string,
        @Query('nonce') nonce: string,
        @Query('sig') sig: string,
        @Body() dto: CrearEstudianteDto,
    ) {
        return this.autenticacionServicio.registrarEstudianteConEnlaceFirmado(dto, { eid, exp, nonce, sig });
    }

    @Post('cambiar-contrasena')
    @UseGuards(JwtAutenticacionGuardia)
    async cambiarContrasena(
        @Request() req: any,
        @Body() dto: CambiarContrasenaDto,
    ) {
        return this.autenticacionServicio.cambiarContrasena(req.user.id, dto);
    }

    @Post('cambiar-correo')
    @UseGuards(JwtAutenticacionGuardia, RolesGuardia)
    @Roles('administrador')
    async cambiarCorreo(
        @Request() req: any,
        @Body() dto: CambiarCorreoDto,
    ) {
        return this.autenticacionServicio.cambiarCorreo(req.user.id, dto);
    }
}
