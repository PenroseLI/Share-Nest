import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 120 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price!: number;

  @Column({ type: 'integer' })
  stock!: number;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  // ===================================================================
  // RELACIONES — standalone en Rama 2-4 (intencional).
  // Product no tiene @OneToMany a OrderItem para mantenerlo desacoplado.
  // OrderItem ya tiene @ManyToOne(() => Product, { eager: true }),
  // así al traer una orden ves el producto sin que Product conozca sus items.
  // Si quisieras bidireccional (ver en qué órdenes aparece un producto):
  //   @OneToMany(() => OrderItem, (oi) => oi.product)
  //   orderItems: OrderItem[];
  // Se deja unidireccional para didáctica y evitar acoplar módulos.
  // ===================================================================
}
