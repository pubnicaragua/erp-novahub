import { Injectable } from '@nestjs/common';

@Injectable()
export class NotificationsService {
  private alerts: any[] = [];
  private messages: any[] = [];
  private push: any[] = [];

  getAlerts() { return this.alerts; }
  createAlert(data: any) { const item = { id: Date.now().toString(), ...data }; this.alerts.push(item); return item; }
  updateAlert(id: string, data: any) { const index = this.alerts.findIndex(x => x.id === id); if (index > -1) { this.alerts[index] = { ...this.alerts[index], ...data }; return this.alerts[index]; } return null; }
  deleteAlert(id: string) { this.alerts = this.alerts.filter(x => x.id !== id); return { success: true }; }

  getMessages() { return this.messages; }
  createMessage(data: any) { const item = { id: Date.now().toString(), ...data }; this.messages.push(item); return item; }
  updateMessage(id: string, data: any) { const index = this.messages.findIndex(x => x.id === id); if (index > -1) { this.messages[index] = { ...this.messages[index], ...data }; return this.messages[index]; } return null; }
  deleteMessage(id: string) { this.messages = this.messages.filter(x => x.id !== id); return { success: true }; }

  getPushNotifications() { return this.push; }
  createPushNotification(data: any) { const item = { id: Date.now().toString(), ...data }; this.push.push(item); return item; }
  updatePushNotification(id: string, data: any) { const index = this.push.findIndex(x => x.id === id); if (index > -1) { this.push[index] = { ...this.push[index], ...data }; return this.push[index]; } return null; }
  deletePushNotification(id: string) { this.push = this.push.filter(x => x.id !== id); return { success: true }; }
}
