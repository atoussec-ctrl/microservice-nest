import { ArgumentsHost, Catch } from '@nestjs/common';
import { GqlExceptionFilter } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import {
  DomainError,
  DomainErrorCode,
} from '../../domain/errors/domain.errors';

interface GraphQLErrorMapping {
  code: string;
  httpStatus: number;
}

const ERROR_MAPPINGS: Record<DomainErrorCode, GraphQLErrorMapping> = {
  [DomainErrorCode.VALIDATION]: { code: 'BAD_USER_INPUT', httpStatus: 400 },
  [DomainErrorCode.CONFLICT]: { code: 'CONFLICT', httpStatus: 409 },
  [DomainErrorCode.NOT_FOUND]: { code: 'NOT_FOUND', httpStatus: 404 },
  [DomainErrorCode.VERSION_CONFLICT]: {
    code: 'PRECONDITION_FAILED',
    httpStatus: 412,
  },
  [DomainErrorCode.FORBIDDEN]: { code: 'FORBIDDEN', httpStatus: 403 },
};

@Catch(DomainError)
export class DomainExceptionFilter implements GqlExceptionFilter {
  catch(exception: DomainError, _host: ArgumentsHost): GraphQLError {
    const mapping = ERROR_MAPPINGS[exception.code] ?? {
      code: 'INTERNAL_SERVER_ERROR',
      httpStatus: 500,
    };

    return new GraphQLError(exception.message, {
      extensions: {
        code: mapping.code,
        domainCode: exception.code,
        httpStatus: mapping.httpStatus,
      },
    });
  }
}
