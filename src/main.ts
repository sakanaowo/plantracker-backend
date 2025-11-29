import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  // Debug: Check Prisma Client schema version
  const prismaSchemaPath = path.join(
    process.cwd(),
    'node_modules',
    '.prisma',
    'client',
    'schema.prisma',
  );
  if (fs.existsSync(prismaSchemaPath)) {
    const schemaContent = fs.readFileSync(prismaSchemaPath, 'utf-8');
    const userIdLine = schemaContent.match(
      /model project_members[\s\S]*?user_id\s+(\S+)/,
    );
    console.log(
      '🔍 PRISMA CLIENT CHECK - project_members.user_id type:',
      userIdLine?.[1] || 'NOT FOUND',
    );
  } else {
    console.log(
      '⚠️ Prisma Client schema.prisma not found at:',
      prismaSchemaPath,
    );
  }

  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');

  app.enableCors({
    origin: ['http://localhost:3000'],
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
  await app.listen(port);

  console.log(`Application is running on: http://localhost:${port}/api`);
  console.log(`Swagger docs available at: http://localhost:${port}/api/docs`);
}

bootstrap().catch((error) => {
  console.error('Error starting the application:', error);
  process.exit(1);
});
