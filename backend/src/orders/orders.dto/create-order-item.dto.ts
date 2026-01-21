import { IsInt, IsNumber, IsString, Min } from "class-validator";

export class CreateOrderItemDto {
  @IsString()
  productId!: string;

  @IsString()
  name!: string;

  @IsNumber()
  price!: number;

  @IsInt()
  @Min(1)
  quantity!: number;
}
