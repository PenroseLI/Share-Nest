import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Booking } from './booking.entity';
import { Listing } from '../../listings/entities/listing.entity';

@Entity('booking_items')
export class BookingItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Fechas como texto 'YYYY-MM-DD' (type 'date' no guarda hora).
  // endDate no la envía el cliente: el service la calcula como startDate + months.
  @Column({ type: 'date' })
  startDate!: string;

  @Column({ type: 'date' })
  endDate!: string;

  // Cantidad de meses reservados.
  @Column({ type: 'integer' })
  months!: number;

  // Precio mensual al momento de reservar — snapshot histórico.
  // No cambia si después Listing.pricePerMonth cambia.
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unitPrice!: number;

  // ===================================================================
  // RELACIONES — al final, separadas de las columnas propias.
  // ===================================================================

  // FK explícita a bookings.id
  @Column({ type: 'varchar' })
  bookingId!: string;

  // Relación N:1 — muchos items pertenecen a UN booking.
  // onDelete: 'CASCADE' → al borrar el booking, se borran sus items.
  @ManyToOne(() => Booking, (booking) => booking.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bookingId' })
  booking!: Booking;

  // FK explícita a listings.id
  @Column({ type: 'varchar' })
  listingId!: string;

  // Relación N:1 — muchos items referencian UNA habitación.
  // eager: true → al hacer find de BookingItem, TypeORM carga automáticamente
  // el Listing relacionado (sin .find({ relations: ['listing'] })).
  // onDelete: 'RESTRICT' → no deja borrar una habitación si tiene items.
  @ManyToOne(() => Listing, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'listingId' })
  listing!: Listing;
}