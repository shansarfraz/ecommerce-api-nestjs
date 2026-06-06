import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  Min,
} from 'class-validator';
import { ShippingCalculator } from '../entities/shipping-method.entity';

export class CreateShippingMethodDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ enum: ShippingCalculator })
  @IsEnum(ShippingCalculator)
  calculator: ShippingCalculator;

  @ApiProperty({ example: 5.0 })
  @IsNumber()
  @Min(0)
  baseAmount: number;

  @ApiProperty({ required: false, example: 50.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  freeOverSubtotal?: number;

  @ApiProperty({ required: false, type: [String], example: ['US', 'CA'] })
  @IsOptional()
  @IsArray()
  countries?: string[];

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateShippingMethodDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  baseAmount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
