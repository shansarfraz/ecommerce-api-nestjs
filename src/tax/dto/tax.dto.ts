import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  Length,
  Min,
  Max,
} from 'class-validator';

export class CreateTaxZoneDto {
  @ApiProperty({ example: 'US' })
  @IsString()
  @Length(2, 2)
  country: string;

  @ApiProperty({ example: 'CA', required: false })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ example: 0.0875 })
  @IsNumber()
  @Min(0)
  @Max(1)
  rate: number;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateTaxZoneDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  rate?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
