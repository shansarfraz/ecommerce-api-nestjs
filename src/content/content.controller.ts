import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ContentService } from './content.service';
import { BlogQueryDto } from './dto/content.dto';

@ApiTags('Content')
@Controller()
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Get('pages/:slug')
  @ApiOperation({ summary: 'Get CMS page by slug' })
  @ApiResponse({ status: 200, description: 'Page retrieved' })
  @ApiResponse({ status: 404, description: 'Page not found' })
  async getPage(@Param('slug') slug: string) {
    return this.contentService.getPageBySlug(slug);
  }

  @Get('blog/posts')
  @ApiOperation({ summary: 'List blog posts' })
  @ApiResponse({ status: 200, description: 'Blog posts retrieved' })
  async getBlogPosts(@Query() query: BlogQueryDto) {
    return this.contentService.getBlogPosts(query);
  }

  @Get('blog/posts/:slug')
  @ApiOperation({ summary: 'Get blog post by slug' })
  @ApiResponse({ status: 200, description: 'Blog post retrieved' })
  @ApiResponse({ status: 404, description: 'Blog post not found' })
  async getBlogPost(@Param('slug') slug: string) {
    return this.contentService.getBlogPostBySlug(slug);
  }
}
