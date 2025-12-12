import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Page, BlogPost, ContentStatus } from './entities/content.entity';
import {
  CreatePageDto,
  UpdatePageDto,
  CreateBlogPostDto,
  UpdateBlogPostDto,
  BlogQueryDto,
} from './dto/content.dto';

@Injectable()
export class ContentService {
  constructor(
    @InjectRepository(Page)
    private pagesRepository: Repository<Page>,
    @InjectRepository(BlogPost)
    private blogPostsRepository: Repository<BlogPost>,
  ) {}

  // Page methods
  async getPageBySlug(slug: string) {
    const page = await this.pagesRepository.findOne({
      where: { slug, status: ContentStatus.PUBLISHED },
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    return page;
  }

  async createPage(dto: CreatePageDto) {
    const existing = await this.pagesRepository.findOne({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new ConflictException('Page slug already exists');
    }

    const page = this.pagesRepository.create(dto);
    return this.pagesRepository.save(page);
  }

  async updatePage(id: string, dto: UpdatePageDto) {
    const page = await this.pagesRepository.findOne({ where: { id } });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    await this.pagesRepository.update(id, dto);
    return this.pagesRepository.findOne({ where: { id } });
  }

  async deletePage(id: string) {
    const page = await this.pagesRepository.findOne({ where: { id } });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    await this.pagesRepository.delete(id);
    return { message: 'Page deleted successfully' };
  }

  async getAllPages() {
    return this.pagesRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  // Blog post methods
  async getBlogPosts(query: BlogQueryDto) {
    const { tag, page = 1, limit = 10 } = query;

    const queryBuilder = this.blogPostsRepository
      .createQueryBuilder('post')
      .where('post.status = :status', { status: ContentStatus.PUBLISHED });

    if (tag) {
      queryBuilder.andWhere(':tag = ANY(post.tags)', { tag });
    }

    const [posts, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('post.publishedAt', 'DESC')
      .getManyAndCount();

    return {
      data: posts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getBlogPostBySlug(slug: string) {
    const post = await this.blogPostsRepository.findOne({
      where: { slug, status: ContentStatus.PUBLISHED },
    });

    if (!post) {
      throw new NotFoundException('Blog post not found');
    }

    return post;
  }

  async createBlogPost(dto: CreateBlogPostDto) {
    const existing = await this.blogPostsRepository.findOne({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new ConflictException('Blog post slug already exists');
    }

    const post = this.blogPostsRepository.create({
      ...dto,
      publishedAt: dto.status === ContentStatus.PUBLISHED ? new Date() : null,
    });

    return this.blogPostsRepository.save(post);
  }

  async updateBlogPost(id: string, dto: UpdateBlogPostDto) {
    const post = await this.blogPostsRepository.findOne({ where: { id } });

    if (!post) {
      throw new NotFoundException('Blog post not found');
    }

    const updateData: any = { ...dto };

    // Set publishedAt when first published
    if (dto.status === ContentStatus.PUBLISHED && !post.publishedAt) {
      updateData.publishedAt = new Date();
    }

    await this.blogPostsRepository.update(id, updateData);
    return this.blogPostsRepository.findOne({ where: { id } });
  }

  async deleteBlogPost(id: string) {
    const post = await this.blogPostsRepository.findOne({ where: { id } });

    if (!post) {
      throw new NotFoundException('Blog post not found');
    }

    await this.blogPostsRepository.delete(id);
    return { message: 'Blog post deleted successfully' };
  }

  async getAllBlogPosts() {
    return this.blogPostsRepository.find({
      order: { createdAt: 'DESC' },
    });
  }
}
