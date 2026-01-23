import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsInt,
  IsNotEmpty,
  Min,
  Validate,
} from "class-validator";
import { CreateOrderItemDto } from "./create-order-item.dto";

export class CreateOrderDto {
  @Validate(CreateOrderItemDto, { each: true })
  @Type(() => CreateOrderItemDto)
  @ArrayMinSize(1)
  items!: CreateOrderItemDto[];
}
