import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class BigIntInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => this.serializeBigInts(data)));
  }

  private serializeBigInts = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'bigint') return obj.toString();
    if (Array.isArray(obj)) return obj.map(this.serializeBigInts);
    if (typeof obj === 'object') {
      const newObj = {};
      for (const key in obj) {
        newObj[key] = this.serializeBigInts(obj[key]);
      }
      return newObj;
    }
    return obj;
  };
}
