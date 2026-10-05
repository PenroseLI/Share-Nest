import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
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
import { UserRole } from '../entities/user.entity';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  name?: string;

  @IsOptional()
  @Transform(({ value }: { value: string }) => value?.trim().toLowerCase())
  @IsEmail()
  @Length(5, 254)
  email?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(130)
  age?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/) // +? permite el prefijo internacional; [0-9]{7,15} exige entre 7 y 15 dígitos.
  phone?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  budgetMax?: number;

  @IsOptional()
  @IsBoolean()
  smoker?: boolean;

  @IsOptional()
  @IsBoolean()
  pets?: boolean;
}