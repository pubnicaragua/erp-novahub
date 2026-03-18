import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ActivitiesService } from './activities.service';

@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get('tasks')
  getTasks() { return this.activitiesService.getTasks(); }
  @Post('tasks')
  createTask(@Body() data: any) { return this.activitiesService.createTask(data); }
  @Patch('tasks/:id')
  updateTask(@Param('id') id: string, @Body() data: any) { return this.activitiesService.updateTask(id, data); }
  @Delete('tasks/:id')
  deleteTask(@Param('id') id: string) { return this.activitiesService.deleteTask(id); }

  @Get('events')
  getEvents() { return this.activitiesService.getEvents(); }
  @Post('events')
  createEvent(@Body() data: any) { return this.activitiesService.createEvent(data); }
  @Patch('events/:id')
  updateEvent(@Param('id') id: string, @Body() data: any) { return this.activitiesService.updateEvent(id, data); }
  @Delete('events/:id')
  deleteEvent(@Param('id') id: string) { return this.activitiesService.deleteEvent(id); }

  @Get('reminders')
  getReminders() { return this.activitiesService.getReminders(); }
  @Post('reminders')
  createReminder(@Body() data: any) { return this.activitiesService.createReminder(data); }
  @Patch('reminders/:id')
  updateReminder(@Param('id') id: string, @Body() data: any) { return this.activitiesService.updateReminder(id, data); }
  @Delete('reminders/:id')
  deleteReminder(@Param('id') id: string) { return this.activitiesService.deleteReminder(id); }

  @Get('logs')
  getLogs() { return this.activitiesService.getLogs(); }
}
