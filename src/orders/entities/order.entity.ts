import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { OrderItem } from './order-item.entity';

export enum OrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Total snapshot al momento de crear — se calcula como Σ (unitPrice * quantity)
  // No se recalcula después, aunque Product.price cambie.
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total!: number;

  @Column({
    type: 'varchar',
    default: OrderStatus.PENDING,
  })
  status!: OrderStatus;

  @CreateDateColumn()
  createdAt!: Date;

  // ===================================================================
  // RELACIONES — al final para que se vea claro qué es columna propia
  // y qué es vínculo con otras tablas. Didáctico para estudiantes.
  // ===================================================================

  // FK explícita. Se guarda como varchar en BD y permite crear una orden
  // con solo userId sin necesidad de cargar la entidad User completa.
  // Ej: { userId: "1234567890", items: [...] }
  @Column({ type: 'varchar' })
  userId!: string;

  // Relación N:1 — muchas órdenes pertenecen a UN usuario.
  // @ManyToOne(() => User) indica el lado N.
  // @JoinColumn({ name: 'userId' }) dice que la FK en la tabla orders
  // se llama userId y apunta a users.id.
  // onDelete: 'CASCADE' didáctico: si borras el usuario, se borran sus órdenes.
  // En prod podrías usar 'RESTRICT' para evitar borrar usuarios con órdenes.
  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'userId' })
  user!: User;

  // Relación 1:N — una orden tiene MUCHOS items.
  // @OneToMany(() => OrderItem, item => item.order) es el inverso de OrderItem.order.
  // cascade: true → al hacer manager.save(order) con items, TypeORM guarda
  // automáticamente los OrderItem sin tener que guardarlos uno a uno.
  // No lleva @JoinColumn porque la FK está en order_items (lado N).
  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items!: OrderItem[];
}
