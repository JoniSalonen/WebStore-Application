import { Module } from "@nestjs/common";
import { UsersModule } from "./users/users.module";
import { AppController } from "./app.controller";
import { OrdersModule } from "./orders/orders.module";
import { ProductsModule } from "./products/products.model";
import { AuthModule } from "./auth/auth.module";

@Module({
  imports: [UsersModule, OrdersModule, ProductsModule, AuthModule],
  controllers: [AppController],
})
export class AppModule {}
