import { Get, Post, Put, Delete, Param, Body, ParseIntPipe, UseGuards } from '@nestjs/common';
import { JwtAutenticacionGuardia } from '@/modulos/autenticacion/guardias/jwt-autenticacion.guardia';
import { RolesGuardia } from '@/modulos/autenticacion/guardias/roles.guardia';
import { Roles } from '@/modulos/autenticacion/guardias/roles.decorador';
import { RolUsuario } from '@/modulos/usuario/entidades/usuario.entidad';

export interface CrudServiceAdapter<T, CreateDto, UpdateDto> {
  findAll(): Promise<T[]> | T[];
  create(dto: CreateDto): Promise<T> | T;
  update(id: number, dto: UpdateDto): Promise<T> | T;
  delete(id: number): Promise<any> | any;
}

export function BaseCrudController<T, CreateDto, UpdateDto>(
  roles: RolUsuario[] = ['administrador'],
) {
  @UseGuards(JwtAutenticacionGuardia, RolesGuardia)
  @Roles(...roles)
  abstract class CrudController {
    constructor(public readonly service: CrudServiceAdapter<T, CreateDto, UpdateDto>) {}

    @Get()
    async findAll() {
      return this.service.findAll();
    }

    @Post()
    async create(@Body() dto: CreateDto) {
      return this.service.create(dto);
    }

    @Put(':id')
    async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDto) {
      return this.service.update(id, dto);
    }

    @Delete(':id')
    async delete(@Param('id', ParseIntPipe) id: number) {
      await this.service.delete(id);
      return { ok: true };
    }
  }

  return CrudController;
}

