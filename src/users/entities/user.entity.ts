import { Column, Entity, PrimaryColumn } from 'typeorm';

export enum UserRole {
  HOST = 'HOST',
  SEEKER = 'SEEKER',
  BOTH = 'BOTH',
}

@Entity('users')
export class User {
  @PrimaryColumn({ length: 20 })
  id!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ unique: true, length: 254 })
  email!: string;

  @Column({ type: 'integer' })
  age!: number;

  @Column({ length: 30 })
  phone!: string;

  @Column({ type: 'varchar', length: 10, default: UserRole.SEEKER })
  role!: UserRole;

  @Column({ type: 'text', nullable: true })
  bio?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  budgetMax?: number;

  @Column({ default: false })
  smoker!: boolean;

  @Column({ default: false })
  pets!: boolean;

  @Column({ default: true })
  isActive!: boolean;

  // ===================================================================
  // RELACIONES — esta entidad es standalone (intencional).
  // No tiene @OneToMany para mantenerla desacoplada:
  // - Listing tiene @ManyToOne(() => User) con FK hostId
  //   (users 1—N listings: el anfitrión publica habitaciones).
  // - Booking tiene @ManyToOne(() => User) con FK tenantId
  //   (users 1—N bookings: el inquilino hace solicitudes).
  // Así puedes hacer GET /bookings/user/:userId sin que User conozca
  // sus bookings. Si quisieras bidireccional, añadirías @OneToMany
  // aquí, pero genera import circular y acopla módulos. El diagrama
  // ER muestra la relación 1—N igual.
  // ===================================================================
}