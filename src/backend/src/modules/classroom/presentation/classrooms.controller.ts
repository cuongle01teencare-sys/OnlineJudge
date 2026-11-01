import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsEmail, IsInt, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import type { Actor } from '../../../shared/application/actor.js';
import { CurrentActor, Public, Roles } from '../../../shared/presentation/decorators.js';
import { ClassroomService } from '../application/classroom.service.js';

class UpsertClassroomBody {
  @IsString() @Length(1, 100, { message: 'Tên lớp phải từ 1 đến 100 ký tự.' }) name: string;
  @IsString() @Length(4, 20, { message: 'Mã lớp gồm 4–20 ký tự.' }) code: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() teacherId?: string | null;
}

class MoveStudentBody {
  @IsUUID() classId: string;
}

class ScheduleDeletionBody {
  @Type(() => Number) @IsInt() @Min(1) @Max(365) days: number;
}

class DeleteNowBody {
  @IsString() confirmName: string;
}

class RegisterBody {
  @IsEmail({}, { message: 'Email không hợp lệ.' }) email: string;
  @IsString() @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự.' }) @MaxLength(128) password: string;
  @IsString() @Length(2, 80, { message: 'Họ tên phải từ 2 đến 80 ký tự.' }) displayName: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(20) phone: string | null = null;
  @IsString() @Length(1, 40, { message: 'Hãy nhập mã lớp.' }) classCode: string;
}

@Controller('classes')
export class ClassroomsController {
  constructor(private readonly classrooms: ClassroomService) {}

  @Get()
  list(@CurrentActor() actor: Actor) {
    return this.classrooms.list(actor);
  }

  // Literal routes before ":id".
  @Get('unassigned-students') @Roles('ADMIN')
  unassigned() {
    return this.classrooms.unassigned();
  }

  @Put('students/:studentId') @Roles('ADMIN', 'TEACHER')
  moveStudent(
    @CurrentActor() actor: Actor,
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Body() body: MoveStudentBody,
  ) {
    return this.classrooms.moveStudent(actor, studentId, body.classId);
  }

  @Post() @Roles('ADMIN', 'TEACHER')
  create(@CurrentActor() actor: Actor, @Body() body: UpsertClassroomBody) {
    return this.classrooms.create(actor, body);
  }

  @Get(':id')
  get(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.classrooms.get(actor, id);
  }

  @Put(':id') @Roles('ADMIN', 'TEACHER')
  update(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpsertClassroomBody) {
    return this.classrooms.update(actor, id, body);
  }

  @Post(':id/archive') @Roles('ADMIN', 'TEACHER') @HttpCode(200)
  archive(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.classrooms.archive(actor, id);
  }

  @Post(':id/restore') @Roles('ADMIN', 'TEACHER') @HttpCode(200)
  restore(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.classrooms.restore(actor, id);
  }

  @Post(':id/schedule-deletion') @Roles('ADMIN', 'TEACHER') @HttpCode(200)
  scheduleDeletion(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body() body: ScheduleDeletionBody) {
    return this.classrooms.scheduleDeletion(actor, id, body.days);
  }

  @Post(':id/cancel-deletion') @Roles('ADMIN', 'TEACHER') @HttpCode(200)
  cancelDeletion(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.classrooms.cancelDeletion(actor, id);
  }

  @Post(':id/delete-now') @Roles('ADMIN', 'TEACHER') @HttpCode(204)
  deleteNow(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body() body: DeleteNowBody) {
    return this.classrooms.deleteNow(actor, id, body.confirmName);
  }

  @Get(':id/students') @Roles('ADMIN', 'TEACHER')
  roster(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.classrooms.roster(actor, id);
  }
}

/** Student sign-up lives here because the class code belongs to the Classroom context. */
@Controller('auth')
export class RegistrationController {
  constructor(private readonly classrooms: ClassroomService) {}

  @Public() @Post('register') @HttpCode(202)
  register(@Body() body: RegisterBody) {
    return this.classrooms.startRegistration(body);
  }
}
