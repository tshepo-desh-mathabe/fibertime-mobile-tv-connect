import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export function setupSwagger(app: INestApplication) {
    const configService = app.get(ConfigService);
    const isProduction = configService.get('NODE_ENV') === 'production';

    // Disable Swagger in production
    if (isProduction) {
        return;
    }

    const config = new DocumentBuilder()
        .setTitle('FiberTime API')
        .setDescription('API documentation for FiberTime services')
        .setVersion('1.0')
        .addBearerAuth()
        .build();

    const document = SwaggerModule.createDocument(app, config, {
        ignoreGlobalPrefix: false,
        deepScanRoutes: true,
    });
    SwaggerModule.setup('api/swagger-ui', app, document, {
        swaggerOptions: {
            persistAuthorization: true,
        },
    });
}