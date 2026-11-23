import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { IOutingsService } from '../../domain/services/i-outings.service';
import {
  AddOutingExpenseDto,
  AddOutingParticipantDto,
  CreateOutingDto,
  SettleOutingDto,
} from '../dtos/outing.dto';
import { OutingStatus } from '../../domain/interfaces/outing.interface';
import { ErrorMapperToHttp } from '../../../../common/errors/error.mapper';

@Controller('outings')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class OutingsController {
  constructor(private readonly outingsService: IOutingsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createOuting(@Body() dto: CreateOutingDto) {
    const result = await this.outingsService.createOuting(dto);
    if (result.isFailure) throw ErrorMapperToHttp(result.getError());
    return result.getValue();
  }

  @Get()
  async listOutings(@Query('status') status?: OutingStatus) {
    const result = await this.outingsService.listOutings(status);
    if (result.isFailure) throw ErrorMapperToHttp(result.getError());
    return result.getValue();
  }

  @Delete('expenses/:expenseId')
  async deleteOutingExpense(@Param('expenseId') expenseId: string) {
    const result = await this.outingsService.deleteExpense(expenseId);
    if (result.isFailure) throw ErrorMapperToHttp(result.getError());
    return result.getValue();
  }

  @Get(':ref/balance')
  async getOutingBalance(@Param('ref') ref: string) {
    const result = await this.outingsService.getOutingBalance(ref);
    if (result.isFailure) throw ErrorMapperToHttp(result.getError());
    return result.getValue();
  }

  @Post(':ref/participants')
  @HttpCode(HttpStatus.CREATED)
  async addParticipant(
    @Param('ref') ref: string,
    @Body() dto: AddOutingParticipantDto,
  ) {
    const result = await this.outingsService.addParticipant(ref, dto);
    if (result.isFailure) throw ErrorMapperToHttp(result.getError());
    return result.getValue();
  }

  @Post(':ref/expenses')
  @HttpCode(HttpStatus.CREATED)
  async addExpense(@Param('ref') ref: string, @Body() dto: AddOutingExpenseDto) {
    const result = await this.outingsService.addExpense(ref, dto);
    if (result.isFailure) throw ErrorMapperToHttp(result.getError());
    return result.getValue();
  }

  @Post(':ref/settle')
  @HttpCode(HttpStatus.OK)
  async settleOuting(@Param('ref') ref: string, @Body() dto: SettleOutingDto) {
    const result = await this.outingsService.settleOuting(ref, dto);
    if (result.isFailure) throw ErrorMapperToHttp(result.getError());
    return result.getValue();
  }

  @Delete(':ref')
  async deleteOuting(@Param('ref') ref: string) {
    const result = await this.outingsService.deleteOuting(ref);
    if (result.isFailure) throw ErrorMapperToHttp(result.getError());
    return result.getValue();
  }
}
