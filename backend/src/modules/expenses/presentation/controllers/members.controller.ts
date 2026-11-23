import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { IExpensesService } from '../../domain/services/i-expenses.service';
import { CreateMemberDto, UpdateMemberDto } from '../dtos/member.dto';
import { ErrorMapperToHttp } from '../../../../common/errors/error.mapper';

@Controller('members')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class MembersController {
  constructor(private readonly expensesService: IExpensesService) {}

  @Get()
  async listMembers(@Query('activeOnly') activeOnly?: string) {
    const result = await this.expensesService.listMembers(activeOnly !== 'false');
    if (result.isFailure) throw ErrorMapperToHttp(result.getError());
    return result.getValue();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createMember(@Body() dto: CreateMemberDto) {
    const result = await this.expensesService.createMember(dto);
    if (result.isFailure) throw ErrorMapperToHttp(result.getError());
    return result.getValue();
  }

  @Get('shared/balance')
  async getSharedBalance(
    @Query('month') month?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const result = await this.expensesService.getSharedBalance({
      month,
      startDate,
      endDate,
    });
    if (result.isFailure) throw ErrorMapperToHttp(result.getError());
    return result.getValue();
  }

  @Patch(':ref')
  async updateMember(@Param('ref') ref: string, @Body() dto: UpdateMemberDto) {
    const result = await this.expensesService.updateMember(ref, dto);
    if (result.isFailure) throw ErrorMapperToHttp(result.getError());
    return result.getValue();
  }

  @Delete(':ref')
  async deleteMember(@Param('ref') ref: string) {
    const result = await this.expensesService.deleteMember(ref);
    if (result.isFailure) throw ErrorMapperToHttp(result.getError());
    return result.getValue();
  }
}
