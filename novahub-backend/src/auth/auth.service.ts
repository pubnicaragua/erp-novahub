import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';

import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private subscriptionsService: SubscriptionsService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user && await bcrypt.compare(pass, user.passwordHash)) {
      const { passwordHash, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const enabledModules = await this.subscriptionsService.getEnabledModules(user.clientTenantId);
    
    const payload = { 
        email: user.email, 
        sub: user.id, 
        clientTenantId: user.clientTenantId,
        role: user.role,
        enabledModules: enabledModules
    };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        clientTenantId: user.clientTenantId,
        clientTenant: user.clientTenant,
        enabledModules: enabledModules
      }
    };
  }

  async switchContext(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('Usuario no encontrado para switch-context');
    return this.login(user);
  }
}
