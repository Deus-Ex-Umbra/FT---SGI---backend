import { Module } from '@nestjs/common';
import { AdministradorUsuariosControlador } from './administrador-usuarios.controlador';
import { AdministradorDocenciaControlador } from './administrador-docencia.controlador';
import { AdministradorDatosControlador } from './administrador-datos.controlador';
import { UsuarioModulo } from '@/modulos/usuario/usuario.modulo';
import { DocenteModulo } from '@/modulos/docente/docente.modulo';
import { EstudianteModulo } from '@/modulos/estudiante/estudiante.modulo';
import { EncargadoInventarioModulo } from '@/modulos/encargado-inventario/encargado-inventario.modulo';

import { PrestamoModulo } from '@/modulos/prestamo/prestamo.modulo';
import { DocenciaModulo } from '@/modulos/docencia/docencia.modulo';
import { SeedModulo } from '@/seed.modulo';

@Module({
  imports: [
    UsuarioModulo,
    DocenteModulo,
    EstudianteModulo,
    EncargadoInventarioModulo,
    PrestamoModulo,
    DocenciaModulo,
    SeedModulo,
  ],
  controllers: [
    AdministradorUsuariosControlador,
    AdministradorDocenciaControlador,
    AdministradorDatosControlador,
  ],
  providers: [],
})
export class AdministradorModulo {}

