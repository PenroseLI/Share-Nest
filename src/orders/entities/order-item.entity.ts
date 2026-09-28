import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { Product } from '../../products/entities/product.entity';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'integer' })
  quantity!: number;

  // Precio unitario al momento de comprar — snapshot histórico.
  // No cambia si después Product.price cambia; así la orden conserva el precio original.
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unitPrice!: number;

  // ===================================================================
  // RELACIONES — al final, didáctico. Separadas de las columnas propias.
  // ===================================================================

  // FK explícita a orders.id
  @Column({ type: 'varchar' })
  orderId!: string;

  // Relación N:1 — muchos items pertenecen a UNA orden.
  // @ManyToOne(() => Order, order => order.items) es el inverso de Order.items.
  // @JoinColumn({ name: 'orderId' }) indica FK orderId → orders.id
  // onDelete: 'CASCADE' → al borrar la orden, se borran sus items automáticamente.
  // Ej: DELETE FROM orders WHERE id = ?  → borra también order_items de esa orden.
  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order!: Order;

  // FK explícita a products.id
  @Column({ type: 'varchar' })
  productId!: string;

  // Relación N:1 — muchos items referencian UN producto.
  // eager: true → al hacer find de OrderItem, TypeORM carga automáticamente
  // el Product relacionado (no necesitas .find({ relations: ['product'] })).
  // Didáctico para ver el producto dentro del item sin join manual.
  // onDelete: 'RESTRICT' → no deja borrar un producto si tiene items (evita huérfanos).
  // Si quisieras borrar productos con historial, usa 'SET NULL' y haz product nullable.
  @ManyToOne(() => Product, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'productId' })
  product!: Product;
}
