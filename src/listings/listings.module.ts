import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { ListingsController } from './controllers/listings.controller';
import { Listing } from './entities/listing.entity';
import { ListingsService } from './services/listings.service';

@Module({
  imports: [TypeOrmModule.forFeature([Listing, User])],
  controllers: [ListingsController],
  providers: [ListingsService],
})
export class ListingsModule {}