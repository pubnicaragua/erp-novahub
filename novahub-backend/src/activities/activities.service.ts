import { Injectable } from '@nestjs/common';

@Injectable()
export class ActivitiesService {
  private tasks: any[] = [];
  private events: any[] = [];
  private reminders: any[] = [];
  private logs: any[] = [];

  getTasks() { return this.tasks; }
  createTask(data: any) { const item = { id: Date.now().toString(), ...data }; this.tasks.push(item); return item; }
  updateTask(id: string, data: any) { const index = this.tasks.findIndex(x => x.id === id); if (index > -1) { this.tasks[index] = { ...this.tasks[index], ...data }; return this.tasks[index]; } return null; }
  deleteTask(id: string) { this.tasks = this.tasks.filter(x => x.id !== id); return { success: true }; }

  getEvents() { return this.events; }
  createEvent(data: any) { const item = { id: Date.now().toString(), ...data }; this.events.push(item); return item; }
  updateEvent(id: string, data: any) { const index = this.events.findIndex(x => x.id === id); if (index > -1) { this.events[index] = { ...this.events[index], ...data }; return this.events[index]; } return null; }
  deleteEvent(id: string) { this.events = this.events.filter(x => x.id !== id); return { success: true }; }

  getReminders() { return this.reminders; }
  createReminder(data: any) { const item = { id: Date.now().toString(), ...data }; this.reminders.push(item); return item; }
  updateReminder(id: string, data: any) { const index = this.reminders.findIndex(x => x.id === id); if (index > -1) { this.reminders[index] = { ...this.reminders[index], ...data }; return this.reminders[index]; } return null; }
  deleteReminder(id: string) { this.reminders = this.reminders.filter(x => x.id !== id); return { success: true }; }

  getLogs() { return this.logs; }
}
