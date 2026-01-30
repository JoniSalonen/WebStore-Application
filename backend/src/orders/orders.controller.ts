import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Delete,
  UseGuards,
  Req,
} from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { CreateOrderDto } from "./orders.dto/create-order.dto";
import { JwtAuthGuard } from "../auth/auth.guard";

@Controller("orders")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Req() req: any, @Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(req.user.userId, dto);
  }

  @Get("my")
  @UseGuards(JwtAuthGuard)
  getUserOrders(@Req() req: any) {
    console.log("REQ.USER:", req.user);
    return this.ordersService.findByUser(req.user.userId);
  }

  @Get(":userId")
  @UseGuards(JwtAuthGuard)
  findByUser(@Param("userId") userId: string) {
    return this.ordersService.findByUser(Number(userId));
  }

  // for testing purpose only delete later
  @Get()
  @UseGuards(JwtAuthGuard)
  getAllOrders() {
    // This method can be implemented to return all orders if needed
    return this.ordersService.getAllOrders();
  }

  @Delete(":orderId")
  @UseGuards(JwtAuthGuard)
  remove(@Param("orderId") orderId: string) {
    return this.ordersService.removeOrder(Number(orderId));
  }
}
