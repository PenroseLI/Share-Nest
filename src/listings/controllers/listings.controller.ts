import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CreateListingDto } from '../dto/create-listing.dto';
import { FilterListingDto } from '../dto/filter-listing.dto';
import { UpdateListingDto } from '../dto/update-listing.dto';
import { ListingsService } from '../services/listings.service';

@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Post()
  create(@Body() createListingDto: CreateListingDto) {
    return this.listingsService.create(createListingDto);
  }

  // GET /listings?city=cali&minPrice=300000&maxPrice=700000&amenity=wifi
  @Get()
  findAll(@Query() filter: FilterListingDto) {
    return this.listingsService.findAll(filter);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.listingsService.findOne(id);
  }

  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateListingDto: UpdateListingDto,
  ) {
    return this.listingsService.update(id, updateListingDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.listingsService.remove(id);
  }
}