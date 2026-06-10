import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const uri = config.get<string>('mongo.uri');
        return {
          uri,
          // Tự động tạo index khi schema có @Index decorator
          autoIndex: true,
          // Reconnect tự động nếu mất kết nối
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
