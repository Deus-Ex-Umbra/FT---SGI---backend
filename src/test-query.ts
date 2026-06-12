import { NestFactory } from '@nestjs/core';
import { AppModulo } from './app.modulo';
import { PrestamoCanastaServicio } from './modulos/prestamo/prestamo-canasta.servicio';
import { Usuario } from './modulos/usuario/entidades/usuario.entidad';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModulo, {
    logger: false, 
  });

  try {
    const service = app.get(PrestamoCanastaServicio);
    const user = {
      id: 61,
      correo: 'juan.perez@ejemplo.com',
      rol: 'encargado_inventario',
    };

    console.log('Calling obtenerCanastasPrestamo for Juan Pérez...');
    const result = await service.obtenerCanastasPrestamo(user);
    console.log('Result length:', result.length);
    console.log('Result detail:');
    console.dir(result, { depth: null });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await app.close();
  }
}

main();
