import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import * as os from 'os';

function getLocalIP(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const ifaces = interfaces[name];
    if (!ifaces) continue;

    for (const iface of ifaces) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');

  const isLocal = process.env.LOCAL === 'true';
  app.enableCors({
    origin: isLocal ? '*' : ['http://localhost:3000'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: false, // set to true to strip unknown properties
      forbidNonWhitelisted: false, // set to true to throw errors on unknown properties
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Transform all responses to camelCase for frontend compatibility
  app.useGlobalInterceptors(new TransformInterceptor());

  const config = new DocumentBuilder()
    .setTitle('PlanTracker API')
    .setDescription('API documentation for PlanTracker')
    .setVersion('0.1.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    })
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;

  if (isLocal) {
    await app.listen(port, '0.0.0.0');
    const localIP = getLocalIP();
    console.log(`Application is running on:`);
    console.log(`  Local:   http://localhost:${port}/api`);
    console.log(`  Network: http://${localIP}:${port}/api`);
    console.log(`Swagger docs available at: http://localhost:${port}/api/docs`);
  } else {
    // Production: bind to default host (localhost) for security
    await app.listen(port);
    console.log(`Application is running on: http://localhost:${port}/api`);
    console.log(`Swagger docs available at: http://localhost:${port}/api/docs`);
  }
}

bootstrap().catch((error) => {
  console.error('Error starting the application:', error);
  process.exit(1);
});
