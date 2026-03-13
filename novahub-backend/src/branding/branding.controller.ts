import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { BrandingService } from './branding.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('branding')
@UseGuards(JwtAuthGuard)
export class BrandingController {
  constructor(private readonly brandingService: BrandingService) {}

  @Get('current')
  async getCurrent(@Request() req) {
    return this.brandingService.getBranding(req.user.userId);
  }

  @Post('update')
  async update(@Request() req, @Body() data: any) {
    return this.brandingService.updateBranding(req.user.userId, data);
  }
}
