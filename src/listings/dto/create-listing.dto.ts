import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ListingStatus } from '../entities/listing.entity';

export class CreateListingDto {
  @IsString()
  @Matches(/^\d{5,20}$/) 
  hostId!: string;

  @IsString()
  @Length(3, 120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsString()
  @Length(2, 80)
  city!: string;

  @IsString()
  @Length(5, 200)
  address!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  pricePerMonth!: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value.map((v: unknown) =>
          typeof v === 'string' ? v.trim().toLowerCase() : v,
        )
      : value,
  )
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Matches(/^[^,]+$/, { each: true })
  amenities?: string[];

  @IsInt()
  @Min(1)
  @Max(10)
  maxRoommates!: number;

  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus;
}