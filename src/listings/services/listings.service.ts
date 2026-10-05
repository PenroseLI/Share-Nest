/**
 * ListingsService — Lógica de Listings (habitaciones publicadas)
 * ----------------------------------------------------------------
 * Igual que ProductsService, pero con una relación: cada listing
 * pertenece a un anfitrión (users 1—N listings, FK hostId).
 *
 * Patrón: Controller recibe @Body/@Param/@Query → Service piensa y valida →
 * Repository guarda en la tabla listings.
 *
 * Filtros usan SOLO Repository (sin QueryBuilder), como en Products.
 */

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  FindOptionsWhere,
  LessThanOrEqual,
  Like,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { User, UserRole } from '../../users/entities/user.entity';
import { CreateListingDto } from '../dto/create-listing.dto';
import { FilterListingDto } from '../dto/filter-listing.dto';
import { UpdateListingDto } from '../dto/update-listing.dto';
import { Listing } from '../entities/listing.entity';

@Injectable()
export class ListingsService {
  constructor(
    @InjectRepository(Listing)
    private readonly listingsRepository: Repository<Listing>,
    // Necesitamos el repositorio de User para validar al anfitrión
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  /**
   * Crear habitación
   * Reglas del diagrama (además de las del DTO):
   * 1. El hostId debe existir y estar activo (404 si no).
   * 2. Su rol debe ser HOST o BOTH (400 si es SEEKER).
   */
  async create(createListingDto: CreateListingDto): Promise<Listing> {
    const host = await this.usersRepository.findOneBy({
      id: createListingDto.hostId,
      isActive: true,
    });
    if (!host) {
      throw new NotFoundException(
        `El usuario con el id: ${createListingDto.hostId} no existe`,
      );
    }
    if (host.role === UserRole.SEEKER) {
      throw new BadRequestException(
        'Solo un usuario con rol HOST o BOTH puede publicar habitaciones',
      );
    }

    // create() arma el objeto Listing en memoria
    const listing = this.listingsRepository.create(createListingDto);
    // save() lo guarda (INSERT) y retorna el listing con id uuid generado
    return this.listingsRepository.save(listing);
  }

  /**
   * Listar con filtros opcionales — SOLO con Repository (sin QueryBuilder)
   * Ejemplos:
   *   GET /listings                           → lista todo activo
   *   GET /listings?city=cali                 → LIKE %cali%
   *   GET /listings?minPrice=300000&maxPrice=700000 → rango de precio
   *   GET /listings?amenity=wifi              → solo las que incluyen wifi
   *
   * amenities es un simple-array (texto "wifi,lavadora,..." en la BD), así que
   * ese filtro se aplica sobre el resultado, comparando el elemento exacto.
   */
  async findAll(filter?: FilterListingDto): Promise<Listing[]> {
    // Filtro base: solo activos (soft delete)
    const where: FindOptionsWhere<Listing> = { isActive: true };

    // Filtro por ciudad — LIKE %cali% (si mandan ?city=cali)
    if (filter?.city) {
      where.city = Like(`%${filter.city}%`);
    }

    // Filtro por precio — combinamos min y max
    if (filter?.minPrice !== undefined && filter?.maxPrice !== undefined) {
      where.pricePerMonth = Between(filter.minPrice, filter.maxPrice);
    } else if (filter?.minPrice !== undefined) {
      where.pricePerMonth = MoreThanOrEqual(filter.minPrice);
    } else if (filter?.maxPrice !== undefined) {
      where.pricePerMonth = LessThanOrEqual(filter.maxPrice);
    }

    const listings = await this.listingsRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });

    // Filtro por comodidad exacta (sobre el arreglo ya cargado)
    const amenity = filter?.amenity;
    if (amenity) {
      return listings.filter((l) => l.amenities?.includes(amenity));
    }
    return listings;
  }

  /**
   * Buscar uno por uuid, solo si está activo
   * Si no existe → 404. Lo usa update() y remove().
   */
  async findOne(id: string): Promise<Listing> {
    const listing = await this.listingsRepository.findOneBy({
      id,
      isActive: true,
    });
    if (!listing) {
      throw new NotFoundException(`La habitación con el id: ${id} no existe`);
    }
    return listing;
  }

  /**
   * Actualizar — campos opcionales
   * 1. Busca el listing (404 si no existe)
   * 2. Copia los campos nuevos sobre el viejo
   * 3. Guarda (UPDATE)
   * El hostId no se puede cambiar: UpdateListingDto no lo incluye.
   */
  async update(
    id: string,
    updateListingDto: UpdateListingDto,
  ): Promise<Listing> {
    const listing = await this.findOne(id);
    Object.assign(listing, updateListingDto);
    return this.listingsRepository.save(listing);
  }

  /**
   * Soft delete — no borra, solo desactiva
   * Así no rompes bookings que ya usaron esa habitación (unitPrice queda en el historial)
   */
  async remove(id: string): Promise<void> {
    const listing = await this.findOne(id);
    listing.isActive = false;
    await this.listingsRepository.save(listing);
  }
}