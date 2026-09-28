/**
 * OrdersService — Tienda con relaciones (solo Repository, nada raro)
 * ---------------------------------------------------------------
 * Todo es Repository — cada entidad tiene su repositorio inyectado.
 * No usamos QueryRunner ni manager, solo:
 *   usersRepository, productsRepository, ordersRepository
 * que vienen de TypeOrmModule.forFeature([...]) en orders.module.ts
 *
 * Así el estudiante ve el patrón más simple de TypeORM:
 *   repository.findOneBy / find / create / save / remove
 */

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { CreateOrderDto } from '../dto/create-order.dto';
import { FilterOrderDto } from '../dto/filter-order.dto';
import { UpdateOrderDto } from '../dto/update-order.dto';
import { Order, OrderStatus } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { User } from '../../users/entities/user.entity';
import { Product } from '../../products/entities/product.entity';

@Injectable()
export class OrdersService {
  // Cada entidad tiene su Repository — solo eso, nada de DataSource
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemsRepository: Repository<OrderItem>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
  ) {}

  // ===================================================================
  // CREAR ORDEN — solo con Repository, paso a paso y sencillo
  // ===================================================================
  /**
   * POST /orders  { userId, items:[{productId, quantity}] }
   * 1. Buscar usuario con usersRepository.findOneBy (si no existe → 404)
   * 2. Por cada item: buscar producto con productsRepository.findOneBy,
   *    validar stock, sumar total y descontar stock con productsRepository.save
   * 3. Crear Order con items y guardar con ordersRepository.save (cascade guarda items)
   * Todo con Repository, sin QueryRunner. En producción se usaría transacción,
   * aquí lo dejamos simple para la clase.
   */
  async create(createOrderDto: CreateOrderDto): Promise<Order> {
    // 1. Usuario debe existir y estar activo
    const user = await this.usersRepository.findOneBy({
      id: createOrderDto.userId,
      isActive: true,
    });
    if (!user) {
      throw new NotFoundException(
        `El usuario con id ${createOrderDto.userId} no existe o está inactivo`,
      );
    }

    // 2. Validar productos y armar items
    let total = 0;
    const orderItems: Partial<OrderItem>[] = [];

    for (const itemDto of createOrderDto.items) {
      // Buscar producto con Repository
      const product = await this.productsRepository.findOneBy({
        id: itemDto.productId,
        isActive: true,
      });
      if (!product) {
        throw new NotFoundException(
          `El producto con id ${itemDto.productId} no existe o está inactivo`,
        );
      }

      // Validar stock
      if (product.stock < itemDto.quantity) {
        throw new BadRequestException(
          `Stock insuficiente para ${product.name}: disponible ${product.stock}, solicitado ${itemDto.quantity}`,
        );
      }

      // Calcular total con precio actual (snapshot)
      const unitPrice = Number(product.price);
      total += unitPrice * itemDto.quantity;

      // Descontar stock con Repository.save
      product.stock -= itemDto.quantity;
      await this.productsRepository.save(product);

      orderItems.push({
        productId: product.id,
        quantity: itemDto.quantity,
        unitPrice,
      });
    }

    // 3. Crear orden con items — cascade guarda los items automáticamente
    const order = this.ordersRepository.create({
      userId: user.id,
      total: Number(total.toFixed(2)),
      status: OrderStatus.PENDING,
      items: orderItems as OrderItem[],
    });

    const savedOrder = await this.ordersRepository.save(order);

    // 4. Retornar completa con relaciones
    return this.findOne(savedOrder.id);
  }

  // ===================================================================
  // LECTURAS — solo Repository
  // ===================================================================
  /**
   * GET /orders?status=PENDING&userId=123
   * Solo Repository.find con where y relations
   */
  async findAll(filter?: FilterOrderDto): Promise<Order[]> {
    const where: FindOptionsWhere<Order> = {};
    if (filter?.status) where.status = filter.status;
    if (filter?.userId) where.userId = filter.userId;

    return this.ordersRepository.find({
      where,
      relations: ['items', 'user'],
      order: { createdAt: 'DESC' },
    });
  }

  /** GET /orders/:id */
  async findOne(id: string): Promise<Order> {
    const order = await this.ordersRepository.findOne({
      where: { id },
      relations: ['items', 'user'],
    });
    if (!order) {
      throw new NotFoundException(`La orden con id ${id} no existe`);
    }
    return order;
  }

  /** GET /orders/user/:userId */
  findByUser(userId: string): Promise<Order[]> {
    return this.ordersRepository.find({
      where: { userId },
      relations: ['items', 'user'],
      order: { createdAt: 'DESC' },
    });
  }

  // ===================================================================
  // ACTUALIZAR Y CANCELAR — solo Repository
  // ===================================================================
  /**
   * PUT /orders/:id { status }
   * Solo PENDING → PAID o CANCELLED
   */
  async update(id: string, dto: UpdateOrderDto): Promise<Order> {
    const order = await this.findOne(id);
    if (dto.status && dto.status !== order.status) {
      if (order.status !== OrderStatus.PENDING) {
        throw new BadRequestException(
          `Solo se puede cambiar estado desde PENDING, estado actual: ${order.status}`,
        );
      }
      if (dto.status === OrderStatus.CANCELLED) {
        return this.cancel(id);
      }
      order.status = dto.status;
      return this.ordersRepository.save(order);
    }
    return order;
  }

  /**
   * PUT /orders/:id/cancel — restaura stock con Repository
   * No usa QueryRunner, solo Repository.findOne y save en loop.
   */
  async cancel(id: string): Promise<Order> {
    const order = await this.ordersRepository.findOne({
      where: { id },
      relations: ['items'],
    });
    if (!order) {
      throw new NotFoundException(`La orden con id ${id} no existe`);
    }
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('La orden ya está cancelada');
    }
    if (order.status === OrderStatus.PAID) {
      throw new BadRequestException('No se puede cancelar una orden pagada');
    }

    // Restaurar stock con productsRepository
    for (const item of order.items) {
      const product = await this.productsRepository.findOneBy({
        id: item.productId,
      });
      if (product) {
        product.stock += item.quantity;
        await this.productsRepository.save(product);
      }
    }

    order.status = OrderStatus.CANCELLED;
    await this.ordersRepository.save(order);
    return this.findOne(id);
  }

  /** DELETE /orders/:id */
  async remove(id: string): Promise<void> {
    const order = await this.findOne(id);
    if (order.status === OrderStatus.PENDING) {
      await this.cancel(id); // restaura stock primero
    }
    await this.ordersRepository.remove(order);
  }
}
