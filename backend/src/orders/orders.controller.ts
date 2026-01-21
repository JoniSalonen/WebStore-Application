import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Delete,
  ParseIntPipe,
  Put,
} from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { CreateOrderDto } from "./orders.dto/create-order.dto";

@Controller("orders")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(
    @Body() dto: CreateOrderDto,
    @Param("userId", ParseIntPipe) userId: number,
  ) {
    return this.ordersService.createOrder(userId, [dto]);
  }

  @Get(":userId")
  findByUser(@Param("userId", ParseIntPipe) userId: number) {
    return this.ordersService.findByUser(userId);
  }

  // for testing purpose only delete later
  @Get()
  getAllOrders() {
    // This method can be implemented to return all orders if needed
    return this.ordersService.getAllOrders();
  }

  @Delete(":orderId")
  remove(@Param("orderId", ParseIntPipe) orderId: number) {
    return this.ordersService.removeOrder(orderId);
  }
}
