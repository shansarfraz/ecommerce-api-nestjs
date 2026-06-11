import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SearchService } from './search.service';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Global search across products and vendors' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max results per type (default 20)' })
  async search(@Query('q') q: string, @Query('limit') limit?: string) {
    return this.searchService.search(q, limit ? parseInt(limit, 10) : 20);
  }

  @Get('suggestions')
  @ApiOperation({ summary: 'Autocomplete suggestions for search' })
  @ApiQuery({ name: 'q', required: true, description: 'Partial search query' })
  async suggestions(@Query('q') q: string) {
    return this.searchService.suggestions(q);
  }
}
