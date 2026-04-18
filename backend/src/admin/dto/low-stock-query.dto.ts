import { IsInt, IsOptional, Min } from "class-validator";
import { Type } from "class-transformer";

export class LowStockQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  threshold?: number;
}
