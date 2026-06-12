import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class PrestamoInitServicio implements OnModuleInit {
  private readonly logger = new Logger(PrestamoInitServicio.name);

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit() {
    try {
      this.logger.log('Verificando y limpiando índices antiguos en la base de datos...');
      await this.dataSource.query('DROP INDEX IF EXISTS uq_prestamos_item_no_devuelto');
      this.logger.log('Limpieza de índices antiguos completada.');
    } catch (err) {
      this.logger.error('Error al intentar eliminar el índice antiguo uq_prestamos_item_no_devuelto:', err);
    }
  }
}
