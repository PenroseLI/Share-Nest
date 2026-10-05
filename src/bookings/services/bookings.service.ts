
// Nuestros cambios respecto al service de Orders: 
// Como no hay stock que descontar ni restaurar, entonces validamos reglas de las cajas:
// 1. El inquilino y la habitación existen y están activos
// 2. La habitación está ACTIVE (status != PAUSED && status != RENTED)
// nadie reserva su propia habitación (tenantId ≠ listing.hostId)
//  la fecha de inicio no está en el pasado

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import {
  Listing,
  ListingStatus,
} from '../../listings/entities/listing.entity';
import { User } from '../../users/entities/user.entity';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { FilterBookingDto } from '../dto/filter-booking.dto';
import { UpdateBookingDto } from '../dto/update-booking.dto';
import { BookingItem } from '../entities/booking-item.entity';
import { Booking, BookingStatus } from '../entities/booking.entity';

// Fecha de hoy como 'YYYY-MM-DD' 
function todayLocal(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

// Esta función de sumar meses se extrajo de la función JS addMonths(date, amount), donde:
//      2026-11-30 + 3 meses → 2027-02-28, no 2027-03-02

function addMonths(startDate: string, months: number): string {
  const date = new Date(`${startDate}T00:00:00Z`);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Listing)
    private readonly listingsRepository: Repository<Listing>,
  ) {}

 // ===================================================================
  // CREAR ORDEN — solo con Repository, paso a paso y sencillo
  // ===================================================================

   // POST /bookings  { tenantId, items:[{listingId, startDate, months}] }
   // 1. Buscar inquilino con usersRepository.findOneBy
   // 2. Por cada item: buscar habitación, validar reglas, calcular endDate, tomar el precio actual como snapshot y sumar al total
   // 3. Crear Booking con items y guardar con bookingsRepository.save

  async create(createBookingDto: CreateBookingDto): Promise<Booking> {
    // 1. Inquilino debe existir y estar activo
    const tenant = await this.usersRepository.findOneBy({
      id: createBookingDto.tenantId,
      isActive: true,
    });
    if (!tenant) {
      throw new NotFoundException(
        `El usuario con id ${createBookingDto.tenantId} no existe o está inactivo`,
      );
    }

    // 2. Validar habitaciones y armar items
    const today = todayLocal();
    let totalPrice = 0;
    const bookingItems: Partial<BookingItem>[] = [];

    for (const itemDto of createBookingDto.items) {
      const listing = await this.listingsRepository.findOneBy({
        id: itemDto.listingId,
        isActive: true,
      });
      if (!listing) {
        throw new NotFoundException(
          `La habitación con id ${itemDto.listingId} no existe o está inactiva`,
        );
      }

      // Solo se reservan habitaciones ACTIVE
      if (listing.status !== ListingStatus.ACTIVE) {
        throw new BadRequestException(
          `La habitación "${listing.title}" no está disponible (estado: ${listing.status})`,
        );
      }

      // Nadie reserva su propia habitación
      if (listing.hostId === tenant.id) {
        throw new BadRequestException(
          'No puedes reservar una habitación que tú mismo publicaste',
        );
      }

      // La fecha de inicio no puede estar en el pasado (YYYY-MM-DD se compara como texto)
      if (itemDto.startDate < today) {
        throw new BadRequestException(
          `La fecha de inicio ${itemDto.startDate} ya pasó`,
        );
      }

      // Snapshot del precio mensual actual
      const unitPrice = Number(listing.pricePerMonth);
      totalPrice += unitPrice * itemDto.months;

      bookingItems.push({
        listingId: listing.id,
        startDate: itemDto.startDate,
        endDate: addMonths(itemDto.startDate, itemDto.months),
        months: itemDto.months,
        unitPrice,
      });
    }

    // 3. Crear Booking con items — cascade guarda los items automáticamente
    const booking = this.bookingsRepository.create({
      tenantId: tenant.id,
      totalPrice: Number(totalPrice.toFixed(2)),
      status: BookingStatus.PENDING,
      items: bookingItems as BookingItem[],
    });

    const savedBooking = await this.bookingsRepository.save(booking);

    // 4. Retornar completo con relaciones
    return this.findOne(savedBooking.id);
  }

  // ===================================================================
  // LECTURAS — solo Repository
  // ===================================================================
  /**
   * GET /bookings?status=PENDING&tenantId=10012345
   * Solo Repository.find con where y relations
   */
  async findAll(filter?: FilterBookingDto): Promise<Booking[]> {
    const where: FindOptionsWhere<Booking> = {};
    if (filter?.status) where.status = filter.status;
    if (filter?.tenantId) where.tenantId = filter.tenantId;

    return this.bookingsRepository.find({
      where,
      relations: ['items', 'tenant'],
      order: { createdAt: 'DESC' },
    });
  }

  /** GET /bookings/:id */
  async findOne(id: string): Promise<Booking> {
    const booking = await this.bookingsRepository.findOne({
      where: { id },
      relations: ['items', 'tenant'],
    });
    if (!booking) {
      throw new NotFoundException(`El booking con id ${id} no existe`);
    }
    return booking;
  }

  /** GET /bookings/user/:userId — bookings de un inquilino */
  findByUser(userId: string): Promise<Booking[]> {
    return this.bookingsRepository.find({
      where: { tenantId: userId },
      relations: ['items', 'tenant'],
      order: { createdAt: 'DESC' },
    });
  }

  // ===================================================================
  // ACTUALIZAR Y CANCELAR — solo Repository
  // ===================================================================
  /**
   * PUT /bookings/:id { status }
   * Transiciones permitidas:
   *   PENDING  → ACCEPTED o CANCELLED
   *   ACCEPTED → CANCELLED
   * Un booking CANCELLED no se puede reactivar ni volver a PENDING.
   */
  async update(id: string, dto: UpdateBookingDto): Promise<Booking> {
    const booking = await this.findOne(id);
    if (dto.status && dto.status !== booking.status) {
      if (booking.status === BookingStatus.CANCELLED) {
        throw new BadRequestException(
          'Un booking cancelado no se puede modificar',
        );
      }
      if (dto.status === BookingStatus.PENDING) {
        throw new BadRequestException(
          'No se puede volver a PENDING desde otro estado',
        );
      }
      if (dto.status === BookingStatus.CANCELLED) {
        return this.cancel(id);
      }
      booking.status = dto.status; // ACCEPTED
      await this.bookingsRepository.save(booking);
      return this.findOne(id);
    }
    return booking;
  }

  /**
   * PUT /bookings/:id/cancel
   * Como no tenemos stock, solo se cambia el estado, sin borrar nada.
   */
  async cancel(id: string): Promise<Booking> {
    const booking = await this.findOne(id);
    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('El booking ya está cancelado');
    }
    booking.status = BookingStatus.CANCELLED;
    await this.bookingsRepository.save(booking);
    return this.findOne(id);
  }

  /** DELETE /bookings/:id — borra el booking y sus items (onDelete CASCADE) */
  async remove(id: string): Promise<void> {
    const booking = await this.findOne(id);
    await this.bookingsRepository.remove(booking);
  }
}