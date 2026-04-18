import { Controller, Post, Body } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";

@Controller("auth")
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post("login")
  async login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }
}
