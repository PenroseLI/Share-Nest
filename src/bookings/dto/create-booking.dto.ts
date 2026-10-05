import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateBookingItemDto {
  @IsUUID()
  listingId!: string;

  // Formato YYYY-MM-DD
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  months!: number;
}

export class CreateBookingDto {
  // Reusa la misma validación que User.id: 5-20 dígitos
  @IsString()
  @Matches(/^\d{5,20}$/)
  tenantId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateBookingItemDto)
  items!: CreateBookingItemDto[];
}