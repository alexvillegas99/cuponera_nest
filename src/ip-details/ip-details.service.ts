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

  public async getIpDetails(ip: string) {
    this.logger.log('Buscando información de la ip: ' + ip);
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
