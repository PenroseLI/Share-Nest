import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Listing } from '../listings/entities/listing.entity';
import { User } from '../users/entities/user.entity';
import { BookingsController } from './controllers/bookings.controller';
import { BookingItem } from './entities/booking-item.entity';
import { Booking } from './entities/booking.entity';
import { BookingsService } from './services/bookings.service';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, BookingItem, User, Listing])],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}