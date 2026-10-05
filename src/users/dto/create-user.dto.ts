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

export class CreateUserDto {
  @IsString()
  @Matches(/^\d{5,20}$/) // ^ y $ delimitan el valor; \d{5,20} exige entre 5 y 20 dígitos.
  id!: string;

  @IsString()
  @Length(2, 100)
  name!: string;

  @Transform(({ value }: { value: string }) => value?.trim().toLowerCase())
  @IsEmail()
  @Length(5, 254)
  email!: string;

  @IsInt()
  @Min(0)
  @Max(130)
  age!: number;

  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/) // +? permite el prefijo internacional; [0-9]{7,15} exige entre 7 y 15 dígitos.
  phone!: string;

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