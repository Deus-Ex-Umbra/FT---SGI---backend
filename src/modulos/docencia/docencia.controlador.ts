import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAutenticacionGuardia } from '@/modulos/autenticacion/guardias/jwt-autenticacion.guardia';
import { Roles } from '@/modulos/autenticacion/guardias/roles.decorador';
import { RolesGuardia } from '@/modulos/autenticacion/guardias/roles.guardia';
import type { RolUsuario } from '@/modulos/usuario/entidades/usuario.entidad';

import { DocenciaServicio } from './docencia.servicio';
import { CrearGrupoMateriaDto } from './dto/crear-grupo-materia.dto';
import { CrearSolicitudMaterialDto } from './dto/crear-solicitud-material.dto';
import { ActualizarGrupoMateriaDto } from './dto/actualizar-grupo-materia.dto';
import { InscribirMateriaDto } from './dto/inscribir-materia.dto';



@ApiTags('Docencia')
@Controller('docencia')
export class DocenciaControlador {
  constructor(
    private readonly servicio: DocenciaServicio,
  ) {}



  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAutenticacionGuardia, RolesGuardia)
  @Roles('docente' as RolUsuario)
  @Get('materias-asignadas')
  @ApiOperation({ summary: 'Listar materias asignadas por el administrador al docente' })
  async listarMateriasAsignadas(@Request() req: any) {
    return await this.servicio.listarMateriasAsignadas(req.user.id);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAutenticacionGuardia, RolesGuardia)
  @Roles('docente' as RolUsuario)
  @Get('materias')
  @ApiOperation({ summary: 'Listar materias creadas por el docente' })
  async listarGrupos(@Request() req: any) {
    return await this.servicio.listarGrupos(req.user.id);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAutenticacionGuardia, RolesGuardia)
  @Roles('estudiante' as RolUsuario)
  @Get('materias-lideradas')
  @ApiOperation({ summary: 'Listar materias donde el estudiante es líder de un subgrupo' })
  async listarMateriasLideradas(@Request() req: any) {
    return await this.servicio.listarMateriasLideradas(req.user.id);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAutenticacionGuardia, RolesGuardia)
  @Roles('docente' as RolUsuario)
  @Post('materias')
  @ApiOperation({ summary: 'Crear materia del docente' })
  async crearGrupo(@Request() req: any, @Body() dto: CrearGrupoMateriaDto) {
    return await this.servicio.crearGrupo(req.user.id, dto);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAutenticacionGuardia, RolesGuardia)
  @Roles('docente' as RolUsuario, 'administrador' as RolUsuario)
  @Patch('materias/:id')
  @ApiOperation({ summary: 'Editar materia del docente' })
  async editarGrupo(@Request() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarGrupoMateriaDto) {
    return await this.servicio.editarGrupo(req.user.id, req.user.rol, id, dto);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAutenticacionGuardia, RolesGuardia)
  @Roles('docente' as RolUsuario, 'administrador' as RolUsuario)
  @Delete('materias/:id')
  @ApiOperation({ summary: 'Eliminar materia del docente' })
  async eliminarGrupo(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    await this.servicio.eliminarGrupo(req.user.id, req.user.rol, id);
    return { ok: true };
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAutenticacionGuardia, RolesGuardia)
  @Roles('docente' as RolUsuario)
  @Get('materias/:id/subgrupos')
  @ApiOperation({ summary: 'Listar subgrupos de préstamo de un grupo de materia' })
  async listarSubgrupos(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return await this.servicio.listarSubgruposPrestamo(req.user.id, id);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAutenticacionGuardia, RolesGuardia)
  @Roles('docente' as RolUsuario)
  @Post('materias/:id/subgrupos')
  @ApiOperation({ summary: 'Crear subgrupo de préstamo en un grupo de materia' })
  async crearSubgrupo(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: {
      codigo: string;
      nombre?: string | null;
      descripcion?: string | null;
      estudianteIds?: number[] | null;
      responsableEstudianteId?: number | null;
    },
  ) {
    return await this.servicio.crearSubgrupoPrestamo(req.user.id, id, dto);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAutenticacionGuardia, RolesGuardia)
  @Roles('docente' as RolUsuario)
  @Patch('materias/:id/subgrupos/:subgrupoId')
  @ApiOperation({ summary: 'Editar subgrupo de préstamo de un grupo de materia' })
  async editarSubgrupo(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('subgrupoId', ParseUUIDPipe) subgrupoId: string,
    @Body() dto: {
      codigo?: string;
      nombre?: string | null;
      descripcion?: string | null;
      habilitado?: boolean;
      estudianteIds?: number[] | null;
      responsableEstudianteId?: number | null;
    },
  ) {
    return await this.servicio.editarSubgrupoPrestamo(req.user.id, id, subgrupoId, dto);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAutenticacionGuardia, RolesGuardia)
  @Roles('docente' as RolUsuario)
  @Delete('materias/:id/subgrupos/:subgrupoId')
  @ApiOperation({ summary: 'Eliminar subgrupo de préstamo de un grupo de materia' })
  async eliminarSubgrupo(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('subgrupoId', ParseUUIDPipe) subgrupoId: string,
  ) {
    return await this.servicio.eliminarSubgrupoPrestamo(req.user.id, id, subgrupoId);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAutenticacionGuardia, RolesGuardia)
  @Roles('estudiante' as RolUsuario)
  @Post('materias/inscribir-codigo')
  @ApiOperation({ summary: 'Inscribirse a materia mediante código alfanumérico (estudiante autenticado)' })
  async inscribirPorCodigo(@Request() req: any, @Body() body: { codigo: string, carreras?: string[] }) {
    return await this.servicio.inscribirEstudiantePorCodigo(req.user.id, body.codigo, body.carreras);
  }

  @Post('materias/inscribir-codigo-publico')
  @ApiOperation({ summary: 'Inscribirse a materia mediante código alfanumérico y carnet (público)' })
  async inscribirPublicoPorCodigo(@Body() body: { codigo: string, carnet: string, carreras?: string[] }) {
    return await this.servicio.inscribirEstudiantePublicoPorCodigo(body.carnet, body.codigo, body.carreras);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAutenticacionGuardia, RolesGuardia)
  @Roles('docente' as RolUsuario)
  @Get('solicitudes')
  @ApiOperation({ summary: 'Listar solicitudes del docente' })
  async listarSolicitudes(@Request() req: any) {
    return await this.servicio.listarSolicitudesDocente(req.user.id);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAutenticacionGuardia, RolesGuardia)
  @Roles('docente' as RolUsuario)
  @Post('solicitudes')
  @ApiOperation({ summary: 'Crear solicitud (docente)' })
  async crearSolicitud(@Request() req: any, @Body() dto: CrearSolicitudMaterialDto) {
    return await this.servicio.crearSolicitud(req.user.id, dto);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAutenticacionGuardia, RolesGuardia)
  @Roles('docente' as RolUsuario)
  @Post('solicitudes/:id/aprobar')
  @ApiOperation({ summary: 'Aprobar solicitud por docente (requiere PDF subido)' })
  async aprobarDocente(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return await this.servicio.aprobarPorDocente(req.user.id, id);
  }



  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAutenticacionGuardia, RolesGuardia)
  @Roles('administrador' as RolUsuario, 'encargado_inventario' as RolUsuario)
  @Get('almacen/solicitudes')
  @ApiOperation({ summary: 'Listar solicitudes pendientes para almacén' })
  async listarPendientesAlmacen() {
    return await this.servicio.listarPendientesAlmacen();
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAutenticacionGuardia, RolesGuardia)
  @Roles('administrador' as RolUsuario, 'encargado_inventario' as RolUsuario)
  @Post('almacen/solicitudes/:id/aprobar')
  @ApiOperation({ summary: 'Aprobar solicitud por almacén' })
  async aprobarAlmacen(@Param('id', ParseUUIDPipe) id: string) {
    return await this.servicio.aprobarPorAlmacen(id);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAutenticacionGuardia, RolesGuardia)
  @Roles('administrador' as RolUsuario, 'encargado_inventario' as RolUsuario)
  @Post('almacen/solicitudes/:id/rechazar')
  @ApiOperation({ summary: 'Rechazar solicitud por almacén' })
  async rechazarAlmacen(@Param('id', ParseUUIDPipe) id: string, @Body() body: { motivo?: string }) {
    return await this.servicio.rechazarPorAlmacen(id, body?.motivo);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAutenticacionGuardia, RolesGuardia)
  @Roles('docente' as RolUsuario)
  @Post('materias/:id/subgrupos/generar-azar')
  @ApiOperation({ summary: 'Generar subgrupos de préstamo de manera aleatoria' })
  async generarSubgruposAlAzar(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return await this.servicio.generarSubgruposAlAzar(req.user.id, id);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAutenticacionGuardia, RolesGuardia)
  @Roles('docente' as RolUsuario)
  @Delete('materias/:id/subgrupos')
  @ApiOperation({ summary: 'Eliminar todos los subgrupos de préstamo de una materia' })
  async eliminarTodosSubgrupos(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return await this.servicio.eliminarTodosSubgrupos(req.user.id, id);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAutenticacionGuardia, RolesGuardia)
  @Roles('estudiante' as RolUsuario, 'docente' as RolUsuario, 'administrador' as RolUsuario)
  @Get('materias/:id/estudiantes-inscritos')
  @ApiOperation({ summary: 'Listar estudiantes inscritos en una materia para selección de compañeros o consulta del docente/admin' })
  async obtenerEstudiantesInscritos(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return await this.servicio.listarEstudiantesInscritos(req.user.id, req.user.rol, id);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAutenticacionGuardia, RolesGuardia)
  @Roles('estudiante' as RolUsuario)
  @Patch('subgrupos/:subgrupoId/companeros')
  @ApiOperation({ summary: 'Actualizar compañeros de grupo por el estudiante líder' })
  async actualizarCompaneros(
    @Request() req: any,
    @Param('subgrupoId', ParseUUIDPipe) subgrupoId: string,
    @Body() dto: { estudianteIds: number[] },
  ) {
    return await this.servicio.actualizarCompanerosPorLider(req.user.id, subgrupoId, dto.estudianteIds);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAutenticacionGuardia, RolesGuardia)
  @Roles('docente' as RolUsuario)
  @Delete('materias/:id/estudiantes/:estudianteId')
  @ApiOperation({ summary: 'Quitar un estudiante de una materia' })
  async desinscribirEstudiante(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('estudianteId') estudianteId: string,
    @Query('carrera') carrera?: string,
  ) {
    return await this.servicio.desinscribirEstudiante(req.user.id, id, Number(estudianteId), carrera);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAutenticacionGuardia, RolesGuardia)
  @Roles('docente' as RolUsuario)
  @Delete('materias/:id/estudiantes')
  @ApiOperation({ summary: 'Quitar todos los estudiantes de una materia' })
  async desinscribirTodosEstudiantes(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return await this.servicio.desinscribirTodosEstudiantes(req.user.id, id);
  }
}
