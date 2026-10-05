import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum ListingStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  RENTED = 'RENTED',
}

@Entity('listings')
export class Listing {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // FK al anfitrión (users 1—N listings). Mismo largo que users.id.
  @Column({ length: 20 })
  hostId!: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'hostId' })
  host!: User;

  @Column({ length: 120 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ length: 80 })
  city!: string;

  @Column({ length: 200 })
  address!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  pricePerMonth!: number;

  // Comodidades como arreglo en el código; en la BD queda "wifi,lavadora,..."
  @Column({ type: 'simple-array', nullable: true })
  amenities!: string[] | null;

  @Column({ type: 'integer' })
  maxRoommates!: number;

  @Column({ type: 'varchar', length: 10, default: ListingStatus.ACTIVE })
  status!: ListingStatus;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  // ===================================================================
  // RELACIONES
  // - @ManyToOne(() => User) con FK hostId: users 1—N listings.
  //   User no conoce sus listings (unidireccional, igual que antes).
  // - Listing no tiene @OneToMany a BookingItem para mantenerlo
  //   desacoplado: BookingItem ya tiene @ManyToOne(() => Listing,
  //   { eager: true }), así al traer un booking ves la habitación sin
  //   que Listing conozca sus items.
  // ===================================================================
}