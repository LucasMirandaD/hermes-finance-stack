import {
  BadRequestException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  BaseError,
  CouldNotCreate,
  CouldNotSave,
  CouldNotUpdate,
  GenericError,
  InvalidOperation,
  NotFound,
} from './errors';

type ExceptionConstructor = new (response?: any) => HttpException;

const ErrorMap = new Map<any, ExceptionConstructor>([
  [NotFound, NotFoundException],
  [InvalidOperation, BadRequestException],
  [CouldNotCreate, BadRequestException],
  [CouldNotUpdate, BadRequestException],
  [GenericError, InternalServerErrorException],
  [CouldNotSave, InternalServerErrorException],
]);

export const ErrorMapperToHttp = (error: BaseError): HttpException => {
  const ExceptionClass = ErrorMap.get(error.constructor);
  if (ExceptionClass) {
    return new ExceptionClass({ message: error.message });
  }
  return new InternalServerErrorException({
    error: `Unhandled BaseError: ${error.constructor.name} - ${error.message}`,
  });
};
