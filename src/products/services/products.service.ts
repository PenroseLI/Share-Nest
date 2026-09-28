/**
 * ProductsService — Lógica de Products (standalone, sin relaciones)
 * ----------------------------------------------------------------
 * Es el CRUD más sencillo del proyecto, intencionalmente sin relaciones
 * para que veas el patrón base antes de ver Orders con transacciones.
 *
 * Patrón: Controller recibe @Body/@Param/@Query → Service piensa y valida →
 * Repository guarda en la tabla products.
 *
 * Filtros usan SOLO Repository (sin QueryBuilder) — didáctico simple con TypeORM.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  FindOptionsWhere,
  LessThanOrEqual,
  Like,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { CreateProductDto } from '../dto/create-product.dto';
import { FilterProductDto } from '../dto/filter-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { Product } from '../entities/product.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
  ) {}

  /**
   * Crear producto
   * No hay validación de duplicado por nombre (se permite repetir nombre),
   * solo validación de DTO (name 2-120, price >0, stock >=0) que ya hace ValidationPipe.
   */
  async create(createProductDto: CreateProductDto): Promise<Product> {
    // create() arma el objeto Product en memoria
    const product = this.productsRepository.create(createProductDto);
    // save() lo guarda (INSERT) y retorna el producto con id uuid generado
    return this.productsRepository.save(product);
  }

  /**
   * Listar con filtros opcionales — SOLO con Repository (sin QueryBuilder)
   * Ejemplos:
   *   GET /products                          → lista todo activo
   *   GET /products?name=whey               → LIKE %whey% (contiene, case-insensitive en sqlite)
   *   GET /products?minPrice=50&maxPrice=200 → rango precio
   *   GET /products?minStock=10             → stock >=10
   *
   * Usamos FindOptionsWhere y operadores de TypeORM: Like, Between, MoreThanOrEqual, LessThanOrEqual.
   * Todo es Repository.find(), nada de query raro.
   */
  async findAll(filter?: FilterProductDto): Promise<Product[]> {
    // Empezamos con el filtro base: solo activos (soft delete)
    const where: FindOptionsWhere<Product> = { isActive: true };

    // Filtro por nombre — LIKE %whey% (si mandan ?name=whey)
    if (filter?.name) {
      where.name = Like(`%${filter.name}%`);
    }

    // Filtro por precio — combinamos min y max
    if (filter?.minPrice !== undefined && filter?.maxPrice !== undefined) {
      where.price = Between(filter.minPrice, filter.maxPrice);
    } else if (filter?.minPrice !== undefined) {
      where.price = MoreThanOrEqual(filter.minPrice);
    } else if (filter?.maxPrice !== undefined) {
      where.price = LessThanOrEqual(filter.maxPrice);
    }

    // Filtro por stock — igual que precio
    if (filter?.minStock !== undefined && filter?.maxStock !== undefined) {
      where.stock = Between(filter.minStock, filter.maxStock);
    } else if (filter?.minStock !== undefined) {
      where.stock = MoreThanOrEqual(filter.minStock);
    } else if (filter?.maxStock !== undefined) {
      where.stock = LessThanOrEqual(filter.maxStock);
    }

    // Repository.find con where y order — todo con Repository, nada de QueryBuilder
    return this.productsRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Buscar uno por uuid, solo si está activo
   * Si no existe → 404. Lo usa update() y remove().
   */
  async findOne(id: string): Promise<Product> {
    const product = await this.productsRepository.findOneBy({
      id,
      isActive: true,
    });
    if (!product) {
      throw new NotFoundException(`El producto con el id: ${id} no existe`);
    }
    return product;
  }

  /**
   * Actualizar — campos opcionales
   * 1. Busca el producto (404 si no existe)
   * 2. Copia los campos nuevos sobre el viejo
   * 3. Guarda (UPDATE)
   */
  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    const product = await this.findOne(id);
    Object.assign(product, updateProductDto);
    return this.productsRepository.save(product);
  }

  /**
   * Soft delete — no borra, solo desactiva
   * Así no rompes órdenes que ya usaron ese producto (unitPrice queda en el historial)
   */
  async remove(id: string): Promise<void> {
    const product = await this.findOne(id);
    product.isActive = false;
    await this.productsRepository.save(product);
  }
}
