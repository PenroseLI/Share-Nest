/**
 * OrdersService — Tienda con relaciones + transacciones (didáctico)
 * ---------------------------------------------------------------
 * Este es el servicio más completo del seed. Demuestra:
 * - Relaciones: Order N:1 User, Order 1:N OrderItem N:1 Product
 * - Transacción con QueryRunner para que todo sea atómico (todo o nada)
 * - Filtros simples con QueryBuilder
 *
 * Concepto clave: Crear una orden toca 2 tablas (orders y products.stock)
 * y debe ser atómico: si falla el stock de un producto, no debe quedar
 * la orden a medias ni descontar stock de los otros productos. Por eso
 * usamos transacción.
 */

import {
  BadRequestException, // 400 — dato inválido (stock insuficiente, estado inválido)
  Injectable,
  NotFoundException, // 404 — no existe
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CreateOrderDto } from '../dto/create-order.dto';
import { FilterOrderDto } from '../dto/filter-order.dto';
import { UpdateOrderDto } from '../dto/update-order.dto';
import { Order, OrderStatus } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { User } from '../../users/entities/user.entity';
import { Product } from '../../products/entities/product.entity';

@Injectable()
export class OrdersService {
  // Necesitamos 2 cosas:
  // - ordersRepository para lecturas simples (findAll, findOne)
  // - dataSource para crear QueryRunner y hacer transacciones
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    private readonly dataSource: DataSource,
  ) {}

  // ===================================================================
  // CREAR ORDEN — con transacción didáctica paso a paso
  // ===================================================================
  /**
   * POST /orders  { userId, items:[{productId, quantity}] }
   * Pasos:
   * 1. Validar usuario existe y activo
   * 2. Por cada item: validar producto existe/activo, stock suficiente,
   *    sumar al total y descontar stock (dentro de la transacción)
   * 3. Crear Order con items (cascade) y guardar
   * 4. Commit → todo OK o Rollback → nada se guarda
   */
  async create(createOrderDto: CreateOrderDto): Promise<Order> {
    // QueryRunner = conexión dedicada para esta transacción
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect(); // pide una conexión del pool
    await queryRunner.startTransaction(); // abre transacción (BEGIN)

    try {
      // --- 1. Usuario debe existir y estar activo ---
      const user = await queryRunner.manager.findOneBy(User, {
        id: createOrderDto.userId,
        isActive: true,
      });
      if (!user) {
        throw new NotFoundException(
          `El usuario con id ${createOrderDto.userId} no existe o está inactivo`,
        );
      }

      // --- 2. Validar cada producto, calcular total y descontar stock ---
      let total = 0;
      const orderItems: Partial<OrderItem>[] = []; // lo que irá dentro de Order

      for (const itemDto of createOrderDto.items) {
        // ¿Existe el producto y está activo?
        const product = await queryRunner.manager.findOneBy(Product, {
          id: itemDto.productId,
          isActive: true,
        });
        if (!product) {
          throw new NotFoundException(
            `El producto con id ${itemDto.productId} no existe o está inactivo`,
          );
        }

        // ¿Hay stock suficiente?
        if (product.stock < itemDto.quantity) {
          throw new BadRequestException(
            `Stock insuficiente para ${product.name}: disponible ${product.stock}, solicitado ${itemDto.quantity}`,
          );
        }

        // Precio al momento de la compra (snapshot)
        const unitPrice = Number(product.price);
        total += unitPrice * itemDto.quantity;

        // Descontar stock AHORA, dentro de la transacción
        // Si luego algo falla y hacemos rollback, este descuento se deshace
        product.stock -= itemDto.quantity;
        await queryRunner.manager.save(Product, product);

        // Preparar el item que irá dentro de la orden
        orderItems.push({
          productId: product.id,
          quantity: itemDto.quantity,
          unitPrice, // guardamos el precio histórico
        });
      }

      // --- 3. Crear la orden con sus items (cascade) ---
      // Gracias a cascade:true en Order.items, al guardar Order se guardan los items
      const order = queryRunner.manager.create(Order, {
        userId: user.id, // FK explícita
        total: Number(total.toFixed(2)), // 2 decimales
        status: OrderStatus.PENDING, // toda orden nace PENDING
        items: orderItems as OrderItem[],
      });

      const savedOrder = await queryRunner.manager.save(Order, order);

      // --- 4. Todo OK → confirmar ---
      await queryRunner.commitTransaction();

      // Retornamos la orden completa con relaciones (user y items.product)
      // findOne usa relations, así el cliente ve el detalle
      return this.findOne(savedOrder.id);
    } catch (error) {
      // Algo falló → deshacer todo (stock, orden, items)
      await queryRunner.rollbackTransaction();
      throw error; // Nest lo convierte en 404/400 según el throw
    } finally {
      // Siempre liberar la conexión, haya ido bien o mal
      await queryRunner.release();
    }
  }

  // ===================================================================
  // LECTURAS CON FILTROS SIMPLES (Rama 4)
  // ===================================================================
  /**
   * GET /orders?status=PENDING&userId=1234567890
   * Filtros opcionales. Si no mandan nada, lista todo.
   * Usa QueryBuilder con leftJoin para traer user y items.product en una sola query.
   */
  async findAll(filter?: FilterOrderDto): Promise<Order[]> {
    const qb = this.ordersRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'item')
      .leftJoinAndSelect('item.product', 'product') // eager ya lo trae, pero lo dejamos explícito
      .leftJoinAndSelect('order.user', 'user');

    if (filter?.status) {
      qb.andWhere('order.status = :status', { status: filter.status });
    }
    if (filter?.userId) {
      qb.andWhere('order.userId = :userId', { userId: filter.userId });
    }

    qb.orderBy('order.createdAt', 'DESC');
    return qb.getMany();
  }

  /**
   * GET /orders/:id — detalle con user e items
   */
  async findOne(id: string): Promise<Order> {
    const order = await this.ordersRepository.findOne({
      where: { id },
      relations: ['items', 'user'], // trae relaciones
    });
    if (!order) {
      throw new NotFoundException(`La orden con id ${id} no existe`);
    }
    return order;
  }

  /**
   * GET /orders/user/:userId — atajo para ver las órdenes de un usuario
   * Es lo mismo que GET /orders?userId=... pero con URL limpia
   */
  findByUser(userId: string): Promise<Order[]> {
    return this.ordersRepository.find({
      where: { userId },
      relations: ['items', 'user'],
      order: { createdAt: 'DESC' },
    });
  }

  // ===================================================================
  // ACTUALIZAR ESTADO
  // ===================================================================
  /**
   * PUT /orders/:id  { status: "PAID" | "CANCELLED" }
   * Solo se permite PENDING → PAID o CANCELLED.
   * Si es CANCELLED, llama a cancel() que restaura stock.
   */
  async update(id: string, dto: UpdateOrderDto): Promise<Order> {
    const order = await this.findOne(id);
    if (dto.status && dto.status !== order.status) {
      // Solo desde PENDING se puede cambiar
      if (order.status !== OrderStatus.PENDING) {
        throw new BadRequestException(
          `Solo se puede cambiar estado desde PENDING, estado actual: ${order.status}`,
        );
      }
      if (dto.status === OrderStatus.CANCELLED) {
        return this.cancel(id); // cancela con transacción y restaura stock
      }
      order.status = dto.status;
      return this.ordersRepository.save(order);
    }
    return order;
  }

  /**
   * PUT /orders/:id/cancel — cancela y restaura stock en transacción
   * No se puede cancelar una PAID o ya CANCELLED.
   */
  async cancel(id: string): Promise<Order> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const order = await queryRunner.manager.findOne(Order, {
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

      // Devolver stock a cada producto
      for (const item of order.items) {
        const product = await queryRunner.manager.findOneBy(Product, {
          id: item.productId,
        });
        if (product) {
          product.stock += item.quantity;
          await queryRunner.manager.save(Product, product);
        }
      }

      order.status = OrderStatus.CANCELLED;
      await queryRunner.manager.save(Order, order);
      await queryRunner.commitTransaction();
      return this.findOne(id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * DELETE /orders/:id — borrado hard didáctico
   * En producción se prefiere soft delete o cancel, aquí borra real.
   * Si estaba PENDING, primero restaura stock vía cancel().
   */
  async remove(id: string): Promise<void> {
    const order = await this.findOne(id);
    if (order.status === OrderStatus.PENDING) {
      await this.cancel(id);
    }
    await this.ordersRepository.remove(order);
  }
}
