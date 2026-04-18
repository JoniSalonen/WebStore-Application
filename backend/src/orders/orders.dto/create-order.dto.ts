import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, ValidateNested } from "class-validator";
import { CreateOrderItemDto } from "./create-order-item.dto";

export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  @ArrayMinSize(1)
  items!: CreateOrderItemDto[];
}
