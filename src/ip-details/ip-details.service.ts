import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  IpDetail,
  IpDetailDocument,
  IpDetailsCollection,
} from './schemas/ip-detail.schema';
import { Model } from 'mongoose';
import axios from 'axios';

@Injectable()
export class IpDetailsService {
  private readonly logger = new Logger(IpDetailsService.name);

  constructor(
    @InjectModel(IpDetailsCollection) private ipDetailsModel: Model<IpDetail>,
  ) {}

  private isPrivateIp(ip: string): boolean {
    if (!ip) return true;
    const clean = ip.replace(/^::ffff:/, ''); // normaliza IPv4-mapped
    return (
      clean === '127.0.0.1' ||
      clean === '::1' ||
      clean.startsWith('10.') ||
      clean.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(clean)
    );
  }

  public async getIpDetails(ip: string) {
    this.logger.log('Buscando información de la ip: ' + ip);

    if (this.isPrivateIp(ip)) {
      this.logger.log('IP privada/local detectada — omitiendo geolocalización');
      return { status: 'local', query: ip, city: null, country: null };
    }

    let ipInfo = await this.getDbIpInfo(ip);

    if (!ipInfo) {
      this.logger.log('No existe la ip en la db, buscando en la api');
      const ipData = await this.getRemoteIpInfo(ip);
      ipInfo = await this.saveIpInfo(ip, ipData);
    }

    return ipInfo.data;
  }

  private async getRemoteIpInfo(ip: string) {
    try {
      const { data } = await axios.get(`http://ip-api.com/json/${ip}`);
      return data;
    } catch (error) {
      this.logger.error('La api no obtuvo informacion de la ip: ' + ip);
      throw error;
    }
  }

  private async getDbIpInfo(ip: string): Promise<any> {
    try {
      const ipInfo:any = await this.ipDetailsModel.findOne({ ip });
      if (!ipInfo) return null;

      return ipInfo;
    } catch (error) {
      this.logger.error('Ocurrió un error al buscar en la db la ip: ' + ip);
      throw error;
    }
  }

  private async saveIpInfo(ip: string, data: any): Promise<any> {
    try {
      const ipInfo = await this.ipDetailsModel.create({ ip, data });
      return ipInfo;
    } catch (error) {
      this.logger.error('Ocurrió un error al guardar en la db la ip: ' + ip);
      throw error;
    }
  }
}
