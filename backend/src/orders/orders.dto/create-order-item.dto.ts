import { IsInt, IsNotEmpty, IsNumber, IsString, Min } from "class-validator";

export class CreateOrderItemDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}
