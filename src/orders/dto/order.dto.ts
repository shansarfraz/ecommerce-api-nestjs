import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsBoolean, IsNumber, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus, FulfillmentStatus } from '../entities/order.entity';
import { AdjustmentType } from '../entities/order-adjustment.entity';

export class OrderQueryDto {
  @ApiProperty({ required: false, enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiProperty({ required: false, default: 10 })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 10;
}

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateFulfillmentStatusDto {
  @ApiProperty({ enum: FulfillmentStatus })
  @IsEnum(FulfillmentStatus)
  fulfillmentStatus: FulfillmentStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  trackingNumber?: string;
}

export class CancelOrderDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ReturnOrderDto {
  @ApiProperty()
  @IsString()
  reason: string;
}

export class ReviewReturnDto {
  @ApiProperty()
  @IsBoolean()
  approve: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  refundAmount?: number;
}

export class CreateAdjustmentDto {
  @ApiProperty({ enum: AdjustmentType })
  @IsEnum(AdjustmentType)
  type: AdjustmentType;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty()
  @IsString()
  label: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateShipmentDto {
  @ApiProperty({ required: false, enum: FulfillmentStatus })
  @IsOptional()
  @IsEnum(FulfillmentStatus)
  status?: FulfillmentStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  carrier?: string;
}
