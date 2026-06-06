import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsObject, IsBoolean, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RefundDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class PayoutRequestDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class PayoutQueryDto {
  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiProperty({ required: false, default: 10 })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 10;
}

export class WebhookDto {
  @ApiProperty()
  @IsString()
  type: string;

  @ApiProperty()
  @IsObject()
  data: any;
}

export class ConfirmIntentDto {
  @ApiProperty({ required: false, enum: ['succeed', 'fail'], default: 'succeed' })
  @IsOptional()
  @IsString()
  outcome?: 'succeed' | 'fail';
}

export class SavePaymentMethodDto {
  @ApiProperty({ example: 'pm_xxxx' })
  @IsString()
  providerMethodId: string;

  @ApiProperty({ required: false, default: 'card' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  details?: object;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  setDefault?: boolean;
}
