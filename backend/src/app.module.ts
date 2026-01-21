import { Module } from "@nestjs/common";
import { UsersModule } from "./users/users.module";
import { AppController } from "./app.controller";
import { OrdersModule } from "./orders/orders.module";
import { ProductsModule } from "./products/products.model";

@Module({
  imports: [UsersModule, OrdersModule, ProductsModule],
  controllers: [AppController],
})
export class AppModule {}
