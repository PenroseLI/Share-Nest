import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { BookingStatus } from '../entities/booking.entity';

export class FilterBookingDto {
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  // Filtra por inquilino 
  @IsOptional()
  @IsString()
  @Matches(/^\d{5,20}$/)
  tenantId?: string;
}