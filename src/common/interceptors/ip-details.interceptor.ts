import { Observable } from 'rxjs';
import { UAParser } from 'ua-parser-js';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';

import * as requestIp from 'request-ip';
import { IpDetailsService } from 'src/ip-details/ip-details.service';

@Injectable()
export class IpDetailsInterceptor implements NestInterceptor {
  private readonly logger: Logger = new Logger(IpDetailsInterceptor.name);

  constructor(private readonly ipDetailsService: IpDetailsService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();

    request.headers['accept-version'] = '1.1.0';

    const parser = new UAParser(request.headers['user-agent']);

    const parserResults = parser.getResult();

    request.ua = parserResults;
    let ip: any;

    ip = requestIp.getClientIp(request);

    //Verificar si la ip tiene mas de un campo

    try {
      const ipInfo = await this.ipDetailsService.getIpDetails(ip);
      request['ipd'] = ipInfo;
      console.log('ipd', ipInfo);
    } catch (error) {
      // TODO - Controlar error en la respuesta
      this.logger.log('Error: ', error);
    }

    return next.handle();
  }
}
