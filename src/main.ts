import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  // Debug: DEEP check Prisma Client generated files
  const prismaClientDir = path.join(
    process.cwd(),
    'node_modules',
    '.prisma',
    'client',
  );

  console.log('🔍 PRISMA CLIENT DEEP CHECK:');
  console.log('  Client dir exists:', fs.existsSync(prismaClientDir));

  // Check schema.prisma
  const prismaSchemaPath = path.join(prismaClientDir, 'schema.prisma');
  if (fs.existsSync(prismaSchemaPath)) {
    const schemaContent = fs.readFileSync(prismaSchemaPath, 'utf-8');
    const userIdMatch = schemaContent.match(
      /model project_members[\s\S]*?user_id\s+(\S+)/,
    );
    console.log(
      '  schema.prisma user_id type:',
      userIdMatch?.[1] || 'NOT FOUND',
    );
  }

  // Check index.d.ts (TypeScript types)
  const indexDtsPath = path.join(prismaClientDir, 'index.d.ts');
  if (fs.existsSync(indexDtsPath)) {
    const dtsContent = fs.readFileSync(indexDtsPath, 'utf-8');
    const userIdTypeMatch = dtsContent.match(
      /project_members[\s\S]{0,500}user_id:\s*(\S+)/,
    );
    console.log(
      '  index.d.ts user_id type:',
      userIdTypeMatch?.[1] || 'NOT FOUND',
    );
  }

  // Check all files modified time
  if (fs.existsSync(prismaClientDir)) {
    const files = fs.readdirSync(prismaClientDir);
    const stats = files.slice(0, 5).map((f) => {
      const stat = fs.statSync(path.join(prismaClientDir, f));
      return `${f}: ${stat.mtime.toISOString()}`;
    });
    console.log('  Recent files:\n   ', stats.join('\n    '));
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
