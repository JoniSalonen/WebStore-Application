import { Module } from "@nestjs/common";
import { UsersModule } from "./users/users.module";
import { AppController } from "./app.controller";
import { OrdersModule } from "./orders/orders.module";
import { ProductsModule } from "./products/products.model";
import { AuthModule } from "./auth/auth.module";
import { AdminModule } from "./admin/admin.module";
import { ServeStaticModule } from "@nestjs/serve-static";
import { join } from "path";

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, "..", "media"),
      serveRoot: "/media",
    }),
    UsersModule,
    OrdersModule,
    ProductsModule,
    AuthModule,
    AdminModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
