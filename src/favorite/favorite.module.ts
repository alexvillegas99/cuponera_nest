import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Favorite, FavoriteSchema } from './schema/favorite.schema';
import { FavoritesController } from './favorite.controller';
import { FavoritesService } from './favorite.service';

@Module({
   imports: [MongooseModule.forFeature([{ name: Favorite.name, schema: FavoriteSchema }])],
  controllers: [FavoritesController],
  providers: [FavoritesService],
})
export class FavoriteModule {}
