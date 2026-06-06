import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsEnum, IsPositive, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { StoreCreditType } from '../entities/store-credit.entity';

export class IssueStoreCreditDto {
  @ApiProperty()
  @IsString()
  userId: string;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({ enum: StoreCreditType, default: StoreCreditType.ISSUED })
  @IsOptional()
  @IsEnum(StoreCreditType)
  type?: StoreCreditType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class RedeemStoreCreditDto {
  @ApiProperty()
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty()
  @IsString()
  orderId: string;
}

export class StoreCreditQueryDto {
  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}
