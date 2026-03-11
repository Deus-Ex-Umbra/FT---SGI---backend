import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Usuario } from './usuario.entidad';

@Injectable()
export class UsuarioServicio implements OnModuleInit {
    constructor(
        @InjectRepository(Usuario)
        private readonly repositorioUsuario: Repository<Usuario>,
    ) { }

    async onModuleInit() {
        await this.sembrarDirector();
    }

    private async sembrarDirector() {
        const existe = await this.repositorioUsuario.findOne({
            where: { nombre_usuario: 'director' },
        });
        if (existe) return;

        const contrasenaHash = await bcrypt.hash('Director@2026!', 10);
        await this.repositorioUsuario.save({
            nombre_usuario: 'director',
            contrasena: contrasenaHash,
            rol: 'director',
        });
    }

    async buscarPorNombreUsuario(nombre_usuario: string): Promise<Usuario | null> {
        return this.repositorioUsuario.findOne({ where: { nombre_usuario } });
    }
}
