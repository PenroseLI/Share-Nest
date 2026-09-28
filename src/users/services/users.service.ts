/**
 * UsersService — Lógica de negocio de Usuarios
 * -------------------------------------------
 * Este servicio es el "cerebro" de /users. El Controller solo recibe la petición
 * y este Service habla con la BD. Así separamos: Controller = entra, Service = piensa,
 * Repository = guarda.
 *
 * Usa TypeORM Repository<User> inyectado con @InjectRepository(User).
 * Ese repositorio ya sabe hacer create, save, find, etc. sobre la tabla users.
 */

import {
  ConflictException, // 409 — cuando algo ya existe (id o email duplicado)
  Injectable, // le dice a Nest que esta clase se puede inyectar en otros lados
  NotFoundException, // 404 — cuando no existe
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { User } from '../entities/user.entity';

@Injectable() // Nest puede crear una sola instancia y compartirla
export class UsersService {
  // Inyección: Nest nos da el repositorio de User automáticamente
  // No hacemos new Repository, Nest lo crea porque en users.module.ts pusimos TypeOrmModule.forFeature([User])
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  /**
   * Crear un usuario
   * 1. Verifica que id no exista
   * 2. Verifica que email no exista
   * 3. Crea el objeto y lo guarda
   * Si algo ya existe → 409 Conflict
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    // ¿Ya hay alguien con ese id (cédula) 5-20 dígitos?
    await this.ensureIdIsAvailable(createUserDto.id);

    // ¿Ya hay alguien con ese email?
    await this.ensureEmailIsAvailable(createUserDto.email);

    // create() solo crea el objeto en memoria, no guarda aún
    const user = this.usersRepository.create(createUserDto);

    // save() sí lo guarda en la BD (INSERT)
    return this.usersRepository.save(user);
  }

  /**
   * Listar solo usuarios activos
   * Usamos soft delete: nunca borramos de la BD, solo ponemos isActive=false
   * Por eso filtramos isActive=true
   */
  findAll(): Promise<User[]> {
    return this.usersRepository.findBy({ isActive: true });
  }

  /**
   * Buscar uno por id, solo si está activo
   * Si no existe o está desactivado → 404
   * Este método lo reusa update() y remove() para no repetir código
   */
  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOneBy({ id, isActive: true });
    if (!user) {
      // Nest convierte esto en respuesta HTTP 404 automáticamente
      throw new NotFoundException(`El usuario con el id: ${id} no existe`);
    }
    return user;
  }

  /**
   * Actualizar campos de un usuario
   * - Primero busca el usuario (si no existe, 404)
   * - Si cambian el email, verifica que el nuevo no esté usado
   * - Object.assign copia los campos nuevos sobre el objeto viejo
   * - save() hace UPDATE
   */
  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id); // reutiliza la validación 404

    // Solo si mandan un email nuevo y es distinto al actual, verifica duplicado
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      await this.ensureEmailIsAvailable(updateUserDto.email);
    }

    // Copia los campos que vienen en el body sobre el usuario encontrado
    Object.assign(user, updateUserDto);

    return this.usersRepository.save(user);
  }

  /**
   * "Borrar" con soft delete
   * No hacemos DELETE real, solo ponemos isActive=false
   * Así el historial se conserva y las órdenes no quedan huérfanas
   */
  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    user.isActive = false;
    await this.usersRepository.save(user); // UPDATE users SET isActive=false
  }

  // ===================================================================
  // HELPERS PRIVADOS — validaciones pequeñas reutilizables
  // ===================================================================

  /**
   * ¿El email ya está usado?
   * Si sí, lanza 409. Si no, no hace nada y deja continuar.
   */
  private async ensureEmailIsAvailable(email: string): Promise<void> {
    const existingUser = await this.usersRepository.findOneBy({ email });
    if (existingUser) {
      throw new ConflictException(
        'Ya existe un usuario con este correo electrónico',
      );
    }
  }

  /**
   * ¿El id (cédula) ya está usado?
   * Igual que email pero para id.
   */
  private async ensureIdIsAvailable(id: string): Promise<void> {
    const existingUser = await this.usersRepository.findOneBy({ id });
    if (existingUser) {
      throw new ConflictException(
        'Ya existe un usuario con este número de identificación',
      );
    }
  }
}
