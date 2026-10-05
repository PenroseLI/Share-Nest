import { IsEnum, IsOptional } from 'class-validator';
import { BookingStatus } from '../entities/booking.entity';

export class UpdateBookingDto {
  // Solo permitimos cambiar estado. En el 4b el service validará las
  // transiciones (PENDING → ACCEPTED/CANCELLED).
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;
}