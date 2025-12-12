import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsObject, IsOptional } from 'class-validator';

export class ApplyCouponDto {
  @ApiProperty({ example: 'SAVE10' })
  @IsString()
  code: string;
}

export class CreateSessionDto {
  @ApiProperty()
  @IsObject()
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  billingAddress?: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  couponCode?: string;
}
