import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BundleService } from './bundle.service';
import { Bundle } from './entities/bundle.entity/bundle.entity';
import { User } from '../user/entities/user.entity/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Bundle, User])
  ],
  providers: [BundleService],
  exports: [BundleService]
})
export class BundleModule {}
