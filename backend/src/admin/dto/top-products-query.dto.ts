import { IsIn, IsInt, IsOptional, Min } from "class-validator";
import { Type } from "class-transformer";

export class TopProductsQueryDto {
  @IsIn(["today", "week", "month", "year"])
  range!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
