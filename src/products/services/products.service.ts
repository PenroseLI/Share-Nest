/**
 * ProductsService — Lógica de Products (standalone, sin relaciones)
 * ----------------------------------------------------------------
 * Es el CRUD más sencillo del proyecto, intencionalmente sin relaciones
 * para que veas el patrón base antes de ver Orders con transacciones.
 *
 * Patrón: Controller recibe @Body/@Param/@Query → Service piensa y valida →
 * Repository guarda en la tabla products.
 *
 * Filtros (Rama 4) usan QueryBuilder para armar la consulta solo con
 * los filtros que el usuario mandó por ?name=...&minPrice=...
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
   * Listar con filtros opcionales — didáctico QueryBuilder
   * Ejemplos:
   *   GET /products                          → lista todo activo
   *   GET /products?name=whey               → LIKE %whey% case-insensitive
   *   GET /products?minPrice=50&maxPrice=200 → rango precio
   *   GET /products?minStock=10             → stock >=10
   *
   * ¿Por qué QueryBuilder y no findBy? Con filtros opcionales es más claro
   * ir añadiendo andWhere solo si el filtro viene, que armar un objeto where dinámico.
   */
  async findAll(filter?: FilterProductDto): Promise<Product[]> {
    // Empezamos con "donde isActive=true" (soft delete)
    const qb = this.productsRepository.createQueryBuilder('product');
    qb.where('product.isActive = :isActive', { isActive: true });

    // Si mandaron ?name=whey, filtra con LIKE insensible a mayúsculas
    // En sqlite no hay ILIKE, por eso usamos LOWER()
    if (filter?.name) {
      qb.andWhere('LOWER(product.name) LIKE LOWER(:name)', {
        name: `%${filter.name}%`, // % significa "contiene"
      });
    }

    // Filtros numéricos — solo si vienen en la URL
    if (filter?.minPrice !== undefined) {
      qb.andWhere('product.price >= :minPrice', { minPrice: filter.minPrice });
    }
    if (filter?.maxPrice !== undefined) {
      qb.andWhere('product.price <= :maxPrice', { maxPrice: filter.maxPrice });
    }
    if (filter?.minStock !== undefined) {
      qb.andWhere('product.stock >= :minStock', { minStock: filter.minStock });
    }
    if (filter?.maxStock !== undefined) {
      qb.andWhere('product.stock <= :maxStock', { maxStock: filter.maxStock });
    }

    // Ordena del más nuevo al más viejo
    qb.orderBy('product.createdAt', 'DESC');

    // Ejecuta la consulta armada y retorna el array
    return qb.getMany();
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
