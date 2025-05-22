import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from '../../user/entities/user.entity/user.entity';
import { OTP } from '../../auth/entities/otp.entity/otp.entity';
import { Bundle } from '../../bundle/entities/bundle.entity/bundle.entity';
import { Connection } from '../../connection/entities/connection.entity/connection.entity';
import { Device } from '../../device/entities/device.entity/device.entity';

@Module({
    imports: [
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (config: ConfigService) => ({
                type: 'postgres',
                host: config.get('DB_HOST'),
                port: config.get<number>('DB_PORT'),
                username: config.get('DB_USERNAME'),
                password: config.get('DB_PASSWORD'),
                database: config.get('DB_NAME'),
                entities: [User, OTP, Bundle, Connection, Device],
                synchronize: true, // This will auto-create tables
                logging: config.get('NODE_ENV') === 'development',
            }),
            inject: [ConfigService],
        }),
    ],
})
export class DatabaseModule { }