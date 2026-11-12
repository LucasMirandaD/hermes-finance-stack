import { BaseError } from './errors';

export class Result<T> {
  public isSuccess: boolean;
  public isFailure: boolean;
  private error?: BaseError;
  private value?: T;

  private constructor(isSuccess: boolean, error?: BaseError, value?: T) {
    this.isSuccess = isSuccess;
    this.isFailure = !isSuccess;
    this.error = error;
    this.value = value;
  }

  public static ok<U>(value?: U): Result<U> {
    return new Result<U>(true, undefined, value);
  }

  public static fail<U>(error: BaseError): Result<U> {
    return new Result<U>(false, error);
  }

  public getError(): BaseError {
    return this.error!;
  }

  public getValue(): T {
    return this.value!;
  }
}
