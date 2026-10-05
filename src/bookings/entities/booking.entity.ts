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
import { BookingItem } from './booking-item.entity';

export enum BookingStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  CANCELLED = 'CANCELLED',
}

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Total snapshot al momento de crear — se calcula como Σ (unitPrice * months)
  // No se recalcula después, aunque Listing.pricePerMonth cambie.
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalPrice!: number;

  @Column({
    type: 'varchar',
    default: BookingStatus.PENDING,
  })
  status!: BookingStatus;

  @CreateDateColumn()
  createdAt!: Date;

  // ===================================================================
  // RELACIONES — al final para que se vea claro qué es columna propia
  // y qué es vínculo con otras tablas.
  // ===================================================================

  // FK explícita al inquilino. Permite crear un booking con solo tenantId
  // sin cargar la entidad User completa.
  // Ej: { tenantId: "1234567890", items: [...] }
  @Column({ type: 'varchar' })
  tenantId!: string;

  // Relación N:1 — muchos bookings pertenecen a UN usuario (el inquilino).
  // @JoinColumn({ name: 'tenantId' }) dice que la FK en la tabla bookings
  // se llama tenantId y apunta a users.id.
  // onDelete: 'CASCADE' didáctico: si borras el usuario, se borran sus bookings.
  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'tenantId' })
  tenant!: User;

  // Relación 1:N — un booking tiene MUCHOS items (una o varias habitaciones).
  // cascade: true → al hacer manager.save(booking) con items, TypeORM guarda
  // automáticamente los BookingItem sin guardarlos uno a uno.
  // No lleva @JoinColumn porque la FK está en booking_items (lado N).
  @OneToMany(() => BookingItem, (item) => item.booking, { cascade: true })
  items!: BookingItem[];
}