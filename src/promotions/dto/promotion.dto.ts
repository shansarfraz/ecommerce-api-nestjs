import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  IsDateString,
} from 'class-validator';
import { PromotionType, PromotionStatus } from '../entities/promotion.entity';

export class CreatePromotionDto {
  @ApiProperty({ example: 'SAVE10' })
  @IsString()
  code: string;

  @ApiProperty({ enum: PromotionType })
  @IsEnum(PromotionType)
  type: PromotionType;

  @ApiProperty({ example: 10, description: 'percent or fixed amount' })
  @IsNumber()
  @Min(0)
  value: number;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderSubtotal?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  usageLimit?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  perUserLimit?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  vendorId?: string;

  @ApiProperty({ required: false, enum: PromotionStatus })
  @IsOptional()
  @IsEnum(PromotionStatus)
  status?: PromotionStatus;
}

export class UpdatePromotionDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  value?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  usageLimit?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiProperty({ required: false, enum: PromotionStatus })
  @IsOptional()
  @IsEnum(PromotionStatus)
  status?: PromotionStatus;
}
