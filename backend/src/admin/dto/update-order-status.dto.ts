import { IsEnum } from "class-validator";
import { OrderStatus } from "@prisma/client";
import { Transform } from "class-transformer";

export class UpdateOrderStatusDto {
  @Transform(({ value }) => value?.toUpperCase())
  @IsEnum(OrderStatus)
  status!: OrderStatus;
}
