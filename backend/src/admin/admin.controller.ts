import {
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
  Body,
  Query,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { AdminService } from "./admin.service";
import { UpdateOrderStatusDto } from "./dto/update-order-status.dto";
import { SalesRangeDto } from "./dto/sales-range.dto";
import { TopProductsQueryDto } from "./dto/top-products-query.dto";
import { LowStockQueryDto } from "./dto/low-stock-query.dto";

@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get("dashboard")
  getDashboardData() {
    return this.adminService.getDashboardData();
  }

  @Patch("orders/:orderId/status")
  updateOrderStatus(
    @Param("orderId") id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.adminService.updateOrderStatus(id, dto.status);
  }

  @Get("sales")
  getSalesData(@Query() dto: SalesRangeDto) {
    return this.adminService.getSalesData(
      dto.range as "today" | "week" | "month" | "year",
    );
  }

  @Get("sales/chart")
  getSalesChartData(@Query() dto: SalesRangeDto) {
    return this.adminService.getSalesChartData(dto.range);
  }

  @Get("sales/top-products")
  getTopSellingProducts(@Query() dto: TopProductsQueryDto) {
    return this.adminService.getTopSellingProducts(dto.range, dto.limit ?? 5);
  }

  @Get("products/low-stock")
  getLowStockProducts(@Query() dto: LowStockQueryDto) {
    return this.adminService.getLowStockProducts(dto.threshold ?? 10);
  }
}
