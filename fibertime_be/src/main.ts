import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import { setupSwagger } from './util/config/swagger.config';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT || 5588;

  app.setGlobalPrefix('/api/');

  // Enable CORS with config
  //  app.enableCors({
  //   origin: configService.get('cors.allowedOrigins'),
  //   methods: configService.get('cors.allowedMethods'),
  //   credentials: configService.get('cors.allowCredentials'),
  // });

  app.enableCors({
    origin: process.env.FRONTEND_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  });

  /**
   ******* Applies global validation pipe with specific options: *******
    * whitelist: strips properties that do not have decorators
    * forbidNonWhitelisted: throws an error if non-whitelisted properties are present
    * transform: automatically transforms payloads to be objects typed according to their DTO classes
   */
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Setup Swagger
  setupSwagger(app);

  // Registers the WebSocket adapter to enable WebSocket-based communication
  app.useWebSocketAdapter(new WsAdapter(app));

  await app.listen(port);

  logger.log(`Application running on port: ${port}`);
}
bootstrap();