import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Rol, RolSchema } from './schema/rol.schema';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: Rol.name, schema: RolSchema }])],
  controllers: [RolesController],
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule {}
