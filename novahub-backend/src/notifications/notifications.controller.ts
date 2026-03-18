import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('alerts')
  getAlerts() { return this.notificationsService.getAlerts(); }
  @Post('alerts')
  createAlert(@Body() data: any) { return this.notificationsService.createAlert(data); }
  @Patch('alerts/:id')
  updateAlert(@Param('id') id: string, @Body() data: any) { return this.notificationsService.updateAlert(id, data); }
  @Delete('alerts/:id')
  deleteAlert(@Param('id') id: string) { return this.notificationsService.deleteAlert(id); }

  @Get('messages')
  getMessages() { return this.notificationsService.getMessages(); }
  @Post('messages')
  createMessage(@Body() data: any) { return this.notificationsService.createMessage(data); }
  @Patch('messages/:id')
  updateMessage(@Param('id') id: string, @Body() data: any) { return this.notificationsService.updateMessage(id, data); }
  @Delete('messages/:id')
  deleteMessage(@Param('id') id: string) { return this.notificationsService.deleteMessage(id); }

  @Get('push')
  getPushNotifications() { return this.notificationsService.getPushNotifications(); }
  @Post('push')
  createPushNotification(@Body() data: any) { return this.notificationsService.createPushNotification(data); }
  @Patch('push/:id')
  updatePushNotification(@Param('id') id: string, @Body() data: any) { return this.notificationsService.updatePushNotification(id, data); }
  @Delete('push/:id')
  deletePushNotification(@Param('id') id: string) { return this.notificationsService.deletePushNotification(id); }
}
