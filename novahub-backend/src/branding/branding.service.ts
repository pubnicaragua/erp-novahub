import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BrandingService {
  constructor(private prisma: PrismaService) {}

  async getBranding(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        clientTenant: {
          include: {
            partner: true,
          },
        },
      },
    });

    if (!user) return this.getDefaultBranding();

    const tenant = user.clientTenant as any;
    const partner = tenant?.partner as any;

    // Hierarchy: Tenant > Partner > Global
    return {
      logo: tenant?.logo || partner?.logo || null,
      primaryColor: tenant?.primaryColor || partner?.primaryColor || '#10b981',
      sidebarColor: tenant?.sidebarColor || partner?.sidebarColor || '#0c1a12',
      accentColor: tenant?.accentColor || partner?.accentColor || '#064e3b',
      whiteLabel: tenant?.whiteLabel ?? partner?.whiteLabel ?? false,
      companyName: tenant?.name || partner?.name || 'Nova Hub',
    };
  }

  async updateBranding(userId: string, data: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) return;

    // If user is PARTNER, update the Partner branding
    if (user.role === 'PARTNER') {
      const tenant = await this.prisma.clientTenant.findUnique({
        where: { id: user.clientTenantId },
        select: { partnerId: true }
      });
      if (tenant?.partnerId) {
        return this.prisma.partner.update({
          where: { id: tenant.partnerId },
          data: {
            logo: data.logo,
            primaryColor: data.primaryColor,
            sidebarColor: data.sidebarColor,
            accentColor: data.accentColor,
            whiteLabel: data.whiteLabel,
          } as any,
        });
      }
    }

    // Default: update Tenant branding
    return this.prisma.clientTenant.update({
      where: { id: user.clientTenantId },
      data: {
        logo: data.logo,
        primaryColor: data.primaryColor,
        sidebarColor: data.sidebarColor,
        accentColor: data.accentColor,
        whiteLabel: data.whiteLabel,
      } as any,
    });
  }

  private getDefaultBranding() {
    return {
      logo: null,
      primaryColor: '#10b981',
      sidebarColor: '#0c1a12',
      accentColor: '#064e3b',
      whiteLabel: false,
      companyName: 'Nova Hub',
    };
  }
}
