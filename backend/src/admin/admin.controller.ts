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
  getSalesData(@Query("range") range: "today" | "week" | "month" | "year") {
    return this.adminService.getSalesData(range);
  }

  @Get("sales/chart")
  getSalesChartData(@Query("range") range: string) {
    return this.adminService.getSalesChartData(range);
  }
}
