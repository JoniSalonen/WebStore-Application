import { IsInt, Min } from "class-validator";

export class CreateOrderDto {
  @IsInt()
  @Min(1)
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}
